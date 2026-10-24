import fs from "node:fs";
import path from "node:path";
import { aliasRegistry } from "../../../src/core/ingredient-aliases";
import { popular, recipes } from "../../../src/core/foods";
import { BundleStore, CatalogueRuntime, SplitStore } from "../runtime/catalogue";
import type { Market } from "../runtime/types";
import { assetsDir } from "./build-assets";
import { memory, nodeReader, peakRssMb } from "./node-reader";

/**
 * One architecture, in one process.
 *
 * Each architecture is measured in a process of its own, because the memory
 * of one would otherwise be counted in the next.
 *
 *   node --import tsx research/m2-3a/bench/run-one.ts B-bundle
 */
export type Architecture = "B-bundle" | "C-split";

/** The detail cache the prototype is given. */
export const CACHE_BUDGET_BYTES = 8 * 1024 * 1024;

const timing = async <T>(work: () => Promise<T> | T): Promise<{ ms: number; value: T }> => {
  const started = process.hrtime.bigint();
  const value = await work();
  return { ms: Number(process.hrtime.bigint() - started) / 1e6, value };
};

const round = (value: number, places = 3) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

/** The recipe ingredient keys the app uses today. */
export function recipeKeys(): string[] {
  const registry = aliasRegistry();
  const byId = new Map(registry.ingredients.map((entry) => [entry.ids.US, entry.key]));
  const keys = new Set<string>();
  for (const recipe of recipes) for (const [id] of recipe.parts) {
    const key = byId.get(`usda:${id}`);
    if (key) keys.add(key);
  }
  return [...keys].sort();
}

/** The popular foods' keys, the other thing the app resolves by number. */
export function popularKeys(): string[] {
  const registry = aliasRegistry();
  const byId = new Map(registry.ingredients.map((entry) => [entry.ids.US, entry.key]));
  const keys = new Set<string>();
  for (const entry of popular) {
    const key = byId.get(`usda:${entry.id}`);
    if (key) keys.add(key);
  }
  return [...keys].sort();
}

/** A store for one market, in the shape the architecture uses. */
export function makeStore(architecture: Architecture, market: Market, reader: ReturnType<typeof nodeReader>) {
  const lower = market.toLowerCase();
  return architecture === "B-bundle"
    ? new BundleStore(market, market === "US" ? "usda" : "cnf", reader, `bundle-${lower}.json`)
    : new SplitStore(
        market,
        market === "US" ? "usda" : "cnf",
        reader,
        `index-${lower}.json`,
        `detail-${lower}.header.json`,
        `detail-${lower}.pack`,
      );
}

/** Measure one architecture. */
export async function runArchitecture(architecture: Architecture): Promise<Record<string, unknown>> {
  const folder = assetsDir();
  const reader = nodeReader(folder);
  const stores = new Map<Market, ReturnType<typeof makeStore>>();
  for (const market of ["US", "CA"] as const) stores.set(market, makeStore(architecture, market, reader));
  const runtime = new CatalogueRuntime(stores, aliasRegistry(), CACHE_BUDGET_BYTES);

  const measurements: Record<string, unknown> = {};
  const before = memory();

  const openUs = await timing(() => runtime.open("US"));
  measurements.open_us_ms = round(openUs.ms);
  measurements.open_us_records = openUs.value.records;
  measurements.open_us_ok = openUs.value.ok;
  const openCa = await timing(() => runtime.open("CA"));
  measurements.open_ca_ms = round(openCa.ms);
  measurements.open_ca_records = openCa.value.records;
  measurements.open_ca_ok = openCa.value.ok;

  // The Canadian scenario: both markets open, because a Canadian user may
  // need the United States records too.
  const both = await timing(async () => {
    const fresh = new CatalogueRuntime(stores, aliasRegistry(), CACHE_BUDGET_BYTES);
    await fresh.open("US");
    await fresh.open("CA");
    return fresh;
  });
  measurements.open_both_markets_ms = round(both.ms);

  const cold = await timing(() => runtime.search("chicken", "CA", 20));
  measurements.search_cold_ms = round(cold.ms);
  measurements.search_cold_results = cold.value.length;
  measurements.search_cold_cross_market = cold.value.filter((r) => r.cross_market).length;

  // A search the Canadian catalogue has little answer for, so the United
  // States fallback is what the user sees.
  const fallbackQuery = "waffle";
  const fallback = await timing(() => runtime.search(fallbackQuery, "CA", 20));
  measurements.fallback_query = fallbackQuery;
  measurements.fallback_results = fallback.value.length;
  measurements.fallback_cross_market = fallback.value.filter((r) => r.cross_market).length;
  measurements.fallback_labelled = fallback.value.every(
    (r) => r.source_market === (r.cross_market ? "US" : "CA"),
  );

  const warm = await timing(() => runtime.search("chicken", "CA", 20));
  measurements.search_warm_ms = round(warm.ms);

  const firstId = cold.value[0]?.id;
  if (firstId) {
    const detailCold = await timing(() => runtime.detail(firstId));
    measurements.detail_cold_ms = round(detailCold.ms);
    const detailWarm = await timing(() => runtime.detail(firstId));
    measurements.detail_warm_ms = round(detailWarm.ms);
  }

  // The existing United States recipes, resolved through the alias registry.
  const keys = recipeKeys();
  const resolution = await timing(() => runtime.ingredients(keys, "US"));
  measurements.recipe_keys = keys.length;
  measurements.recipe_resolution_ms = round(resolution.ms);
  measurements.recipe_resolved = resolution.value.filter((r) => r.outcome === "resolved").length;
  measurements.recipe_fallbacks = resolution.value.filter((r) => r.outcome === "fallback").length;
  measurements.recipe_unavailable = resolution.value.filter((r) => r.outcome === "unavailable").length;
  measurements.popular_keys = popularKeys().length;

  const searches = 100;
  const repeated = await timing(async () => {
    for (let i = 0; i < searches; i++) await runtime.search(i % 2 ? "rice" : "chicken", "CA", 20);
  });
  measurements.repeated_searches = searches;
  measurements.repeated_search_mean_ms = round(repeated.ms / searches);

  const switches = 10;
  const switching = await timing(async () => {
    for (let i = 0; i < switches; i++) await runtime.search("chicken", i % 2 ? "US" : "CA", 20);
  });
  measurements.market_switches = switches;
  measurements.market_switch_mean_ms = round(switching.ms / switches);

  // The cache: more details than the budget holds.
  const eviction = await timing(async () => {
    for (const entry of aliasRegistry().ingredients) await runtime.detail(entry.ids.US);
  });
  measurements.cache_eviction_pass_ms = round(eviction.ms);
  measurements.cache_entries = runtime.cache.size;
  measurements.cache_bytes = runtime.cache.bytes;
  measurements.cache_budget_bytes = CACHE_BUDGET_BYTES;
  measurements.cache_hit_rate = round(
    runtime.stats().detailsFromCache / Math.max(1, runtime.stats().detailsRequested),
  );
  measurements.cache_evicted = runtime.stats().evictions;

  const peak = peakRssMb();
  // The retained figure is what is still held once the garbage has been
  // collected, so it is the memory the app would keep.
  global.gc?.();
  const retained = memory();
  runtime.clearCache();
  global.gc?.();
  const cleared = memory();

  return {
    architecture,
    measurements,
    memory: {
      before,
      retained_after_workload: retained,
      after_cache_cleared: cleared,
      peak_rss_mb: peak,
      // The app already holds its own shipped catalogue, so what an
      // architecture costs is the **difference** from that starting point.
      retained_delta_mb: round(retained.heap_used_mb - before.heap_used_mb),
      peak_delta_rss_mb: round(peak - before.rss_mb),
    },
  };
}

/** What happens when the asset is not there, and when it is broken. */
export async function failureScenarios(): Promise<Record<string, unknown>> {
  const folder = assetsDir();
  const broken = path.join(folder, "broken");
  const empty = path.join(folder, "empty");
  fs.mkdirSync(broken, { recursive: true });
  fs.mkdirSync(empty, { recursive: true });
  fs.writeFileSync(path.join(broken, "index-us.json"), "{ this is not json");
  fs.writeFileSync(path.join(broken, "detail-us.header.json"), "{ neither is this");
  fs.writeFileSync(path.join(broken, "detail-us.pack"), "not a pack file");

  const missingStore = new SplitStore(
    "US",
    "usda",
    nodeReader(empty),
    "index-us.json",
    "detail-us.header.json",
    "detail-us.pack",
  );
  const missingRuntime = new CatalogueRuntime(
    new Map([["US", missingStore]]),
    aliasRegistry(),
    CACHE_BUDGET_BYTES,
  );
  const missing = await missingRuntime.open("US");

  const corruptStore = new SplitStore(
    "US",
    "usda",
    nodeReader(broken),
    "index-us.json",
    "detail-us.header.json",
    "detail-us.pack",
  );
  const corruptRuntime = new CatalogueRuntime(
    new Map([["US", corruptStore]]),
    aliasRegistry(),
    CACHE_BUDGET_BYTES,
  );
  const corrupt = await corruptRuntime.open("US");
  const noMarket = await corruptRuntime.open("CA");

  return {
    missing_asset: { ok: missing.ok, reason: missing.reason },
    corrupt_asset: { ok: corrupt.ok, reason: corrupt.reason },
    no_such_market: { ok: noMarket.ok, reason: noMarket.reason },
  };
}

async function main() {
  const architecture = process.argv[2] as Architecture | undefined;
  if (!architecture) return;
  const report = await runArchitecture(architecture);
  process.stdout.write(JSON.stringify(report));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
