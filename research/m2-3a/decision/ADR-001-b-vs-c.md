# ADR-001: B-Bundle versus C-Split Architecture Decision Review

**Document ID**: `ADR-001` (`M2-3A-DEC-001`)  
**Reference Directive**: `SNAP2FIT — CHIEF ARCHITECT DIRECTIVE ADR-001`  
**Date**: 24 October 2026  
**Status**: PROPOSED RECOMMENDATION — DOCUMENTATION ONLY (PRODUCTION IMPLEMENTATION NOT AUTHORIZED)  
**Project**: Snap2Fit / Snap to Fit (ZuniTech)  
**Authoring Agent**: Antigravity / ARGON  
**Chief Architect**: ChatGPT  
**Decision Authority**: Project Owner / Chief Architect  
**Git Worktree**: `C:\Users\EC\AppData\Roaming\com.zunitech.zcode\chat-sessions\2026-10-21\c15ac950d74c449d83a21c4cdc6128bc\snap-to-fit`  
**Branch**: `feat/m2-3-device-benchmark-harness`  
**Published Git HEAD**: `ff1b1c5781875775030b9fe0f22beb034deab7ba`  
**Draft PR #7**: [https://github.com/z-sops/snap-to-fit/pull/7](https://github.com/z-sops/snap-to-fit/pull/7)  

---

## 1. Context and Problem Statement

In Milestone M2-3A, the Snap2Fit mobile client reached an architectural fork regarding how nutrition food catalogue data (8,257 US records, 5,993 CA records across 80.4MB of raw assets) is structured, packaged, and accessed on mobile devices.

Two concrete architectures underwent comprehensive physical benchmark testing on a Google Pixel 6a (Android 17 / API 37, Hermes bytecode engine, Expo Go SDK 57) across 30 full iterations:
- **Architecture B (B-bundle)**: A monolithic pre-bundled JSON file per market. All food items, search tokens, and full nutritional details are deserialized upfront into the JavaScript runtime memory upon opening the catalogue.
- **Architecture C (C-split)**: A split architecture where catalogue data is divided into lightweight search index tables (loaded at catalogue opening) and binary detail packs accessed on-demand via disk slice offsets (`readSlice`) backed by a bounded in-memory LRU cache.

This Architecture Decision Review evaluates the empirical evidence gathered from the physical B30 and C30 benchmarks, resolves provenance questions, analyzes user experience trade-offs, formulates a research-only hybrid proposal, and recommends an authoritative architectural path forward.

---

## 2. Decision Summary and Recommendation

### 2.1 Recommendation
**CONDITIONAL RECOMMENDATION: ADOPT ARCHITECTURE C (C-SPLIT) AS THE PRIMARY CATALOGUE ARCHITECTURE.**

Architecture C demonstrates a decisive, transformative user experience advantage in **First Interaction Latency** (reducing catalogue opening time by **~90% to 92%**, from 1.42s to 138ms on US catalogue, and 1.15s to 91ms on CA catalogue). Because opening the catalogue occurs on 100% of user nutrition sessions, eliminating the 1.4-second UI freeze is paramount.

### 2.2 Conditions of Recommendation
1. **Downstream Recipe Resolution Mitigation**: Architecture C's on-demand slice reads increase batch recipe resolution time (138 ingredients) from 12.02ms to 180.87ms (+168.85ms). While 180ms is well within acceptable background thresholds for batch imports, future work should explore Option H optimizations (e.g., batch/vectorized slice reading or staged hydration) to minimize I/O overhead.
2. **Physical Memory Verification**: Claims of memory savings remain officially classified as **UNVERIFIED** due to Hermes platform constraints in Expo Go. Implementation of Architecture C must not be justified on memory grounds until confirmed via the proposed ADB memory validation protocol (`M2-3A-DEC-004`).
3. **Strict Implementation Boundary**: No production application code (`src/`) may be altered until the Project Owner reviews this ADR and explicitly issues an implementation directive.

---

## 3. Empirical Benchmark Comparison Summary

The table below summarizes the audited physical benchmark results across 30 iterations on the Google Pixel 6a (linear percentile interpolation):

| Operation / Metric | Architecture B (B30) p50 | Architecture C (C30) p50 | Absolute Delta p50 | Percent Delta p50 | Architectural Meaning & Impact |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **US Catalogue Open** | 1416.72 ms | 137.89 ms | **-1278.83 ms** | **-90.27%** | **Architecture C Decisively Superior**: B-bundle forces Hermes to parse 22.6MB JSON upfront; C-split only loads lightweight index headers. |
| **CA Catalogue Open** | 1148.30 ms | 91.04 ms | **-1057.25 ms** | **-92.07%** | **Architecture C Decisively Superior**: Eliminates over 1 second of boot latency. |
| **Cold Search ("chicken")** | 75.92 ms | 72.65 ms | -3.26 ms | -4.30% | **Equivalent / Parity**: Both architectures execute search index queries at near-identical speed. |
| **Warm Search ("chicken")** | 75.56 ms | 72.14 ms | -3.42 ms | -4.53% | **Equivalent / Parity**: Fast and stable across repeated runs. |
| **Fallback Search ("waffle")** | 75.43 ms | 70.50 ms | -4.94 ms | -6.54% | **Equivalent / Parity**: Alias and cross-market fallback queries maintain parity. |
| **Repeated Search (50x mean)** | 76.27 ms | 72.49 ms | -3.78 ms | -4.96% | **Equivalent / Parity**: Consistent search engine performance under repeated load. |
| **Market Switch (10x mean)** | 76.52 ms | 72.89 ms | -3.63 ms | -4.74% | **Equivalent / Parity**: Fast switching between loaded markets. |
| **Cold Detail Lookup** | 0.11 ms | 1.79 ms | +1.68 ms | +1567.44% | **Architecture B Faster, but Imperceptible**: C-split must read binary slice from disk. However, 1.79ms is well under a single 16.6ms screen frame. |
| **Warm Detail Lookup** | 0.008 ms | 0.009 ms | +0.001 ms | +12.50% | **Equivalent / Parity**: Absolute difference is 1 microsecond (timer noise). Both achieve $O(1)$ RAM speed once cached. |
| **Recipe Resolution (138 keys)** | 12.02 ms | 180.87 ms | **+168.85 ms** | **+1405.07%** | **Architecture B Decisively Superior**: Resolving 138 ingredients requires 138 sequential disk slice reads in C-split, compared to in-memory lookups in B-bundle. |
| **Cache Pass (166 items)** | 2.22 ms | 36.05 ms | +33.82 ms | +1521.46% | **Architecture B Faster**: C-split populates LRU cache via disk reads; B-bundle is purely in-memory. |

---

## 4. Architectural Trade-Off Analysis

### 4.1 Option B: Continue B-Bundle Architecture
- **Advantages**:
  1. *Sub-millisecond Detail Reads*: Cold detail lookup takes 0.11ms; recipe resolution across 138 ingredients takes only 12.02ms.
  2. *Simplicity*: Single JSON file per market. No binary slice offsets, header pack indexing, or LRU cache management required.
  3. *High Throughput for Batch Processing*: Batch meal plan imports or complex recipe generation with hundreds of ingredients execute instantaneously in memory.
- **Disadvantages**:
  1. *Severe Startup Penalty*: Catalogue open takes 1.42s (US) and 1.15s (CA). The UI experiences a frozen frame or requires an explicit loading spinner every time a user accesses the catalogue.
  2. *Monolithic Heap Allocation*: Deserializing 22.6MB of JSON text into JavaScript objects causes high initial heap allocation and increases the likelihood of Hermes garbage collection pauses on lower-tier mobile devices.
  3. *Poor Multi-Market Scalability*: Adding additional regional catalogues (e.g., UK, EU, AU) will linearly compound the heap allocation and startup delay.

### 4.2 Option C: Continue C-Split Architecture
- **Advantages**:
  1. *Sub-150ms Instant Catalogue Access*: US catalogue opens in 137.89ms; CA catalogue opens in 91.04ms (a ~91% reduction). The app feels immediate and responsive upon first touch.
  2. *Low Initial Parse Footprint*: Only search tokens and lightweight index records are parsed on boot.
  3. *Multi-Market Scalability*: Multiple markets can be mounted simultaneously without incurring multi-second deserialization penalties.
  4. *Identical Correctness and Search Latency*: Generates bit-for-bit identical query results, item records, and alias resolution as Architecture B with ~72ms search response time.
- **Disadvantages**:
  1. *On-Demand I/O Overhead*: Cold detail access takes 1.79ms (vs 0.11ms).
  2. *Substantial Batch Recipe Penalty*: Resolving 138 ingredients takes 180.87ms (vs 12.02ms).
  3. *Implementation Complexity*: Requires managing binary pack files, byte slice offsets, and an in-memory LRU cache.
  4. *Unproven Memory Claims*: As documented in `M2-3A-DEC-004`, physical memory savings remain unverified on Hermes/Android.

### 4.3 Option H: Research-Only Conceptual Hybrid Proposal

> [!NOTE]
> **CONCEPTUAL RESEARCH PROPOSAL ONLY**: Option H is a design hypothesis. Implementation is strictly unauthorized under ADR-001.

To bridge the gap between Architecture C's rapid startup (138ms) and Architecture B's instantaneous recipe resolution (12ms), Option H proposes the following non-breaking enhancements to Architecture C:
1. **Batch/Vectorized Detail Slicing (`readSliceBatch`)**:
   In Architecture C, resolving 138 ingredients invokes 138 independent file system calls. Option H proposes adding a native or multi-offset batch read adapter:
   ```typescript
   readSliceBatch(filePath: string, ranges: Array<{ offset: number; length: number }>): Array<FoodDetail>
   ```
   Sorting requested ranges by byte offset and reading contiguous file blocks in a single file descriptor pass would dramatically reduce OS context-switching overhead, potentially reducing the 180ms resolution time to <50ms.
2. **Popular Food Background Prefetching**:
   Immediately after catalogue opening (during idle event loop frames), pre-populate the LRU cache with the top 50 most frequently logged foods (e.g., chicken breast, egg, oats, banana). This converts typical cold detail lookups into 0.009ms warm lookups.
3. **Recipe Ingredient Prefetch on Navigation**:
   When a user taps into a recipe screen or meal builder, prefetch the recipe's ingredient detail slices asynchronously while the screen transition animation plays (150–250ms), masking all I/O latency before the user can interact.

---

## 5. User Experience Interpretation and Persona Journeys

Translating benchmark measurements into real user interaction scenarios demonstrates why Architecture C is the superior user-centric choice:

### Scenario 1: User Opens Food Catalogue to Log Lunch
- **User Action**: User taps "Nutrition" tab, then taps "Add Food".
- **Architecture B**: Screen freezes for **1.42 seconds** while 22.6MB JSON is deserialized. User sees a spinner or stuttering UI.
- **Architecture C**: Screen renders catalogue in **138 milliseconds**. The transition is visually seamless (<9 frames at 60Hz).
- **UX Verdict**: **Architecture C wins decisively.**

### Scenario 2: User Searches for "Grilled Chicken"
- **User Action**: User types "chicken" into search bar.
- **Architecture B**: Search completes in **75.92 ms** (~4 frames).
- **Architecture C**: Search completes in **72.65 ms** (~4 frames).
- **UX Verdict**: **Tied / Imperceptible.** Both feel instantaneous.

### Scenario 3: User Taps on a Search Result to View Nutrition Facts
- **User Action**: User taps "Chicken Breast, Raw" from search list.
- **Architecture B**: Detail opens in **0.11 ms**.
- **Architecture C**: Detail opens in **1.79 ms**.
- **UX Verdict**: **Tied / Imperceptible.** A human user cannot discern between 0.1ms and 1.8ms; both complete well within the 16.6ms single-frame budget.

### Scenario 4: User Logs a Complete 10-Ingredient Homemade Dinner Recipe
- **User Action**: User adds a saved recipe containing 10 ingredients.
- **Architecture B**: Ingredients resolve in **~0.9 ms**.
- **Architecture C**: Ingredients resolve in **~13 ms** (10 items $\times$ 1.3ms).
- **UX Verdict**: **Tied / Imperceptible.** 13ms is faster than a single 60Hz frame (16.6ms). The user perceives no lag whatsoever.

### Scenario 5: User Imports a 138-Ingredient Meal Plan / Deep Recipe Batch
- **User Action**: User executes a massive multi-recipe batch import.
- **Architecture B**: Resolves in **12.02 ms** (instantaneous).
- **Architecture C**: Resolves in **180.87 ms** (~11 frames).
- **UX Verdict**: **Architecture B is faster.** However, 180ms is easily handled with standard React Native optimistic UI or background promise resolution.

### Priority Conclusion:
Every user encounters Catalogue Open on every session, whereas 138-ingredient batch imports represent rare edge cases. Optimizing for the 1.4-second boot penalty delivers vastly superior daily UX.

---

## 6. Provenance and Integrity Summary

As detailed in Document `M2-3A-DEC-003`:
1. The `"dirtyWorktree": true` flag recorded in the C30 task contract was caused by the newly added Gate C2 smoke test harness (`runNativeSmokeTest()`).
2. Detailed diff analysis confirms that `measureOnce()`, the catalogue import, binary file reading, and LRU cache sizing were **100% untouched and identical** between contract base `e7a7637` and publication commit `ff1b1c5`.
3. All primary evidence hashes match published records exactly.

---

## 7. Next Steps Requiring Owner Authorization

The following work items are strictly blocked until separate Project Owner authorization is granted:
1. **Production Implementation Directive**: Authorizing migration of production code in `src/` to Architecture C (or Option H).
2. **Memory Validation Execution**: Authorizing execution of the non-intrusive ADB memory validation protocol (`M2-3A-DEC-004`).
3. **Pull Request Finalization**: Transitioning PR #7 from DRAFT to READY FOR REVIEW.
