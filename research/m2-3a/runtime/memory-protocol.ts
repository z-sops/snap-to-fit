/**
 * MVE-001A Memory Measurement Protocol and Validation Utilities
 *
 * Implements:
 * 1. Process identity validation & liveness verification on Android.
 * 2. Safe parsing of `adb shell dumpsys meminfo -d` output.
 * 3. Checkpoint synchronization protocol between device and host orchestrator.
 * 4. Differential memory attribution (PSS, Private Dirty, Native Heap deltas).
 * 5. Structured evidence compilation and manifest generation.
 */

import { createHash } from "node:crypto";

export const MEMORY_CHECKPOINT_PHASES = [
  "M0_BASELINE",
  "M1_POST_OPEN_US",
  "M2_POST_OPEN_CA",
  "M3_POST_SEARCH",
  "M4_POST_RECIPE",
  "M5_POST_REPEAT",
  "M6_POST_CACHE",
  "M7_POST_GC",
] as const;

export type MemoryCheckpointPhase = (typeof MEMORY_CHECKPOINT_PHASES)[number];

export interface ProcessAttributionResult {
  valid: boolean;
  pid: number;
  packageName: string;
  user: string;
  error?: string;
}

export interface ParsedMeminfo {
  pid: number;
  packageName?: string;
  totalPssKb: number;
  privateDirtyKb: number;
  privateCleanKb: number;
  swapPssKb: number;
  nativeHeapPssKb: number;
  nativeHeapDirtyKb: number;
  dalvikHeapPssKb: number;
  dalvikHeapDirtyKb: number;
  unknownPssKb: number;
  unknownDirtyKb: number;
  gfxPssKb: number;
  glPssKb: number;
  /** Explicitly records whether the Hermes JS heap is directly measured. Always false for dumpsys meminfo. */
  hermesJsHeapMeasured: false;
  hermesJsHeapNote: string;
}

export interface MemoryCheckpointEvent {
  sessionId: string;
  architecture: "B-bundle" | "C-split";
  blockOrder: "B_THEN_C" | "C_THEN_B";
  sessionIndex: number;
  checkpointIndex: number;
  phase: MemoryCheckpointPhase;
  pid: number;
  deviceTimestampMs: number;
  note?: string;
}

export interface MemorySyncReceipt {
  status: "accepted";
  receiptId: string;
  sessionId: string;
  phase: MemoryCheckpointPhase;
  checkpointIndex: number;
  hostTimestampMs: number;
  observedDeltaMs: number;
}

export interface DifferentialMetrics {
  deltaPssKb: number;
  deltaPrivateDirtyKb: number;
  deltaNativeHeapKb: number;
  deltaUnknownKb: number;
}

export interface MemorySessionState {
  sessionId: string;
  architecture: "B-bundle" | "C-split";
  sessionIndex: number;
  expectedPid: number;
  expectedPackage: string;
  currentCheckpointIndex: number;
  completedPhases: Set<MemoryCheckpointPhase>;
  baselineMeminfo?: ParsedMeminfo;
  checkpoints: Map<MemoryCheckpointPhase, {
    event: MemoryCheckpointEvent;
    meminfo: ParsedMeminfo;
    differential?: DifferentialMetrics;
    hostTimestampMs: number;
  }>;
}

/**
 * Validates process identity from Android `ps -A` output.
 * Ensures the target PID exists, belongs to the exact expected package,
 * and is not duplicated or associated with an unexpected process.
 */
export function validateProcessAttribution(
  pid: number,
  expectedPackage: string,
  psOutput: string,
): ProcessAttributionResult {
  if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 0) {
    return { valid: false, pid, packageName: "", user: "", error: `Invalid PID: must be positive integer, got ${pid}` };
  }
  if (!expectedPackage || typeof expectedPackage !== "string") {
    return { valid: false, pid, packageName: "", user: "", error: "Expected package name must be non-empty string" };
  }
  if (!psOutput || typeof psOutput !== "string") {
    return { valid: false, pid, packageName: "", user: "", error: "Process list output is empty" };
  }

  const lines = psOutput.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const matchingPidLines: { pid: number; user: string; name: string }[] = [];

  for (const line of lines) {
    const tokens = line.split(/\s+/);
    // Standard Android ps -A columns: USER PID PPID VSZ RSS WCHAN ADDR S NAME
    if (tokens.length >= 8) {
      const linePid = parseInt(tokens[1], 10);
      const user = tokens[0];
      const name = tokens[tokens.length - 1];
      if (linePid === pid) {
        matchingPidLines.push({ pid: linePid, user, name });
      }
    }
  }

  if (matchingPidLines.length === 0) {
    return {
      valid: false,
      pid,
      packageName: "",
      user: "",
      error: `Process with PID ${pid} not found in process list. Target process may have crashed or terminated.`,
    };
  }

  if (matchingPidLines.length > 1) {
    return {
      valid: false,
      pid,
      packageName: matchingPidLines[0].name,
      user: matchingPidLines[0].user,
      error: `Duplicate entries found for PID ${pid} in process list`,
    };
  }

  const proc = matchingPidLines[0];
  if (proc.name !== expectedPackage) {
    return {
      valid: false,
      pid,
      packageName: proc.name,
      user: proc.user,
      error: `Process identity mismatch: PID ${pid} belongs to '${proc.name}', expected '${expectedPackage}'`,
    };
  }

  return {
    valid: true,
    pid: proc.pid,
    packageName: proc.name,
    user: proc.user,
  };
}

/**
 * Safely parses Android `dumpsys meminfo -d` raw text output.
 * Extracts Total PSS, Private Dirty, Native Heap, Dalvik Heap, Unknown, etc.
 * Handles missing fields, malformed characters, and header validation.
 */
export function parseDumpsysMeminfo(rawText: string, expectedPid?: number): ParsedMeminfo {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("dumpsys meminfo output must be a non-empty string");
  }

  // Header extraction: MEMINFO in pid 14285 [host.exp.exponent]
  const headerMatch = rawText.match(/MEMINFO in pid\s+(\d+)\s+\[([^\]]+)\]/i);
  let parsedPid = 0;
  let packageName = "";
  if (headerMatch) {
    parsedPid = parseInt(headerMatch[1], 10);
    packageName = headerMatch[2].trim();
  } else {
    // Alternative format: ** MEMINFO in pid 14285 [host.exp.exponent] **
    const altHeader = rawText.match(/pid\s+(\d+)/i);
    if (altHeader) {
      parsedPid = parseInt(altHeader[1], 10);
    }
  }

  if (expectedPid !== undefined && parsedPid !== 0 && parsedPid !== expectedPid) {
    throw new Error(`Dumpsys meminfo PID mismatch: header has PID ${parsedPid}, expected ${expectedPid}`);
  }

  // Helper to extract numeric KB value safely
  const extractRowMetrics = (categoryRegex: RegExp): { pss: number; dirty: number; clean: number } => {
    const match = rawText.match(categoryRegex);
    if (!match) return { pss: 0, dirty: 0, clean: 0 };
    const pss = parseInt(match[1].replace(/,/g, ""), 10);
    const dirty = match[2] ? parseInt(match[2].replace(/,/g, ""), 10) : 0;
    const clean = match[3] ? parseInt(match[3].replace(/,/g, ""), 10) : 0;
    return {
      pss: isNaN(pss) ? 0 : pss,
      dirty: isNaN(dirty) ? 0 : dirty,
      clean: isNaN(clean) ? 0 : clean,
    };
  };

  // Total PSS line: TOTAL: 198243 TOTAL PSS: 198243 or TOTAL 198243 145230 ...
  let totalPssKb = 0;
  let privateDirtyKb = 0;
  let privateCleanKb = 0;
  let swapPssKb = 0;

  // In dumpsys meminfo -d, the summary table contains:
  // TOTAL PSS:   198,243            TOTAL RSS:   245,120      TOTAL SWAP PSS:    12,450
  // or bottom row:
  // TOTAL   198243   145230    12400     ...
  const totalSummaryMatch = rawText.match(/TOTAL PSS:\s*([\d,]+)/i);
  if (totalSummaryMatch) {
    totalPssKb = parseInt(totalSummaryMatch[1].replace(/,/g, ""), 10);
  }

  const swapSummaryMatch = rawText.match(/TOTAL SWAP PSS:\s*([\d,]+)/i);
  if (swapSummaryMatch) {
    swapPssKb = parseInt(swapSummaryMatch[1].replace(/,/g, ""), 10);
  }

  // App Summary table:
  // Java Heap: 24500
  // Native Heap: 85200
  // Code: 45200
  // Stack: 1200
  // Graphics: 18500
  // Private Other: 12400
  // System: 11200
  // TOTAL: 198243 TOTAL SWAP: 12450
  const nativeAppSummary = rawText.match(/Native Heap:\s*([\d,]+)/i);
  const nativeHeapPssKb = nativeAppSummary ? parseInt(nativeAppSummary[1].replace(/,/g, ""), 10) : 0;

  const javaAppSummary = rawText.match(/Java Heap:\s*([\d,]+)/i);
  const dalvikHeapPssKb = javaAppSummary ? parseInt(javaAppSummary[1].replace(/,/g, ""), 10) : 0;

  const gfxSummary = rawText.match(/Graphics:\s*([\d,]+)/i);
  const gfxPssKb = gfxSummary ? parseInt(gfxSummary[1].replace(/,/g, ""), 10) : 0;

  // Detailed table rows:
  // Native Heap       85200    82100        0 ...
  // Dalvik Heap       24500    24100        0 ...
  // Unknown           14500    14200        0 ...
  const nativeRow = extractRowMetrics(/^\s*Native Heap\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)/m);
  const dalvikRow = extractRowMetrics(/^\s*Dalvik Heap\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)/m);
  const unknownRow = extractRowMetrics(/^\s*Unknown\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)/m);
  const glRow = extractRowMetrics(/^\s*GL mtrack\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)/m);

  // Fallback total line if summary not matched
  const totalRow = extractRowMetrics(/^\s*TOTAL\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)/m);
  if (totalPssKb === 0 && totalRow.pss > 0) {
    totalPssKb = totalRow.pss;
  }
  privateDirtyKb = totalRow.dirty;
  privateCleanKb = totalRow.clean;

  if (totalPssKb <= 0 && totalRow.pss <= 0) {
    throw new Error("Failed to parse valid Total PSS from dumpsys meminfo output");
  }

  return {
    pid: parsedPid || (expectedPid ?? 0),
    packageName: packageName || undefined,
    totalPssKb: totalPssKb || totalRow.pss,
    privateDirtyKb: privateDirtyKb || nativeRow.dirty + dalvikRow.dirty + unknownRow.dirty,
    privateCleanKb,
    swapPssKb,
    nativeHeapPssKb: nativeHeapPssKb || nativeRow.pss,
    nativeHeapDirtyKb: nativeRow.dirty,
    dalvikHeapPssKb: dalvikHeapPssKb || dalvikRow.pss,
    dalvikHeapDirtyKb: dalvikRow.dirty,
    unknownPssKb: unknownRow.pss,
    unknownDirtyKb: unknownRow.dirty,
    gfxPssKb: gfxPssKb || glRow.pss,
    glPssKb: glRow.pss,
    hermesJsHeapMeasured: false,
    hermesJsHeapNote:
      "Hermes JS heap is not directly measured by dumpsys meminfo. Memory metrics represent OS-level process pages (PSS/Private Dirty).",
  };
}

/**
 * Validates a device checkpoint event against the active session state.
 * Enforces correct phase order, prevents duplicate submissions, validates PID,
 * and detects dropped/skipped checkpoints.
 */
export function validateMemoryCheckpointEvent(
  data: unknown,
  state: MemorySessionState,
): MemoryCheckpointEvent {
  if (!data || typeof data !== "object") {
    throw new Error("Checkpoint event must be a non-null object");
  }
  const obj = data as Record<string, unknown>;

  if (typeof obj.sessionId !== "string" || obj.sessionId !== state.sessionId) {
    throw new Error(`Session ID mismatch: expected '${state.sessionId}', got '${String(obj.sessionId)}'`);
  }
  if (obj.architecture !== state.architecture) {
    throw new Error(`Architecture mismatch: expected '${state.architecture}', got '${String(obj.architecture)}'`);
  }
  if (typeof obj.pid !== "number" || obj.pid !== state.expectedPid) {
    throw new Error(`Process PID mismatch: expected PID ${state.expectedPid}, got ${String(obj.pid)}. Process may have restarted unexpectedly.`);
  }

  const phaseIndex = MEMORY_CHECKPOINT_PHASES.indexOf(obj.phase as MemoryCheckpointPhase);
  if (phaseIndex === -1) {
    throw new Error(`Invalid checkpoint phase: '${String(obj.phase)}'`);
  }

  // Prevent duplicate submission
  if (state.completedPhases.has(obj.phase as MemoryCheckpointPhase)) {
    throw new Error(`Duplicate checkpoint rejected: phase '${String(obj.phase)}' was already accepted for session '${state.sessionId}'`);
  }

  // Strict sequence enforcement: must equal currentCheckpointIndex
  if (phaseIndex !== state.currentCheckpointIndex) {
    throw new Error(
      `Out-of-order checkpoint: expected phase index ${state.currentCheckpointIndex} ('${MEMORY_CHECKPOINT_PHASES[state.currentCheckpointIndex]}'), but received phase index ${phaseIndex} ('${String(obj.phase)}')`,
    );
  }

  if (typeof obj.deviceTimestampMs !== "number" || obj.deviceTimestampMs <= 0 || !Number.isFinite(obj.deviceTimestampMs)) {
    throw new Error(`Invalid deviceTimestampMs: expected positive finite number, got ${String(obj.deviceTimestampMs)}`);
  }

  return {
    sessionId: obj.sessionId,
    architecture: obj.architecture as "B-bundle" | "C-split",
    blockOrder: (obj.blockOrder as "B_THEN_C" | "C_THEN_B") ?? "B_THEN_C",
    sessionIndex: state.sessionIndex,
    checkpointIndex: phaseIndex,
    phase: obj.phase as MemoryCheckpointPhase,
    pid: obj.pid,
    deviceTimestampMs: obj.deviceTimestampMs,
    note: typeof obj.note === "string" ? obj.note : undefined,
  };
}

/**
 * Computes baseline-adjusted differential memory metrics.
 * $\Delta \text{PSS} = \text{PSS}_{phase} - \text{PSS}_{baseline}$
 */
export function calculateDifferentialMetrics(
  current: ParsedMeminfo,
  baseline: ParsedMeminfo,
): DifferentialMetrics {
  if (current.pid !== baseline.pid) {
    throw new Error(`Baseline comparison error: current PID (${current.pid}) does not match baseline PID (${baseline.pid})`);
  }

  return {
    deltaPssKb: current.totalPssKb - baseline.totalPssKb,
    deltaPrivateDirtyKb: current.privateDirtyKb - baseline.privateDirtyKb,
    deltaNativeHeapKb: current.nativeHeapPssKb - baseline.nativeHeapPssKb,
    deltaUnknownKb: current.unknownPssKb - baseline.unknownPssKb,
  };
}

/**
 * Initializes a clean memory tracking session state.
 */
export function createMemorySessionState(
  sessionId: string,
  architecture: "B-bundle" | "C-split",
  sessionIndex: number,
  expectedPid: number,
  expectedPackage: string = "host.exp.exponent",
): MemorySessionState {
  return {
    sessionId,
    architecture,
    sessionIndex,
    expectedPid,
    expectedPackage,
    currentCheckpointIndex: 0,
    completedPhases: new Set(),
    checkpoints: new Map(),
  };
}

/**
 * Generates an immutable SHA-256 evidence manifest for memory validation artifacts.
 */
export function generateMemoryEvidenceManifest(files: { path: string; content: string | Buffer }[]): string {
  const lines: string[] = [];
  for (const f of files) {
    const hash = createHash("sha256").update(f.content).digest("hex");
    lines.push(`${hash}  ${f.path}`);
  }
  return lines.join("\n") + "\n";
}
