/**
 * MVE-001A-R1: Windows Host Memory Orchestrator
 *
 * Implements:
 * 1. Pluggable ADB transport (Physical Android device via ADB vs deterministic Mock transport).
 * 2. HTTP orchestrator server bound exclusively to 127.0.0.1.
 * 3. Atomic raw meminfo dump persistence with exclusive (wx) flags.
 * 4. Process attribution, session-to-PID binding, and sequence enforcement.
 * 5. Structured memory evidence report and SHA-256 manifest generation.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  type ArchitectureRun,
  type MemoryCheckpointData,
  type MemoryCheckpointEvent,
  type MemoryCheckpointPhase,
  type MemoryEvidenceReport,
  type MemorySessionState,
  type MemorySyncReceipt,
  type ParsedMeminfo,
  type SessionData,
  MEMORY_CHECKPOINT_PHASES,
  calculateDifferentialMetrics,
  calculateStatisticalSummary,
  createMemorySessionState,
  evaluateProvisionalCriteria,
  generateMemoryEvidenceManifest,
  parseDumpsysMeminfo,
  validateMemoryCheckpointEvent,
  validateMemoryEvidenceReport,
  validateProcessAttribution,
} from "../runtime/memory-protocol";

export const DEFAULT_ADB_PATH = "C:\\Users\\EC\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe";

/**
 * Interface abstraction for ADB communications.
 */
export interface AdbTransport {
  getProcessList(): Promise<string>;
  getMeminfo(pid: number): Promise<string>;
  forceStop(packageName: string): Promise<void>;
}

/**
 * Physical Android device ADB transport using platform-tools adb.exe.
 */
export class PhysicalAdbTransport implements AdbTransport {
  private adbPath: string;

  constructor(adbPath: string = DEFAULT_ADB_PATH) {
    this.adbPath = fs.existsSync(adbPath) ? adbPath : (process.env.ADB_PATH || "adb");
  }

  async getProcessList(): Promise<string> {
    try {
      return execFileSync(this.adbPath, ["shell", "ps", "-A"], {
        encoding: "utf8",
        timeout: 10000,
      });
    } catch (err: unknown) {
      throw new Error(`ADB ps -A execution failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async getMeminfo(pid: number): Promise<string> {
    try {
      return execFileSync(this.adbPath, ["shell", "dumpsys", "meminfo", "-d", String(pid)], {
        encoding: "utf8",
        timeout: 15000,
      });
    } catch (err: unknown) {
      throw new Error(`ADB dumpsys meminfo failed for PID ${pid}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async forceStop(packageName: string): Promise<void> {
    try {
      execFileSync(this.adbPath, ["shell", "am", "force-stop", packageName], {
        encoding: "utf8",
        timeout: 10000,
      });
    } catch (err: unknown) {
      throw new Error(`ADB am force-stop failed for ${packageName}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

/**
 * Deterministic Mock ADB Transport for offline testing and simulation.
 */
export class MockAdbTransport implements AdbTransport {
  public mockProcessList: string;
  public mockMeminfoResponses: Map<string, string>;
  public forceStopCalled: boolean = false;
  public forceStoppedPackage?: string;

  constructor(options?: {
    processList?: string;
    meminfoResponses?: Map<string, string>;
  }) {
    this.mockProcessList =
      options?.processList ||
      `USER           PID  PPID     VSZ    RSS WCHAN            ADDR S NAME\n` +
      `u0_a123      12345   678 1450200 245120 0                   0 S host.exp.exponent\n`;
    this.mockMeminfoResponses = options?.meminfoResponses || new Map();
  }

  async getProcessList(): Promise<string> {
    return this.mockProcessList;
  }

  async getMeminfo(pid: number): Promise<string> {
    const key = String(pid);
    if (this.mockMeminfoResponses.has(key)) {
      return this.mockMeminfoResponses.get(key)!;
    }
    // Default realistic mock dumpsys meminfo -d output
    return `Applications Memory Usage (in Kilobytes):
Uptime: 1234567 Realtime: 1234567

** MEMINFO in pid ${pid} [host.exp.exponent] **
                   Pss     Pss  Shared Private  Shared Private    Swap  SwapPss
                 Total   Clean   Dirty   Dirty   Clean   Clean   Dirty    Dirty
                ------  ------  ------  ------  ------  ------  ------  ------
  Native Heap    65000       0   62000   61000    1000       0   12000    1200
  Dalvik Heap    25000       0   24000   23500    1000       0    2000     200
       Unknown   15000       0   14000   13500    1000       0    1000     100
         TOTAL  135000       0  125000  120000    8000       0   15000    1500

 App Summary
                       Pss(KB)                        Rss(KB)
                        ------                         ------
           Java Heap:    25000                          30000
         Native Heap:    65000                          70000
                Code:    20000                          35000
               Stack:     1500                           1500
            Graphics:    10000                          12000
       Private Other:    12000
              System:     1500
             TOTAL PSS: 135000             TOTAL RSS:  245000      TOTAL SWAP PSS:    1500
`;
  }

  async forceStop(packageName: string): Promise<void> {
    this.forceStopCalled = true;
    this.forceStoppedPackage = packageName;
  }

  /**
   * Helper to configure realistic meminfo responses for synthetic runs.
   */
  setPhaseMeminfo(pid: number, phase: MemoryCheckpointPhase, pssKb: number, dirtyKb: number, nativeKb: number): void {
    const text = `Applications Memory Usage (in Kilobytes):
** MEMINFO in pid ${pid} [host.exp.exponent] **
                   Pss     Pss  Shared Private  Shared Private    Swap  SwapPss
                 Total   Clean   Dirty   Dirty   Clean   Clean   Dirty    Dirty
                ------  ------  ------  ------  ------  ------  ------  ------
  Native Heap    ${nativeKb}       0   ${Math.round(nativeKb * 0.95)}   ${Math.round(nativeKb * 0.9)}    1000       0   12000    1200
  Dalvik Heap    25000       0   24000   23500    1000       0    2000     200
       Unknown   15000       0   14000   13500    1000       0    1000     100
         TOTAL  ${pssKb}       0  ${dirtyKb}  ${Math.round(dirtyKb * 0.95)}    8000       0   15000    1500

 App Summary
                       Pss(KB)                        Rss(KB)
                        ------                         ------
           Java Heap:    25000                          30000
         Native Heap:    ${nativeKb}                          ${nativeKb + 5000}
                Code:    20000                          35000
               Stack:     1500                           1500
            Graphics:    10000                          12000
       Private Other:    12000
              System:     1500
             TOTAL PSS: ${pssKb}             TOTAL RSS:  ${pssKb + 50000}      TOTAL SWAP PSS:    1500
`;
    this.mockMeminfoResponses.set(`${pid}:${phase}`, text);
  }
}

export interface OrchestratorOptions {
  outputDir: string;
  adbTransport: AdbTransport;
  expectedPackage?: string;
  isSynthetic?: boolean;
  catalogueManifestSha256?: string;
}

/**
 * Windows Host Memory Orchestrator
 */
export class MemoryOrchestrator {
  public outputDir: string;
  public rawDir: string;
  public adbTransport: AdbTransport;
  public expectedPackage: string;
  public isSynthetic: boolean;
  public catalogueManifestSha256: string;

  public activeSessions: Map<string, MemorySessionState> = new Map();
  public sessionRuns: Map<string, ArchitectureRun> = new Map();
  public baselineMeminfoMap: Map<string, ParsedMeminfo> = new Map();
  public rawFiles: Array<{ path: string; relativePath: string; content: string; sha256: string }> = [];
  public errors: Array<{ sessionId?: string; error: string; timestampMs: number }> = [];

  constructor(options: OrchestratorOptions) {
    this.outputDir = options.outputDir;
    this.rawDir = path.join(this.outputDir, "raw");
    this.adbTransport = options.adbTransport;
    this.expectedPackage = options.expectedPackage || "host.exp.exponent";
    this.isSynthetic = options.isSynthetic ?? false;
    this.catalogueManifestSha256 =
      options.catalogueManifestSha256 ||
      "b5e0ca152f0f1bf0bb24fdbd800e735c31354415246652680eccd238c5bfdc02";

    if (!fs.existsSync(this.rawDir)) {
      fs.mkdirSync(this.rawDir, { recursive: true });
    }
  }

  /**
   * Initializes or registers an architecture block session.
   */
  startSession(
    sessionId: string,
    architecture: "B-bundle" | "C-split",
    sessionIndex: number,
    expectedPid: number,
  ): MemorySessionState {
    if (this.activeSessions.has(sessionId)) {
      throw new Error(`Session '${sessionId}' is already active`);
    }
    const state = createMemorySessionState(
      sessionId,
      architecture,
      sessionIndex,
      expectedPid,
      this.expectedPackage,
    );
    this.activeSessions.set(sessionId, state);
    return state;
  }

  /**
   * Handles a checkpoint event submitted by the device/runner.
   */
  async handleCheckpoint(event: MemoryCheckpointEvent): Promise<MemorySyncReceipt> {
    const hostTimestampMs = Date.now();
    const sessionId = event.sessionId;

    // 1. Retrieve or auto-register session
    let state = this.activeSessions.get(sessionId);
    if (!state) {
      state = this.startSession(sessionId, event.architecture, event.sessionIndex, event.pid);
    }

    // 2. Validate process attribution via ADB
    const procList = await this.adbTransport.getProcessList();
    const attribution = validateProcessAttribution(event.pid, this.expectedPackage, procList);
    if (!attribution.valid) {
      const err = `Process attribution failed for PID ${event.pid}: ${attribution.error}`;
      this.errors.push({ sessionId, error: err, timestampMs: hostTimestampMs });
      throw new Error(err);
    }

    // 3. Verify session-to-PID binding
    if (event.pid !== state.expectedPid) {
      const err = `Mid-session PID change detected: expected ${state.expectedPid}, received ${event.pid}. Session interrupted.`;
      this.errors.push({ sessionId, error: err, timestampMs: hostTimestampMs });
      throw new Error(err);
    }

    // 4. Validate checkpoint sequence & check for duplicate
    const validatedEvent = validateMemoryCheckpointEvent(event, state);

    // 5. Query dumpsys meminfo -d via ADB
    let rawMeminfo: string;
    if (this.adbTransport instanceof MockAdbTransport) {
      const phaseKey = `${event.pid}:${event.phase}`;
      if (this.adbTransport.mockMeminfoResponses.has(phaseKey)) {
        rawMeminfo = this.adbTransport.mockMeminfoResponses.get(phaseKey)!;
      } else {
        rawMeminfo = await this.adbTransport.getMeminfo(event.pid);
      }
    } else {
      rawMeminfo = await this.adbTransport.getMeminfo(event.pid);
    }

    // 6. Parse meminfo safely
    const parsedMeminfo = parseDumpsysMeminfo(rawMeminfo, event.pid);

    // 7. Store baseline or calculate differential metrics
    if (event.phase === "M0_BASELINE") {
      this.baselineMeminfoMap.set(sessionId, parsedMeminfo);
    }
    const baseline = this.baselineMeminfoMap.get(sessionId) || parsedMeminfo;
    const diff = calculateDifferentialMetrics(parsedMeminfo, baseline);

    // 8. Atomically persist raw meminfo dump file with exclusive (wx) flag
    const rawFileName = `${sessionId}_${event.architecture}_${event.phase}_${hostTimestampMs}.txt`;
    const rawFilePath = path.join(this.rawDir, rawFileName);
    const rawRelativePath = `raw/${rawFileName}`;

    try {
      fs.writeFileSync(rawFilePath, rawMeminfo, { encoding: "utf8", flag: "wx" });
    } catch (writeErr: unknown) {
      const err = `Failed to persist raw snapshot exclusively: ${writeErr instanceof Error ? writeErr.message : String(writeErr)}`;
      this.errors.push({ sessionId, error: err, timestampMs: hostTimestampMs });
      throw new Error(err);
    }

    const rawSha256 = createHash("sha256").update(rawMeminfo).digest("hex");
    this.rawFiles.push({
      path: rawFilePath,
      relativePath: rawRelativePath,
      content: rawMeminfo,
      sha256: rawSha256,
    });

    // 9. Create Sync Receipt
    const observedDeltaMs = Math.abs(hostTimestampMs - event.deviceTimestampMs);
    const receiptHash = createHash("sha256")
      .update(`${sessionId}:${event.phase}:${event.checkpointIndex}:${hostTimestampMs}`)
      .digest("hex");
    const receiptId = `rcpt_${receiptHash.slice(0, 16)}`;

    const receipt: MemorySyncReceipt = {
      status: "accepted",
      receiptId,
      sessionId,
      phase: event.phase,
      checkpointIndex: event.checkpointIndex,
      hostTimestampMs,
      observedDeltaMs,
    };

    // 10. Record snapshot in session state
    const checkpointData: MemoryCheckpointData = {
      phase: event.phase,
      checkpointIndex: event.checkpointIndex,
      pid: event.pid,
      deviceTimestampMs: event.deviceTimestampMs,
      hostTimestampMs,
      observedDeltaMs,
      receiptId,
      rawMetrics: parsedMeminfo,
      differential: diff,
      rawDumpFile: rawRelativePath,
      rawDumpSha256: rawSha256,
    };

    state.completedPhases.add(event.phase);
    state.checkpoints.set(event.phase, checkpointData);
    state.currentCheckpointIndex = event.checkpointIndex + 1;

    return receipt;
  }

  /**
   * Finalizes an architecture block run.
   */
  finalizeRun(sessionId: string): ArchitectureRun {
    const state = this.activeSessions.get(sessionId);
    if (!state) {
      throw new Error(`Session '${sessionId}' not found`);
    }
    if (state.completedPhases.size !== MEMORY_CHECKPOINT_PHASES.length) {
      throw new Error(
        `Incomplete session '${sessionId}': completed ${state.completedPhases.size} of 8 required checkpoints`,
      );
    }

    const checkpointsList: MemoryCheckpointData[] = [];
    for (const phase of MEMORY_CHECKPOINT_PHASES) {
      const cp = state.checkpoints.get(phase);
      if (!cp) throw new Error(`Missing checkpoint '${phase}' in session '${sessionId}'`);
      checkpointsList.push(cp);
    }

    const run: ArchitectureRun = {
      runId: sessionId,
      architecture: state.architecture,
      pid: state.expectedPid,
      checkpoints: checkpointsList,
    };

    this.sessionRuns.set(sessionId, run);
    return run;
  }

  /**
   * Compiles and atomically writes the final memory evidence report and SHA-256 manifest.
   */
  compileAndPersistEvidenceReport(
    sessions: SessionData[],
    options?: {
      targetFileName?: string;
      directive?: "MVE-001B" | "MVP-001" | "MVE-001A-R1";
      device?: {
        model: string;
        product: string;
        serial: string;
        androidVersion: string;
        apiLevel: number;
        engine: "Hermes";
        expoGoVersion: string;
      };
    },
  ): { report: MemoryEvidenceReport; reportPath: string; manifestPath: string } {
    const stats = calculateStatisticalSummary(sessions);
    const evalResult = evaluateProvisionalCriteria(stats);

    const targetFileName =
      options?.targetFileName ||
      (this.isSynthetic ? "synthetic-64-memory-evidence.json" : "mvp-001-memory-evidence.json");

    const report: MemoryEvidenceReport = {
      schemaVersion: "m2-3a-memory-evidence-1.0",
      directive: options?.directive || (this.isSynthetic ? "MVE-001A-R1" : "MVE-001B"),
      date: new Date().toISOString(),
      isSynthetic: this.isSynthetic,
      syntheticDisclaimer: this.isSynthetic
        ? "SIMULATED OFFLINE HARNESS RUN - NOT PHYSICAL DEVICE MEASUREMENT"
        : undefined,
      device: options?.device || {
        model: "Pixel 6a",
        product: "bluejay",
        serial: "19301FDEE003AS",
        androidVersion: "14",
        apiLevel: 34,
        engine: "Hermes",
        expoGoVersion: "57.0.9",
      },
      contract: {
        sessionsCount: 4,
        iterationsPerRun: 30,
        catalogueManifestSha256: this.catalogueManifestSha256,
        cacheBudgetBytes: 8 * 1024 * 1024,
      },
      sessions,
      statisticalSummary: stats,
      provisionalEvaluation: evalResult,
    };

    // Validate report schema
    const validation = validateMemoryEvidenceReport(report);
    if (!validation.valid) {
      throw new Error(`Compiled memory evidence report failed validation: ${validation.errors.join("; ")}`);
    }

    const reportPath = path.join(this.outputDir, targetFileName);
    const reportJson = JSON.stringify(report, null, 2);

    // Exclusive write for evidence report
    fs.writeFileSync(reportPath, reportJson, { encoding: "utf8", flag: "wx" });

    // Generate manifest including all raw files and the report JSON
    const manifestEntries: { path: string; content: string | Buffer }[] = [];
    for (const raw of this.rawFiles) {
      manifestEntries.push({
        path: raw.relativePath,
        content: raw.content,
      });
    }
    manifestEntries.push({
      path: targetFileName,
      content: reportJson,
    });

    const manifestContent = generateMemoryEvidenceManifest(manifestEntries);
    const manifestPath = path.join(
      this.outputDir,
      this.isSynthetic ? "manifest-synthetic-memory.sha256" : "manifest-memory.sha256",
    );
    fs.writeFileSync(manifestPath, manifestContent, { encoding: "utf8", flag: "wx" });

    return { report, reportPath, manifestPath };
  }

  /**
   * Starts an HTTP orchestrator server bound exclusively to 127.0.0.1.
   */
  startServer(port: number = 0): Promise<{ port: number; url: string; close: () => Promise<void> }> {
    return new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        // Enforce 127.0.0.1 loopback only
        const remoteIp = req.socket.remoteAddress;
        if (remoteIp !== "127.0.0.1" && remoteIp !== "::ffff:127.0.0.1" && remoteIp !== "::1") {
          res.writeHead(403, { "Content-Type": "text/plain" });
          res.end("Forbidden: memory orchestrator binds only to loopback");
          return;
        }

        const parsedUrl = new URL(req.url || "/", `http://127.0.0.1:${port}`);

        if (req.method === "POST" && parsedUrl.pathname === "/memory/checkpoint") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
            if (body.length > 1024 * 1024) {
              res.writeHead(413, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Payload too large" }));
              req.destroy();
            }
          });

          req.on("end", async () => {
            try {
              const event = JSON.parse(body) as MemoryCheckpointEvent;
              const receipt = await this.handleCheckpoint(event);
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify(receipt));
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              const statusCode = msg.includes("Duplicate") || msg.includes("Mid-session") ? 409 : 400;
              res.writeHead(statusCode, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: msg }));
            }
          });
          return;
        }

        if (req.method === "GET" && parsedUrl.pathname === "/memory/status") {
          const sessionId = parsedUrl.searchParams.get("sessionId");
          if (!sessionId) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Missing sessionId parameter" }));
            return;
          }
          const state = this.activeSessions.get(sessionId);
          if (!state) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: `Session '${sessionId}' not found` }));
            return;
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              sessionId: state.sessionId,
              architecture: state.architecture,
              completedPhases: Array.from(state.completedPhases),
              currentCheckpointIndex: state.currentCheckpointIndex,
            }),
          );
          return;
        }

        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      });

      server.listen(port, "127.0.0.1", () => {
        const addr = server.address();
        if (typeof addr === "object" && addr) {
          const actualPort = addr.port;
          resolve({
            port: actualPort,
            url: `http://127.0.0.1:${actualPort}`,
            close: () =>
              new Promise((resClose) => {
                server.close(() => resClose());
              }),
          });
        } else {
          reject(new Error("Failed to obtain server address"));
        }
      });

      server.on("error", (err) => reject(err));
    });
  }
}