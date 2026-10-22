import React, { useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { BundleStore, CatalogueRuntime, SplitStore } from "../../runtime/catalogue";
import { aliasRegistry } from "../../../../src/core/ingredient-aliases";
import { popular, recipes } from "../../../../src/core/foods";
import { Instrument, deviceDescription, type DeviceReport } from "../instrumentation";
import { expoReader } from "../expo-reader";

/**
 * The device benchmark screen.
 *
 * It runs the **same runtime code** the Node harness measures, against the
 * catalogue that has been pushed onto the device, and it reports what it
 * measured. The report is printed as one line of JSON, so it can be read
 * from the device log, and it is shown on the screen.
 *
 * The assets are not bundled: they are pushed onto the device and read from
 * the app's own document directory.
 */
const CACHE_BUDGET_BYTES = 8 * 1024 * 1024;

type Architecture = "B-bundle" | "C-split";

/** The recipe ingredient keys, the same set the Node harness uses. */
function recipeKeys(): string[] {
  const registry = aliasRegistry();
  const byId = new Map(registry.ingredients.map((entry) => [entry.ids.US, entry.key]));
  const keys = new Set<string>();
  for (const recipe of recipes) for (const [id] of recipe.parts) {
    const key = byId.get(`usda:${id}`);
    if (key) keys.add(key);
  }
  return [...keys].sort();
}

async function measure(architecture: Architecture): Promise<{ marks: DeviceReport["marks"]; counts: Record<string, number> }> {
  const instrument = new Instrument();
  const reader = expoReader();
  const stores = new Map<
    "US" | "CA",
    BundleStore | SplitStore
  >();
  for (const market of ["US", "CA"] as const) {
    const lower = market.toLowerCase();
    stores.set(
      market,
      architecture === "B-bundle"
        ? new BundleStore(market, market === "US" ? "usda" : "cnf", reader, `bundle-${lower}.json`)
        : new SplitStore(
            market,
            market === "US" ? "usda" : "cnf",
            reader,
            `index-${lower}.json`,
            `detail-${lower}.header.json`,
            `detail-${lower}.pack`,
          ),
    );
  }
  const runtime = new CatalogueRuntime(stores, aliasRegistry(), CACHE_BUDGET_BYTES);

  const openUs = await instrument.time("open_us", () => runtime.open("US"));
  const openCa = await instrument.time("open_ca", () => runtime.open("CA"));
  const cold = await instrument.time("search_cold", () => runtime.search("chicken", "CA", 20));
  await instrument.time("search_warm", () => runtime.search("chicken", "CA", 20));
  const fallback = await instrument.time("search_fallback", () => runtime.search("waffle", "CA", 20));
  const first = cold.value[0];
  if (first) {
    await instrument.time("detail_cold", () => runtime.detail(first.id));
    await instrument.time("detail_warm", () => runtime.detail(first.id));
  }
  const keys = recipeKeys();
  const resolution = await instrument.time("recipe_resolution", () => runtime.ingredients(keys, "US"));
  await instrument.repeat("repeated_search", 50, (i) => runtime.search(i % 2 ? "rice" : "chicken", "CA", 20));
  await instrument.repeat("market_switch", 10, (i) => runtime.search("chicken", i % 2 ? "US" : "CA", 20));
  await instrument.time("cache_pass", async () => {
    for (const entry of aliasRegistry().ingredients) await runtime.detail(entry.ids.US);
  });

  return {
    marks: instrument.marks,
    counts: {
      architecture: architecture === "B-bundle" ? "B" : "C",
      open_us_records: openUs.value.records,
      open_ca_records: openCa.value.records,
      search_results: cold.value.length,
      fallback_results: fallback.value.length,
      fallback_cross_market: fallback.value.filter((r) => r.cross_market).length,
      recipe_keys: keys.length,
      recipe_resolved: resolution.value.filter((r) => r.outcome === "resolved").length,
      cache_entries: runtime.cache.size,
      cache_bytes: runtime.cache.bytes,
    },
  };
}

export default function App() {
  const [report, setReport] = useState<DeviceReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        console.log("M2-3A step: the benchmark screen has started");
        const device = deviceDescription({
          platform: Platform.OS,
          engine: "Hermes",
          model: "see the device log",
        });
        console.log("M2-3A step: measuring architecture B");
        const b = await measure("B-bundle");
        console.log("M2-3A step: architecture B is done");
        console.log("M2-3A step: measuring architecture C");
        const c = await measure("C-split");
        console.log("M2-3A step: architecture C is done");
        const full: DeviceReport = {
          device,
          marks: [
            ...b.marks.map((mark) => ({ ...mark, name: `B/${mark.name}` })),
            ...c.marks.map((mark) => ({ ...mark, name: `C/${mark.name}` })),
          ],
          memory: {
            platform_required: true,
            note: "Hermes does not expose a JavaScript heap size; the memory figure has to come from the platform.",
          },
          counts: { ...b.counts, c_open_us_records: c.counts.open_us_records },
          note: "A physical device run of the M2-3A harness.",
        };
        console.log(`M2-3A_DEVICE_REPORT ${JSON.stringify(full)}`);
        if (!cancelled) setReport(full);
      } catch (thrown) {
        const message = thrown instanceof Error ? thrown.message : String(thrown);
        const stack = thrown instanceof Error ? (thrown.stack ?? "(no stack)") : "(no stack)";
        console.log(`M2-3A_DEVICE_ERROR ${message}`);
        console.log(`M2-3A_DEVICE_STACK ${stack}`);
        if (!cancelled) setError(`${message}\n${stack}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>M2-3A device benchmark</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {report
        ? report.marks.map((mark) => (
            <Text key={mark.name} style={styles.line}>
              {mark.name.padEnd(28)} {mark.ms} ms{mark.iterations ? ` x${mark.iterations}` : ""}
            </Text>
          ))
        : <Text style={styles.line}>{error ? "" : "running..."}</Text>}
      {report ? <Text style={styles.note}>{report.memory?.note}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  content: { padding: 16 },
  title: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  line: { fontSize: 13, fontVariant: ["tabular-nums"], marginBottom: 4 },
  error: { fontSize: 13, color: "#b00020", marginBottom: 8 },
  note: { fontSize: 12, color: "#555555", marginTop: 12 },
});
