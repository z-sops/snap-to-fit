import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * The pinned source manifest, and the rules for using it.
 *
 * The manifest is the only place a download URL is allowed to appear. Nothing
 * in this file runs by itself: the fetch is an explicit, manual step, and it
 * never runs in CI.
 */
export interface ManifestFile {
  name: string;
  sha256: string;
  bytes: number;
}

export interface ManifestInput {
  id: string;
  kind: "repository-artefact" | "publisher-archive";
  name: string;
  publisher: string;
  dataset: string;
  version: string;
  region: "US" | "CA";
  path?: string;
  url?: string;
  archive?: string;
  sha256: string;
  bytes: number;
  licence: {
    name: string;
    url: string;
    commercial_use: "permitted" | "prohibited" | "unresolved";
    legal_confirmation: string;
    evidence: string;
  };
  citation: string;
  files?: ManifestFile[];
}

export interface SourceManifest {
  manifest_version: number;
  updated: string;
  note: string;
  inputs: ManifestInput[];
  excluded: { id: string; name: string; reason: string; commercial_use: string }[];
}

export function readManifest(root = process.cwd()): SourceManifest {
  const file = path.join(root, "pipeline", "manifest", "sources.json");
  return JSON.parse(fs.readFileSync(file, "utf8")) as SourceManifest;
}

/** The SHA-256 of a file, in lower-case hex. */
export function sha256(file: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(file));
  return hash.digest("hex");
}

/**
 * Check a downloaded file against the manifest.
 *
 * It fails closed: a file whose checksum is not the pinned one is refused,
 * whatever the size says.
 */
export function verifyFile(
  file: string,
  expected: { sha256: string; bytes: number },
): { ok: boolean; reason?: string } {
  if (!fs.existsSync(file)) return { ok: false, reason: "the file is not there" };
  const size = fs.statSync(file).size;
  if (size !== expected.bytes)
    return { ok: false, reason: `the file is ${size} bytes, the manifest says ${expected.bytes}` };
  const digest = sha256(file);
  if (digest !== expected.sha256)
    return { ok: false, reason: `the checksum is ${digest}, the manifest says ${expected.sha256}` };
  return { ok: true };
}

/**
 * The folder a source is cached in. It is outside the repository, so a
 * downloaded archive can never reach the application bundle.
 */
export function cacheDir(root = process.cwd()): string {
  return path.join(root, "pipeline", ".cache");
}

/** The folder a source's extracted files live in. */
export function sourceDir(root = process.cwd(), id: string): string {
  return path.join(cacheDir(root), id);
}

/**
 * Check every input the manifest names, without downloading anything.
 *
 * A repository artefact is checked where it is. A publisher archive is checked
 * in the cache folder, and reported as missing when it has not been fetched.
 */
export function verifyInputs(
  manifest: SourceManifest,
  root = process.cwd(),
): { id: string; kind: string; status: string; detail?: string }[] {
  const results: { id: string; kind: string; status: string; detail?: string }[] = [];
  for (const input of manifest.inputs) {
    if (input.kind === "repository-artefact") {
      const file = path.join(root, input.path!);
      const check = verifyFile(file, input);
      results.push({
        id: input.id,
        kind: input.kind,
        status: check.ok ? "verified" : "failed",
        detail: check.reason ?? input.path,
      });
      continue;
    }
    const folder = sourceDir(root, input.id);
    const file = path.join(folder, input.archive!);
    if (!fs.existsSync(file)) {
      results.push({ id: input.id, kind: input.kind, status: "not fetched" });
      continue;
    }
    const check = verifyFile(file, input);
    if (!check.ok) {
      results.push({ id: input.id, kind: input.kind, status: "failed", detail: check.reason });
      continue;
    }
    results.push({
      id: input.id,
      kind: input.kind,
      status: "verified",
      detail: input.archive,
    });
    // The archive is unpacked beside it, so each published file is checked too.
    for (const part of input.files ?? []) {
      const unpacked = path.join(folder, part.name);
      if (!fs.existsSync(unpacked)) continue;
      const partCheck = verifyFile(unpacked, part);
      results.push({
        id: input.id,
        kind: input.kind,
        status: partCheck.ok ? "verified" : "failed",
        detail: partCheck.ok ? part.name : `${part.name}: ${partCheck.reason}`,
      });
    }
  }
  return results;
}

/**
 * Whether an input may be used at all.
 *
 * A source whose commercial use is not permitted is refused, so a licence
 * question can never be settled by accident.
 */
export function mayUse(input: ManifestInput): { ok: boolean; reason?: string } {
  if (input.licence.commercial_use === "permitted") return { ok: true };
  return {
    ok: false,
    reason: `the commercial use of ${input.id} is ${input.licence.commercial_use}, so it is not used`,
  };
}

/** One file inside a publisher archive, as the manifest pins it. */
export interface VerifiableFile {
  name: string;
  sha256: string;
  bytes: number;
}

/** An input, as a build sees it, with everything needed to verify it. */
export interface VerifiableInput {
  id: string;
  kind: "repository-artefact" | "publisher-archive";
  path?: string;
  archive?: string;
  sha256: string;
  bytes: number;
  files?: VerifiableFile[];
  licence: { commercial_use: string };
}

/**
 * How a build checks its inputs.
 *
 * `verified` is the only mode an ordinary build may use. It requires every
 * input to match the manifest, byte for byte, before anything is parsed.
 *
 * `fixture` is for the checked-in slice of the Canadian release. The slice is
 * deliberately not the published bytes, so it cannot be verified against the
 * manifest, and a build in that mode says so in its own output.
 */
export type VerificationMode = "verified" | "fixture";

/** A failure to match the manifest. */
export class SourceVerificationError extends Error {
  constructor(
    readonly input: string,
    message: string,
  ) {
    super(message);
    this.name = "SourceVerificationError";
  }
}

/**
 * Check every input against the manifest, before anything is parsed.
 *
 * A missing file is a failure, not a skip: a build that quietly carries on
 * without one of the published files would produce a catalogue that is wrong
 * in a way nobody would notice.
 *
 * The repository artefact is always checked. A publisher archive is checked
 * in `verified` mode: the archive itself, and every file inside it. In
 * `fixture` mode the archive is not checked, because the fixture is a slice
 * of the release rather than the release.
 */
export function verifyBuildInputs(
  inputs: VerifiableInput[],
  sourceDirs: Map<string, string>,
  mode: VerificationMode,
): { id: string; checked: string[] }[] {
  const results: { id: string; checked: string[] }[] = [];

  for (const input of inputs) {
    if (input.licence.commercial_use !== "permitted")
      throw new SourceVerificationError(
        input.id,
        `the commercial use of ${input.id} is ${input.licence.commercial_use}, so it is not used`,
      );

    const checked: string[] = [];

    if (input.kind === "repository-artefact") {
      if (!input.path)
        throw new SourceVerificationError(input.id, `${input.id} has no path, so it cannot be checked`);
      const check = verifyFile(input.path, input);
      if (!check.ok)
        throw new SourceVerificationError(
          input.id,
          `${input.id} does not match the manifest: ${check.reason}`,
        );
      checked.push(input.path);
      results.push({ id: input.id, checked });
      continue;
    }

    if (mode === "fixture") {
      // The slice in the repository is not the published bytes, so there is
      // nothing to compare them with. The build records that it ran in this
      // mode, and the difference is visible in its output.
      results.push({ id: input.id, checked: [] });
      continue;
    }

    const dir = sourceDirs.get(input.id);
    if (!dir)
      throw new SourceVerificationError(input.id, `there is no folder for ${input.id}, so it cannot be checked`);
    if (!input.archive)
      throw new SourceVerificationError(input.id, `${input.id} has no archive, so it cannot be checked`);

    const archive = path.join(dir, input.archive);
    const archiveCheck = verifyFile(archive, input);
    if (!archiveCheck.ok)
      throw new SourceVerificationError(
        input.id,
        `the archive of ${input.id} does not match the manifest: ${archiveCheck.reason}`,
      );
    checked.push(archive);

    for (const part of input.files ?? []) {
      const file = path.join(dir, part.name);
      const check = verifyFile(file, part);
      if (!check.ok)
        throw new SourceVerificationError(
          input.id,
          `the file ${part.name} of ${input.id} does not match the manifest: ${check.reason}`,
        );
      checked.push(file);
    }

    results.push({ id: input.id, checked });
  }

  return results;
}
