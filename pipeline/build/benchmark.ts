import zlib from "node:zlib";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { buildDataset, type BuildInput } from "./build";

/**
 * Real measurements for the three candidate architectures.
 *
 * The point is to replace the estimates with numbers, so:
 *
 *   A. one merged catalogue for every market;
 *   B. one catalogue per market, loaded only when that market is used;
 *   C. a small search index for names, with the nutrient detail kept apart.
 *
 * Every number here is produced by actually building and parsing the data, not
 * estimated. The lookup figure is the total time for twenty thousand
 * resolutions, and the memory figure is the heap held after the structure the
 * app has to parse at start-up.
 */
export interface ArchitectureReport {
  architecture: "A-merged" | "B-per-market" | "C-search-index";
  /** The bytes on disk, for the whole architecture. */
  uncompressed_bytes: number;
  /** The bytes after gzip, as a store binary would carry them. */
  compressed_bytes: number;
  /** The bytes the app has to parse at start-up. */
  startup_bytes: number;
  /** The bytes of the search index, for C. */
  search_index_bytes: number;
  /** The bytes of the nutrient detail, for C. */
  detail_bytes: number;
  /** Milliseconds to parse what the app parses at start-up. */
  startup_parse_ms: number;
  /** Milliseconds for twenty thousand lookups. */
  lookup_ms: number;
  /** Microseconds for one lookup. */
  lookup_us: number;
  /** Megabytes of heap held after the start-up parse. */
  memory_mb: number;
  records: number;
  /** The breakdown, for B. */
  per_market?: { region: string; bytes: number; compressed_bytes: number; parse_ms: number }[];
}

export interface BenchmarkReport {
  generated_from: { source_id: string; sha256: string }[];
  architectures: ArchitectureReport[];
  notes: string[];
}

interface Food {
  id: string;
  name: string;
  per100: Record<string, number>;
  region: string;
}

const bytes = (value: string) => Buffer.byteLength(value, "utf8");
const gzipped = (value: string) => zlib.gzipSync(Buffer.from(value, "utf8")).length;

/**
 * Measures the cost of loading one catalogue file, in a process of its own.
 *
 * The measurement is done in a child process because the number that matters
 * is what the application would hold: the catalogue file and nothing else.
 * Measuring it in this process would report the dataset that is already in
 * memory here, which is the same for all three architectures and says
 * nothing about them.
 */
function measureFile(file: string, records: number): { parse_ms: number; memory_mb: number; bytes: number } {
  const script = path.join(__dirname, "measure-parse.cjs");
  const output = execFileSync(process.execPath, ["--expose-gc", script, file, String(records)], {
    encoding: "utf8",
  });
  const measured = JSON.parse(output) as { parse_ms: number; heap_mb: number; bytes: number };
  return { parse_ms: measured.parse_ms, memory_mb: measured.heap_mb, bytes: measured.bytes };
}

/** Writes a payload to a temporary file, and returns its path. */
function temporaryFile(folder: string, name: string, text: string): string {
  const file = path.join(folder, name);
  fs.writeFileSync(file, text, "utf8");
  return file;
}

/** Twenty thousand resolutions through an identifier index. */
function measureLookup(index: Map<string, number>, foods: Food[], rounds = 20000): { total_ms: number; per_us: number } {
  const started = process.hrtime.bigint();
  for (let i = 0; i < rounds; i++) {
    const food = foods[index.get(foods[i % foods.length].id)!];
    void food.per100.protein;
  }
  const total_ms = Number(process.hrtime.bigint() - started) / 1e6;
  return { total_ms, per_us: (total_ms * 1000) / rounds };
}

export function runBenchmark(
  inputs: BuildInput[],
  cnfDir: string | undefined,
  root = process.cwd(),
): BenchmarkReport {
  const dataset = buildDataset(inputs, cnfDir);
  const notes: string[] = [];
  const foods = dataset.foods as unknown as Food[];
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "m2-bench-"));
  const written: string[] = [];

  // A: one merged catalogue.
  const merged = JSON.stringify({ schema_version: dataset.schema_version, foods: dataset.foods });
  const aFile = temporaryFile(folder, "a-merged.json", merged);
  written.push(aFile);
  const aParse = measureFile(aFile, dataset.foods.length);
  const aIndex = new Map(dataset.foods.map((f, at) => [f.id, at]));
  const aLookup = measureLookup(aIndex, foods);
  const a: ArchitectureReport = {
    architecture: "A-merged",
    uncompressed_bytes: bytes(merged),
    compressed_bytes: gzipped(merged),
    startup_bytes: bytes(merged),
    search_index_bytes: 0,
    detail_bytes: 0,
    startup_parse_ms: round(aParse.parse_ms),
    lookup_ms: round(aLookup.total_ms),
    lookup_us: round(aLookup.per_us, 4),
    memory_mb: round(aParse.memory_mb),
    records: dataset.foods.length,
  };

  // B: one catalogue per market, loaded only when that market is used.
  const byRegion = new Map<string, Food[]>();
  for (const food of foods) {
    const list = byRegion.get(food.region) ?? [];
    list.push(food);
    byRegion.set(food.region, list);
  }
  const bParts = [...byRegion.entries()].map(([region, part]) => ({
    region,
    foods: part,
    text: JSON.stringify({ schema_version: dataset.schema_version, foods: part }),
  }));
  const bPerMarket = bParts.map((part) => {
    const file = temporaryFile(folder, `b-${part.region}.json`, part.text);
    written.push(file);
    const parse = measureFile(file, part.foods.length);
    return {
      region: part.region,
      bytes: bytes(part.text),
      compressed_bytes: gzipped(part.text),
      parse_ms: round(parse.parse_ms),
      memory_mb: round(parse.memory_mb),
    };
  });
  // The app loads one market, so the largest one is the figure that matters.
  const largest = bParts.reduce((a, b) => (b.text.length > a.text.length ? b : a));
  const bFile = temporaryFile(folder, "b-largest.json", largest.text);
  written.push(bFile);
  const bParse = measureFile(bFile, largest.foods.length);
  const bIndex = new Map(largest.foods.map((f, at) => [f.id, at]));
  const bLookup = measureLookup(bIndex, largest.foods);
  const b: ArchitectureReport = {
    architecture: "B-per-market",
    uncompressed_bytes: bParts.reduce((sum, part) => sum + bytes(part.text), 0),
    compressed_bytes: bParts.reduce((sum, part) => sum + gzipped(part.text), 0),
    startup_bytes: bytes(largest.text),
    search_index_bytes: 0,
    detail_bytes: 0,
    startup_parse_ms: round(bParse.parse_ms),
    lookup_ms: round(bLookup.total_ms),
    lookup_us: round(bLookup.per_us, 4),
    memory_mb: round(bParse.memory_mb),
    records: dataset.foods.length,
    per_market: bPerMarket,
  };
  notes.push(
    "B's start-up figures are for the largest market, which is what the app would actually parse; the per-market breakdown is in the report.",
  );

  // C: a small search index, with the nutrient detail kept apart.
  const indexEntries = dataset.foods.map((food) => [food.id, food.name] as const);
  const indexText = JSON.stringify(Object.fromEntries(indexEntries));
  const detailText = JSON.stringify(
    Object.fromEntries(
      dataset.foods.map((food) => [
        food.id,
        { per100: food.per100, servings: food.servings, nutrients: food.nutrients },
      ]),
    ),
  );
  const cFile = temporaryFile(folder, "c-index.json", indexText);
  written.push(cFile);
  const cParse = measureFile(cFile, dataset.foods.length);
  const cIndex = new Map(indexEntries.map(([id], at) => [id, at]));
  const cLookup = measureLookup(cIndex, foods);
  const c: ArchitectureReport = {
    architecture: "C-search-index",
    uncompressed_bytes: bytes(indexText) + bytes(detailText),
    compressed_bytes: gzipped(indexText) + gzipped(detailText),
    startup_bytes: bytes(indexText),
    search_index_bytes: bytes(indexText),
    detail_bytes: bytes(detailText),
    startup_parse_ms: round(cParse.parse_ms),
    lookup_ms: round(cLookup.total_ms),
    lookup_us: round(cLookup.per_us, 4),
    memory_mb: round(cParse.memory_mb),
    records: dataset.foods.length,
  };
  notes.push(
    "C's start-up figure is the search index alone; the nutrient detail is a separate store, read only for a food the user opens.",
  );
  notes.push(
    "Each architecture was loaded in a process of its own, so the heap figure is the catalogue and nothing else.",
  );
  notes.push(
    `The shipped United States catalogue is ${bytes(fs.readFileSync(path.join(root, "src", "data", "usda-foods.json"), "utf8"))} bytes, for comparison.`,
  );
  for (const file of written) fs.rmSync(file, { force: true });
  fs.rmSync(folder, { recursive: true, force: true });

  return {
    generated_from: dataset.built_from,
    architectures: [a, b, c],
    notes,
  };
}

function round(value: number, places = 3): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}


