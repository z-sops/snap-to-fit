import fs from "node:fs";
import path from "node:path";
import { readUsda, shippedUsdaPath } from "../adapters/usda";
import { readCnf } from "../adapters/cnf";
import { lintDataset, summariseFindings } from "./lint";
import { verifyBuildInputs, type ManifestInput, type VerificationMode } from "../fetch";
import type { Finding, PipelineDataset, PipelineFood } from "../adapters/types";

/** The schema version of the normalised output. */
export const SCHEMA_VERSION = 2;

/** One pinned input, as the manifest records it. */
export interface BuildInput {
  id: string;
  kind: "repository-artefact" | "publisher-archive";
  path?: string;
  /** The publisher archive's file name, for a downloaded input. */
  archive?: string;
  url?: string;
  sha256: string;
  bytes: number;
  /** Every file inside the archive, as the manifest pins it. */
  files?: { name: string; sha256: string; bytes: number }[];
  region: "US" | "CA";
  version: string;
  licence: {
    name: string;
    commercial_use: "permitted" | "prohibited" | "unresolved";
    legal_confirmation: string;
  };
}

/**
 * How a build checks itself.
 *
 * The default is `verified`, and it is the only mode an ordinary build uses:
 * every input is compared with the manifest before anything is parsed, so a
 * changed or missing publisher file stops the build instead of quietly
 * changing the catalogue.
 *
 * `fixture` is for the checked-in slice of the Canadian release, whose bytes
 * are deliberately not the published bytes. A build in that mode records it.
 */
export interface BuildOptions {
  mode?: VerificationMode;
  /** Where each input's files are, by input id. */
  sourceDirs?: Map<string, string>;
}

/**
 * Turn a manifest input into a build input, with everything needed to verify
 * it: the file pins of the artefact, and of every file inside an archive.
 */
export function toBuildInput(input: ManifestInput, root: string): BuildInput {
  return {
    id: input.id,
    kind: input.kind,
    path: input.path ? path.join(root, input.path) : undefined,
    archive: input.archive,
    url: input.url,
    sha256: input.sha256,
    bytes: input.bytes,
    files: input.files,
    region: input.region,
    version: input.version,
    licence: {
      name: input.licence.name,
      commercial_use: input.licence.commercial_use,
      legal_confirmation: input.licence.legal_confirmation,
    },
  };
}

/**
 * Build the normalised dataset.
 *
 * The order is deterministic: records are sorted by identifier, and the
 * findings are sorted too, so two builds of the same bytes produce the same
 * file. Nothing here depends on the clock, on the file system order, or on
 * which source was read first.
 */
export function buildDataset(
  inputs: BuildInput[],
  cnfDir?: string,
  options: BuildOptions = {},
): PipelineDataset {
  const mode: VerificationMode = options.mode ?? "verified";
  const sourceDirs = new Map(options.sourceDirs ?? []);
  if (cnfDir) {
    for (const input of inputs)
      if (input.kind === "publisher-archive" && !sourceDirs.has(input.id)) sourceDirs.set(input.id, cnfDir);
  }

  // Nothing is parsed until every input has been checked against the
  // manifest. A changed or missing publisher file stops the build here.
  verifyBuildInputs(inputs, sourceDirs, mode);

  const foods: PipelineFood[] = [];
  const findings: Finding[] = [];

  for (const input of inputs) {
    // Fail closed: a source whose commercial use is not permitted never
    // reaches the build.
    if (input.licence.commercial_use !== "permitted") {
      throw new Error(
        `refusing to build from ${input.id}: its commercial use is ${input.licence.commercial_use}`,
      );
    }
    if (input.region === "US") {
      const usda = readUsda({ file: input.path!, version: input.version });
      foods.push(...usda.foods);
      findings.push(...usda.findings);
    } else {
      if (!cnfDir) throw new Error(`no folder given for ${input.id}`);
      const cnf = readCnf({ dir: cnfDir, version: input.version });
      foods.push(...cnf.foods);
      findings.push(...cnf.findings);
    }
  }

  foods.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const all = lintDataset(foods, findings);
  all.sort((a, b) =>
    a.id === b.id
      ? (a.nutrient ?? "").localeCompare(b.nutrient ?? "")
      : a.id.localeCompare(b.id),
  );

  return {
    schema_version: SCHEMA_VERSION,
    verification: mode,
    built_from: inputs
      .map((input) => ({ source_id: input.id, sha256: input.sha256 }))
      .sort((a, b) => a.source_id.localeCompare(b.source_id)),
    foods,
    findings: all,
  };
}

/** The bytes of the dataset, for writing or for comparing. */
export function serialise(dataset: PipelineDataset): string {
  return JSON.stringify(dataset);
}

/** Write the dataset and its manifest. */
export function writeBuild(
  dataset: PipelineDataset,
  inputs: BuildInput[],
  outDir: string,
): { dataset: string; manifest: string } {
  fs.mkdirSync(outDir, { recursive: true });
  const datasetFile = path.join(outDir, `foods.v${dataset.schema_version}.json`);
  fs.writeFileSync(datasetFile, serialise(dataset));
  const manifestFile = path.join(outDir, "manifest.json");
  const manifest = {
    schema_version: dataset.schema_version,
    generated_by: "pipeline/build/build.ts",
    sources: inputs
      .map((input) => ({
        id: input.id,
        region: input.region,
        version: input.version,
        sha256: input.sha256,
        bytes: input.bytes,
        licence: input.licence,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    records: dataset.foods.length,
    findings: summariseFindings(dataset.findings),
  };
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
  return { dataset: datasetFile, manifest: manifestFile };
}

export { shippedUsdaPath };
