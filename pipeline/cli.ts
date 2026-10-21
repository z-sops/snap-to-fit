import fs from "node:fs";
import path from "node:path";
import { mayUse, readManifest, sha256, sourceDir, verifyFile, verifyInputs, type ManifestInput } from "./fetch";
import { buildDataset, writeBuild, type BuildInput } from "./build/build";
import { summariseFindings } from "./build/lint";
import { runBenchmark } from "./build/benchmark";

/**
 * The pipeline's command line.
 *
 * `verify`   checks the pinned inputs; it never downloads anything.
 * `fetch`    downloads one publisher archive, on request only, and only if a
 *            checksum is pinned and the commercial use is permitted.
 * `build`    builds the normalised dataset from the cached sources.
 * `bench`    measures the three candidate architectures.
 *
 * Nothing here runs in CI, and nothing here writes to `src/`.
 */
const root = process.cwd();

function toBuildInput(input: ManifestInput): BuildInput {
  return {
    id: input.id,
    kind: input.kind,
    path: input.path ? path.join(root, input.path) : undefined,
    url: input.url,
    sha256: input.sha256,
    bytes: input.bytes,
    region: input.region,
    version: input.version,
    licence: {
      name: input.licence.name,
      commercial_use: input.licence.commercial_use,
      legal_confirmation: input.licence.legal_confirmation,
    },
  };
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
    console.log(`unpacked ${input.id} into ${folder}`);
    return;
  }

  if (command === "build") {
    const inputs = manifest.inputs.map(toBuildInput);
    const cnf = manifest.inputs.find((i) => i.region === "CA");
    const cnfDir = cnf ? sourceDir(root, cnf.id) : undefined;
    if (cnf && cnfDir && !fs.existsSync(cnfDir))
      throw new Error(`the Canadian source is not in the cache; run "fetch ${cnf.id}" first`);
    const dataset = buildDataset(inputs, cnfDir);
    const out = writeBuild(dataset, inputs, path.join(root, "pipeline", "out"));
    console.log(`wrote ${out.dataset}`);
    console.log(`wrote ${out.manifest}`);
    console.log(`records: ${dataset.foods.length}`);
    console.log(`findings: ${JSON.stringify(summariseFindings(dataset.findings))}`);
    return;
  }

  if (command === "bench") {
    const manifestInputs = manifest.inputs.map(toBuildInput);
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

