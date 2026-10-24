# MVE-001A: Android Memory Measurement Harness Readiness & Safety Report

**Document ID:** MVE-001A-RR  
**Directive Reference:** SNAP2FIT — CHIEF ARCHITECT DIRECTIVE MVE-001A  
**Project:** Snap2Fit Mobile Application (ZuniTech)  
**Author:** Antigravity / ARGON  
**Chief Architect:** ChatGPT / ZuniTech Architecture Board  
**Target Milestone:** M2-3A — Architecture Decision Validation  
**Date:** 24 October 2026  
**Readiness Classification:** **READY FOR PHYSICAL EXECUTION (AWAITING OWNER AUTHORIZATION)**  
**Physical Testing Status:** **LOCKED — ZERO PHYSICAL MEASUREMENTS EXECUTED**  

---

## 1. Executive Summary

Directive MVE-001A authorized the offline implementation, safety corrections, synchronization protocols, and regression testing necessary to prepare the Snap2Fit research harness for controlled Android process memory validation comparing **Architecture B (B-bundle)** and **Architecture C (C-split)**.

All safety vulnerabilities identified in previous planning revisions have been resolved:
1. **Safety Correction:** Blanket `am kill-all` commands have been **completely eliminated** and replaced with safe, app-scoped lifecycle controls (`am force-stop host.exp.exponent`).
2. **Device Evidence Protection:** Explicit zero-storage-wipe policies guarantee that device-resident research files and historical benchmarks are never purged.
3. **Attribution Hardening:** The process attribution engine now deterministically parses Android `ps -A` output, strictly validates package identity, rejects duplicate or unexpected processes, and mandates re-attestation after every container restart.
4. **Non-Interfering Synchronization:** A deterministic checkpoint synchronization protocol (`MemoryCheckpointEvent` and `MemorySyncReceipt`) coordinates sampling between operations without altering the core `measureOnce()` timing loop.
5. **Hermes Attribution Boundary:** Explicit data modeling records `hermesJsHeapMeasured: false`, forbidding misleading conflation of OS-level PSS with JavaScript object heap size.

All 67 offline harness unit tests and 296 repository core tests passed with 100% success. The measurement tooling is verified and ready for physical deployment.

---

## 2. Source Files Modified & Created

| File Path | Nature of Change | Core Purpose |
| :--- | :--- | :--- |
| `research/m2-3a/runtime/memory-protocol.ts` | **NEW IMPLEMENTATION** | Process attribution validator, safe `dumpsys meminfo -d` parser, checkpoint sequence state machine, differential metrics calculator, and evidence manifest generator. |
| `research/m2-3a/bench/memory-protocol.test.ts` | **NEW TEST SUITE** | 15 deterministic regression tests covering process discovery, PID reuse, corrupt meminfo, out-of-order events, duplicate checkpoints, and manifest tampering. |
| `research/m2-3a/decision/MVP-001-memory-execution-plan.md` | **REVISED / CORRECTED** | Replaces `am kill-all` with app-scoped controls; defines 4-session repeated-measures protocol; documents observer uncertainty ($\pm 15\text{ms}$). |
| `research/m2-3a/decision/MVP-001-device-process-attribution.md` | **REVISED / CORRECTED** | Documents strict multi-step `ps -A` process selection, Differential Attribution equations, Hermes anonymous `mmap` placement, and heap boundaries. |
| `research/m2-3a/decision/MVP-001-evidence-schema.md` | **REVISED / CORRECTED** | Formal JSON Schema (Draft-07) with synchronization metadata, `hermesJsHeapMeasured: false`, and provisional decision criteria labeling. |

---

## 3. Detailed Audit of Applied Safety Corrections

### A. Process Attribution & Re-Attestation
- **Vulnerability in Prior Plan:** Assuming `host.exp.exponent` always uniquely resolves without validation or re-checking after restart.
- **Correction Applied:** `validateProcessAttribution(pid, expectedPackage, psOutput)` parses full `ps -A` process tables:
  - Fails closed if PID is missing (crash/OOM detection).
  - Rejects duplicate PIDs.
  - Rejects PID reuse by rogue daemons or background packages.
  - Mandates complete re-attestation upon container restart between Architecture B and C blocks.

### B. Memory Definitions & Heap Attribution Boundaries
- **Vulnerability in Prior Plan:** Risk of conflating Android OS-level PSS with Hermes JavaScript object sizes.
- **Correction Applied:**
  - Clear architectural taxonomy: Total PSS, Private Dirty, Private Clean, Native Heap, Dalvik Heap, and Unknown (`mmap` pool).
  - Explicit schema contract: `hermesJsHeapMeasured: false` is permanently recorded on every checkpoint snapshot.
  - Dual reporting: All outputs report both absolute readings and baseline-adjusted deltas ($\Delta \text{PSS} = \text{PSS}_{phase} - \text{PSS}_{M0\_baseline}$).

### C. Checkpoint Synchronization & Observer Accounting
- **Vulnerability in Prior Plan:** Vague synchronization mechanism; claiming zero observer overhead.
- **Correction Applied:**
  - Standardized checkpoint events: `{ sessionId, architecture, sessionIndex, checkpointIndex, phase, pid, deviceTimestampMs }`.
  - Non-interfering sampling: Events trigger *between* timed benchmark operations, preventing CPU contention during latency measurement.
  - Observer uncertainty explicitly documented: $\sim 15\text{ms}$ socket transit + ADB dumpsys latency window.

### D. Device Safety & Zero Storage Destruction
- **Vulnerability in Prior Plan:** Blanket `am kill-all` disrupts Android OS; risk of clearing Expo Go storage.
- **Correction Applied:**
  - Blanket kills removed. Strict app-scoped lifecycle used exclusively: `adb shell am force-stop host.exp.exponent`.
  - Explicit storage protection: Wiping app data or cache directories is strictly forbidden.
  - Controlled experimental parameters: Ambient temperature, battery SOC (80–95%), screen brightness (20%), and airplane mode are tracked as controlled experimental conditions, not assumed guarantees.
  - Thermal interlock: Immediate abort if battery temperature exceeds $38^\circ\text{C}$.

### E. Experimental Independence & Statistical Modeling
- **Vulnerability in Prior Plan:** Treating 64 snapshots as 64 independent experimental subjects.
- **Correction Applied:**
  - Formal Repeated-Measures Factorial Model:
    - Between-Sessions factor: $N=4$ independent test sessions.
    - Within-Session factor: Balanced alternating order (AB / BA / AB / BA).
    - Within-Session factor: 8 lifecycle phase checkpoints per architecture run.

### F. Decision Threshold Reclassification
- **Vulnerability in Prior Plan:** Treating 25% memory reduction as an automatic production shipping mandate.
- **Correction Applied:** Reclassified as **provisional engineering guidelines**. Final architectural selection requires holistic evaluation across startup latency, batch throughput, offline reliability, and memory footprints.

---

## 4. Offline Regression Test Results

Deterministic unit tests were executed offline using `node:test` and `tsx`:

### A. Memory Measurement Protocol Test Suite (`memory-protocol.test.ts`)
```text
✔ 1. Missing process: PID not found in process list is rejected (1.16ms)
✔ 2. Unexpected PID changes: validates that expected PID matches active process (0.16ms)
✔ 3. Reused PID after process restart: package mismatch is detected (0.16ms)
✔ 4. Incorrect process package attribution: PID belongs to another app (0.17ms)
✔ 5. Valid memory output: dumpsys meminfo -d parses correctly (0.66ms)
✔ 6. Unsupported or missing memory fields: handles missing lines safely with defaults (0.14ms)
✔ 7. Malformed numeric values: throws error when Total PSS is unparseable (0.43ms)
✔ 8. Duplicate checkpoints: rejects duplicate phase in same session (0.32ms)
✔ 9. Missing / skipped checkpoints: detects gap in phase sequence (0.19ms)
✔ 10. Out-of-order events: rejects inverted checkpoint arrival (0.23ms)
✔ 11. Baseline PID / session mismatch: detects baseline comparison error (0.32ms)
✔ 12. Interrupted collection: validates session aborts on PID change mid-session (0.15ms)
✔ 13. Corrupt evidence payload: rejects invalid event types (0.19ms)
✔ 14. Checksum mismatch in manifest: manifest accurately detects modified file bytes (0.60ms)
✔ 15. Correct distinction: physical memory reported with hermesJsHeapMeasured = false (0.20ms)

Total Tests: 15 | Passed: 15 | Failed: 0 | Duration: 273.9ms
```

### B. Offline Contract & Harness Suite (`contract.test.ts`)
```text
Total Tests: 52 | Passed: 52 | Failed: 0 | Duration: 945.2ms
Combined Harness Tests: 67 of 67 PASSED (100% Pass Rate)
```

### C. Core Repository Test Suite (`npm test`)
```text
Total Tests: 296 | Passed: 296 | Failed: 0 | Duration: 12.2s
```

---

## 5. Evidence Integrity & Historical Checksums

The authoritative historical benchmark evidence was independently verified and remains completely untouched:

| Evidence File | Path | Checksum (SHA-256) | Status |
| :--- | :--- | :--- | :--- |
| **B30 Evidence** | `research/m2-3a/evidence/b30-evidence.json` | `3CBFFE49140801EA8CE76C3DD0151860357D5B9E92BCCBD98734D2E43202118B` | **VERIFIED UNCHANGED** |
| **C30 Evidence** | `research/m2-3a/evidence/c30/c30-evidence.json` | `23C648B0459FF5F3D9A9B66504A55F8BF7985658E03A10B9C2F727458B667A6A` | **VERIFIED UNCHANGED** |

---

## 6. Physical Execution Prerequisites

Before the physical 64-snapshot experiment can be unlocked under a future directive:
1. **Physical Handset:** Pixel 6a (`19301FDEE003AS`) connected via high-speed USB-C.
2. **Reverse Port Bridges:** `adb reverse tcp:8081 tcp:8081` and `adb reverse tcp:8082 tcp:8082` active.
3. **Battery & Thermal Window:** Battery level between 80% and 95%; initial battery temperature $\le 34^\circ\text{C}$.
4. **Airplane Mode:** Verified active on handset (Wi-Fi, Bluetooth, Cellular disabled).
5. **Screen Lock:** Screen set to 20% brightness and awake while charging.

---

## 7. Readiness Classification & Final Verdict

**FINAL VERDICT: READY FOR PHYSICAL EXECUTION (PENDING OWNER DIRECTIVE MVE-001B)**

All offline tooling, safe lifecycle controls, process attribution validators, synchronization endpoints, and regression tests are implemented, verified, and passing. The codebase is in a safe, non-destructive, and deterministic state. Zero physical measurements have been initiated.

---

## 8. NEXT RECOMMENDED DIRECTIVE

To proceed from offline preparation to empirical data collection, the following continuation directive is proposed for Project Owner authorization:

### Proposed Directive: `SNAP2FIT — CHIEF ARCHITECT DIRECTIVE MVE-001B`
- **Title:** Controlled Physical Android Memory Validation Execution
- **Objective:** Execute the 4-session alternating physical memory benchmark on Google Pixel 6a according to `MVP-001-memory-execution-plan.md` using the verified `memory-protocol.ts` harness.
- **Scope of Execution:**
  - 4 sessions (AB, BA, AB, BA).
  - 64 raw `dumpsys meminfo -d` captures preserved under `research/m2-3a/evidence/memory/raw/`.
  - Structured evidence artifact: `research/m2-3a/evidence/memory/mvp-001-memory-evidence.json`.
  - Analysis report: `research/m2-3a/decision/MVE-001B-memory-validation-results.md`.
- **Mandatory Safety Interlocks:**
  - Automatic abort on thermal spike ($> 38^\circ\text{C}$).
  - Automatic abort on PID drop / OOM killer termination.
  - Draft PR #7 remains OPEN, DRAFT, and UNMERGED throughout.
