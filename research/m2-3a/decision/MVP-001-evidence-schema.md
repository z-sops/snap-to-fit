# MVP-001: Physical Memory Evidence Schema & Validation Specification

**Document ID:** MVP-001-EVS  
**Directive Reference:** SNAP2FIT — CHIEF ARCHITECT DIRECTIVE MVP-001 (Section 7)  
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
2. Multi-session alternating block structure (4 independent sessions).
3. 8 standardized lifecycle phase checkpoints per run.
4. Raw operating system subsystem breakdown from `adb shell dumpsys meminfo -d`.
5. Normalized Differential Attribution values ($\Delta \text{PSS}$, $\Delta \text{PrivateDirty}$).
6. Statistical aggregation and pre-defined acceptance criteria validation.

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
    "acceptanceEvaluation"
  ],
  "properties": {
    "schemaVersion": {
      "type": "string",
      "enum": ["m2-3a-memory-evidence-1.0"]
    },
    "directive": {
      "type": "string",
      "enum": ["MVP-001"]
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
    "acceptanceEvaluation": {
      "type": "object",
      "required": [
        "peakIngestionReductionGe25Pct",
        "sustainedExpansionLe15Pct",
        "leakRateLe100KbPerIter",
        "verdict"
      ],
      "properties": {
        "peakIngestionReductionGe25Pct": { "type": "boolean" },
        "sustainedExpansionLe15Pct": { "type": "boolean" },
        "leakRateLe100KbPerIter": { "type": "boolean" },
        "verdict": {
          "type": "string",
          "enum": [
            "PASSED_CONFIRMED_C_ADVANTAGE",
            "NEUTRAL_LATENCY_PRIMARY",
            "REJECTED_MEMORY_REGRESSION"
          ]
        }
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
        "timestamp",
        "pid",
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
        "timestamp": { "type": "string", "format": "date-time" },
        "pid": { "type": "integer" },
        "rawMetrics": {
          "type": "object",
          "required": [
            "totalPssKb",
            "privateDirtyKb",
            "privateCleanKb",
            "swapPssKb",
            "nativeHeapPssKb",
            "dalvikHeapPssKb",
            "unknownPssKb"
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
            "glPssKb": { "type": "integer" }
          }
        },
        "differential": {
          "type": "object",
          "required": ["deltaPssKb", "deltaPrivateDirtyKb", "deltaNativeHeapKb"],
          "properties": {
            "deltaPssKb": { "type": "integer" },
            "deltaPrivateDirtyKb": { "type": "integer" },
            "deltaNativeHeapKb": { "type": "integer" }
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

---

## 3. Offline Python Schema Validator

The following read-only Python validator verifies compliance without installing external dependencies:

```python
import json
import re

REQUIRED_ROOT = [
    "schemaVersion", "directive", "date", "device", "contract",
    "sessions", "statisticalSummary", "acceptanceEvaluation"
]

PHASES = [
    "M0_BASELINE", "M1_POST_OPEN_US", "M2_POST_OPEN_CA", "M3_POST_SEARCH",
    "M4_POST_RECIPE", "M5_POST_REPEAT", "M6_POST_CACHE", "M7_POST_GC"
]

def validate_evidence(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    for k in REQUIRED_ROOT:
        if k not in data:
            raise ValueError(f"Missing required root key: {k}")

    if data["schemaVersion"] != "m2-3a-memory-evidence-1.0":
        raise ValueError(f"Invalid schemaVersion: {data['schemaVersion']}")

    sessions = data["sessions"]
    if len(sessions) != 4:
        raise ValueError(f"Expected exactly 4 sessions, got {len(sessions)}")

    for sess in sessions:
        for arch in ["B-bundle", "C-split"]:
            checkpoints = sess["runs"][arch]["checkpoints"]
            if len(checkpoints) != 8:
                raise ValueError(f"Expected 8 checkpoints for {arch}, got {len(checkpoints)}")
            for i, cp in enumerate(checkpoints):
                if cp["phase"] != PHASES[i]:
                    raise ValueError(f"Phase mismatch at index {i}: expected {PHASES[i]}, got {cp['phase']}")

    print("PASS: Memory validation evidence matches schema specification perfectly.")

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        validate_evidence(sys.argv[1])
```
