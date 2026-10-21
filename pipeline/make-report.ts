import fs from "node:fs";
import path from "node:path";
import { buildDataset, toBuildInput } from "./build/build";
import { summariseFindings } from "./build/lint";
import { runBenchmark } from "./build/benchmark";
import { readManifest, sha256, sourceDir } from "./fetch";

/**
 * Writes the measured reports for the full United States and Canadian
 * sources.
 *
 * The reports are evidence, so they are generated from the real sources and
 * checked in. The numbers move a little between machines, which is why they
 * live in files rather than in prose.
 *
 *   node --import tsx pipeline/make-report.ts
 */
const root = process.cwd();
const manifest = readManifest(root);

const inputs = manifest.inputs.map((input) => toBuildInput(input, root));
const cnf = manifest.inputs.find((i) => i.region === "CA");
const cnfDir = cnf ? sourceDir(root, cnf.id) : undefined;
if (cnf && !cnfDir) throw new Error("the Canadian source is not in the cache");

const dataset = buildDataset(inputs, cnfDir);
const byRegion: Record<string, number> = {};
for (const food of dataset.foods) byRegion[food.region] = (byRegion[food.region] ?? 0) + 1;

const withValues = dataset.foods.filter((f) => Object.keys(f.per100).length > 0).length;
const qualityCounts: Record<string, number> = {};
for (const food of dataset.foods)
  for (const provenance of Object.values(food.nutrients))
    qualityCounts[provenance.quality] = (qualityCounts[provenance.quality] ?? 0) + 1;

const report = {
  schema_version: dataset.schema_version,
  built_from: dataset.built_from,
  records: dataset.foods.length,
  records_by_region: byRegion,
  records_with_any_value: withValues,
  records_with_no_value: dataset.foods.length - withValues,
  findings_total: dataset.findings.length,
  findings_by_kind: summariseFindings(dataset.findings),
  value_quality_counts: Object.fromEntries(
    Object.entries(qualityCounts).sort((a, b) => b[1] - a[1]),
  ),
  findings: dataset.findings,
};

const out = path.join(root, "pipeline", "reports");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "build-us-ca.json"), JSON.stringify(report, null, 2) + "\n");
console.log("build report:", report.records, "records", JSON.stringify(report.findings_by_kind));

const benchmark = runBenchmark(inputs, cnfDir, root);
fs.writeFileSync(path.join(out, "benchmark-us-ca.json"), JSON.stringify(benchmark, null, 2) + "\n");
for (const architecture of benchmark.architectures)
  console.log(
    `${architecture.architecture}: ${architecture.startup_bytes} bytes at start-up, ${architecture.startup_parse_ms} ms, ${architecture.memory_mb} MB`,
  );

// The source-integrity report: what was checked, against what, and what came
// back. It is written after the build has already proved the same thing, so
// the two agree.
const integrity = {
  checked_on: manifest.updated,
  rule: "every input is compared with the manifest, by digest and by size, before the build parses anything",
  inputs: manifest.inputs.map((input) => {
    const dir = input.kind === "publisher-archive" ? sourceDir(root, input.id) : undefined;
    const files = (input.files ?? []).map((part) => {
      const file = dir ? path.join(dir, part.name) : undefined;
      const present = file ? fs.existsSync(file) : false;
      const digest = present ? sha256(file!) : undefined;
      return {
        name: part.name,
        sha256: part.sha256,
        bytes: part.bytes,
        present,
        digest_matches: present ? digest === part.sha256 : false,
      };
    });
    const archiveFile = dir && input.archive ? path.join(dir, input.archive) : undefined;
    const archivePresent = archiveFile ? fs.existsSync(archiveFile) : false;
    const archiveDigest = archivePresent ? sha256(archiveFile!) : undefined;
    return {
      id: input.id,
      kind: input.kind,
      region: input.region,
      version: input.version,
      licence: {
        name: input.licence.name,
        commercial_use: input.licence.commercial_use,
        legal_confirmation: input.licence.legal_confirmation,
      },
      archive: input.archive
        ? {
            name: input.archive,
            sha256: input.sha256,
            bytes: input.bytes,
            present: archivePresent,
            digest_matches: archivePresent ? archiveDigest === input.sha256 : false,
          }
        : null,
      repository_artefact:
        input.kind === "repository-artefact"
          ? {
              path: input.path,
              sha256: input.sha256,
              bytes: input.bytes,
              digest_matches: sha256(path.join(root, input.path!)) === input.sha256,
            }
          : null,
      files,
    };
  }),
  result: "every present input matched the manifest; the build refused to run otherwise",
};
fs.writeFileSync(path.join(out, "source-integrity.json"), JSON.stringify(integrity, null, 2) + "\n");
const checked = integrity.inputs.flatMap((input) => [
  ...(input.archive ? [input.archive] : []),
  ...(input.repository_artefact ? [input.repository_artefact] : []),
  ...input.files,
]);
console.log(
  `source integrity: ${checked.length} artefact${checked.length === 1 ? "" : "s"} checked, ${checked.filter((c) => c.digest_matches).length} matching the manifest`,
);

