import fs from "node:fs";
import path from "node:path";
import { mayUse, readManifest, sha256, sourceDir, verifyBuildInputs, verifyFile, verifyInputs, type ManifestInput, type SourceManifest } from "./fetch";
import { buildDataset, toBuildInput, writeBuild } from "./build/build";
import { summariseFindings } from "./build/lint";
import { runBenchmark } from "./build/benchmark";

/**
 * The pipeline's command line.
 *
 * `verify`   checks the pinned inputs; it never downloads anything.
 * `fetch`    downloads one publisher archive, on request only, and only if a
 *            checksum is pinned and the commercial use is permitted.
 * `build`    builds the normalised dataset from the cached sources, after
 *            checking every one of them against the manifest.
 * `bench`    measures the three candidate architectures.
 *
 * Nothing here runs in CI, and nothing here writes to `src/`.
 */
const root = process.cwd();

/** Where each input's files are, by input id. */
function sourceDirs(manifest: SourceManifest): Map<string, string> {
  const dirs = new Map<string, string>();
  for (const input of manifest.inputs)
    if (input.kind === "publisher-archive") dirs.set(input.id, sourceDir(root, input.id));
  return dirs;
}

async function main() {
  const [command, argument] = process.argv.slice(2);
  const manifest = readManifest(root);

  if (command === "verify") {
    const results = verifyInputs(manifest, root);
    for (const result of results)
      console.log(`${result.status.padEnd(11)} ${result.id} (${result.kind})${result.detail ? ` — ${result.detail}` : ""}`);
    const failed = results.filter((r) => r.status === "failed");
    if (failed.length) process.exitCode = 1;
    return;
  }

  if (command === "fetch") {
    const input = manifest.inputs.find((i) => i.id === argument);
    if (!input) throw new Error(`no input named ${argument}`);
    if (input.kind !== "publisher-archive") throw new Error(`${input.id} is not downloaded`);
    const allowed = mayUse(input);
    if (!allowed.ok) throw new Error(allowed.reason);
    if (!input.url) throw new Error(`${input.id} has no download URL`);
    if (!input.sha256) throw new Error(`${input.id} has no pinned checksum, so it is not downloaded`);
    const folder = sourceDir(root, input.id);
    fs.mkdirSync(folder, { recursive: true });
    const target = path.join(folder, input.archive!);
    console.log(`downloading ${input.id} from ${input.url}`);
    const response = await fetch(input.url);
    if (!response.ok) throw new Error(`the download failed with ${response.status}`);
    fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()));
    const check = verifyFile(target, input);
    if (!check.ok) {
      fs.unlinkSync(target);
      throw new Error(`the download was refused: ${check.reason}`);
    }
    console.log(`verified ${input.id} (${sha256(target)})`);
    // Unpack beside the archive, so the adapter reads the published files.
    const { execFileSync } = await import("node:child_process");
    try {
      execFileSync("tar", ["-xf", target, "-C", folder], { stdio: "inherit" });
    } catch {
      throw new Error(
        "the archive was fetched and verified, but it could not be unpacked; unpack it by hand into the same folder",
      );
    }
    // The cache is only accepted once every published file inside it has been
    // checked against the manifest. An unpacked file that does not match is a
    // broken cache, and a build must not be able to read it.
    for (const part of input.files ?? []) {
      const file = path.join(folder, part.name);
      const partCheck = verifyFile(file, part);
      if (!partCheck.ok) {
        fs.rmSync(folder, { recursive: true, force: true });
        throw new Error(
          `the unpacked file ${part.name} does not match the manifest: ${partCheck.reason}; the cache was discarded`,
        );
      }
    }
    console.log(`unpacked and verified ${input.id} into ${folder}`);
    return;
  }

  if (command === "build") {
    const inputs = manifest.inputs.map((input) => toBuildInput(input, root));
    const cnf = manifest.inputs.find((i) => i.region === "CA");
    const cnfDir = cnf ? sourceDir(root, cnf.id) : undefined;
    if (cnf && cnfDir && !fs.existsSync(cnfDir))
      throw new Error(`the Canadian source is not in the cache; run "fetch ${cnf.id}" first`);
    // Every input is checked against the manifest before anything is parsed.
    const verified = verifyBuildInputs(inputs, sourceDirs(manifest), "verified");
    for (const input of verified)
      console.log(`verified    ${input.id} (${input.checked.length} file${input.checked.length === 1 ? "" : "s"})`);
    const dataset = buildDataset(inputs, cnfDir, {
      mode: "verified",
      sourceDirs: sourceDirs(manifest),
    });
    const out = writeBuild(dataset, inputs, path.join(root, "pipeline", "out"));
    console.log(`wrote ${out.dataset}`);
    console.log(`wrote ${out.manifest}`);
    console.log(`records: ${dataset.foods.length}`);
    console.log(`findings: ${JSON.stringify(summariseFindings(dataset.findings))}`);
    return;
  }

  if (command === "bench") {
    const manifestInputs = manifest.inputs.map((input) => toBuildInput(input, root));
    const cnf = manifest.inputs.find((i) => i.region === "CA");
    const cnfDir = cnf ? sourceDir(root, cnf.id) : undefined;
    if (cnf && cnfDir && !fs.existsSync(cnfDir))
      throw new Error(`the Canadian source is not in the cache; run "fetch ${cnf.id}" first`);
    const report = runBenchmark(manifestInputs, cnfDir, root);
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  throw new Error("use one of: verify, fetch <id>, build, bench");
}

main().catch((error) => {
  console.error(String(error instanceof Error ? error.message : error));
  process.exitCode = 1;
});

