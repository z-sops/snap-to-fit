# MVP-001: Android Process Memory Attribution & Hermes Subsystem Analysis (MVE-001A Revised)

**Document ID:** MVP-001-DPA-REV1  
**Directive Reference:** SNAP2FIT — CHIEF ARCHITECT DIRECTIVES MVP-001 & MVE-001A (Section 4)  
**Project:** Snap2Fit Mobile Application (ZuniTech)  
**Author:** Antigravity / ARGON  
**Chief Architect:** ChatGPT / ZuniTech Architecture Board  
**Target Milestone:** M2-3A — Architecture Decision Validation  
**Date:** 24 October 2026  
**Status:** READY FOR AUTHORIZATION (TECHNICAL REFERENCE ONLY)  

---

## 1. Executive Summary & Attribution Principles

Accurate memory profiling on mobile devices requires a rigorous understanding of the operating system's memory model. On Android, naive memory reporting frequently succumbs to three major attribution fallacies:
1. **Container Baseline Conflation:** Attributing the ~120–150 MB baseline memory of the Expo Go development container (including the Metro bundler client, React DevTools, and preloaded native modules) to the application catalogue workload.
2. **Runtime Misattribution:** Conflating operating-system-level process memory (`dumpsys meminfo`) with JavaScript heap object sizes.
3. **Subsystem Confusion:** Failing to distinguish between C++ Native allocations (where Hermes bytecode and JSI buffers reside) and Java Dalvik allocations.

This document formalizes the **Android Process Memory Attribution Model** on Google Pixel 6a (Android 17 / API Level 37). It details the strict multi-step process selection pipeline, the **Differential Attribution Model**, and the anatomical dissection of Hermes runtime memory subsystems.

---

## 2. Multi-Step Process Selection & Re-Attestation Pipeline

> [!CAUTION]
> **DO NOT ASSUME A SINGLE PROCESS BLINDLY:**  
> It is an error to assume that `host.exp.exponent` always resolves to a single unique process or that the PID remains constant across sessions. The harness must validate process identity before every checkpoint and re-validate after every container restart.

### A. The Target Package: `host.exp.exponent`
In the Expo Go environment on Android, the entire React Native runtime, Hermes virtual machine, and benchmark application run inside the Android application sandbox named:
```text
Package Name: host.exp.exponent
User ID (UID): u0_aXXX (assigned dynamically by Android OS)
```

### B. Process Attribution Verification Algorithm
The host orchestrator implements `validateProcessAttribution()` in `research/m2-3a/runtime/memory-protocol.ts`:
1. **Full Process Inspection:** Executes `adb shell ps -A -o USER,PID,PPID,VSZ,RSS,WCHAN,ADDR,S,NAME | grep host.exp.exponent`.
2. **Missing Process Rejection:** If no line matches the expected PID, the harness rejects attribution and aborts the session (indicating app crash or OOM termination).
3. **Duplicate Process Rejection:** If multiple processes share or claim the PID, or if multiple rogue Expo instances are detected, attribution is rejected.
4. **Package Identity Mismatch:** If the PID resolves to a different process (e.g. `com.android.systemui` or a rogue background task), the harness detects PID reuse and halts.
5. **Post-Restart Re-Validation:** Whenever Expo Go is restarted between Architecture B and Architecture C blocks, the PID must be re-discovered and re-attested from scratch.

---

## 3. Isolating Container Baseline: The Differential Attribution Model

### A. The Container Baseline Problem
When Expo Go boots on Android, it initializes:
- The Android ART (Android Runtime) VM and Java framework classes (~40–50MB).
- The React Native C++ core (Yoga layout engine, Fabric surface pipeline, JSI bridge) (~35–45MB).
- The Metro websocket debugging client, Dev Menu overlay, and bundled Expo native modules (~30–40MB).
- Graphics surfaces (EGL surface, Vulkan pipeline buffers) (~15–20MB).

As a result, an empty Expo Go container on Pixel 6a typically exhibits a baseline Total PSS of **120 MB to 150 MB** *before a single line of catalogue data is loaded*.

### B. Differential Attribution Equations
Reporting raw Total PSS alone would obscure whether Architecture C saves 50MB of catalogue memory or merely 5MB, because the 140MB container baseline dominates the figure. Therefore, the memory validation harness mandates **Differential Attribution**:

$$\Delta \text{PSS}_{phase} = \text{PSS}_{phase} - \text{PSS}_{M0\_baseline}$$

$$\Delta \text{PrivateDirty}_{phase} = \text{PrivateDirty}_{phase} - \text{PrivateDirty}_{M0\_baseline}$$

$$\Delta \text{NativeHeap}_{phase} = \text{NativeHeap}_{phase} - \text{NativeHeap}_{M0\_baseline}$$

- **$\text{PSS}_{M0\_baseline}$**: Captured at checkpoint `M0_BASELINE` (app rendered, idle 5 seconds, zero catalogue data loaded).
- **$\Delta \text{PSS}_{phase}$**: Represents the true marginal physical RAM consumed specifically by catalogue ingestion, in-memory search indices, and detail caching.

Both the raw absolute readings and the baseline-adjusted deltas are reported side-by-side in all evidence outputs.

---

## 4. Dissection of Android `dumpsys meminfo` Subsystems

The primary diagnostic tool used by the host orchestrator is:
```bash
adb shell dumpsys meminfo <PID> -d
```

### A. Primary Operating System Metrics

| Metric | OS Definition | Relevance to Snap2Fit Architecture |
| :--- | :--- | :--- |
| **Total PSS (Proportional Set Size)** | Physical RAM mapped by the process, plus shared system libraries divided proportionally among all sharing processes. | **Primary architectural comparison metric.** Reflects true physical RAM impact on the Android system. |
| **Private Dirty** | Physical RAM dedicated exclusively to this process that has been modified. It cannot be paged out to disk without swapping. | **Crucial reliability metric.** High Private Dirty is the primary trigger for Android Low Memory Killer (LMK) terminations. |
| **Private Clean** | Mapped clean pages (e.g. read-only `.dex` or `.so` code) that the OS can evict to disk under pressure without data loss. | Low risk; reflects read-only code and asset pack mappings. |
| **Swap PSS (zRAM)** | Compressed pages swapped into Android's zRAM kernel partition. | Measures OS memory pressure and page eviction activity. |
| **RSS (Resident Set Size)** | Total physical pages referenced by the process, without accounting for shared libraries. | Reported for completeness, but secondary to PSS because RSS double-counts shared memory. |

### B. Subsystem Breakdown and Hermes Heap Placement

```text
                       dumpsys meminfo Breakdown
+-------------------------------------------------------------------------+
| Native Heap  | C++ runtime, malloc, Hermes VM Bytecode, JSI, Yoga, I/O   |
+-------------------------------------------------------------------------+
| Dalvik Heap  | Java / ART objects, Android View hierarchy, Expo bridges |
+-------------------------------------------------------------------------+
| Unknown      | Custom anonymous mmap pools (Hermes GC heap blocks)      |
+-------------------------------------------------------------------------+
| .so / .dex   | Mapped native binaries and compiled Java bytecode        |
+-------------------------------------------------------------------------+
| GfxDev / EGL | Render surfaces, OpenGL/Vulkan texture buffers           |
+-------------------------------------------------------------------------+
```

1. **Native Heap (`Native Heap PSS` / `Native Heap Dirty`):**
   - Allocations via standard C `malloc` / C++ `new`.
   - In React Native on Hermes, this contains C++ string buffers, JSI host objects, Yoga layout tree structures, and Expo FileSystem I/O read buffers (`readSlice`).
2. **Dalvik Heap (`Dalvik Heap PSS` / `Dalvik Heap Dirty`):**
   - Java-level memory managed by the Android ART runtime.
   - For Snap2Fit, Dalvik heap is largely static after boot because all catalogue parsing, index searching, and detail calculations occur inside C++ / Hermes.
3. **Unknown (`Unknown PSS` / `Unknown Dirty`):**
   - **Crucial for Hermes:** Hermes allocates large, contiguous virtual memory blocks using direct `mmap(MAP_ANONYMOUS)` system calls to manage its garbage-collected heap.
   - On Android 17, `dumpsys meminfo` categorizes anonymous `mmap` blocks outside `malloc` as **Unknown**. Therefore, **changes in Hermes JavaScript heap size predominantly manifest in the `Unknown` and `Native Heap` categories**, rather than Dalvik.

---

## 5. Hermes Engine Memory Model vs OS Process Memory

> [!CAUTION]
> **CRITICAL ARCHITECTURAL DISTINCTION:**  
> `adb shell dumpsys meminfo` measures virtual and physical memory at the **operating system kernel page level**. It **does NOT** directly measure individual JavaScript object sizes, AST structures, or closure counts.
> **NEVER describe an OS-level PSS measurement as a direct measurement of JavaScript heap size.**

### Key Behaviors of the Hermes Runtime Allocator:
1. **Chunked Allocation:** Hermes requests memory from the OS kernel in multi-megabyte page blocks (typically 4MB or 8MB segments).
2. **Internal Fragmentation:** If JavaScript allocates 500KB of food detail objects, Hermes may request a new 4MB segment from the OS. `dumpsys meminfo` will register an increase of 4MB, not 500KB.
3. **Non-Immediate Page Return:** When Hermes garbage collection frees JavaScript objects, it marks the memory slots as free internally for future allocations. However, it does not necessarily issue `madvise(MADV_DONTNEED)` or `munmap` immediately back to Linux.
4. **Attribution Boundary:** We must never claim that dumpsys meminfo measures exact JavaScript string lengths. All evidence must be formally reported and interpreted as **Android Process Memory (PSS / Private Dirty)**.
