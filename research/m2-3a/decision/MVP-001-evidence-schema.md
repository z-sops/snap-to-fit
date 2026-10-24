# MVP-001: Physical Memory Evidence Schema & Validation Specification (MVE-001A Revised)

**Document ID:** MVP-001-EVS-REV1  
**Directive Reference:** SNAP2FIT — CHIEF ARCHITECT DIRECTIVES MVP-001 & MVE-001A (Section 4)  
**Project:** Snap2Fit Mobile Application (ZuniTech)  
**Author:** Antigravity / ARGON  
**Chief Architect:** ChatGPT / ZuniTech Architecture Board  
**Target Milestone:** M2-3A — Architecture Decision Validation  
**Date:** 24 October 2026  
**Status:** READY FOR AUTHORIZATION (SCHEMA & VALIDATION SPECIFICATION ONLY)  

---

## 1. Specification Overview

This specification establishes the authoritative data contract and JSON schema for the upcoming physical Android memory validation evidence file:
```text
research/m2-3a/evidence/memory/mvp-001-memory-evidence.json
```

All host-collected memory evidence captured during the future execution phase must conform to this schema. It integrates:
1. Complete device and platform metadata.
2. Multi-session repeated-measures alternating block structure (4 independent sessions).
3. 8 standardized lifecycle phase checkpoints per run.
4. Checkpoint synchronization metadata (deviceTimestampMs, hostTimestampMs, observedDeltaMs, receiptId).
5. Raw operating system subsystem breakdown from `adb shell dumpsys meminfo -d`.
6. Normalized Differential Attribution values ($\Delta \text{PSS}$, $\Delta \text{PrivateDirty}$).
7. Explicit documentation that Hermes JS heap is NOT directly measured (`hermesJsHeapMeasured: false`).
8. Statistical aggregation and provisional decision criteria evaluation.

---

## 2. Complete Evidence JSON Schema (JSON Schema Draft-07)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Snap2FitM23AMemoryEvidence",
  "type": "object",
  "required": [
    "schemaVersion",
    "directive",
    "date",
    "device",
    "contract",
    "sessions",
    "statisticalSummary",
    "provisionalEvaluation"
  ],
  "properties": {
    "schemaVersion": {
      "type": "string",
      "enum": ["m2-3a-memory-evidence-1.0"]
    },
    "directive": {
      "type": "string",
      "enum": ["MVE-001B", "MVP-001"]
    },
    "date": {
      "type": "string",
      "format": "date-time"
    },
    "device": {
      "type": "object",
      "required": ["model", "product", "serial", "androidVersion", "apiLevel", "engine", "expoGoVersion"],
      "properties": {
        "model": { "type": "string" },
        "product": { "type": "string" },
        "serial": { "type": "string" },
        "androidVersion": { "type": "string" },
        "apiLevel": { "type": "integer" },
        "engine": { "type": "string", "enum": ["Hermes"] },
        "expoGoVersion": { "type": "string" }
      }
    },
    "contract": {
      "type": "object",
      "required": ["sessionsCount", "iterationsPerRun", "catalogueManifestSha256", "cacheBudgetBytes"],
      "properties": {
        "sessionsCount": { "type": "integer", "enum": [4] },
        "iterationsPerRun": { "type": "integer", "enum": [30] },
        "catalogueManifestSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
        "cacheBudgetBytes": { "type": "integer", "enum": [8388608] }
      }
    },
    "sessions": {
      "type": "array",
      "minItems": 4,
      "maxItems": 4,
      "items": {
        "type": "object",
        "required": ["sessionIndex", "order", "runs"],
        "properties": {
          "sessionIndex": { "type": "integer", "minimum": 0, "maximum": 3 },
          "order": { "type": "string", "enum": ["B_THEN_C", "C_THEN_B"] },
          "thermal": {
            "type": "object",
            "required": ["startBatteryTempC", "endBatteryTempC"],
            "properties": {
              "startBatteryTempC": { "type": "number" },
              "endBatteryTempC": { "type": "number" }
            }
          },
          "runs": {
            "type": "object",
            "required": ["B-bundle", "C-split"],
            "properties": {
              "B-bundle": { "$ref": "#/definitions/ArchitectureRun" },
              "C-split": { "$ref": "#/definitions/ArchitectureRun" }
            }
          }
        }
      }
    },
    "statisticalSummary": {
      "type": "object",
      "required": ["B-bundle", "C-split", "comparison"],
      "properties": {
        "B-bundle": { "$ref": "#/definitions/ArchitectureSummary" },
        "C-split": { "$ref": "#/definitions/ArchitectureSummary" },
        "comparison": {
          "type": "object",
          "required": [
            "peakIngestionDeltaReductionPct",
            "sustainedWorkloadDeltaReductionPct",
            "welchTStatistic",
            "cohensD"
          ],
          "properties": {
            "peakIngestionDeltaReductionPct": { "type": "number" },
            "sustainedWorkloadDeltaReductionPct": { "type": "number" },
            "welchTStatistic": { "type": "number" },
            "cohensD": { "type": "number" }
          }
        }
      }
    },
    "provisionalEvaluation": {
      "type": "object",
      "required": [
        "peakIngestionReductionGe25Pct",
        "sustainedExpansionLe15Pct",
        "leakRateLe100KbPerIter",
        "provisionalVerdict",
        "notes"
      ],
      "properties": {
        "peakIngestionReductionGe25Pct": { "type": "boolean" },
        "sustainedExpansionLe15Pct": { "type": "boolean" },
        "leakRateLe100KbPerIter": { "type": "boolean" },
        "provisionalVerdict": {
          "type": "string",
          "enum": [
            "PROVISIONAL_CONFIRMED_C_ADVANTAGE",
            "PROVISIONAL_NEUTRAL_LATENCY_PRIMARY",
            "PROVISIONAL_REJECTED_MEMORY_REGRESSION"
          ]
        },
        "notes": { "type": "string" }
      }
    }
  },
  "definitions": {
    "ArchitectureRun": {
      "type": "object",
      "required": ["runId", "architecture", "checkpoints"],
      "properties": {
        "runId": { "type": "string" },
        "architecture": { "type": "string", "enum": ["B-bundle", "C-split"] },
        "checkpoints": {
          "type": "array",
          "minItems": 8,
          "maxItems": 8,
          "items": { "$ref": "#/definitions/MemoryCheckpoint" }
        }
      }
    },
    "MemoryCheckpoint": {
      "type": "object",
      "required": [
        "phase",
        "checkpointIndex",
        "pid",
        "deviceTimestampMs",
        "hostTimestampMs",
        "observedDeltaMs",
        "rawMetrics",
        "differential"
      ],
      "properties": {
        "phase": {
          "type": "string",
          "enum": [
            "M0_BASELINE",
            "M1_POST_OPEN_US",
            "M2_POST_OPEN_CA",
            "M3_POST_SEARCH",
            "M4_POST_RECIPE",
            "M5_POST_REPEAT",
            "M6_POST_CACHE",
            "M7_POST_GC"
          ]
        },
        "checkpointIndex": { "type": "integer", "minimum": 0, "maximum": 7 },
        "pid": { "type": "integer" },
        "deviceTimestampMs": { "type": "number" },
        "hostTimestampMs": { "type": "number" },
        "observedDeltaMs": { "type": "number" },
        "rawMetrics": {
          "type": "object",
          "required": [
            "totalPssKb",
            "privateDirtyKb",
            "privateCleanKb",
            "swapPssKb",
            "nativeHeapPssKb",
            "dalvikHeapPssKb",
            "unknownPssKb",
            "hermesJsHeapMeasured"
          ],
          "properties": {
            "totalPssKb": { "type": "integer" },
            "privateDirtyKb": { "type": "integer" },
            "privateCleanKb": { "type": "integer" },
            "swapPssKb": { "type": "integer" },
            "nativeHeapPssKb": { "type": "integer" },
            "dalvikHeapPssKb": { "type": "integer" },
            "unknownPssKb": { "type": "integer" },
            "gfxPssKb": { "type": "integer" },
            "glPssKb": { "type": "integer" },
            "hermesJsHeapMeasured": { "type": "boolean", "enum": [false] },
            "hermesJsHeapNote": { "type": "string" }
          }
        },
        "differential": {
          "type": "object",
          "required": ["deltaPssKb", "deltaPrivateDirtyKb", "deltaNativeHeapKb"],
          "properties": {
            "deltaPssKb": { "type": "integer" },
            "deltaPrivateDirtyKb": { "type": "integer" },
            "deltaNativeHeapKb": { "type": "integer" },
            "deltaUnknownKb": { "type": "integer" }
          }
        }
      }
    },
    "ArchitectureSummary": {
      "type": "object",
      "required": [
        "baselinePssMeanKb",
        "peakIngestionDeltaPssP50Kb",
        "peakIngestionDeltaPssP95Kb",
        "sustainedWorkloadDeltaPssP50Kb",
        "sustainedWorkloadDeltaPssP95Kb",
        "postGcRetainedDeltaPssMeanKb",
        "growthRateKbPerIteration"
      ],
      "properties": {
        "baselinePssMeanKb": { "type": "number" },
        "peakIngestionDeltaPssP50Kb": { "type": "number" },
        "peakIngestionDeltaPssP95Kb": { "type": "number" },
        "sustainedWorkloadDeltaPssP50Kb": { "type": "number" },
        "sustainedWorkloadDeltaPssP95Kb": { "type": "number" },
        "postGcRetainedDeltaPssMeanKb": { "type": "number" },
        "growthRateKbPerIteration": { "type": "number" }
      }
    }
  }
}
```
