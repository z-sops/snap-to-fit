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
  corrupt?: boolean;
  reason?: string;
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

export const REQUIRED_BENCHMARK_MARKS = [
  "open_us",
  "open_ca",
  "search_cold",
  "search_warm",
  "search_fallback",
  "recipe_resolution",
  "repeated_search",
  "market_switch",
  "cache_pass",
] as const;

export const REQUIRED_BENCHMARK_COUNTS = [
  "iteration",
  "architecture",
  "open_us_records",
  "open_ca_records",
  "search_results",
  "fallback_results",
  "recipe_keys",
  "recipe_resolved",
  "cache_entries",
  "cache_bytes",
] as const;

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
 * Validates a benchmark evidence report against the authoritative contract and strict measurement schema.
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

  // Authoritative provenance verification across all contract fields (Correction B)
  if (embeddedContract.contractVersion !== contract.contractVersion) {
    throw new Error(`Embedded contractVersion mismatch: expected ${contract.contractVersion}, got ${embeddedContract.contractVersion}`);
  }
  if (embeddedContract.runId !== contract.runId) {
    throw new Error(`Embedded contract runId mismatch: expected '${contract.runId}', got '${embeddedContract.runId}'`);
  }
  if (embeddedContract.architecture !== contract.architecture) {
    throw new Error(`Embedded contract architecture mismatch: expected '${contract.architecture}', got '${embeddedContract.architecture}'`);
  }
  if (embeddedContract.iterations !== contract.iterations) {
    throw new Error(`Embedded contract iterations mismatch: expected ${contract.iterations}, got ${embeddedContract.iterations}`);
  }
  if (embeddedContract.createdAt !== contract.createdAt) {
    throw new Error(`Embedded contract createdAt mismatch: expected '${contract.createdAt}', got '${embeddedContract.createdAt}'`);
  }
  if (embeddedContract.gitSha !== contract.gitSha) {
    throw new Error(`Embedded contract gitSha mismatch: expected '${contract.gitSha}', got '${embeddedContract.gitSha}'`);
  }
  if (embeddedContract.dirtyWorktree !== contract.dirtyWorktree) {
    throw new Error(`Embedded contract dirtyWorktree mismatch: expected ${contract.dirtyWorktree}, got ${embeddedContract.dirtyWorktree}`);
  }
  if (embeddedContract.instrumentationRevision !== contract.instrumentationRevision) {
    throw new Error(`Embedded contract instrumentationRevision mismatch: expected '${contract.instrumentationRevision}', got '${embeddedContract.instrumentationRevision}'`);
  }
  if (embeddedContract.catalogueManifestSha256 !== contract.catalogueManifestSha256) {
    throw new Error(`Embedded contract catalogueManifestSha256 mismatch: expected '${contract.catalogueManifestSha256}', got '${embeddedContract.catalogueManifestSha256}'`);
  }

  if (typeof report.startTime !== "number" || isNaN(report.startTime) || report.startTime <= 0) {
    throw new Error(`Evidence report has invalid startTime: ${String(report.startTime)}`);
  }

  if (
    typeof report.completedTime !== "number" ||
    isNaN(report.completedTime) ||
    report.completedTime < report.startTime
  ) {
    throw new Error(`Evidence report has invalid completedTime: ${String(report.completedTime)}`);
  }

  if (!Array.isArray(report.samples)) {
    throw new Error("Evidence report missing samples array");
  }

  if (report.samples.length !== contract.iterations) {
    throw new Error(`Evidence report sample count mismatch: expected ${contract.iterations}, got ${report.samples.length}`);
  }

  const expectedArchCode = contract.architecture === "B-bundle" ? 1 : 2;

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

    const markNames = new Set<string>();
    for (const m of sample.marks) {
      if (!m || typeof m.name !== "string" || typeof m.ms !== "number" || isNaN(m.ms) || !isFinite(m.ms) || m.ms < 0) {
        throw new Error(`Sample at iteration ${i} contains invalid mark: ${JSON.stringify(m)}`);
      }
      markNames.add(m.name);
    }

    for (const reqMark of REQUIRED_BENCHMARK_MARKS) {
      if (!markNames.has(reqMark)) {
        throw new Error(`Sample at iteration ${i} missing required benchmark mark '${reqMark}'`);
      }
    }

    if (!sample.counts || typeof sample.counts !== "object") {
      throw new Error(`Sample at iteration ${i} missing counts object`);
    }

    const counts = sample.counts as Record<string, unknown>;
    for (const reqCount of REQUIRED_BENCHMARK_COUNTS) {
      const val = counts[reqCount];
      if (typeof val !== "number" || !Number.isInteger(val) || val < 0) {
        throw new Error(`Sample at iteration ${i} has invalid or missing count for '${reqCount}': ${String(val)}`);
      }
    }

    if (counts.iteration !== i) {
      throw new Error(`Sample at iteration ${i} counts.iteration mismatch: expected ${i}, got ${String(counts.iteration)}`);
    }

    if (counts.architecture !== expectedArchCode) {
      throw new Error(`Sample at iteration ${i} counts.architecture mismatch: expected ${expectedArchCode}, got ${String(counts.architecture)}`);
    }
  }

  if (!Array.isArray(report.marks) || report.marks.length === 0) {
    throw new Error("Evidence report missing aggregated marks array");
  }

  for (const agg of report.marks) {
    if (!agg || typeof agg.name !== "string" || typeof agg.ms !== "number" || isNaN(agg.ms) || !isFinite(agg.ms) || agg.ms < 0) {
      throw new Error(`Aggregated marks contain invalid mark: ${JSON.stringify(agg)}`);
    }
  }

  if (!report.device || typeof report.device !== "object") {
    throw new Error("Evidence report missing device description");
  }
  const device = report.device as Record<string, unknown>;
  if (typeof device.platform !== "string" || device.platform.trim().length === 0) {
    throw new Error("Evidence report device description missing platform");
  }
  if (typeof device.engine !== "string" || device.engine.trim().length === 0) {
    throw new Error("Evidence report device description missing engine");
  }

  return data as BenchmarkEvidenceReport;
}

/**
 * Durable baseline acceptance record stored by the Windows collector upon
 * authoritative validation and acceptance of evidence.
 *
 * Provides an independent baseline against which persisted evidence files
 * can be verified to detect post-acceptance tampering, file truncation,
 * or modification even if the modified file remains schema-valid.
 */
export interface AcceptanceRecord {
  runId: string;
  filename: string;
  bytes: number;
  sha256: string;
  acceptedAt: string;
  contract: BenchmarkTaskContract;
}

/**
 * Validates a durable acceptance record against the authoritative contract.
 */
export function validateAcceptanceRecord(data: unknown, contract: BenchmarkTaskContract): AcceptanceRecord {
  if (!data || typeof data !== "object") {
    throw new Error("Acceptance record must be a non-null object");
  }

  const obj = data as Record<string, unknown>;

  if (obj.runId !== contract.runId) {
    throw new Error(`Acceptance record runId mismatch: expected '${contract.runId}', got '${String(obj.runId)}'`);
  }

  const expectedFilename = `${contract.runId}.json`;
  if (typeof obj.filename !== "string" || obj.filename !== expectedFilename) {
    throw new Error(`Acceptance record invalid filename: expected '${expectedFilename}', got '${String(obj.filename)}'`);
  }

  if (typeof obj.bytes !== "number" || !Number.isInteger(obj.bytes) || obj.bytes <= 0) {
    throw new Error(`Acceptance record invalid byte count: expected positive integer, got ${String(obj.bytes)}`);
  }

  if (typeof obj.sha256 !== "string" || !/^[a-fA-F0-9]{64}$/.test(obj.sha256)) {
    throw new Error(`Acceptance record invalid sha256: expected 64-char hex string, got ${String(obj.sha256)}`);
  }

  if (typeof obj.acceptedAt !== "string" || isNaN(Date.parse(obj.acceptedAt))) {
    throw new Error(`Acceptance record invalid acceptedAt: expected ISO timestamp, got ${String(obj.acceptedAt)}`);
  }

  if (!obj.contract || typeof obj.contract !== "object") {
    throw new Error("Acceptance record missing contract object");
  }

  const embeddedContract = validateTaskContract(obj.contract);
  if (
    embeddedContract.runId !== contract.runId ||
    embeddedContract.architecture !== contract.architecture ||
    embeddedContract.iterations !== contract.iterations ||
    embeddedContract.gitSha !== contract.gitSha ||
    embeddedContract.catalogueManifestSha256 !== contract.catalogueManifestSha256
  ) {
    throw new Error("Acceptance record contract identity mismatch with authoritative contract");
  }

  return {
    runId: obj.runId,
    filename: obj.filename,
    bytes: obj.bytes,
    sha256: obj.sha256.toLowerCase(),
    acceptedAt: obj.acceptedAt,
    contract: embeddedContract,
  };
}

/**
 * Validates a collector receipt returned by POST /evidence.
 * Ensures the response strictly conforms to authoritative contract identity and checksum requirements.
 */
export function validateCollectorReceipt(
  receiptData: unknown,
  expectedRunId: string,
): EvidenceReceipt {
  if (!receiptData || typeof receiptData !== "object") {
    throw new Error("Invalid collector receipt: response is not an object");
  }

  const r = receiptData as Record<string, unknown>;

  if (r.status !== "accepted") {
    throw new Error(`Invalid collector receipt status: expected 'accepted', got '${String(r.status)}'`);
  }

  if (r.runId !== expectedRunId) {
    throw new Error(`Collector receipt runId mismatch: expected '${expectedRunId}', got '${String(r.runId)}'`);
  }

  const expectedFilename = `${expectedRunId}.json`;
  if (typeof r.filename !== "string" || r.filename !== expectedFilename) {
    throw new Error(`Collector receipt invalid filename: expected '${expectedFilename}', got '${String(r.filename)}'`);
  }

  if (typeof r.bytes !== "number" || !Number.isInteger(r.bytes) || r.bytes <= 0) {
    throw new Error(`Collector receipt invalid byte count: expected positive integer, got ${String(r.bytes)}`);
  }

  if (typeof r.sha256 !== "string" || !/^[a-fA-F0-9]{64}$/.test(r.sha256)) {
    throw new Error(`Collector receipt invalid SHA-256 digest: got '${String(r.sha256)}'`);
  }

  if (typeof r.acceptedAt !== "string" || isNaN(Date.parse(r.acceptedAt))) {
    throw new Error(`Collector receipt invalid acceptedAt timestamp: got '${String(r.acceptedAt)}'`);
  }

  return {
    status: "accepted",
    runId: r.runId,
    filename: r.filename,
    bytes: r.bytes,
    sha256: (r.sha256 as string).toLowerCase(),
    acceptedAt: r.acceptedAt,
  };
}

/**
 * Validates the collector status returned by GET /evidence/status?runId=... against the accepted receipt.
 * Enforces byte count match, SHA-256 match, persistence verification, and non-corruption.
 */
export function validateCollectorStatus(
  statusData: unknown,
  expectedReceipt: EvidenceReceipt,
): EvidenceStatus {
  if (!statusData || typeof statusData !== "object") {
    throw new Error("Invalid collector status: response is not an object");
  }

  const s = statusData as Record<string, unknown>;

  if (s.runId !== expectedReceipt.runId) {
    throw new Error(`Collector status runId mismatch: expected '${expectedReceipt.runId}', got '${String(s.runId)}'`);
  }

  if (s.persisted !== true) {
    throw new Error(`Collector status indicates evidence not persisted: persisted=${String(s.persisted)}`);
  }

  if (s.verified !== true) {
    throw new Error(`Collector status indicates evidence not verified: verified=${String(s.verified)}`);
  }

  if (s.corrupt === true) {
    throw new Error(`Collector status indicates evidence is corrupt: ${String(s.reason ?? "unspecified corruption")}`);
  }

  if (typeof s.bytes !== "number" || s.bytes !== expectedReceipt.bytes) {
    throw new Error(`Collector status byte count mismatch: receipt has ${expectedReceipt.bytes}, status has ${String(s.bytes)}`);
  }

  if (typeof s.sha256 !== "string" || s.sha256.toLowerCase() !== expectedReceipt.sha256.toLowerCase()) {
    throw new Error(`Collector status SHA-256 mismatch: receipt has ${expectedReceipt.sha256}, status has ${String(s.sha256)}`);
  }

  if (typeof s.filename === "string" && s.filename !== expectedReceipt.filename) {
    throw new Error(`Collector status filename mismatch: receipt has ${expectedReceipt.filename}, status has ${s.filename}`);
  }

  return {
    runId: s.runId as string,
    persisted: true,
    verified: true,
    corrupt: false,
    filename: (s.filename as string) ?? expectedReceipt.filename,
    bytes: s.bytes as number,
    sha256: (s.sha256 as string).toLowerCase(),
    acceptedAt: typeof s.acceptedAt === "string" ? s.acceptedAt : expectedReceipt.acceptedAt,
  };
}

/**
 * Adapter interface representing an Expo SDK 57 File instance for device evidence persistence.
 * Compatible with `new File(...)` from expo-file-system.
 */
export interface DeviceReportFileAdapter {
  exists: boolean;
  create(options?: { intermediates?: boolean }): void;
  write(content: string): void;
  textSync(): string;
  uri?: string;
}

/**
 * Persists benchmark evidence report to device filesystem using strict no-overwrite semantics
 * and exact read-back verification.
 *
 * Refuses to overwrite any pre-existing report file.
 * Verifies byte-for-byte read-back equality before reporting persistence success.
 */
export function persistDeviceReport(
  reportFile: DeviceReportFileAdapter,
  report: BenchmarkEvidenceReport,
): { persisted: boolean; payload: string; bytes: number } {
  if (reportFile.exists) {
    throw new Error(`Device evidence already exists for run ${report.runId}; refusing to overwrite existing report`);
  }

  const payload = JSON.stringify(report, null, 2);
  reportFile.create();
  reportFile.write(payload);

  const readBack = reportFile.textSync();
  if (readBack !== payload) {
    throw new Error(
      `Device evidence read-back verification failed: content mismatch with original serialized payload (expected ${payload.length} chars, read ${readBack ? readBack.length : 0} chars)`,
    );
  }

  return {
    persisted: true,
    payload,
    bytes: payload.length,
  };
}
