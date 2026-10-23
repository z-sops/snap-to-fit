import React, { useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import { BundleStore, CatalogueRuntime, SplitStore } from "../../runtime/catalogue";
import { aliasRegistry } from "../../../../src/core/ingredient-aliases";
import { popular, recipes } from "../../../../src/core/foods";
import { Instrument, deviceDescription, type DeviceReport } from "../instrumentation";
import { expoReader } from "../expo-reader";
import { importCatalogue } from "../import-assets";
import { readTask } from "../read-task";
import {
  type Architecture,
  type BenchmarkTaskContract,
  type BenchmarkEvidenceReport,
  type EvidenceReceipt,
  type EvidenceStatus,
  type RunState,
} from "../../runtime/contract";

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

/** The recipe ingredient keys, the same set the Node harness uses. */
function recipeKeys(): string[] {
  const registry = aliasRegistry();
  const byId = new Map(registry.ingredients.map((entry) => [entry.ids.US, entry.key]));
  const keys = new Set<string>();
  for (const recipe of recipes) {
    for (const [id] of recipe.parts) {
      const key = byId.get(`usda:${id}`);
      if (key) keys.add(key);
    }
  }
  return [...keys].sort();
}

async function measureOnce(
  architecture: Architecture,
  iteration: number,
): Promise<{ iteration: number; marks: DeviceReport["marks"]; counts: Record<string, number> }> {
  const instrument = new Instrument();
  const reader = expoReader();
  const stores = new Map<"US" | "CA", BundleStore | SplitStore>();
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
  // A runtime of its own for every iteration, so one iteration's data is not
  // still held while the next one starts.
  const runtime = new CatalogueRuntime(stores, aliasRegistry(), CACHE_BUDGET_BYTES);

  const step = async <T,>(name: string, work: () => Promise<T> | T): Promise<T> => {
    const value = await work();
    return value;
  };
  const timed = async <T,>(name: string, work: () => Promise<T> | T): Promise<T> =>
    instrument.time(name, work);

  const openUs = await timed("open_us", () => runtime.open("US"));
  const openCa = await timed("open_ca", () => runtime.open("CA"));
  const cold = await timed("search_cold", () => runtime.search("chicken", "CA", 20));
  const warm = await timed("search_warm", () => runtime.search("chicken", "CA", 20));
  const fallback = await timed("search_fallback", () => runtime.search("waffle", "CA", 20));
  const first = cold[0];
  let detailCold = 0;
  let detailWarm = 0;
  if (first) {
    const coldDetail = await timed("detail_cold", () => runtime.detail(first.id));
    const warmDetail = await timed("detail_warm", () => runtime.detail(first.id));
    detailCold = coldDetail === undefined ? 0 : 1;
    detailWarm = warmDetail === undefined ? 0 : 1;
  }
  const keys = await step("recipe_keys", () => recipeKeys());
  const resolution = await timed("recipe_resolution", () => runtime.ingredients(keys, "US"));
  await instrument.repeat("repeated_search", 50, (i) => runtime.search(i % 2 ? "rice" : "chicken", "CA", 20));
  await instrument.repeat("market_switch", 10, (i) => runtime.search("chicken", i % 2 ? "US" : "CA", 20));
  await timed("cache_pass", async () => {
    for (const entry of aliasRegistry().ingredients) await runtime.detail(entry.ids.US);
  });

  return {
    iteration,
    marks: instrument.marks.filter((mark) => mark.ms > 0 || mark.iterations !== undefined),
    counts: {
      iteration,
      architecture: architecture === "B-bundle" ? 1 : 2,
      open_us_records: openUs.records,
      open_ca_records: openCa.records,
      search_results: cold.length,
      fallback_results: fallback.length,
      fallback_cross_market: fallback.filter((r) => r.cross_market).length,
      recipe_keys: keys.length,
      recipe_resolved: resolution.filter((r) => r.outcome === "resolved").length,
      cache_entries: runtime.cache.size,
      cache_bytes: runtime.cache.bytes,
      detail_found_cold: detailCold,
      detail_found_warm: detailWarm,
    },
  };
}

export default function App() {
  const [report, setReport] = useState<BenchmarkEvidenceReport | null>(null);
  const [runState, setRunState] = useState<RunState>("TASK_VALIDATED");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const startTime = Date.now();

    ;(async () => {
      try {
        console.log("M2-3A step: the benchmark screen has started");
        // The registry's shape, because a bundled JSON module can arrive
        // wrapped in an interop object.
        const registry = aliasRegistry() as unknown as Record<string, unknown>;
        console.log(
          `M2-3A step: the registry has the keys [${Object.keys(registry ?? {}).join(", ")}] and ${
            Array.isArray(registry?.ingredients) ? `${(registry.ingredients as unknown[]).length} ingredients` : "NO ingredients array"
          }`,
        );
        // The catalogue is brought in once, and checked against the manifest
        // the build produced. A partial import never reaches the benchmark.
        const imported = await importCatalogue();
        if (!imported.ok) {
          throw new Error(
            `the catalogue was not imported completely: ${imported.imported
              .filter((entry) => !entry.ok)
              .map((entry) => `${entry.name}: ${entry.reason}`)
              .join("; ")}`,
          );
        }

        // 1. Retrieve and strictly validate authoritative task contract
        const task: BenchmarkTaskContract = await readTask();
        if (!cancelled) setRunState("TASK_VALIDATED");
        console.log(`M2-3A step: the validated task is ${task.architecture} x ${task.iterations} (runId: ${task.runId})`);

        const device = deviceDescription({
          platform: Platform.OS,
          engine: "Hermes",
          model: "see the device log",
        });

        // 2. Execute benchmark iterations
        const samples: {
          iteration: number;
          marks: DeviceReport["marks"];
          counts: Record<string, number>;
        }[] = [];
        for (let iteration = 0; iteration < task.iterations; iteration++) {
          console.log(`M2-3A step: iteration ${iteration + 1} of ${task.iterations}`);
          const one = await measureOnce(task.architecture, iteration);
          samples.push(one);
          console.log(
            `M2-3A iteration ${iteration} ${JSON.stringify(one.counts)} ${JSON.stringify(one.marks.map((m) => [m.name, m.ms]))}`,
          );
        }

        // Validate that all iterations completed successfully before producing a report
        const allIterationsComplete =
          samples.length === task.iterations &&
          samples.every((s) => s.marks !== undefined && s.counts.architecture !== undefined);
        if (!allIterationsComplete) {
          throw new Error("one or more iterations did not complete successfully; refusing to report incomplete run");
        }

        if (!cancelled) setRunState("WORKLOAD_COMPLETED");

        const completedTime = Date.now();

        // 3. Construct the full BenchmarkEvidenceReport
        const full: BenchmarkEvidenceReport = {
          contract: task,
          runId: task.runId,
          startTime,
          completedTime,
          completed: true,
          runState: "WORKLOAD_COMPLETED",
          device,
          marks: samples.flatMap((sample) =>
            sample.marks.map((mark) => ({ ...mark, name: `#${sample.counts.iteration}/${mark.name}` })),
          ),
          memory: {
            platform_required: true,
            note: "Hermes does not expose a JavaScript heap size; the memory figure has to come from the platform.",
          },
          counts: {
            architecture: task.architecture === "B-bundle" ? 1 : 2,
            iterations: task.iterations,
            samples: samples.length,
            ...samples[samples.length - 1]?.counts,
          },
          samples,
          note: "A physical device run of the M2-3A harness.",
        };

        // 4. SDK 57-compatible local evidence persistence
        try {
          const evidenceDir = new Directory(Paths.document, "research", "evidence");
          if (!evidenceDir.exists) {
            evidenceDir.create({ idempotent: true });
          }
          const reportFile = new File(evidenceDir, `${task.runId}.json`);
          reportFile.write(JSON.stringify(full, null, 2));

          // Read back to verify integrity
          const readBack = reportFile.textSync();
          if (!readBack || readBack.length === 0) {
            throw new Error("Local evidence read-back verification failed: empty file");
          }

          full.runState = "DEVICE_EVIDENCE_PERSISTED";
          if (!cancelled) setRunState("DEVICE_EVIDENCE_PERSISTED");
          console.log(`M2-3A step: evidence persisted locally to ${reportFile.uri} (${readBack.length} bytes)`);
        } catch (persistErr) {
          full.runState = "FAILED";
          if (!cancelled) setRunState("FAILED");
          throw new Error(
            `Device evidence persistence failed: ${persistErr instanceof Error ? persistErr.message : String(persistErr)}`,
          );
        }

        // 5. Windows evidence collector export
        try {
          const source = process.env.EXPO_PUBLIC_CATALOGUE_SOURCE ?? "http://127.0.0.1:8082";
          const exportResponse = await fetch(`${source}/evidence`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify(full),
          });

          if (!exportResponse.ok) {
            const errBody = await exportResponse.text();
            throw new Error(`Windows collector rejected evidence with HTTP ${exportResponse.status}: ${errBody}`);
          }

          const receipt = (await exportResponse.json()) as EvidenceReceipt;
          console.log(`M2-3A step: evidence exported to Windows collector. Receipt: ${JSON.stringify(receipt)}`);
          full.runState = "WINDOWS_EVIDENCE_EXPORTED";
          if (!cancelled) setRunState("WINDOWS_EVIDENCE_EXPORTED");

          // Status read-back check
          const statusResponse = await fetch(`${source}/evidence/status?runId=${encodeURIComponent(task.runId)}`);
          if (statusResponse.ok) {
            const statusData = (await statusResponse.json()) as EvidenceStatus;
            if (statusData.persisted && statusData.verified && statusData.sha256 === receipt.sha256) {
              console.log(`M2-3A step: evidence verified on Windows collector (SHA: ${statusData.sha256})`);
              full.runState = "WINDOWS_EVIDENCE_VERIFIED";
              if (!cancelled) setRunState("WINDOWS_EVIDENCE_VERIFIED");
            }
          }
        } catch (exportErr) {
          const msg = exportErr instanceof Error ? exportErr.message : String(exportErr);
          console.warn(`M2-3A warning: Windows collector export failed (${msg}); report retained locally`);
        }

        console.log(`M2-3A_DEVICE_REPORT ${JSON.stringify(full)}`);
        if (!cancelled) setReport(full);
      } catch (thrown) {
        const message = thrown instanceof Error ? thrown.message : String(thrown);
        const stack = thrown instanceof Error ? (thrown.stack ?? "(no stack)") : "(no stack)";
        console.log(`M2-3A_DEVICE_ERROR ${message}`);
        console.log(`M2-3A_DEVICE_STACK ${stack}`);
        if (!cancelled) {
          setError(`${message}\n${stack}`);
          setRunState("FAILED");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>M2-3A device benchmark</Text>
      <Text style={styles.stateLine}>State: {runState} | Run: {report?.runId ?? (error ? "FAILED" : "initializing...")}</Text>
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
  title: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  stateLine: { fontSize: 12, fontWeight: "500", color: "#333333", marginBottom: 8 },
  line: { fontSize: 13, fontVariant: ["tabular-nums"], marginBottom: 4 },
  error: { fontSize: 13, color: "#b00020", marginBottom: 8 },
  note: { fontSize: 12, color: "#555555", marginTop: 12 },
});
