# Snap2Fit M2-3A: Physical Memory Validation Plan (Future Milestone Proposal)

**Document ID**: `M2-3A-DEC-004`  
**Reference Directive**: `SNAP2FIT — CHIEF ARCHITECT DIRECTIVE ADR-001` (Section 10)  
**Date**: 24 October 2026  
**Status**: PROPOSAL & PROTOCOL SPECIFICATION ONLY — IMPLEMENTATION NOT AUTHORIZED  
**Project**: Snap2Fit / Snap to Fit (ZuniTech)  
**Authoring Agent**: Antigravity / ARGON  
**Chief Architect**: ChatGPT  
**Git Worktree**: `C:\Users\EC\AppData\Roaming\com.zunitech.zcode\chat-sessions\2026-10-21\c15ac950d74c449d83a21c4cdc6128bc\snap-to-fit`  
**Branch**: `feat/m2-3-device-benchmark-harness`  
**Draft PR #7**: [https://github.com/z-sops/snap-to-fit/pull/7](https://github.com/z-sops/snap-to-fit/pull/7)  

---

## 1. Context and Problem Statement

### 1.1 The Hermes Memory Evidence Gap
In both the B30 and C30 physical benchmarks, the primary JSON evidence artifacts record:
```json
"memory": {
  "platform_required": true,
  "note": "Hermes does not expose a JavaScript heap size; the memory figure has to come from the platform."
}
```

Because the application runs on Android via the Hermes JavaScript bytecode engine inside Expo Go SDK 57, standard V8 `performance.memory` APIs are unavailable. Consequently, **no empirical memory metrics (heap size, process PSS, RSS, or native memory) were captured during M2-3A**.

### 1.2 The "Inferred Memory" Anti-Pattern
It is a dangerous architectural fallacy to infer memory superiority from disk file structure alone. While Architecture C loads smaller initial index tables into JavaScript objects, Architecture C also introduces:
1. Native file handle caches and buffer overhead in Expo FileSystem (`readSlice`).
2. An in-memory LRU cache storing decoded food detail objects.
3. Multiple string allocations during Base64 / binary slice decoding.

Therefore, **Directive ADR-001 strictly classifies physical memory comparison between Architecture B and Architecture C as UNVERIFIED**. Any claim that Architecture C uses less RAM on Android is currently an unproven hypothesis.

This document outlines a rigorous, non-destructive memory profiling methodology for a future authorized gate.

---

## 2. Hard Execution Boundaries Under ADR-001

> [!WARNING]
> **NO EXECUTION AUTHORIZED UNDER ADR-001**:  
> - No ADB commands (`dumpsys meminfo`, `kill`, `am start`).  
> - No physical device interaction or memory profiling.  
> - No code modifications to `App.tsx` or `src/`.  
> This document is exclusively a planning and design proposal for the Project Owner and Chief Architect.

---

## 3. Objective and Memory Invariants to Measure

The goal of the future memory verification milestone is to quantitatively determine whether Architecture C reduces physical memory pressure compared to Architecture B under realistic mobile operating conditions.

### Target Metrics
1. **Total PSS (Proportional Set Size)**: The authoritative Android metric representing actual physical RAM consumed by the app process, accounting for shared libraries.
2. **Native Heap (PSS & Private Dirty)**: Memory allocated via `malloc`/`mmap` by the React Native C++ runtime, Hermes VM engine, and Android OS graphics pipeline.
3. **Dalvik/Hermes Heap (Private Dirty)**: Memory dedicated to JavaScript objects, closures, strings, and parsed JSON structures.
4. **Peak Allocation (High-Water Mark)**: The maximum PSS observed during the heavy catalogue open phase (parsing 22.6MB JSON in Architecture B vs loading index in Architecture C).
5. **Sustained Post-Workload Allocation**: Resident memory after completing full search, recipe resolution, and filling the LRU cache (166 items / 454KB).
6. **Leak and Growth Gradient**: Memory slope $\Delta \text{PSS} / \Delta \text{iteration}$ across 30 consecutive iterations to confirm that the LRU cache strictly bounds memory growth.

---

## 4. Proposed Instrumentation Architecture and Collection Protocol

### 4.1 External Host-Driven Sampling (Non-Intrusive)
Rather than attempting to measure memory from inside the JavaScript runtime (which perturbs garbage collection and introduces measuring artifacts), sampling must be conducted externally via the Android Debug Bridge (ADB) from the Windows host machine:

```powershell
adb -s 19301FDEE003AS shell dumpsys meminfo host.exp.exponent -d
```

### 4.2 Lifecycle Measurement Gates (Phased Sampling)

For each candidate architecture (B vs C), measurements must be sampled at standardized phase gates:

| Phase Gate | Execution Point | Architectural Purpose |
| :--- | :--- | :--- |
| **`M0_BASELINE`** | Immediately after Expo Go boots, before catalogue import. | Measure idle container baseline RAM. |
| **`M1_POST_OPEN_US`** | 500ms after opening the US catalogue (8,257 records). | Capture peak ingestion and parsing heap expansion. |
| **`M2_POST_OPEN_CA`** | 500ms after opening the CA catalogue (5,993 records). | Capture multi-market cumulative memory footprint. |
| **`M3_POST_SEARCH`** | After executing cold, warm, and repeated search passes. | Measure search index memory retention. |
| **`M4_POST_RECIPE`** | After resolving 138 recipe ingredients. | Measure detail cache allocation and slice buffer retention. |
| **`M5_POST_CACHE_PASS`**| After completing 166-entry LRU cache pass. | Measure bounded cache high-water mark. |
| **`M6_POST_GC`** | After forcing GC via `adb shell am dumpheap -n` or 5-second idle settling. | Measure uncollectable retained resident set. |

### 4.3 Controlled Experimental Invariants
1. **Device Thermal Baseline**: Ensure battery temperature is $\le 34^\circ\text{C}$ before starting benchmark to avoid Android OS aggressive background trimming.
2. **Background Process Elimination**: Terminate non-essential background services; disable auto-updates and notifications.
3. **Screen Brightness & State**: Device screen must remain awake at 50% brightness in foreground mode.
4. **Identical Compilation Target**: Both B and C must run on identical Hermes bytecode builds inside Expo Go SDK 57.

---

## 5. Structured Output Schema for Memory Evidence

Upon future authorization, the memory collector will emit a structured evidence file `research/m2-3a/evidence/memory-comparison.json` conforming to:

```json
{
  "schemaVersion": "m2-3a-memory-1.0",
  "device": {
    "model": "Pixel 6a",
    "serial": "19301FDEE003AS",
    "androidVersion": 17,
    "apiLevel": 37
  },
  "runs": {
    "architectureB": {
      "runId": "m2-3a-mem-B-30x-...",
      "baselinePssKb": 142500,
      "peakPssKb": 248900,
      "postWorkloadPssKb": 231400,
      "nativeHeapKb": 85200,
      "dalvikHeapKb": 98400,
      "growthRateKbPerIteration": 12.4
    },
    "architectureC": {
      "runId": "m2-3a-mem-C-30x-...",
      "baselinePssKb": 142100,
      "peakPssKb": 168400,
      "postWorkloadPssKb": 172300,
      "nativeHeapKb": 79100,
      "dalvikHeapKb": 41200,
      "growthRateKbPerIteration": 8.1
    }
  },
  "delta": {
    "peakPssDeltaKb": -80500,
    "peakPssPercent": -32.34,
    "sustainedPssDeltaKb": -59100,
    "sustainedPssPercent": -25.54
  }
}
```

---

## 6. Decision Triggers and Acceptance Criteria

When executed under future authorization, the memory benchmark results shall drive architecture decisions based on the following pre-established thresholds:

1. **Decisive Architecture C Advantage**:
   If Architecture C achieves $\ge 25\%$ reduction in Peak PSS and $\ge 20\%$ reduction in Sustained PSS without memory leaks ($\Delta \text{PSS} / \Delta \text{iteration} \approx 0$), Architecture C's memory advantage is officially verified.
2. **Neutral / Inconsequential Outcome**:
   If Peak PSS reduction is $< 10\%$ (e.g., if native FileSystem overhead and Base64 buffers offset JavaScript heap savings), the decision must rely exclusively on CPU/I/O latency and user experience trade-offs.
3. **Architecture C Rejection Trigger**:
   If Architecture C demonstrates continuous PSS growth across 30 iterations (indicating file descriptor leaks or buffer retention in Expo FileSystem), Architecture C must be rejected or redesigned prior to production implementation.
