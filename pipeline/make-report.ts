import fs from "node:fs";
import path from "node:path";
import { buildDataset } from "./build/build";
import { summariseFindings } from "./build/lint";
import { runBenchmark } from "./build/benchmark";
import { readManifest, sourceDir, type ManifestInput } from "./fetch";
import type { BuildInput } from "./build/build";

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

const inputs = manifest.inputs.map(toBuildInput);
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
