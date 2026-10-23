/**
 * Shared benchmark task contract and evidence types for M2-3A research.
 *
 * This module defines the immutable contract negotiated between the research
 * assets server and the device harness, eliminating configuration drift and
 * silent fallbacks.
 */

export const CONTRACT_VERSION = 1;

export type Architecture = "B-bundle" | "C-split";

export type RunState =
  | "TASK_VALIDATED"
  | "WORKLOAD_COMPLETED"
  | "DEVICE_EVIDENCE_PERSISTED"
  | "WINDOWS_EVIDENCE_EXPORTED"
  | "WINDOWS_EVIDENCE_VERIFIED"
  | "FAILED";

export interface BenchmarkTaskContract {
  contractVersion: 1;
  runId: string;
  architecture: Architecture;
  iterations: number;
  createdAt: string;
  gitSha: string;
  dirtyWorktree: boolean;
  instrumentationRevision: string;
  catalogueManifestSha256: string;
}

export interface EvidenceReceipt {
  status: "accepted";
  runId: string;
  filename: string;
  bytes: number;
  sha256: string;
  acceptedAt: string;
}

export interface EvidenceStatus {
  runId: string;
  persisted: boolean;
  verified: boolean;
  filename?: string;
  bytes?: number;
  sha256?: string;
  acceptedAt?: string;
}

export interface DeviceReportMark {
  name: string;
  ms: number;
  iterations?: number;
  note?: string;
}

export interface DeviceReportDevice {
  platform: string;
  engine: string;
  model?: string;
  os_version?: string;
  app_version?: string;
}

export interface DeviceReportMemory {
  heap_used_mb?: number;
  heap_limit_mb?: number;
  platform_required: boolean;
  note: string;
}

export interface IterationSample {
  iteration: number;
  marks: DeviceReportMark[];
  counts: Record<string, number>;
}

export interface BenchmarkEvidenceReport {
  contract: BenchmarkTaskContract;
  runId: string;
  startTime: number;
  completedTime: number;
  completed: boolean;
  runState: RunState;
  device: DeviceReportDevice;
  marks: DeviceReportMark[];
  memory?: DeviceReportMemory;
  counts: Record<string, number>;
  samples: IterationSample[];
  note: string;
}

/**
 * Validates a task contract retrieved from the research server.
 * Throws a descriptive error if the contract is missing, malformed, or invalid.
 * Never silently defaults or clamps.
 */
export function validateTaskContract(data: unknown): BenchmarkTaskContract {
  if (!data || typeof data !== "object") {
    throw new Error("Task contract must be a non-null object");
  }

  const obj = data as Record<string, unknown>;

  if (obj.contractVersion !== CONTRACT_VERSION) {
    throw new Error(`Unsupported contractVersion: expected ${CONTRACT_VERSION}, got ${String(obj.contractVersion)}`);
  }

  if (typeof obj.runId !== "string" || !/^[a-zA-Z0-9_\-\.]+$/.test(obj.runId)) {
    throw new Error(`Invalid runId format: expected alphanumeric/hyphen/underscore/dot string, got ${String(obj.runId)}`);
  }

  if (obj.architecture !== "B-bundle" && obj.architecture !== "C-split") {
    throw new Error(`Invalid architecture: expected 'B-bundle' or 'C-split', got ${String(obj.architecture)}`);
  }

  if (
    typeof obj.iterations !== "number" ||
    !Number.isInteger(obj.iterations) ||
    obj.iterations < 1 ||
    obj.iterations > 100
  ) {
    throw new Error(`Invalid iterations: expected integer in range [1, 100], got ${String(obj.iterations)}`);
  }

  if (typeof obj.createdAt !== "string" || isNaN(Date.parse(obj.createdAt))) {
    throw new Error(`Invalid createdAt ISO timestamp: got ${String(obj.createdAt)}`);
  }

  if (typeof obj.gitSha !== "string" || !/^[a-fA-F0-9]{40}$/.test(obj.gitSha)) {
    throw new Error(`Invalid gitSha: expected 40-character hex string, got ${String(obj.gitSha)}`);
  }

  if (typeof obj.dirtyWorktree !== "boolean") {
    throw new Error(`Invalid dirtyWorktree: expected boolean, got ${String(obj.dirtyWorktree)}`);
  }

  if (typeof obj.instrumentationRevision !== "string" || obj.instrumentationRevision.trim().length === 0) {
    throw new Error(`Invalid instrumentationRevision: expected non-empty string, got ${String(obj.instrumentationRevision)}`);
  }

  if (typeof obj.catalogueManifestSha256 !== "string" || !/^[a-fA-F0-9]{64}$/.test(obj.catalogueManifestSha256)) {
    throw new Error(`Invalid catalogueManifestSha256: expected 64-character hex string, got ${String(obj.catalogueManifestSha256)}`);
  }

  return {
    contractVersion: 1,
    runId: obj.runId,
    architecture: obj.architecture,
    iterations: obj.iterations,
    createdAt: obj.createdAt,
    gitSha: obj.gitSha.toLowerCase(),
    dirtyWorktree: obj.dirtyWorktree,
    instrumentationRevision: obj.instrumentationRevision,
    catalogueManifestSha256: obj.catalogueManifestSha256.toLowerCase(),
  };
}

/**
 * Validates a benchmark evidence report against the authoritative contract.
 */
export function validateEvidenceReport(data: unknown, contract: BenchmarkTaskContract): BenchmarkEvidenceReport {
  if (!data || typeof data !== "object") {
    throw new Error("Evidence report must be a non-null object");
  }

  const report = data as Record<string, unknown>;

  if (report.runId !== contract.runId) {
    throw new Error(`Evidence runId mismatch: expected '${contract.runId}', got '${String(report.runId)}'`);
  }

  if (report.completed !== true) {
    throw new Error(`Evidence report indicates run was incomplete: completed=${String(report.completed)}`);
  }

  if (!report.contract || typeof report.contract !== "object") {
    throw new Error("Evidence report missing embedded contract object");
  }
  const embeddedContract = validateTaskContract(report.contract);
  if (embeddedContract.runId !== contract.runId) {
    throw new Error(`Embedded contract runId mismatch: expected '${contract.runId}', got '${embeddedContract.runId}'`);
  }
  if (embeddedContract.architecture !== contract.architecture) {
    throw new Error(`Embedded contract architecture mismatch: expected '${contract.architecture}', got '${embeddedContract.architecture}'`);
  }
  if (embeddedContract.iterations !== contract.iterations) {
    throw new Error(`Embedded contract iterations mismatch: expected ${contract.iterations}, got ${embeddedContract.iterations}`);
  }

  if (!Array.isArray(report.samples)) {
    throw new Error("Evidence report missing samples array");
  }

  if (report.samples.length !== contract.iterations) {
    throw new Error(`Evidence report sample count mismatch: expected ${contract.iterations}, got ${report.samples.length}`);
  }

  for (let i = 0; i < report.samples.length; i++) {
    const sample = report.samples[i];
    if (!sample || typeof sample !== "object") {
      throw new Error(`Invalid sample at index ${i}: not an object`);
    }
    if (sample.iteration !== i) {
      throw new Error(`Sample index mismatch at position ${i}: sample.iteration=${sample.iteration}`);
    }
    if (!Array.isArray(sample.marks) || sample.marks.length === 0) {
      throw new Error(`Sample at iteration ${i} has empty or missing marks`);
    }
    for (const m of sample.marks) {
      if (!m || typeof m.name !== "string" || typeof m.ms !== "number" || isNaN(m.ms) || m.ms < 0) {
        throw new Error(`Sample at iteration ${i} contains invalid mark: ${JSON.stringify(m)}`);
      }
    }
    if (!sample.counts || typeof sample.counts !== "object") {
      throw new Error(`Sample at iteration ${i} missing counts object`);
    }
  }

  if (!Array.isArray(report.marks) || report.marks.length === 0) {
    throw new Error("Evidence report missing aggregated marks array");
  }

  if (!report.device || typeof report.device !== "object") {
    throw new Error("Evidence report missing device description");
  }

  return data as BenchmarkEvidenceReport;
}
