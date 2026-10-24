# MVE-001A-R1: End-to-End Memory Capture Integration Verification Report

**Document ID:** MVE-001A-R1-IVR-FINAL  
**Directive Reference:** SNAP2FIT — CHIEF ARCHITECT DIRECTIVE MVE-001A-R1  
**Project:** Snap2Fit Mobile Application (ZuniTech)  
**Author:** Antigravity / ARGON  
**Chief Architect:** ChatGPT / ZuniTech Architecture Board  
**Target Milestone:** M2-3A — Architecture Decision Validation  
**Date:** 24 October 2026  
**Status:** COMPLETE & VERIFIED (OFFLINE SIMULATION & INTEGRATION READINESS)  
**Physical Benchmark Status:** LOCKED PENDING OWNER DIRECTIVE MVE-001B  

---

## 1. Executive Summary & Verification Verdict

Under Directive **MVE-001A-R1**, the full operational memory measurement toolchain connecting the Windows host orchestrator to the device checkpoint protocol was implemented, proven, and deterministically verified offline.

The measurement harness bridges the gap identified between raw protocol definitions and end-to-end execution:
1. **Windows Host Memory Orchestrator (`memory-orchestrator.ts`)**: Implements pluggable ADB transports (`PhysicalAdbTransport` and `MockAdbTransport`), exclusive atomic persistence (`flag: "wx"`), sequence/state validation, and automated SHA-256 evidence manifest generation.
2. **Device Checkpoint Runner (`memory-runner.ts`)**: Encapsulates catalogue lifecycle execution across phases M0 through M7 with strict host acknowledgment, observer latency delta accounting, and fail-closed abort semantics.
3. **End-to-End 64-Checkpoint Simulation**: Fully simulated 4 independent alternating sessions (Session 1: B→C, Session 2: C→B, Session 3: B→C, Session 4: C→B) totaling 64 snapshots, with 100% acceptance, zero file collisions, exact differential subtraction, and schema validation.
4. **Deterministic Negative Testing**: 14 integration test cases verifying duplicate rejection (HTTP 409), out-of-order rejection (HTTP 400), mid-session PID replacement abortion (HTTP 409), process attribution failure, raw file tamper detection, and exclusive file collision guards.

### Verification Verdict: READY FOR PHYSICAL EXECUTION (PENDING OWNER DIRECTIVE MVE-001B)

All 81 research harness tests, 296 repository core tests, 84 UI tests, and root + device TypeScript checks pass with zero errors (exit code 0).

---

## 2. Tooling Architecture

### 2.1 Component Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                           WINDOWS HOST HARNESS (127.0.0.1)                        |
|                                                                                   |
|   +---------------------------------------------------------------------------+   |
|   |                  MemoryOrchestrator (memory-orchestrator.ts)              |   |
|   |                                                                           |   |
|   |   +-------------------+  POST /memory/checkpoint  +-------------------+   |   |
|   |   |   HTTP Server     |<--------------------------|   Memory Runner   |   |   |
|   |   |  (Loopback Only)  |-------------------------->|  (Device Client)  |   |   |
|   |   +---------+---------+   HTTP 200 SyncReceipt    +---------+---------+   |   |
|   |             |                                               |             |   |
|   |             v                                               v             |   |
|   |   +-------------------+                           +-------------------+   |   |
|   |   | Attribution &     |                           | Catalogue Stores  |   |   |
|   |   | Sequence Check    |                           | (B-bundle/C-split)|   |   |
|   |   +---------+---------+                           +-------------------+   |   |
|   |             |                                                             |   |
|   |             v                                                             |   |
|   |   +-------------------+                           +-------------------+   |   |
|   |   |   AdbTransport    |                           | M0..M7 Checkpoint |   |   |
|   |   | (Physical / Mock) |                           | Lifecycle Phases  |   |   |
|   |   +---------+---------+                           +-------------------+   |   |
|   |             |                                                             |   |
|   |             +-----------------------+                                     |   |
|   |                                     |                                     |   |
|   |                                     v                                     |   |
|   |                        +-------------------------+                        |   |
|   |                        |  Exclusive File Writer  |                        |   |
|   |                        | (flag: 'wx', no-overwr) |                        |   |
|   |                        +------------+------------+                        |   |
|   |                                     |                                     |   |
|   +-------------------------------------|-------------------------------------+   |
|                                         v                                         |
|                       +----------------------------------+                        |
|                       |  research/m2-3a/evidence/memory/ |                        |
|                       |    ├── raw/*.txt                 |                        |
|                       |    ├── evidence.json             |                        |
|                       |    └── manifest-memory.sha256    |                        |
|                       +----------------------------------+                        |
+-----------------------------------------------------------------------------------+
```

### 2.2 Key Implementation Source Files

| File Path | Purpose |
|---|---|
| `research/m2-3a/bench/memory-orchestrator.ts` | Host orchestrator, `AdbTransport` abstraction, exclusive raw dump writer, evidence aggregator, SHA-256 manifest builder. |
| `research/m2-3a/runtime/memory-runner.ts` | Client/device profiling runner, M0–M7 lifecycle dispatcher, HTTP checkpoint sender, receipt integrity validator. |
| `research/m2-3a/runtime/memory-protocol.ts` | Process attribution rules, safe `dumpsys meminfo` parser, sequence validator, differential metrics, statistical calculators. |
| `research/m2-3a/bench/memory-orchestrator.test.ts` | Deterministic integration test suite covering 64-snapshot simulation and 13 failure/validation modes. |
| `research/m2-3a/bench/memory-protocol.test.ts` | Deterministic unit tests covering protocol parsers, token boundaries, and regex validators. |

---

## 3. Protocol & Synchronization Specifications

### 3.1 Lifecycle Phases (M0–M7)

Each architecture block executes the following standardized sequence:

| Phase Index | Checkpoint Phase | Workload Trigger | Primary Memory Question |
|---|---|---|---|
| 0 | `M0_BASELINE` | App launched; idle container state before opening catalogue | Container footprint ($\text{PSS}_{\text{base}}$) |
| 1 | `M1_POST_OPEN_US` | `runtime.open("US")` completed | US index ingestion cost |
| 2 | `M2_POST_OPEN_CA` | `runtime.open("CA")` completed | **Peak ingestion footprint** (US + CA dual-market) |
| 3 | `M3_POST_SEARCH` | Search queries executed (`chicken`, `apple`, `spinach`) | Query cache allocation |
| 4 | `M4_POST_RECIPE` | Recipe ingredient resolution executed (138 keys) | Multi-item detail payload expansion |
| 5 | `M5_POST_REPEAT` | 50 repeated search queries executed | Intermediate string allocation & churn |
| 6 | `M6_POST_CACHE` | Detail lookup across registry items completed | **Sustained workload footprint** (LRU cache saturation) |
| 7 | `M7_POST_GC` | Teardown runtime, invoke `global.gc?.()`, 50ms settle | Post-settle retained footprint / leakage |

### 3.2 Device-to-Host Checkpoint Synchronization Protocol

1. **Client Event Formulation**: Device emits a `POST /memory/checkpoint` request containing:
   - `sessionId`: Unique block run identifier (e.g., `m2-3a-mem-s1-b-then-c-1792840000000`).
   - `architecture`: `"B-bundle"` or `"C-split"`.
   - `blockOrder`: `"B_THEN_C"` or `"C_THEN_B"`.
   - `sessionIndex`: 0 to 3.
   - `checkpointIndex`: 0 to 7.
   - `phase`: One of `MEMORY_CHECKPOINT_PHASES`.
   - `pid`: Active process ID.
   - `deviceTimestampMs`: Monotonic client time.
2. **Process Attribution Validation**: Orchestrator queries `adb shell ps -A` and matches PID against package `host.exp.exponent`.
3. **Session PID Binding**: The PID must strictly match the session's registered PID. Mid-session PID change throws HTTP 409 Conflict.
4. **Sequence Verification**: Checkpoint index must equal `currentCheckpointIndex`. Skips throw HTTP 400. Duplicate phase throws HTTP 409.
5. **Memory Capture**: Host executes `dumpsys meminfo -d <pid>` via ADB.
6. **Atomic Persistence**: Raw meminfo text is written immediately to `raw/<sessionId>_<arch>_<phase>_<timestamp>.txt` with exclusive write flag (`flag: "wx"`).
7. **Differential Calculation**: Baseline $\text{PSS}_{\text{base}}$ from M0 is subtracted from current PSS.
8. **Acknowledgment Receipt**: Orchestrator returns HTTP 200 with `MemorySyncReceipt`:
   - `receiptId`: `rcpt_<sha256_prefix>`.
   - `hostTimestampMs`: Host monotonic clock.
   - `observedDeltaMs`: Absolute difference between host and device clocks (observer uncertainty).
9. **Client Verification**: Client validates that receipt matches phase and index before advancing. If receipt is invalid or missing, client aborts immediately.

---

## 4. End-to-End 64-Checkpoint Simulation Results

The deterministic simulation executed 4 independent alternating sessions, validating all 64 checkpoints without failure:

### 4.1 Session Order & Snapshot Matrix

| Session Index | Session Order | Block 1 (8 CPs) | Block 2 (8 CPs) | Total Snapshots | Status |
|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | `B_THEN_C` | Architecture B (M0–M7) | Architecture C (M0–M7) | 16 | ACCEPTED |
| 2 | `C_THEN_B` | Architecture C (M0–M7) | Architecture B (M0–M7) | 16 | ACCEPTED |
| 3 | `B_THEN_C` | Architecture B (M0–M7) | Architecture C (M0–M7) | 16 | ACCEPTED |
| 4 | `C_THEN_B` | Architecture C (M0–M7) | Architecture B (M0–M7) | 16 | ACCEPTED |
| **Total** | — | **32 Snapshots** | **32 Snapshots** | **64** | **100% ACCEPTED** |

### 4.2 Simulated Statistical Summary

```json
{
  "B-bundle": {
    "peakIngestionDeltaMeanKb": 50000,
    "peakIngestionDeltaStdKb": 0,
    "sustainedWorkloadDeltaMeanKb": 63000,
    "sustainedWorkloadDeltaStdKb": 0,
    "leakRateKbPerIteration": 0
  },
  "C-split": {
    "peakIngestionDeltaMeanKb": 4000,
    "peakIngestionDeltaStdKb": 0,
    "sustainedWorkloadDeltaMeanKb": 43000,
    "sustainedWorkloadDeltaStdKb": 0,
    "leakRateKbPerIteration": 0
  },
  "comparison": {
    "peakIngestionDeltaReductionPct": 92.0,
    "sustainedWorkloadDeltaReductionPct": 31.75,
    "welchTStatistic": 0,
    "cohensD": 0
  },
  "provisionalEvaluation": {
    "peakIngestionReductionGe25Pct": true,
    "sustainedExpansionLe15Pct": true,
    "leakRateLe100KbPerIter": true,
    "provisionalVerdict": "PROVISIONAL_CONFIRMED_C_ADVANTAGE",
    "notes": "Architecture C confirmed memory advantage: >=25% peak PSS reduction with bounded sustained footprint."
  }
}
```

### 4.3 Synthetic Evidence Disclaimers

To prevent any possibility of confusing synthetic simulation data with physical device evidence, the orchestrator enforces:
1. `isSynthetic: true` top-level boolean flag in evidence JSON.
2. Explicit disclaimer: `"syntheticDisclaimer": "SIMULATED OFFLINE HARNESS RUN - NOT PHYSICAL DEVICE MEASUREMENT"`.
3. Separate manifest naming: `manifest-synthetic-memory.sha256`.
4. Isolation: Tests operate in isolated temp directories and clean up upon completion.

---

## 5. Offline Regression Test Results

### 5.1 Test Breakdown

| Suite | File | Tests | Passed | Failed |
|---|---|:---:|:---:|:---:|
| Research Harness Contracts | `research/m2-3a/bench/contract.test.ts` | 52 | 52 | 0 |
| Memory Protocol Validators | `research/m2-3a/bench/memory-protocol.test.ts` | 15 | 15 | 0 |
| Memory Orchestrator & E2E Sim | `research/m2-3a/bench/memory-orchestrator.test.ts` | 14 | 14 | 0 |
| Repository Core Tests | `tests/*.test.ts` | 296 | 296 | 0 |
| Repository UI Tests | `tests/*.ui.test.tsx` | 84 | 84 | 0 |
| **Total** | — | **461** | **461** | **0** |

### 5.2 Deterministic Failure Modes Verified

1. **Duplicate Checkpoint**: Attempting duplicate submission of an accepted phase in the same session is rejected with HTTP 409 Conflict.
2. **Out-of-Order Checkpoint**: Submitting phase index 2 when expecting index 1 is rejected with HTTP 400 Bad Request.
3. **Skipped Checkpoint**: Jumping from M0 to M3 is rejected with HTTP 400 Bad Request.
4. **Process Attribution Failure**: PIDs not belonging to `host.exp.exponent` (e.g. `com.rogue.app`) are rejected before capture.
5. **Mid-Session PID Replacement**: PID changing mid-session triggers abort with HTTP 409 Conflict.
6. **Exclusive Persistence (`wx`)**: Re-writing an existing snapshot path throws `EEXIST` rather than overwriting.
7. **Interrupted Session Evidence Preservation**: Previously captured raw files are preserved intact on disk following mid-session failure.
8. **Client Runner Receipt Verification**: Runner rejects malformed or non-"accepted" receipts immediately.
9. **Manifest Tamper Detection**: Modifying a single byte in any persisted raw snapshot file invalidates the SHA-256 manifest.
10. **Hermes JS Heap Distinction**: All snapshots report `hermesJsHeapMeasured: false` with explanatory disclaimers.

---

## 6. Physical Execution Prerequisites for Directive MVE-001B

The measurement harness is completely verified offline. Before the Owner authorizes physical testing (**MVE-001B**), the following physical device conditions must be satisfied:

1. **Hardware Identity**: Google Pixel 6a (`19301FDEE003AS`) running Android 14 (API 34).
2. **ADB Transport**: Platform-tools `adb.exe` at `C:\Users\EC\AppData\Local\Android\Sdk\platform-tools\adb.exe` verified via `adb devices`.
3. **Port Forwarding**: Reverse TCP tunnels established:
   - `adb reverse tcp:8081 tcp:8081` (Metro bundler)
   - `adb reverse tcp:8082 tcp:8082` (Memory orchestrator & asset server)
4. **Thermal Window**: Battery temperature verified between $25^\circ\text{C}$ and $34^\circ\text{C}$ via `adb shell dumpsys battery`. Abort threshold: $38^\circ\text{C}$.
5. **Battery SOC**: Between 80% and 95% to avoid low-battery throttling and aggressive charging thermals.
6. **Environmental Constraints**:
   - Airplane Mode: Enabled.
   - Wi-Fi & Bluetooth: Disabled.
   - Screen: 20% fixed brightness, display awake while plugged in.
   - Background Apps: Closed; no competing foreground tasks.
7. **Storage Protection**: No `am kill-all`, no storage clearing, zero wiping of Expo Go data directories.

---

## 7. Evidence Immutability Check

All historical timing benchmark files remain bit-for-bit identical:
- **B30 Benchmark SHA-256**: `3CBFFE49140801EA8CE76C3DD0151860357D5B9E92BCCBD98734D2E43202118B`
- **C30 Benchmark SHA-256**: `23C648B0459FF5F3D9A9B66504A55F8BF7985658E03A10B9C2F727458B667A6A`

Production `src/` codebase is 100% untouched.

---

## 8. Final Verdict

**MVE-001A-R1 READINESS VERDICT:** **READY**  
**PHYSICAL 64-SNAPSHOT EXPERIMENT STATUS:** **LOCKED** (Pending Owner Directive MVE-001B).