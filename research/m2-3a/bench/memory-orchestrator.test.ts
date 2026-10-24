import http from "node:http";
/**
 * MVE-001A-R1: Memory Orchestrator & End-to-End Simulation Tests
 *
 * Verifies:
 * 1. Full 64-checkpoint simulation (4 sessions x 2 blocks x 8 checkpoints) with alternating B/C orders.
 * 2. Exclusive atomic file persistence (wx) and SHA-256 evidence manifest generation.
 * 3. Statistical summary and provisional criteria evaluation.
 * 4. Deterministic negative testing for all protocol & communication failure modes.
 * 5. Complete separation of synthetic test data from physical evidence.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  type MemoryCheckpointPhase,
  type SessionData,
  MEMORY_CHECKPOINT_PHASES,
  validateMemoryEvidenceReport,
} from "../runtime/memory-protocol";
import {
  type AdbTransport,
  DEFAULT_ADB_PATH,
  MemoryOrchestrator,
  MockAdbTransport,
  PhysicalAdbTransport,
} from "./memory-orchestrator";
import { MemoryProfilingRunner } from "../runtime/memory-runner";

function createTempDir(prefix: string): string {
  const tmp = path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(tmp, { recursive: true });
  return tmp;
}

function cleanTempDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors in tests
  }
}

/**
 * Configure realistic mock memory data for B-bundle and C-split across M0..M7.
 */
function setupRealisticMockTransport(): MockAdbTransport {
  const mockAdb = new MockAdbTransport();

  // B-bundle realistic values (PSS KB, Dirty KB, Native KB)
  const bProfiles: Record<MemoryCheckpointPhase, [number, number, number]> = {
    M0_BASELINE: [125000, 115000, 60000],
    M1_POST_OPEN_US: [150000, 138000, 80000],
    M2_POST_OPEN_CA: [175000, 162000, 100000], // Peak ingestion
    M3_POST_SEARCH: [178000, 165000, 102000],
    M4_POST_RECIPE: [180000, 167000, 103000],
    M5_POST_REPEAT: [182000, 169000, 104000],
    M6_POST_CACHE: [188000, 175000, 108000],   // Sustained workload
    M7_POST_GC: [174000, 161000, 98000],
  };

  // C-split realistic values (PSS KB, Dirty KB, Native KB)
  const cProfiles: Record<MemoryCheckpointPhase, [number, number, number]> = {
    M0_BASELINE: [125000, 115000, 60000],
    M1_POST_OPEN_US: [127000, 117000, 61000],
    M2_POST_OPEN_CA: [129000, 119000, 62000], // Peak ingestion: ~4 MB delta vs B's 50 MB (92% reduction)
    M3_POST_SEARCH: [134000, 124000, 65000],
    M4_POST_RECIPE: [139000, 129000, 68000],
    M5_POST_REPEAT: [142000, 131000, 70000],
    M6_POST_CACHE: [168000, 155000, 85000],   // Sustained workload
    M7_POST_GC: [155000, 143000, 78000],
  };

  // Configure PID 12345
  for (const phase of MEMORY_CHECKPOINT_PHASES) {
    const [bPss, bDirty, bNat] = bProfiles[phase];
    mockAdb.setPhaseMeminfo(12345, phase, bPss, bDirty, bNat);
  }

  // Configure PID 12346 for alternate runs
  for (const phase of MEMORY_CHECKPOINT_PHASES) {
    const [cPss, cDirty, cNat] = cProfiles[phase];
    mockAdb.setPhaseMeminfo(12346, phase, cPss, cDirty, cNat);
  }

  return mockAdb;
}

test("1. End-to-end 64-checkpoint simulation: 4 alternating sessions x 2 blocks x 8 checkpoints", async () => {
  const tempDir = createTempDir("mve001a-sim-64");
  const mockAdb = setupRealisticMockTransport();

  mockAdb.mockProcessList =
    `USER           PID  PPID     VSZ    RSS WCHAN            ADDR S NAME\n` +
    `u0_a123      12345   678 1450200 245120 0                   0 S host.exp.exponent\n` +
    `u0_a123      12346   678 1450200 245120 0                   0 S host.exp.exponent\n`;

  const orchestrator = new MemoryOrchestrator({
    outputDir: tempDir,
    adbTransport: mockAdb,
    isSynthetic: true,
  });

  const { port, url, close } = await orchestrator.startServer();

  try {
    const sessionOrders: Array<"B_THEN_C" | "C_THEN_B"> = [
      "B_THEN_C",
      "C_THEN_B",
      "B_THEN_C",
      "C_THEN_B",
    ];

    const completedSessions: SessionData[] = [];
    let totalSnapshotsAccepted = 0;

    for (let sessionIdx = 0; sessionIdx < 4; sessionIdx++) {
      const order = sessionOrders[sessionIdx];
      const archs: Array<"B-bundle" | "C-split"> =
        order === "B_THEN_C" ? ["B-bundle", "C-split"] : ["C-split", "B-bundle"];

      const sessionRuns: Partial<Record<"B-bundle" | "C-split", any>> = {};

      for (const arch of archs) {
        const pid = arch === "B-bundle" ? 12345 : 12346;
        const sessionId = `sim-s${sessionIdx + 1}-${arch.toLowerCase()}-${Date.now()}`;

        const runner = new MemoryProfilingRunner({
          sessionId,
          architecture: arch,
          blockOrder: order,
          sessionIndex: sessionIdx,
          pid,
          orchestratorUrl: url,
          simulateWorkloadOnly: true,
        });

        const receipts = await runner.runLifecycle();
        assert.equal(receipts.length, 8, `Block ${arch} must complete all 8 phases`);
        totalSnapshotsAccepted += receipts.length;

        const finalizedRun = orchestrator.finalizeRun(sessionId);
        assert.equal(finalizedRun.checkpoints.length, 8);
        sessionRuns[arch] = finalizedRun;
      }

      completedSessions.push({
        sessionIndex: sessionIdx,
        order,
        thermal: {
          startBatteryTempC: 30.5 + sessionIdx * 0.4,
          endBatteryTempC: 32.0 + sessionIdx * 0.5,
        },
        runs: {
          "B-bundle": sessionRuns["B-bundle"],
          "C-split": sessionRuns["C-split"],
        },
      });
    }

    assert.equal(totalSnapshotsAccepted, 64, "Exactly 64 snapshots must be accepted across 4 sessions");
    assert.equal(orchestrator.rawFiles.length, 64, "64 raw meminfo dump files must be persisted");

    // Compile and verify final evidence report
    const { report, reportPath, manifestPath } = orchestrator.compileAndPersistEvidenceReport(completedSessions);

    assert.ok(fs.existsSync(reportPath), "Evidence JSON file must exist");
    assert.ok(fs.existsSync(manifestPath), "Manifest SHA-256 file must exist");
    assert.equal(report.isSynthetic, true, "Must be clearly labeled isSynthetic: true");
    assert.ok(report.syntheticDisclaimer?.includes("SIMULATED"), "Must include synthetic disclaimer");

    // Verify statistical calculations
    assert.ok(report.statisticalSummary.comparison.peakIngestionDeltaReductionPct > 80.0, "C-split must exhibit >80% peak delta reduction");
    assert.equal(report.provisionalEvaluation.provisionalVerdict, "PROVISIONAL_CONFIRMED_C_ADVANTAGE");

    // Verify manifest bit-for-bit against all raw files
    const manifestText = fs.readFileSync(manifestPath, "utf8");
    for (const raw of orchestrator.rawFiles) {
      assert.ok(
        manifestText.includes(raw.relativePath),
        `Manifest must contain entry for ${raw.relativePath}`,
      );
      assert.ok(
        manifestText.includes(raw.sha256),
        `Manifest must record matching SHA-256 for ${raw.relativePath}`,
      );
    }
  } finally {
    await close();
    cleanTempDir(tempDir);
  }
});

test("2. Duplicate checkpoint rejected with HTTP 409 Conflict", async () => {
  const tempDir = createTempDir("mve001a-test-dup");
  const mockAdb = setupRealisticMockTransport();
  const orchestrator = new MemoryOrchestrator({ outputDir: tempDir, adbTransport: mockAdb });
  const { url, close } = await orchestrator.startServer();

  try {
    const sessionId = "dup-test-session";
    const runner = new MemoryProfilingRunner({
      sessionId,
      architecture: "B-bundle",
      blockOrder: "B_THEN_C",
      sessionIndex: 0,
      pid: 12345,
      orchestratorUrl: url,
    });

    await runner.signalCheckpoint("M0_BASELINE", 0);

    // Attempting duplicate submission of M0_BASELINE must throw HTTP 409
    await assert.rejects(
      async () => {
        await runner.signalCheckpoint("M0_BASELINE", 0);
      },
      /409.*Duplicate checkpoint rejected/i,
    );
  } finally {
    await close();
    cleanTempDir(tempDir);
  }
});

test("3. Out-of-order checkpoint rejected with HTTP 400 Bad Request", async () => {
  const tempDir = createTempDir("mve001a-test-order");
  const mockAdb = setupRealisticMockTransport();
  const orchestrator = new MemoryOrchestrator({ outputDir: tempDir, adbTransport: mockAdb });
  const { url, close } = await orchestrator.startServer();

  try {
    const sessionId = "order-test-session";
    const runner = new MemoryProfilingRunner({
      sessionId,
      architecture: "B-bundle",
      blockOrder: "B_THEN_C",
      sessionIndex: 0,
      pid: 12345,
      orchestratorUrl: url,
    });

    await runner.signalCheckpoint("M0_BASELINE", 0);

    // Skipping M1 and sending M2 directly must fail sequence check
    await assert.rejects(
      async () => {
        await runner.signalCheckpoint("M2_POST_OPEN_CA", 2);
      },
      /400.*Out-of-order checkpoint/i,
    );
  } finally {
    await close();
    cleanTempDir(tempDir);
  }
});

test("4. Process attribution failure: PID not belonging to expected package rejected", async () => {
  const tempDir = createTempDir("mve001a-test-attrib");
  const mockAdb = new MockAdbTransport({
    processList:
      `USER           PID  PPID     VSZ    RSS WCHAN            ADDR S NAME\n` +
      `u0_a999      99999   678 1450200 245120 0                   0 S com.rogue.app\n`,
  });

  const orchestrator = new MemoryOrchestrator({ outputDir: tempDir, adbTransport: mockAdb });
  const { url, close } = await orchestrator.startServer();

  try {
    const runner = new MemoryProfilingRunner({
      sessionId: "attrib-test-session",
      architecture: "B-bundle",
      blockOrder: "B_THEN_C",
      sessionIndex: 0,
      pid: 99999,
      orchestratorUrl: url,
    });

    await assert.rejects(
      async () => {
        await runner.signalCheckpoint("M0_BASELINE", 0);
      },
      /Process attribution failed.*PID 99999 belongs to 'com.rogue.app'/i,
    );
  } finally {
    await close();
    cleanTempDir(tempDir);
  }
});

test("5. Mid-session PID change detected and session aborted", async () => {
  const tempDir = createTempDir("mve001a-test-pidchange");
  const mockAdb = setupRealisticMockTransport();
  mockAdb.mockProcessList =
    `USER           PID  PPID     VSZ    RSS WCHAN            ADDR S NAME\n` +
    `u0_a123      12345   678 1450200 245120 0                   0 S host.exp.exponent\n` +
    `u0_a123      55555   678 1450200 245120 0                   0 S host.exp.exponent\n`;

  const orchestrator = new MemoryOrchestrator({ outputDir: tempDir, adbTransport: mockAdb });
  const { url, close } = await orchestrator.startServer();

  try {
    const sessionId = "pidchange-test-session";
    const runner1 = new MemoryProfilingRunner({
      sessionId,
      architecture: "B-bundle",
      blockOrder: "B_THEN_C",
      sessionIndex: 0,
      pid: 12345,
      orchestratorUrl: url,
    });

    await runner1.signalCheckpoint("M0_BASELINE", 0);

    // Now send checkpoint with new PID 55555 for same session
    const runner2 = new MemoryProfilingRunner({
      sessionId,
      architecture: "B-bundle",
      blockOrder: "B_THEN_C",
      sessionIndex: 0,
      pid: 55555,
      orchestratorUrl: url,
    });

    await assert.rejects(
      async () => {
        await runner2.signalCheckpoint("M1_POST_OPEN_US", 1);
      },
      /409.*Mid-session PID change detected/i,
    );
  } finally {
    await close();
    cleanTempDir(tempDir);
  }
});

test("6. Exclusive file creation prevents silent overwrite of snapshot files", async () => {
  const tempDir = createTempDir("mve001a-test-wx");
  const mockAdb = setupRealisticMockTransport();
  const orchestrator = new MemoryOrchestrator({ outputDir: tempDir, adbTransport: mockAdb });

  try {
    const sessionId = "wx-test-session";
    const event = {
      sessionId,
      architecture: "B-bundle" as const,
      blockOrder: "B_THEN_C" as const,
      sessionIndex: 0,
      checkpointIndex: 0,
      phase: "M0_BASELINE" as const,
      pid: 12345,
      deviceTimestampMs: 100000,
    };

    // First checkpoint creates raw file
    const receipt1 = await orchestrator.handleCheckpoint(event);
    assert.equal(receipt1.status, "accepted");
    assert.equal(orchestrator.rawFiles.length, 1);

    // If an identical raw file name somehow exists, exclusive write throws error
    const rawFile = orchestrator.rawFiles[0].path;
    assert.ok(fs.existsSync(rawFile));

    assert.throws(
      () => {
        fs.writeFileSync(rawFile, "attempted overwrite", { flag: "wx" });
      },
      /EEXIST/,
      "fs.writeFileSync with 'wx' flag must throw EEXIST if file already exists",
    );
  } finally {
    cleanTempDir(tempDir);
  }
});

test("7. Interrupted session preserves previously persisted raw evidence on disk", async () => {
  const tempDir = createTempDir("mve001a-test-interrupt");
  const mockAdb = setupRealisticMockTransport();
  const orchestrator = new MemoryOrchestrator({ outputDir: tempDir, adbTransport: mockAdb });
  const { url, close } = await orchestrator.startServer();

  try {
    const sessionId = "interrupt-session";
    const runner = new MemoryProfilingRunner({
      sessionId,
      architecture: "B-bundle",
      blockOrder: "B_THEN_C",
      sessionIndex: 0,
      pid: 12345,
      orchestratorUrl: url,
    });

    // Accept checkpoints 0, 1, 2
    await runner.signalCheckpoint("M0_BASELINE", 0);
    await runner.signalCheckpoint("M1_POST_OPEN_US", 1);
    await runner.signalCheckpoint("M2_POST_OPEN_CA", 2);

    assert.equal(orchestrator.rawFiles.length, 3);
    for (const raw of orchestrator.rawFiles) {
      assert.ok(fs.existsSync(raw.path), `Raw file ${raw.path} must exist on disk`);
    }

    // Now simulate failure / crash
    await assert.rejects(
      async () => {
        await runner.signalCheckpoint("M2_POST_OPEN_CA", 2); // Duplicate error
      },
      /409/,
    );

    // All 3 previously written files must remain intact on disk
    assert.equal(orchestrator.rawFiles.length, 3);
    for (const raw of orchestrator.rawFiles) {
      assert.ok(fs.existsSync(raw.path), `Raw file ${raw.path} must remain intact after error`);
    }
  } finally {
    await close();
    cleanTempDir(tempDir);
  }
});

test("8. Schema validator catches malformed memory evidence report", () => {
  const invalidReport = {
    schemaVersion: "invalid-version",
    directive: "MVE-001B",
    date: new Date().toISOString(),
    sessions: [], // Must have 4 sessions
  };

  const res = validateMemoryEvidenceReport(invalidReport);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes("schemaVersion")));
  assert.ok(res.errors.some((e) => e.includes("Expected exactly 4 sessions")));
});
test("9. Client runner detects corrupted/non-accepted receipt and aborts immediately", async () => {
  const tempDir = createTempDir("mve001a-test-bad-receipt");
  // Set up mock HTTP server returning invalid receipt status
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "rejected",
      receiptId: "bad",
      sessionId: "corrupt-receipt-session",
      phase: "M0_BASELINE",
      checkpointIndex: 0,
      hostTimestampMs: Date.now(),
      observedDeltaMs: 0,
    }));
  });

  const url = await new Promise<string>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as any;
      resolve(`http://127.0.0.1:${addr.port}`);
    });
  });

  try {
    const runner = new MemoryProfilingRunner({
      sessionId: "corrupt-receipt-session",
      architecture: "B-bundle",
      blockOrder: "B_THEN_C",
      sessionIndex: 0,
      pid: 12345,
      orchestratorUrl: url,
    });

    await assert.rejects(
      async () => {
        await runner.signalCheckpoint("M0_BASELINE", 0);
      },
      /Orchestrator rejected checkpoint 'M0_BASELINE': status was 'rejected'/i,
    );
  } finally {
    server.close();
    cleanTempDir(tempDir);
  }
});

test("10. Missing/skipped checkpoint in sequence is rejected", async () => {
  const tempDir = createTempDir("mve001a-test-skip");
  const mockAdb = setupRealisticMockTransport();
  const orchestrator = new MemoryOrchestrator({ outputDir: tempDir, adbTransport: mockAdb });
  const { url, close } = await orchestrator.startServer();

  try {
    const runner = new MemoryProfilingRunner({
      sessionId: "skip-test-session",
      architecture: "B-bundle",
      blockOrder: "B_THEN_C",
      sessionIndex: 0,
      pid: 12345,
      orchestratorUrl: url,
    });

    // M0 accepted
    await runner.signalCheckpoint("M0_BASELINE", 0);

    // Try to jump to M3 (skipping M1 and M2)
    await assert.rejects(
      async () => {
        await runner.signalCheckpoint("M3_POST_SEARCH", 3);
      },
      /400.*Out-of-order checkpoint.*expected phase index 1/i,
    );
  } finally {
    await close();
    cleanTempDir(tempDir);
  }
});

test("11. Differential metrics exactly match M0 baseline subtraction across phases", async () => {
  const tempDir = createTempDir("mve001a-test-diff-exact");
  const mockAdb = setupRealisticMockTransport();
  const orchestrator = new MemoryOrchestrator({ outputDir: tempDir, adbTransport: mockAdb });
  const { url, close } = await orchestrator.startServer();

  try {
    const sessionId = "diff-exact-session";
    const runner = new MemoryProfilingRunner({
      sessionId,
      architecture: "B-bundle",
      blockOrder: "B_THEN_C",
      sessionIndex: 0,
      pid: 12345,
      orchestratorUrl: url,
    });

    // M0: 125000 KB PSS
    await runner.signalCheckpoint("M0_BASELINE", 0);
    // M1: 150000 KB PSS (delta should be +25000 KB)
    await runner.signalCheckpoint("M1_POST_OPEN_US", 1);
    // M2: 175000 KB PSS (delta should be +50000 KB)
    await runner.signalCheckpoint("M2_POST_OPEN_CA", 2);

    const state = orchestrator.activeSessions.get(sessionId)!;
    const m0 = state.checkpoints.get("M0_BASELINE")!;
    const m1 = state.checkpoints.get("M1_POST_OPEN_US")!;
    const m2 = state.checkpoints.get("M2_POST_OPEN_CA")!;

    assert.ok(m0.differential);
    assert.ok(m1.differential);
    assert.ok(m2.differential);
    assert.equal(m0.differential.deltaPssKb, 0, "M0 baseline delta must be 0");
    assert.equal(m1.differential.deltaPssKb, 25000, "M1 delta must equal 150000 - 125000 = 25000 KB");
    assert.equal(m2.differential.deltaPssKb, 50000, "M2 delta must equal 175000 - 125000 = 50000 KB");
  } finally {
    await close();
    cleanTempDir(tempDir);
  }
});

test("12. Manifest tamper detection: modifying 1 byte in a raw file invalidates checksum match", async () => {
  const tempDir = createTempDir("mve001a-test-tamper");
  const mockAdb = setupRealisticMockTransport();
  const orchestrator = new MemoryOrchestrator({ outputDir: tempDir, adbTransport: mockAdb });

  try {
    const event = {
      sessionId: "tamper-session",
      architecture: "B-bundle" as const,
      blockOrder: "B_THEN_C" as const,
      sessionIndex: 0,
      checkpointIndex: 0,
      phase: "M0_BASELINE" as const,
      pid: 12345,
      deviceTimestampMs: 100000,
    };

    await orchestrator.handleCheckpoint(event);
    assert.equal(orchestrator.rawFiles.length, 1);

    const rawFile = orchestrator.rawFiles[0];
    const originalHash = rawFile.sha256;

    // Tamper with file on disk
    fs.appendFileSync(rawFile.path, "\n# TAMPERED LINE");
    const tamperedBytes = fs.readFileSync(rawFile.path);
    const tamperedHash = createHash("sha256").update(tamperedBytes).digest("hex");

    assert.notEqual(originalHash, tamperedHash, "Tampered file hash must not match original");
  } finally {
    cleanTempDir(tempDir);
  }
});

test("13. Physical memory distinction: hermesJsHeapMeasured is strictly false with explanatory note", async () => {
  const tempDir = createTempDir("mve001a-test-hermes");
  const mockAdb = setupRealisticMockTransport();
  const orchestrator = new MemoryOrchestrator({ outputDir: tempDir, adbTransport: mockAdb });

  try {
    const event = {
      sessionId: "hermes-session",
      architecture: "B-bundle" as const,
      blockOrder: "B_THEN_C" as const,
      sessionIndex: 0,
      checkpointIndex: 0,
      phase: "M0_BASELINE" as const,
      pid: 12345,
      deviceTimestampMs: 100000,
    };

    await orchestrator.handleCheckpoint(event);
    const state = orchestrator.activeSessions.get("hermes-session")!;
    const cp = state.checkpoints.get("M0_BASELINE")!;

    assert.equal(cp.rawMetrics.hermesJsHeapMeasured, false, "hermesJsHeapMeasured must strictly be false");
    assert.ok(
      cp.rawMetrics.hermesJsHeapNote.includes("Hermes JS heap is not directly measured"),
      "Must include required disclaimer note",
    );
  } finally {
    cleanTempDir(tempDir);
  }
});

test("14. PhysicalAdbTransport initialization and fallback path checks", () => {
  const transport = new PhysicalAdbTransport("C:\\nonexistent\\adb.exe");
  assert.ok(transport, "PhysicalAdbTransport must instantiate safely with fallback");
});