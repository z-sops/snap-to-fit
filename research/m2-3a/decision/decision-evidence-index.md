# Snap2Fit M2-3A: Architecture Decision Evidence Index

**Document ID**: `M2-3A-DEC-005`  
**Reference Directive**: `SNAP2FIT — CHIEF ARCHITECT DIRECTIVE ADR-001`  
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

## 1. Overview and Custody Principles

This evidence index provides a complete, tamper-verifiable registry of all benchmark evidence artifacts, configuration contracts, system environment manifests, and log files collected across Milestone M2-3A.

All physical device benchmarks were conducted on a dedicated physical hardware target (Google Pixel 6a, Android 17 / API 37, Hermes JavaScript engine, Expo Go SDK 57). Every primary evidence artifact is mirrored in external protected backups under `C:\Users\EC\Documents\Snap2Fit-Agent-State`.

---

## 2. Primary Benchmark Evidence Registry

| Artifact Identifier | Repository Path | External Protected Backup Path | File Size (Bytes) | SHA-256 Digest | Status & Provenance |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **B30 Primary Evidence** | `research/m2-3a/evidence/b30-evidence.json` | `C:\Users\EC\Documents\Snap2Fit-Agent-State\evidence\b30-original\b30-evidence.json` | 10,768 | `3CBFFE49140801EA8CE76C3DD0151860357D5B9E92BCCBD98734D2E43202118B` | **VERIFIED AUTHENTIC**<br>Parsed from devserver.log at commit `9ade7fb1`. 30 full iterations (0–29). |
| **C30 Primary Evidence** | `research/m2-3a/evidence/c30/c30-evidence.json` | `C:\Users\EC\Documents\Snap2Fit-Agent-State\evidence\c30-original\c30-evidence.json` | 71,751 | `23C648B0459FF5F3D9A9B66504A55F8BF7985658E03A10B9C2F727458B667A6A` | **VERIFIED AUTHENTIC**<br>Direct collector output from Pixel 6a (run ID: `m2-3a-C-split-30x-1792837216010-598758a3`). 30 full iterations. |
| **C30 Run-Named Evidence Copy** | `research/m2-3a/evidence/c30/m2-3a-C-split-30x-1792837216010-598758a3.json` | `C:\Users\EC\Documents\Snap2Fit-Agent-State\evidence\c30-original\m2-3a-C-split-30x-1792837216010-598758a3.json` | 71,751 | `23C648B0459FF5F3D9A9B66504A55F8BF7985658E03A10B9C2F727458B667A6A` | **VERIFIED AUTHENTIC**<br>Identical copy of primary C30 evidence bearing canonical runId filename. |

---

## 3. Supporting Verification and Audit Artifacts

| Artifact Name | Repository Path | External Backup Path | File Size (Bytes) | SHA-256 Digest | Description & Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C30 Acceptance Record** | `research/m2-3a/evidence/c30/c30-acceptance.json` | `C:\Users\EC\Documents\Snap2Fit-Agent-State\evidence\c30-original\c30-acceptance.json` | 705 | `7C88340C5C7FB8F0A1A64281DC0D9E176A65985D1F35B819E82EB792A97E1317` | Immutable collector acceptance baseline recording receipt timestamp, byte length, and SHA-256. |
| **C30 Task Contract** | `research/m2-3a/evidence/c30/task-contract.json` | `C:\Users\EC\Documents\Snap2Fit-Agent-State\evidence\c30-original\task-contract.json` | 407 | `A358B247FC7FA066A807BF1E955F2C4A289EA4097AFBFC473824A2CCC7EDA708` | Authoritative pre-run execution contract; specifies 30 iterations, C-split architecture, commit `e7a7637`, and dirtyWorktree: true. |
| **C30 Collector Receipt** | `research/m2-3a/evidence/c30/collector-receipt.json` | `C:\Users\EC\Documents\Snap2Fit-Agent-State\evidence\c30-original\collector-receipt.json` | 286 | `E39DB02A7A8BCA5E10BB45BCF76FC59D2B83390848538F4B45A252229D30E4E4` | HTTP response receipt issued to Pixel 6a upon successful `POST /evidence`. |
| **C30 Collector Status** | `research/m2-3a/evidence/c30/collector-status.json` | `C:\Users\EC\Documents\Snap2Fit-Agent-State\evidence\c30-original\collector-status.json` | 323 | `CC837A008F52E2CE81FFB140EA342EAE5384B5F902D44118C2A63C779B84A307` | Two-way readback verification status (`persisted: true`, `verified: true`, `corrupt: false`). |
| **Comparison Summary** | `research/m2-3a/evidence/c30/comparison-summary.json` | `C:\Users\EC\Documents\Snap2Fit-Agent-State\evidence\c30-original\comparison-summary.json` | 6,531 | `D669F97C84A92984A7FC9262926DB0547D844E12F927786C5CB907AB69699D1B` | Machine-readable comparison table of all 11 metrics (p50, p95, min, max, deltas, percentages). |
| **Environment Record** | `research/m2-3a/evidence/c30/environment.json` | `C:\Users\EC\Documents\Snap2Fit-Agent-State\evidence\c30-original\environment.json` | 1,072 | `F46D3E09B28CDE147B1E12F508923F177406A2AE71A5A2A43BA3CC7D2F9081B6` | Device environment metadata: Pixel 6a, Android 17, Hermes, Expo Go 57.0.9, ADB bindings. |
| **C30 SHA-256 Manifest** | `research/m2-3a/evidence/c30/manifest-c30.sha256` | `C:\Users\EC\Documents\Snap2Fit-Agent-State\evidence\c30-original\manifest-c30.sha256` | 1,178 | `C61B8F2270F5B2A4B9F86467138E187B2BB8D846681B61745B5C705554BCE703` | Authoritative checksum manifest for all published C30 artifacts. |

---

## 4. Raw System and Device Execution Logs

| Log File Name | Repository Path (Worktree) | External Protected Backup Path | File Size (Bytes) | SHA-256 Digest | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **B30 DevServer Console Log** | `research/m2-3a/device/app/devserver.log.bak` *(untracked)* | `C:\Users\EC\Documents\Snap2Fit-Agent-State\evidence\b30-original\devserver.log` | 45,570 | `76810433380184A1417F19EFFDD600259E27E57C1034691A81F6D02477DF8431` | Raw Metro bundler console log containing all 30 B-bundle iterations logged from Pixel 6a device. |
| **C30 Pixel 6a Logcat Log** | `research/m2-3a/evidence/c30/pixel6a-logcat.log` *(untracked)* | `C:\Users\EC\Documents\Snap2Fit-Agent-State\evidence\c30-original\pixel6a-logcat.log` | 667,296 | `A94FCCB29948C73DD8F7B70BCB5936F9C661520E0CBE85EFDA60B229FBB261E7` | Physical Android logcat captured during C30 benchmark execution on Pixel 6a. |
| **C30 Metro Bundler Log** | `research/m2-3a/evidence/c30/metro-bundler.log` *(untracked)* | `C:\Users\EC\Documents\Snap2Fit-Agent-State\evidence\c30-original\metro-bundler.log` | 75,427 | `726F081D7518EB29F2AC37873245209E2A65C01B7934FED2562FFCCE3E648DDA` | Metro dev server console logs during the C30 run. |
| **C30 Asset Server Log** | `research/m2-3a/evidence/c30/serve-assets.log` *(untracked)* | `C:\Users\EC\Documents\Snap2Fit-Agent-State\evidence\c30-original\serve-assets.log` | 1,916 | `E131B50D8104C6DD6FD222773DB412C888BA351D840D68E9AC281E0C4E84988F` | Windows evidence collector HTTP log for smoke test and benchmark evidence ingestion. |

---

## 5. Non-Benchmark Diagnostic Smoke Test Registry

| Artifact Name | Repository Path (Worktree) | External Protected Backup Path | File Size (Bytes) | SHA-256 Digest | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C30 Smoke Evidence** | `research/m2-3a/evidence/runs/smoke/smoke-m2-3a-C-split-30x-1792837216010-598758a3-1792838156246.json` *(untracked)* | `C:\Users\EC\Documents\Snap2Fit-Agent-State\snapshots\untracked-adr001-preflight\research\m2-3a\evidence\runs\smoke\smoke-m2-3a-C-split-30x-1792837216010-598758a3-1792838156246.json` | 272 | `4E4D3E64E195F95B5B821F2D642CD1C434C6EBFF54FD3B1D5FBFB09939EDBE8D` | **PASSED**<br>Executed prior to iteration 0; verified exclusive file creation and readback on device. |
| **C30 Smoke Acceptance** | `research/m2-3a/evidence/runs/smoke/smoke-m2-3a-C-split-30x-1792837216010-598758a3-1792838156246.acceptance.json` *(untracked)* | `C:\Users\EC\Documents\Snap2Fit-Agent-State\snapshots\untracked-adr001-preflight\research\m2-3a\evidence\runs\smoke\smoke-m2-3a-C-split-30x-1792837216010-598758a3-1792838156246.acceptance.json` | 240 | `1B1A53E4BF7BD0AEFE71038166D4BC588EAC678A03E5C8D4445BD17E5E5830AC` | **PASSED**<br>Collector durable acceptance record for diagnostic smoke run. |

---

## 6. Audit Trail and Verification Summary

1. **Checksum Conformity**: All primary and supporting artifacts in `research/m2-3a/evidence/` match their expected SHA-256 digests exactly:
   - B30 evidence SHA-256 matches directive requirement: `3CBFFE49140801EA8CE76C3DD0151860357D5B9E92BCCBD98734D2E43202118B`.
   - C30 evidence SHA-256 matches directive requirement: `23C648B0459FF5F3D9A9B66504A55F8BF7985658E03A10B9C2F727458B667A6A`.
2. **Backup Parity**: Every file listed above has a bit-for-bit identical mirror in `C:\Users\EC\Documents\Snap2Fit-Agent-State`.
3. **Immutability Invariant**: No raw evidence file has been modified, renamed, or overwritten during this review.
