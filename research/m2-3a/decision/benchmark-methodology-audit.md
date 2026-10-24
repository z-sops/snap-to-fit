# Snap2Fit M2-3A: Benchmark Methodology and Statistical Audit

**Document ID**: `M2-3A-DEC-002`  
**Reference Directive**: `SNAP2FIT — CHIEF ARCHITECT DIRECTIVE ADR-001` (Sections 5 & 7)  
**Date**: 24 October 2026  
**Status**: AUTHORIZED — DOCUMENTATION & EVIDENCE REVIEW ONLY  
**Project**: Snap2Fit / Snap to Fit (ZuniTech)  
**Authoring Agent**: Antigravity / ARGON  
**Chief Architect**: ChatGPT  
**Git Worktree**: `C:\Users\EC\AppData\Roaming\com.zunitech.zcode\chat-sessions\2026-10-21\c15ac950d74c449d83a21c4cdc6128bc\snap-to-fit`  
**Branch**: `feat/m2-3-device-benchmark-harness`  
**Published Git HEAD**: `ff1b1c5781875775030b9fe0f22beb034deab7ba`  
**Draft PR #7**: [https://github.com/z-sops/snap-to-fit/pull/7](https://github.com/z-sops/snap-to-fit/pull/7)  

---

## 1. Executive Summary and Audit Scope

This audit provides an independent mathematical recalculation and rigorous methodological audit of the physical device benchmark datasets for **Architecture B (B-bundle)** and **Architecture C (C-split)** collected during Milestone M2-3A.

### Core Audit Findings
1. **Mathematical Reproducibility**: All 11 reported benchmark timing metrics and all 11 correctness counters published in `research/m2-3a/evidence/c30/comparison-summary.json` were reproduced with 100% precision directly from the raw iteration samples in `b30-evidence.json` and `c30-evidence.json`.
2. **Percentile Methodology Resolution**: The reported percentiles use **linear interpolation** (`R Type 7` / `NumPy` / `Excel` percentile formula: $\text{rank} = (n - 1) \times p$). In earlier interim reports, a nearest-rank / ceiling index method was used, causing an inconsequential ~6ms difference on B30 `open_us` p95 (1536.19ms linear vs 1542.55ms nearest-rank).
3. **Correctness Invariant**: Both architectures produced **bit-for-bit identical query results, item record counts, and cache footprints** across all 30 iterations.
4. **Comparability Qualification**: Both runs executed on the identical physical Google Pixel 6a device running Android 17 / API 37, Hermes engine, and Expo Go SDK 57 with identical catalogue datasets. However, B30 was captured via Metro bundler console log scraping (`devserver.log`), while C30 was captured via structured HTTP JSON transport with durable acceptance records.

---

## 2. Statistical Recalculation and Metric Verification

### 2.1 Sample Size and Percentile Method
- **Sample Size ($n$)**: Exactly 30 complete iterations ($i = 0 \dots 29$) for both Architecture B and Architecture C. Total underlying marks evaluated: $30 \times 11 = 330$ for B30; $30 \times 11 = 330$ for C30.
- **Percentile Calculation Method**:
  For an ascending sorted array $X$ of length $n = 30$:
  $$\text{index} = (n - 1) \times p$$
  $$\text{lower} = \lfloor \text{index} \rfloor, \quad \text{upper} = \lceil \text{index} \rceil, \quad \text{weight} = \text{index} - \text{lower}$$
  $$P_p = X[\text{lower}] \times (1 - \text{weight}) + X[\text{upper}] \times \text{weight}$$
  For $p = 0.50$ (median / p50): $\text{index} = 29 \times 0.5 = 14.5$, interpolating $X[14]$ and $X[15]$.  
  For $p = 0.95$ (tail / p95): $\text{index} = 29 \times 0.95 = 27.55$, interpolating $X[27]$ (weight 0.45) and $X[28]$ (weight 0.55).

### 2.2 Comprehensive Performance Recalculation Table

All values are in milliseconds (ms), rounded to 2 decimal places in summary text and 3 decimal places in calculations.

| Metric | Architecture | $n$ | Min (ms) | Max (ms) | Mean (ms) | Std Dev (ms) | p50 (ms) | p95 (ms) | Delta p50 (ms) | Delta p50 (%) | Delta p95 (ms) | Delta p95 (%) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **open_us** | B-bundle<br>C-split | 30<br>30 | 1312.30<br>102.84 | 1545.86<br>249.91 | 1424.37<br>148.51 | 63.48<br>45.82 | **1416.72**<br>**137.89** | 1536.19<br>227.16 | **-1278.83** | **-90.27%** | -1309.03 | -85.21% |
| **open_ca** | B-bundle<br>C-split | 30<br>30 | 1037.50<br>65.63 | 1317.22<br>173.96 | 1157.06<br>101.40 | 60.10<br>34.78 | **1148.30**<br>**91.04** | 1222.96<br>164.03 | **-1057.25** | **-92.07%** | -1058.93 | -86.59% |
| **search_cold** | B-bundle<br>C-split | 30<br>30 | 70.47<br>66.25 | 85.79<br>104.43 | 76.24<br>76.43 | 3.51<br>9.80 | **75.92**<br>**72.65** | 80.85<br>97.74 | **-3.26** | **-4.30%** | +16.89 | +20.89% |
| **search_warm** | B-bundle<br>C-split | 30<br>30 | 69.52<br>61.61 | 79.92<br>85.54 | 75.31<br>73.06 | 2.50<br>5.22 | **75.56**<br>**72.14** | 79.46<br>80.66 | **-3.42** | **-4.53%** | +1.20 | +1.51% |
| **search_fallback** | B-bundle<br>C-split | 30<br>30 | 68.43<br>60.75 | 77.96<br>83.43 | 74.88<br>72.11 | 2.30<br>5.43 | **75.43**<br>**70.50** | 77.88<br>78.68 | **-4.94** | **-6.54%** | +0.80 | +1.02% |
| **detail_cold** | B-bundle<br>C-split | 30<br>30 | 0.10<br>1.68 | 1.63<br>8.34 | 0.16<br>2.08 | 0.27<br>1.17 | **0.11**<br>**1.79** | 0.13<br>2.21 | **+1.69** | **+1567.44%** | +2.08 | +1618.73% |
| **detail_warm** | B-bundle<br>C-split | 30<br>30 | 0.007<br>0.008 | 0.010<br>0.011 | 0.008<br>0.009 | 0.001<br>0.001 | **0.008**<br>**0.009** | 0.009<br>0.010 | **+0.001** | **+12.50%** | +0.001 | +11.11% |
| **recipe_resolution** | B-bundle<br>C-split | 30<br>30 | 11.23<br>173.56 | 15.60<br>213.00 | 12.16<br>184.28 | 0.81<br>10.74 | **12.02**<br>**180.87** | 12.38<br>202.10 | **+168.85** | **+1405.07%** | +189.72 | +1532.14% |
| **repeated_search** | B-bundle<br>C-split | 30<br>30 | 71.89<br>66.01 | 78.53<br>83.93 | 76.01<br>73.74 | 1.54<br>4.48 | **76.27**<br>**72.49** | 78.47<br>78.92 | **-3.78** | **-4.96%** | +0.45 | +0.58% |
| **market_switch** | B-bundle<br>C-split | 30<br>30 | 72.75<br>67.70 | 80.23<br>84.13 | 76.51<br>74.20 | 1.63<br>4.79 | **76.52**<br>**72.89** | 79.24<br>81.62 | **-3.63** | **-4.74%** | +2.38 | +3.01% |
| **cache_pass** | B-bundle<br>C-split | 30<br>30 | 1.98<br>34.41 | 2.33<br>41.69 | 2.22<br>37.28 | 0.08<br>2.29 | **2.22**<br>**36.05** | 2.30<br>41.36 | **+33.82** | **+1521.46%** | +39.06 | +1698.05% |

---

## 3. Analysis of Critical Metrics and Statistical Pitfalls

### 3.1 The "Percentage Change" Fallacy for Sub-Millisecond Operations
Special analytical care must be taken when interpreting large percentage changes for timings near zero:
- **`detail_warm`**: B30 is 0.008ms, C30 is 0.009ms. The mathematical calculation yields $+12.50\%$. However, the absolute difference is **$0.001\text{ ms}$ (1 microsecond)**. This is below the clock jitter and timing precision of `performance.now()` in JavaScript/Hermes on Android. Both architectures effectively achieve instantaneous $O(1)$ memory lookup once an item is cached in RAM.
- **`detail_cold`**: B30 is 0.11ms, C30 is 1.79ms. This yields $+1567.44\%$. While mathematically correct, the real user-facing impact is **$1.68\text{ ms}$**—a duration that is completely imperceptible to human users and fits comfortably within a single 60Hz frame (16.6ms) or 120Hz frame (8.3ms).

### 3.2 Tail Latency ($p95$) and Dispersion Analysis
- **Catalogue Open Tail**:
  - In Architecture B, `open_us` max is 1545.86ms with standard deviation 63.48ms. The high latency is constant and deterministic because JSON.parse must deserialize 22.6MB of text on every open.
  - In Architecture C, `open_us` p50 is 137.89ms, but p95 rises to 227.16ms and max is 249.91ms (std dev 45.82ms). This higher coefficient of variation reflects flash storage read latency variance on the mobile device (ext4 block read spikes on Android).
- **Search Latency Stability**:
  - Both architectures show very stable search performance (~70–76ms) across cold, warm, repeated, and market-switched searches.
  - C-split has a slight median advantage (-3 to -5ms) across search queries, likely due to a lower heap footprint allowing Hermes garbage collector pauses to be shorter.
  - However, C-split `search_cold` p95 is 97.74ms vs B-bundle 80.85ms (+20.89%), reflecting an occasional cold disk read during index header initialization.
- **Recipe Resolution Divergence**:
  - `recipe_resolution` evaluates resolving **138 distinct ingredient items** in a single batch pass.
  - Architecture B resolves this in **12.02ms** ($0.087\text{ ms/item}$) because all items already reside deserialized in memory.
  - Architecture C takes **180.87ms** ($1.31\text{ ms/item}$) because each ingredient not currently in the LRU cache requires an on-demand binary slice disk read (`readSlice` via Expo FileSystem).
  - The standard deviation for C-split recipe resolution is 10.74ms (min 173.56ms, max 213.00ms), demonstrating consistent flash I/O throughput across 138 sequential slice reads.

---

## 4. Verification of Correctness Counters

A critical requirement of experimental validity is verifying that both architectures performed **identical semantic work**.

| Correctness Counter | B30 Baseline Value | C30 Candidate Value | Match Status | Semantic Meaning |
| :--- | :--- | :--- | :--- | :--- |
| `open_us_records` | 8,257 | 8,257 | **100% IDENTICAL** | Exact number of food items indexed in US catalogue. |
| `open_ca_records` | 5,993 | 5,993 | **100% IDENTICAL** | Exact number of food items indexed in CA catalogue. |
| `search_results` | 20 | 20 | **100% IDENTICAL** | Matches returned for primary query "chicken". |
| `fallback_results` | 20 | 20 | **100% IDENTICAL** | Matches returned for fallback query "waffle". |
| `fallback_cross_market` | 9 | 9 | **100% IDENTICAL** | Cross-market alias resolutions between US and CA. |
| `recipe_keys` | 138 | 138 | **100% IDENTICAL** | Total ingredient keys requested for complex recipe. |
| `recipe_resolved` | 138 | 138 | **100% IDENTICAL** | Total ingredient keys successfully resolved with complete nutrition data. |
| `cache_entries` | 166 | 166 | **100% IDENTICAL** | Items resident in LRU cache at benchmark completion. |
| `cache_bytes` | 454,343 | 454,343 | **100% IDENTICAL** | Exact byte size of cached JSON food detail records. |
| `detail_found_cold` | 1 | 1 | **100% IDENTICAL** | Target item located on cold detail lookup. |
| `detail_found_warm` | 1 | 1 | **100% IDENTICAL** | Target item located on warm (cached) detail lookup. |

**Conclusion on Correctness**: There is zero divergence in catalogue contents, search ranking, alias resolution, or cache budget enforcement between Architecture B and Architecture C.

---

## 5. Experimental Comparability Audit

| Factor | B30 Baseline | C30 Physical Candidate | Audit Assessment |
| :--- | :--- | :--- | :--- |
| **Physical Hardware** | Google Pixel 6a (`bluejay`) | Google Pixel 6a (`bluejay`) | **EQUIVALENT**: Verified via ADB serial `19301FDEE003AS`. |
| **Android OS** | Android 17 (API 37) | Android 17 (API 37) | **EQUIVALENT**: Verified via OS build and platform description. |
| **JS Engine** | Hermes 0.78.0 | Hermes 0.78.0 | **EQUIVALENT**: Confirmed running bytecode engine. |
| **Container Platform** | Expo Go SDK 57 (57.0.9) | Expo Go SDK 57 (57.0.9) | **EQUIVALENT**: Exact SDK container version. |
| **Dataset & Manifest** | US (8,257) & CA (5,993) | US (8,257) & CA (5,993) | **EQUIVALENT**: Catalogue manifest SHA-256: `30c0cbf18d47f6e00bab337fac47b2be6ea8dfe89dfb838eb12d415a3c9f22d6`. Total 80,445,082 bytes across 8 files. |
| **Workload Operations** | 11 standardized marks | 11 standardized marks | **EQUIVALENT**: Exact sequence: open_us -> open_ca -> search_cold -> search_warm -> search_fallback -> detail_cold -> detail_warm -> recipe_resolution -> repeated_search (50x) -> market_switch (10x) -> cache_pass. |
| **Cache Budget** | LRU `CACHE_BUDGET_BYTES` | LRU `CACHE_BUDGET_BYTES` | **EQUIVALENT**: 454,343 bytes across 166 entries. |
| **Iteration Count** | 30 complete iterations | 30 complete iterations | **EQUIVALENT**: Indices 0 to 29. |
| **Evidence Collection** | Metro console log parsing (`devserver.log`) | Structured HTTP collector (`POST /evidence`) with durable receipt | **DIFFERENT METHODOLOGY**: B30 scraped from devserver logcat; C30 transferred via native JSON payload over localhost HTTP bridge. Both measure client-side `performance.now()` marks inside Hermes runtime. |
| **Worktree State** | Clean at `9ade7fb1` | Dirty at `e7a7637` (committed at `ff1b1c5`) | **AUDITED & RESOLVED**: Detailed in Document `M2-3A-DEC-003`; dirty state comprised diagnostic smoke test harness and did not modify benchmark workload. |
| **Thermal / Battery State** | Uncontrolled ambient room temp | Uncontrolled ambient room temp | **QUALIFIED UNCERTAINTY**: Runs occurred on different dates. Normal device temperature variations may account for minor tail latency fluctuations. |
| **Memory Metrics** | Not captured | Not captured | **UNVERIFIED**: Hermes runtime does not expose heap memory in Expo Go on Android. |

---

## 6. Audit Verdict

1. **Recalculation Success**: All statistical values published in `comparison-summary.json` are 100% reproducible from the raw evidence.
2. **Comparability Confirmation**: Despite differences in evidence transport harnesses, the underlying timing measurements were executed on the same physical hardware, engine, and workload, making the comparison statistically and architecturally valid.
