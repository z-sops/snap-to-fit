/**
 * MVE-001A-R1: Memory Profiling Runner
 *
 * Implements the device/client-side checkpoint runner that exercises catalogue
 * lifecycle operations while synchronizing with the Windows memory orchestrator.
 *
 * Requirements:
 * 1. Preserves existing benchmark workload semantics without modifying measureOnce().
 * 2. Emits checkpoints M0_BASELINE through M7_POST_GC.
 * 3. Enforces strict host acknowledgment before progressing to the next phase.
 * 4. Measures observer sync delta and aborts immediately on communication failure.
 */

import http from "node:http";
import type { AssetReader } from "./assets";
import { BundleStore, CatalogueRuntime, SplitStore } from "./catalogue";
import {
  type Architecture,
  type MemoryCheckpointEvent,
  type MemoryCheckpointPhase,
  type MemorySyncReceipt,
  MEMORY_CHECKPOINT_PHASES,
} from "./memory-protocol";

export interface MemoryRunnerOptions {
  sessionId: string;
  architecture: "B-bundle" | "C-split";
  blockOrder: "B_THEN_C" | "C_THEN_B";
  sessionIndex: number;
  pid: number;
  orchestratorUrl: string;
  reader?: AssetReader;
  aliasRegistry?: any;
  cacheBudgetBytes?: number;
  // Optional mock work bypass for lightweight integration tests
  simulateWorkloadOnly?: boolean;
}

export class MemoryProfilingRunner {
  public sessionId: string;
  public architecture: "B-bundle" | "C-split";
  public blockOrder: "B_THEN_C" | "C_THEN_B";
  public sessionIndex: number;
  public pid: number;
  public orchestratorUrl: string;
  public reader?: AssetReader;
  public aliasRegistry?: any;
  public cacheBudgetBytes: number;
  public simulateWorkloadOnly: boolean;

  public acceptedReceipts: MemorySyncReceipt[] = [];
  public observerDeltasMs: number[] = [];

  constructor(options: MemoryRunnerOptions) {
    this.sessionId = options.sessionId;
    this.architecture = options.architecture;
    this.blockOrder = options.blockOrder;
    this.sessionIndex = options.sessionIndex;
    this.pid = options.pid;
    this.orchestratorUrl = options.orchestratorUrl;
    this.reader = options.reader;
    this.aliasRegistry = options.aliasRegistry;
    this.cacheBudgetBytes = options.cacheBudgetBytes || 8 * 1024 * 1024;
    this.simulateWorkloadOnly = options.simulateWorkloadOnly ?? false;
  }

  /**
   * Sends a checkpoint event to the host orchestrator and validates receipt.
   */
  async signalCheckpoint(phase: MemoryCheckpointPhase, checkpointIndex: number, note?: string): Promise<MemorySyncReceipt> {
    const deviceTimestampMs = Date.now();
    const event: MemoryCheckpointEvent = {
      sessionId: this.sessionId,
      architecture: this.architecture,
      blockOrder: this.blockOrder,
      sessionIndex: this.sessionIndex,
      checkpointIndex,
      phase,
      pid: this.pid,
      deviceTimestampMs,
      note,
    };

    const receipt = await this.postCheckpointHttp(event);

    // Validate receipt integrity
    if (receipt.status !== "accepted") {
      throw new Error(`Orchestrator rejected checkpoint '${phase}': status was '${receipt.status}'`);
    }
    if (receipt.sessionId !== this.sessionId) {
      throw new Error(`Receipt sessionId mismatch: expected '${this.sessionId}', got '${receipt.sessionId}'`);
    }
    if (receipt.phase !== phase) {
      throw new Error(`Receipt phase mismatch: expected '${phase}', got '${receipt.phase}'`);
    }
    if (receipt.checkpointIndex !== checkpointIndex) {
      throw new Error(`Receipt checkpointIndex mismatch: expected ${checkpointIndex}, got ${receipt.checkpointIndex}`);
    }

    this.acceptedReceipts.push(receipt);
    this.observerDeltasMs.push(receipt.observedDeltaMs);
    return receipt;
  }

  /**
   * Executes the full 8-phase memory lifecycle sequence M0 to M7.
   */
  async runLifecycle(): Promise<MemorySyncReceipt[]> {
    let runtime: CatalogueRuntime | undefined;

    // Phase 0: M0_BASELINE (before catalogue open or store initialization)
    await this.signalCheckpoint("M0_BASELINE", 0, "Pre-catalogue baseline container footprint");

    if (!this.simulateWorkloadOnly && this.reader && this.aliasRegistry) {
      const stores = new Map<"US" | "CA", BundleStore | SplitStore>();
      for (const market of ["US", "CA"] as const) {
        const lower = market.toLowerCase();
        stores.set(
          market,
          this.architecture === "B-bundle"
            ? new BundleStore(market, market === "US" ? "usda" : "cnf", this.reader, `bundle-${lower}.json`)
            : new SplitStore(
                market,
                market === "US" ? "usda" : "cnf",
                this.reader,
                `index-${lower}.json`,
                `detail-${lower}.header.json`,
                `detail-${lower}.pack`,
              ),
        );
      }
      runtime = new CatalogueRuntime(stores, this.aliasRegistry, this.cacheBudgetBytes);

      // Phase 1: M1_POST_OPEN_US
      await runtime.open("US");
      await this.signalCheckpoint("M1_POST_OPEN_US", 1, "US catalogue opened");

      // Phase 2: M2_POST_OPEN_CA
      await runtime.open("CA");
      await this.signalCheckpoint("M2_POST_OPEN_CA", 2, "CA catalogue opened (peak ingestion)");

      // Phase 3: M3_POST_SEARCH
      await runtime.search("chicken", "CA", 20);
      await runtime.search("apple", "US", 20);
      await this.signalCheckpoint("M3_POST_SEARCH", 3, "Cold & warm searches executed");

      // Phase 4: M4_POST_RECIPE
      const registry = this.aliasRegistry;
      const keys = (registry.ingredients as Array<{ ids: { US: string }; key: string }>)
        .slice(0, 50)
        .map((e) => e.key);
      await runtime.ingredients(keys, "US");
      await this.signalCheckpoint("M4_POST_RECIPE", 4, "Recipe ingredient resolution executed");

      // Phase 5: M5_POST_REPEAT
      for (let i = 0; i < 20; i++) {
        await runtime.search(i % 2 === 0 ? "chicken" : "rice", "CA", 20);
      }
      await this.signalCheckpoint("M5_POST_REPEAT", 5, "Repeated search stress executed");

      // Phase 6: M6_POST_CACHE
      for (const entry of (registry.ingredients as Array<{ ids: { US: string } }>).slice(0, 30)) {
        await runtime.detail(entry.ids.US);
      }
      await this.signalCheckpoint("M6_POST_CACHE", 6, "Sustained detail cache pass executed");

      // Phase 7: M7_POST_GC
      runtime = undefined;
      if (typeof (global as any).gc === "function") {
        (global as any).gc();
      }
      await new Promise((r) => setTimeout(r, 50));
      await this.signalCheckpoint("M7_POST_GC", 7, "Post-GC teardown idle settle");
    } else {
      // Synthetic simulated execution
      for (let i = 1; i < MEMORY_CHECKPOINT_PHASES.length; i++) {
        await new Promise((r) => setTimeout(r, 10)); // simulate work
        await this.signalCheckpoint(MEMORY_CHECKPOINT_PHASES[i], i, `Synthetic step ${MEMORY_CHECKPOINT_PHASES[i]}`);
      }
    }

    return this.acceptedReceipts;
  }

  private postCheckpointHttp(event: MemoryCheckpointEvent): Promise<MemorySyncReceipt> {
    return new Promise((resolve, reject) => {
      const url = new URL("/memory/checkpoint", this.orchestratorUrl);
      const postData = JSON.stringify(event);

      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData),
          },
          timeout: 10000,
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => {
            body += chunk;
          });
          res.on("end", () => {
            if (res.statusCode !== 200) {
              reject(new Error(`Host returned HTTP ${res.statusCode}: ${body}`));
              return;
            }
            try {
              const receipt = JSON.parse(body) as MemorySyncReceipt;
              resolve(receipt);
            } catch (err: unknown) {
              reject(new Error(`Failed to parse sync receipt JSON: ${err instanceof Error ? err.message : String(err)}`));
            }
          });
        },
      );

      req.on("error", (err) => reject(new Error(`HTTP request failed: ${err.message}`)));
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("HTTP request timed out after 10000ms"));
      });

      req.write(postData);
      req.end();
    });
  }
}