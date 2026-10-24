/**
 * MVE-001A: Offline Deterministic Tests for Android Memory Measurement Harness
 *
 * Verifies all 15 safety and validation requirements mandated by Directive MVE-001A:
 * 1. Missing process in ps output
 * 2. Unexpected PID changes
 * 3. Reused PID after process restart
 * 4. Incorrect process package attribution
 * 5. Valid memory output parsing (dumpsys meminfo -d)
 * 6. Unsupported or missing memory fields
 * 7. Malformed numeric values in meminfo
 * 8. Duplicate checkpoints rejection
 * 9. Missing / skipped checkpoints detection
 * 10. Out-of-order events rejection
 * 11. Baseline PID / session mismatch
 * 12. Interrupted collection handling
 * 13. Corrupt evidence payload detection
 * 14. Checksum mismatch in manifest
 * 15. Correct distinction between physical memory and unsupported Hermes heap metrics
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateProcessAttribution,
  parseDumpsysMeminfo,
  validateMemoryCheckpointEvent,
  calculateDifferentialMetrics,
  createMemorySessionState,
  generateMemoryEvidenceManifest,
  type MemoryCheckpointEvent,
  type MemorySessionState,
} from "../runtime/memory-protocol";

// Realistic sample Android ps -A output mock
const MOCK_PS_OUTPUT_VALID = `
USER      PID   PPID  VSZ    RSS   WCHAN            ADDR S NAME
root      1     0     24120  4120  do_epoll_wait       0 S init
system    1200  1     142000 12000 binder_thread_read  0 S system_server
u0_a185   14285 1100  185200 45200 epoll_wait          0 S host.exp.exponent
u0_a210   15100 1100  110000 24000 epoll_wait          0 S com.android.chrome
`;

// Sample dumpsys meminfo -d mock for Pixel 6a
const MOCK_MEMINFO_VALID = `
Applications Memory Usage (in Kilobytes):
Uptime: 1420584 Realtime: 2548901

** MEMINFO in pid 14285 [host.exp.exponent] **
                   Pss      Pss  Shared Private  Shared Private    Swap  SwapPss   Heap    Heap    Heap
                 Total    Clean   Dirty   Dirty   Clean   Clean   Total    Total   Size   Alloc    Free
                ------   ------  ------  ------  ------  ------  ------  ------  ------  ------  ------
  Native Heap    85200        0   82100   82100       0       0   12400    8200   92000   84100    7900
  Dalvik Heap    24500        0   24100   24100       0       0    1200     800   32000   23500    8500
        Stack     1400        0    1400    1400       0       0       0       0
       Ashmem      250        0       0       0       0       0       0       0
      Gfx dev    18500        0   18500   18500       0       0       0       0
    Other dev       40        0       0       0      40       0       0       0
     .so mmap    12400     4200    1200    1200    8200    4200       0       0
    .apk mmap     4200     2100       0       0    2100    2100       0       0
    .ttf mmap      120       40       0       0      80      40       0       0
    .dex mmap    14200     8100     200     200    6100    8100       0       0
    .oat mmap     2100     1100       0       0    1000    1100       0       0
    .art mmap     8400     4200    2100    2100    4200    4200       0       0
   Other mmap     3200      400     800     800    2400     400       0       0
   EGL mtrack     4200        0    4200    4200       0       0       0       0
    GL mtrack     8400        0    8400    8400       0       0       0       0
      Unknown    14500        0   14200   14200       0       0       0       0
        TOTAL   198243    20180  161400  161400   24120   20180   13600    9000  124000  107600   16400

 App Summary
                       Pss(KB)                        Rss(KB)
                        ------                         ------
           Java Heap:    24500                          32000
         Native Heap:    85200                          92000
                Code:    45200                          52000
               Stack:     1400                           1400
            Graphics:    31100                          31100
       Private Other:    12400
              System:    11200
             Unknown:    14500

           TOTAL PSS:   198243            TOTAL RSS:   245120      TOTAL SWAP PSS:     9000
`;

test("1. Missing process: PID not found in process list is rejected", () => {
  const result = validateProcessAttribution(99999, "host.exp.exponent", MOCK_PS_OUTPUT_VALID);
  assert.equal(result.valid, false);
  assert.match(result.error ?? "", /not found in process list/i);
});

test("2. Unexpected PID changes: validates that expected PID matches active process", () => {
  const result = validateProcessAttribution(14285, "host.exp.exponent", MOCK_PS_OUTPUT_VALID);
  assert.equal(result.valid, true);
  assert.equal(result.pid, 14285);
  assert.equal(result.packageName, "host.exp.exponent");

  // Unexpected PID replacement
  const resultChanged = validateProcessAttribution(14286, "host.exp.exponent", MOCK_PS_OUTPUT_VALID);
  assert.equal(resultChanged.valid, false);
});

test("3. Reused PID after process restart: package mismatch is detected", () => {
  // If PID 14285 is terminated and OS reassigns 14285 to a different package
  const MOCK_PS_REUSED = `
USER      PID   PPID  VSZ    RSS   WCHAN S NAME
u0_a999   14285 1100  12000  4000  epoll_wait       0 S com.rogue.daemon
`;
  const result = validateProcessAttribution(14285, "host.exp.exponent", MOCK_PS_REUSED);
  assert.equal(result.valid, false);
  assert.match(result.error ?? "", /Process identity mismatch.*expected 'host\.exp\.exponent'/i);
});

test("4. Incorrect process package attribution: PID belongs to another app", () => {
  const result = validateProcessAttribution(15100, "host.exp.exponent", MOCK_PS_OUTPUT_VALID);
  assert.equal(result.valid, false);
  assert.match(result.error ?? "", /Process identity mismatch/i);
});

test("5. Valid memory output: dumpsys meminfo -d parses correctly", () => {
  const mem = parseDumpsysMeminfo(MOCK_MEMINFO_VALID, 14285);
  assert.equal(mem.pid, 14285);
  assert.equal(mem.packageName, "host.exp.exponent");
  assert.equal(mem.totalPssKb, 198243);
  assert.equal(mem.nativeHeapPssKb, 85200);
  assert.equal(mem.dalvikHeapPssKb, 24500);
  assert.equal(mem.swapPssKb, 9000);
  assert.equal(mem.unknownPssKb, 14500);
  assert.ok(mem.privateDirtyKb > 0);
});

test("6. Unsupported or missing memory fields: handles missing lines safely with defaults", () => {
  const truncatedMeminfo = `
** MEMINFO in pid 14285 [host.exp.exponent] **
        TOTAL   150000    10000   120000  120000   10000   10000       0       0
`;
  const mem = parseDumpsysMeminfo(truncatedMeminfo, 14285);
  assert.equal(mem.totalPssKb, 150000);
  assert.equal(mem.nativeHeapPssKb, 0); // Missing field defaults safely to 0
  assert.equal(mem.dalvikHeapPssKb, 0);
  assert.equal(mem.swapPssKb, 0);
});

test("7. Malformed numeric values: throws error when Total PSS is unparseable", () => {
  const malformedMeminfo = `
** MEMINFO in pid 14285 [host.exp.exponent] **
        TOTAL   CORRUPT_NOT_A_NUMBER    NaN   ERROR
`;
  assert.throws(() => {
    parseDumpsysMeminfo(malformedMeminfo, 14285);
  }, /Failed to parse valid Total PSS/i);
});

test("8. Duplicate checkpoints: rejects duplicate phase in same session", () => {
  const state: MemorySessionState = createMemorySessionState("session-test-1", "B-bundle", 0, 14285);
  const eventM0: MemoryCheckpointEvent = {
    sessionId: "session-test-1",
    architecture: "B-bundle",
    blockOrder: "B_THEN_C",
    sessionIndex: 0,
    checkpointIndex: 0,
    phase: "M0_BASELINE",
    pid: 14285,
    deviceTimestampMs: 1792840001000,
  };

  const validated1 = validateMemoryCheckpointEvent(eventM0, state);
  assert.equal(validated1.phase, "M0_BASELINE");
  state.completedPhases.add("M0_BASELINE");
  state.currentCheckpointIndex = 1;

  // Duplicate M0 attempt
  assert.throws(() => {
    validateMemoryCheckpointEvent(eventM0, state);
  }, /Duplicate checkpoint rejected/i);
});

test("9. Missing / skipped checkpoints: detects gap in phase sequence", () => {
  const state: MemorySessionState = createMemorySessionState("session-test-1", "B-bundle", 0, 14285);
  state.completedPhases.add("M0_BASELINE");
  state.currentCheckpointIndex = 1; // Expected M1_POST_OPEN_US

  const eventM3: MemoryCheckpointEvent = {
    sessionId: "session-test-1",
    architecture: "B-bundle",
    blockOrder: "B_THEN_C",
    sessionIndex: 0,
    checkpointIndex: 3,
    phase: "M3_POST_SEARCH", // Skipped M1 and M2
    pid: 14285,
    deviceTimestampMs: 1792840003000,
  };

  assert.throws(() => {
    validateMemoryCheckpointEvent(eventM3, state);
  }, /Out-of-order checkpoint: expected phase index 1/i);
});

test("10. Out-of-order events: rejects inverted checkpoint arrival", () => {
  const state: MemorySessionState = createMemorySessionState("session-test-1", "B-bundle", 0, 14285);
  state.completedPhases.add("M0_BASELINE");
  state.completedPhases.add("M1_POST_OPEN_US");
  state.currentCheckpointIndex = 2; // Expected M2_POST_OPEN_CA

  const eventM1: MemoryCheckpointEvent = {
    sessionId: "session-test-1",
    architecture: "B-bundle",
    blockOrder: "B_THEN_C",
    sessionIndex: 0,
    checkpointIndex: 1,
    phase: "M1_POST_OPEN_US",
    pid: 14285,
    deviceTimestampMs: 1792840002000,
  };

  assert.throws(() => {
    validateMemoryCheckpointEvent(eventM1, state);
  }, /Duplicate checkpoint rejected/i);
});

test("11. Baseline PID / session mismatch: detects baseline comparison error", () => {
  const baseline = parseDumpsysMeminfo(MOCK_MEMINFO_VALID, 14285);
  const currentAfterCrash = parseDumpsysMeminfo(
    MOCK_MEMINFO_VALID.replace(/14285/g, "14299"),
    14299,
  );

  assert.throws(() => {
    calculateDifferentialMetrics(currentAfterCrash, baseline);
  }, /Baseline comparison error: current PID \(14299\) does not match baseline PID \(14285\)/i);
});

test("12. Interrupted collection: validates session aborts on PID change mid-session", () => {
  const state = createMemorySessionState("session-test-1", "B-bundle", 0, 14285);
  const eventCrashed: MemoryCheckpointEvent = {
    sessionId: "session-test-1",
    architecture: "B-bundle",
    blockOrder: "B_THEN_C",
    sessionIndex: 0,
    checkpointIndex: 0,
    phase: "M0_BASELINE",
    pid: 99999, // Process restarted
    deviceTimestampMs: 1792840001000,
  };

  assert.throws(() => {
    validateMemoryCheckpointEvent(eventCrashed, state);
  }, /Process PID mismatch: expected PID 14285, got 99999/i);
});

test("13. Corrupt evidence payload: rejects invalid event types", () => {
  const state = createMemorySessionState("session-test-1", "B-bundle", 0, 14285);
  assert.throws(() => {
    validateMemoryCheckpointEvent(null, state);
  }, /Checkpoint event must be a non-null object/i);

  assert.throws(() => {
    validateMemoryCheckpointEvent({ sessionId: "session-test-1", phase: "INVALID_PHASE" }, state);
  }, /Architecture mismatch/i);
});

test("14. Checksum mismatch in manifest: manifest accurately detects modified file bytes", () => {
  const fileA = { path: "raw/m0.txt", content: "TOTAL PSS: 140000" };
  const manifest1 = generateMemoryEvidenceManifest([fileA]);

  const fileAModified = { path: "raw/m0.txt", content: "TOTAL PSS: 199999" };
  const manifest2 = generateMemoryEvidenceManifest([fileAModified]);

  assert.notEqual(manifest1, manifest2);
  assert.match(manifest1, /^[a-f0-9]{64}\s+raw\/m0\.txt/);
});

test("15. Correct distinction: physical memory reported with hermesJsHeapMeasured = false", () => {
  const mem = parseDumpsysMeminfo(MOCK_MEMINFO_VALID, 14285);
  assert.equal(mem.hermesJsHeapMeasured, false);
  assert.match(mem.hermesJsHeapNote, /Hermes JS heap is not directly measured/i);
  assert.ok(mem.totalPssKb > 0);
  assert.ok(mem.privateDirtyKb > 0);
});
