import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { aliasRegistry } from "../../../src/core/ingredient-aliases";
import { popular, recipes } from "../../../src/core/foods";
import { assetsDir } from "./build-assets";
import { failureScenarios, type Architecture } from "./run-one";

/**
 * The benchmark harness.
 *
 * It measures the two architectures on the same data, with the same runtime
 * code, and it records what it measured. **Each architecture is measured in
 * a process of its own**, so one architecture's memory is never counted in
 * the other's.
 *
 * The numbers are **Node.js figures on a desktop machine**: they compare the
 * two architectures, and they are not a statement about a phone.
 *
 *   node --import tsx research/m2-3a/bench/run.ts
 */
const root = process.cwd();

/** The asset sizes, which are what a build would carry. */
function assetSizes(): { name: string; bytes: number }[] {
  const folder = assetsDir();
  return fs
    .readdirSync(folder)
    .filter((name) => /\.(json|pack)$/.test(name) && !name.includes("."))
    .sort()
    .map((name) => ({ name, bytes: fs.statSync(path.join(folder, name)).size }));
}

/** Run one architecture in its own process, and read what it measured. */
function measure(architecture: Architecture): Record<string, unknown> {
  const script = path.join(root, "research", "m2-3a", "bench", "run-one.ts");
  const output = execFileSync(
    process.execPath,
    ["--expose-gc", "--import", "tsx", script, architecture],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(output) as Record<string, unknown>;
}

async function main() {
  const report = {
    generated_by: "research/m2-3a/bench/run.ts",
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    host: {
      cpus: os.cpus().length,
      model: os.cpus()[0]?.model?.trim(),
      total_memory_gb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    },
    note:
      "These are Node.js figures on a desktop machine, measured in a separate process per architecture. They compare the two architectures on the same data and the same runtime code. They are not a statement about a phone, and no architecture is selected here.",
    asset_sizes: assetSizes(),
    architectures: [] as Record<string, unknown>[],
    failures: await failureScenarios(),
    compatibility: {
      popular_foods: popular.length,
      recipes: recipes.length,
      alias_entries: aliasRegistry().ingredients.length,
    },
  };
  for (const architecture of ["B-bundle", "C-split"] as Architecture[])
    report.architectures.push(measure(architecture));

  const out = path.join(root, "research", "m2-3a", "reports", "node-b-vs-c.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nwrote ${out}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
