import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { assetsDir } from "./build-assets";
import {
  type Architecture,
  type BenchmarkTaskContract,
  type EvidenceReceipt,
  type EvidenceStatus,
  type AcceptanceRecord,
  CONTRACT_VERSION,
  validateEvidenceReport,
  validateAcceptanceRecord,
} from "../runtime/contract";

/**
 * Serves the benchmark assets to the device over the development machine's
 * loopback (127.0.0.1) and collects physical/device benchmark evidence.
 *
 * CLI syntax:
 *   node --import tsx research/m2-3a/bench/serve-assets.ts [port] --arch=B-bundle|C-split --iter=N
 */

export const MAX_EVIDENCE_BODY_BYTES = 10 * 1024 * 1024; // 10 MB

const CONTENT_TYPES: Record<string, string> = {
  ".json": "application/json",
  ".pack": "application/octet-stream",
};

export interface CliConfig {
  port: number;
  architecture: Architecture;
  iterations: number;
}

export interface ServerConfig {
  port: number;
  contract: BenchmarkTaskContract;
  folder: string;
  evidenceDir: string;
}

/**
 * Strict CLI argument parser.
 * Rejects missing, duplicate, unknown or invalid arguments.
 * Never silently defaults or clamps.
 */
export function parseCliArgs(argv: string[]): CliConfig {
  let port: number | undefined;
  let arch: Architecture | undefined;
  let iter: number | undefined;

  const seen = new Set<string>();

  for (const arg of argv) {
    if (arg.startsWith("--arch=")) {
      if (seen.has("arch")) {
        throw new Error("Duplicate --arch argument");
      }
      seen.add("arch");
      const val = arg.slice("--arch=".length);
      if (val !== "B-bundle" && val !== "C-split") {
        throw new Error(`Invalid --arch: expected 'B-bundle' or 'C-split', got '${val}'`);
      }
      arch = val;
    } else if (arg.startsWith("--iter=")) {
      if (seen.has("iter")) {
        throw new Error("Duplicate --iter argument");
      }
      seen.add("iter");
      const valStr = arg.slice("--iter=".length);
      if (!/^\d+$/.test(valStr)) {
        throw new Error(`Invalid --iter: must be an integer, got '${valStr}'`);
      }
      const val = parseInt(valStr, 10);
      if (val < 1 || val > 100) {
        throw new Error(`Invalid --iter: must be between 1 and 100, got ${val}`);
      }
      iter = val;
    } else if (arg.startsWith("--port=")) {
      if (seen.has("port")) {
        throw new Error("Duplicate --port argument");
      }
      seen.add("port");
      const valStr = arg.slice("--port=".length);
      if (!/^\d+$/.test(valStr)) {
        throw new Error(`Invalid --port: must be an integer, got '${valStr}'`);
      }
      const val = parseInt(valStr, 10);
      if (val < 1 || val > 65535) {
        throw new Error(`Invalid --port: must be between 1 and 65535, got ${val}`);
      }
      port = val;
    } else if (/^\d+$/.test(arg)) {
      if (seen.has("port")) {
        throw new Error("Duplicate port argument");
      }
      seen.add("port");
      const val = parseInt(arg, 10);
      if (val < 1 || val > 65535) {
        throw new Error(`Invalid port: must be between 1 and 65535, got ${val}`);
      }
      port = val;
    } else {
      throw new Error(`Unknown argument: '${arg}'`);
    }
  }

  if (!arch) {
    throw new Error("Missing required argument: --arch=B-bundle|C-split");
  }
  if (!iter) {
    throw new Error("Missing required argument: --iter=N (integer between 1 and 100)");
  }

  return {
    port: port ?? 8082,
    architecture: arch,
    iterations: iter,
  };
}

/**
 * Obtains current Git commit SHA and dirty state.
 */
function getGitInfo(): { gitSha: string; dirtyWorktree: boolean } {
  try {
    const gitSha = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    const status = execFileSync("git", ["status", "--porcelain"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    return {
      gitSha,
      dirtyWorktree: status.length > 0,
    };
  } catch {
    return {
      gitSha: "0000000000000000000000000000000000000000",
      dirtyWorktree: true,
    };
  }
}

/**
 * Creates the authoritative, immutable task contract for a benchmark run.
 */
export function createTaskContract(
  architecture: Architecture,
  iterations: number,
  folder: string,
): BenchmarkTaskContract {
  const { gitSha, dirtyWorktree } = getGitInfo();

  const manifestPath = path.join(folder, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Catalogue manifest not found at ${manifestPath}. Run build-assets first.`);
  }

  const manifestBytes = fs.readFileSync(manifestPath);
  const catalogueManifestSha256 = crypto.createHash("sha256").update(manifestBytes).digest("hex");

  const runId = `m2-3a-${architecture}-${iterations}x-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

  return {
    contractVersion: CONTRACT_VERSION,
    runId,
    architecture,
    iterations,
    createdAt: new Date().toISOString(),
    gitSha,
    dirtyWorktree,
    instrumentationRevision: "M2-3A-C1-R2-VERIFIED-v1",
    catalogueManifestSha256,
  };
}

/**
 * Creates the HTTP asset server and evidence collector.
 * Listens only on 127.0.0.1.
 */
export function createAssetServer(config: ServerConfig): http.Server {
  const { contract, folder, evidenceDir } = config;

  // Ensure evidence directory exists
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  // Clean up any orphaned temporary files (.tmp-*) from previous crashes
  try {
    const entries = fs.readdirSync(evidenceDir);
    for (const entry of entries) {
      if (entry.startsWith(".tmp-") && entry.endsWith(".tmp")) {
        try {
          fs.unlinkSync(path.join(evidenceDir, entry));
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }

  // Pre-populate accepted run IDs from existing persisted evidence and acceptance files
  const acceptedRunIds = new Set<string>();
  try {
    const entries = fs.readdirSync(evidenceDir);
    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      if (entry.endsWith(".acceptance.json")) {
        acceptedRunIds.add(entry.slice(0, -".acceptance.json".length));
      } else if (entry.endsWith(".json")) {
        acceptedRunIds.add(entry.slice(0, -".json".length));
      }
    }
  } catch {
    // ignore
  }

  // Active in-flight submission lock to prevent concurrent races
  const inFlightRunIds = new Set<string>();

  const server = http.createServer((request, response) => {
    // Bind to localhost requests only
    const clientIp = request.socket.remoteAddress;
    if (clientIp !== "127.0.0.1" && clientIp !== "::1" && clientIp !== "::ffff:127.0.0.1") {
      response.writeHead(403, { "content-type": "text/plain" }).end("forbidden: localhost only");
      return;
    }

    const host = request.headers.host ?? "127.0.0.1";
    const parsedUrl = new URL(request.url ?? "/", `http://${host}`);
    const pathname = parsedUrl.pathname.replace(/^\/+/, "");

    // 1. Task contract endpoint (GET /task)
    if (pathname === "task") {
      if (request.method !== "GET") {
        response.writeHead(405, { "content-type": "text/plain" }).end("method not allowed");
        return;
      }
      console.log(`[serve-assets] GET /task: returning contract for run ${contract.runId}`);
      const payload = JSON.stringify(contract, null, 2);
      response.writeHead(200, {
        "content-type": "application/json",
        "cache-control": "no-store",
        "content-length": Buffer.byteLength(payload),
      });
      response.end(payload);
      return;
    }

    // 2. Evidence submission endpoint (POST /evidence)
    if (pathname === "evidence") {
      if (request.method !== "POST") {
        response.writeHead(405, { "content-type": "text/plain" }).end("method not allowed");
        return;
      }

      const contentLengthHeader = request.headers["content-length"];
      let declaredLength: number | undefined;
      if (contentLengthHeader) {
        declaredLength = parseInt(contentLengthHeader, 10);
        if (isNaN(declaredLength) || declaredLength < 0) {
          response.writeHead(400, { "content-type": "text/plain" }).end("invalid content-length header");
          return;
        }
        if (declaredLength > MAX_EVIDENCE_BODY_BYTES) {
          response.writeHead(413, { "content-type": "text/plain" }).end("payload too large");
          return;
        }
      }

      let receivedBytes = 0;
      let aborted = false;
      const chunks: Buffer[] = [];

      request.on("data", (chunk: Buffer) => {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_EVIDENCE_BODY_BYTES) {
          aborted = true;
          if (!response.headersSent) {
            response.writeHead(413, { "content-type": "text/plain" }).end("payload too large");
          }
          request.destroy(new Error("Request body exceeded maximum allowed size"));
          return;
        }
        chunks.push(chunk);
      });

      request.on("aborted", () => {
        aborted = true;
      });

      request.on("close", () => {
        if (!request.complete) {
          aborted = true;
        }
      });

      request.on("end", () => {
        if (aborted || !request.complete) {
          if (!response.headersSent) {
            response.writeHead(400, { "content-type": "text/plain" }).end("incomplete upload: request was aborted or incomplete");
          }
          return;
        }

        // Detect incomplete uploads
        if (declaredLength !== undefined && receivedBytes !== declaredLength) {
          response.writeHead(400, { "content-type": "text/plain" }).end(
            `incomplete upload: received ${receivedBytes} bytes, expected ${declaredLength} bytes`,
          );
          return;
        }

        let tempEvidenceFilePath: string | null = null;
        let tempAcceptanceFilePath: string | null = null;
        let runIdToRelease: string | null = null;

        try {
          const bodyBuffer = Buffer.concat(chunks);
          const rawText = bodyBuffer.toString("utf8");
          let parsed: unknown;
          try {
            parsed = JSON.parse(rawText);
          } catch (jsonErr) {
            response.writeHead(400, { "content-type": "text/plain" }).end("malformed JSON in request body");
            return;
          }

          const report = validateEvidenceReport(parsed, contract);

          const targetFileName = `${report.runId}.json`;
          const targetFilePath = path.join(evidenceDir, targetFileName);
          const acceptanceFileName = `${report.runId}.acceptance.json`;
          const acceptanceFilePath = path.join(evidenceDir, acceptanceFileName);

          // Atomic check: reject duplicate, in-flight, or existing on-disk submissions
          if (
            acceptedRunIds.has(report.runId) ||
            inFlightRunIds.has(report.runId) ||
            fs.existsSync(targetFilePath) ||
            fs.existsSync(acceptanceFilePath)
          ) {
            acceptedRunIds.add(report.runId);
            response.writeHead(409, { "content-type": "text/plain" }).end(
              "duplicate evidence: report already accepted, in flight, or exists on disk for this run",
            );
            return;
          }

          // Acquire in-flight lock
          inFlightRunIds.add(report.runId);
          runIdToRelease = report.runId;

          // Exclusive publication on Windows:
          // Write to temporary files on the same volume with exclusive flag 'wx'
          const tempEvidenceFileName = `.tmp-ev-${report.runId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.tmp`;
          tempEvidenceFilePath = path.join(evidenceDir, tempEvidenceFileName);

          const tempAcceptanceFileName = `.tmp-acc-${report.runId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.tmp`;
          tempAcceptanceFilePath = path.join(evidenceDir, tempAcceptanceFileName);

          const serializedEvidence = JSON.stringify(report, null, 2);
          fs.writeFileSync(tempEvidenceFilePath, serializedEvidence, { encoding: "utf8", flag: "wx" });

          // Read back and compute SHA-256 for verification before publication
          const persistedBytes = fs.readFileSync(tempEvidenceFilePath);
          if (persistedBytes.length === 0) {
            throw new Error("Temporary evidence file verification failed: file is empty");
          }
          const computedSha = crypto.createHash("sha256").update(persistedBytes).digest("hex");

          // Prepare independent durable acceptance baseline record
          const acceptanceRecord: AcceptanceRecord = {
            runId: report.runId,
            filename: targetFileName,
            bytes: persistedBytes.length,
            sha256: computedSha,
            acceptedAt: new Date().toISOString(),
            contract: {
              contractVersion: contract.contractVersion,
              runId: contract.runId,
              architecture: contract.architecture,
              iterations: contract.iterations,
              createdAt: contract.createdAt,
              gitSha: contract.gitSha,
              dirtyWorktree: contract.dirtyWorktree,
              instrumentationRevision: contract.instrumentationRevision,
              catalogueManifestSha256: contract.catalogueManifestSha256,
            },
          };

          const serializedAcceptance = JSON.stringify(acceptanceRecord, null, 2);
          fs.writeFileSync(tempAcceptanceFilePath, serializedAcceptance, { encoding: "utf8", flag: "wx" });

          // Genuine exclusive atomic publication: hard-link temp files to final destinations
          // On Windows NTFS, fs.linkSync throws EEXIST if targetFilePath already exists.
          try {
            fs.linkSync(tempEvidenceFilePath, targetFilePath);
          } catch (linkErr: any) {
            if (linkErr.code === "EEXIST") {
              acceptedRunIds.add(report.runId);
              response.writeHead(409, { "content-type": "text/plain" }).end(
                "duplicate evidence: target file already exists",
              );
              return;
            }
            throw linkErr;
          }

          try {
            fs.linkSync(tempAcceptanceFilePath, acceptanceFilePath);
          } catch (linkErr: any) {
            if (linkErr.code === "EEXIST") {
              acceptedRunIds.add(report.runId);
              response.writeHead(409, { "content-type": "text/plain" }).end(
                "duplicate evidence: acceptance record already exists",
              );
              return;
            }
            throw linkErr;
          }

          // Clean up temporary files after successful publication
          try {
            fs.unlinkSync(tempEvidenceFilePath);
            tempEvidenceFilePath = null;
          } catch {
            // ignore
          }
          try {
            fs.unlinkSync(tempAcceptanceFilePath);
            tempAcceptanceFilePath = null;
          } catch {
            // ignore
          }

          // Finalize acceptance
          acceptedRunIds.add(report.runId);
          inFlightRunIds.delete(report.runId);
          runIdToRelease = null;

          const receipt: EvidenceReceipt = {
            status: "accepted",
            runId: report.runId,
            filename: targetFileName,
            bytes: persistedBytes.length,
            sha256: computedSha,
            acceptedAt: acceptanceRecord.acceptedAt,
          };

          console.log(
            `[serve-assets] POST /evidence: accepted evidence for ${report.runId} (${persistedBytes.length} bytes, SHA: ${computedSha})`,
          );

          const payload = JSON.stringify(receipt);
          response.writeHead(200, {
            "content-type": "application/json",
            "cache-control": "no-store",
            "content-length": Buffer.byteLength(payload),
          });
          response.end(payload);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[serve-assets] POST /evidence error: ${msg}`);
          if (!response.headersSent) {
            response.writeHead(400, { "content-type": "text/plain" }).end(`evidence rejected: ${msg}`);
          }
        } finally {
          if (tempEvidenceFilePath && fs.existsSync(tempEvidenceFilePath)) {
            try {
              fs.unlinkSync(tempEvidenceFilePath);
            } catch {
              // ignore
            }
          }
          if (tempAcceptanceFilePath && fs.existsSync(tempAcceptanceFilePath)) {
            try {
              fs.unlinkSync(tempAcceptanceFilePath);
            } catch {
              // ignore
            }
          }
          if (runIdToRelease) {
            inFlightRunIds.delete(runIdToRelease);
          }
        }
      });

      request.on("error", (err) => {
        console.error(`[serve-assets] POST /evidence stream error:`, err);
        if (!response.headersSent) {
          response.writeHead(400, { "content-type": "text/plain" }).end("request stream error");
        }
      });
      return;
    }

    // 3. Evidence status endpoint (GET /evidence/status?runId=...)
    if (pathname === "evidence/status") {
      if (request.method !== "GET") {
        response.writeHead(405, { "content-type": "text/plain" }).end("method not allowed");
        return;
      }

      const runId = parsedUrl.searchParams.get("runId");
      if (!runId || !/^[a-zA-Z0-9_\-\.]+$/.test(runId)) {
        response.writeHead(400, { "content-type": "text/plain" }).end("bad request: missing or invalid runId parameter");
        return;
      }

      const targetFileName = `${runId}.json`;
      const targetFilePath = path.join(evidenceDir, targetFileName);
      const acceptanceFileName = `${runId}.acceptance.json`;
      const acceptanceFilePath = path.join(evidenceDir, acceptanceFileName);

      const evidenceExists = fs.existsSync(targetFilePath);
      const acceptanceExists = fs.existsSync(acceptanceFilePath);

      // Neither exists
      if (!evidenceExists && !acceptanceExists) {
        const notFoundStatus: EvidenceStatus = {
          runId,
          persisted: false,
          verified: false,
        };
        const payload = JSON.stringify(notFoundStatus);
        response.writeHead(200, {
          "content-type": "application/json",
          "cache-control": "no-store",
          "content-length": Buffer.byteLength(payload),
        });
        response.end(payload);
        return;
      }

      // Partial transaction: evidence exists but acceptance record missing
      if (evidenceExists && !acceptanceExists) {
        const fileBytes = fs.readFileSync(targetFilePath);
        const computedSha = crypto.createHash("sha256").update(fileBytes).digest("hex");
        const partialStatus: EvidenceStatus = {
          runId,
          persisted: true,
          verified: false,
          corrupt: true,
          reason: "Missing durable acceptance record (incomplete or unverified transaction)",
          filename: targetFileName,
          bytes: fileBytes.length,
          sha256: computedSha,
        };
        const payload = JSON.stringify(partialStatus);
        response.writeHead(200, {
          "content-type": "application/json",
          "cache-control": "no-store",
          "content-length": Buffer.byteLength(payload),
        });
        response.end(payload);
        return;
      }

      // Partial transaction: acceptance record exists but evidence file missing
      if (!evidenceExists && acceptanceExists) {
        const partialStatus: EvidenceStatus = {
          runId,
          persisted: false,
          verified: false,
          corrupt: true,
          reason: "Evidence file missing despite existing durable acceptance record",
          filename: targetFileName,
        };
        const payload = JSON.stringify(partialStatus);
        response.writeHead(200, {
          "content-type": "application/json",
          "cache-control": "no-store",
          "content-length": Buffer.byteLength(payload),
        });
        response.end(payload);
        return;
      }

      // Both files exist: inspect acceptance record first
      let acceptanceRecord: AcceptanceRecord;
      try {
        const accBytes = fs.readFileSync(acceptanceFilePath);
        if (accBytes.length === 0) {
          throw new Error("Durable acceptance record is empty (0 bytes)");
        }
        const accJson = JSON.parse(accBytes.toString("utf8"));
        acceptanceRecord = validateAcceptanceRecord(accJson, contract);
      } catch (accErr) {
        const msg = accErr instanceof Error ? accErr.message : String(accErr);
        const corruptStatus: EvidenceStatus = {
          runId,
          persisted: true,
          verified: false,
          corrupt: true,
          reason: `Corrupted or invalid durable acceptance record: ${msg}`,
          filename: targetFileName,
        };
        const payload = JSON.stringify(corruptStatus);
        response.writeHead(200, {
          "content-type": "application/json",
          "cache-control": "no-store",
          "content-length": Buffer.byteLength(payload),
        });
        response.end(payload);
        return;
      }

      // Read evidence file and verify against durable acceptance record
      const fileBytes = fs.readFileSync(targetFilePath);
      const computedSha = crypto.createHash("sha256").update(fileBytes).digest("hex");

      if (fileBytes.length === 0) {
        const emptyStatus: EvidenceStatus = {
          runId,
          persisted: true,
          verified: false,
          corrupt: true,
          reason: "Evidence file is empty (0 bytes)",
          filename: targetFileName,
          bytes: 0,
          sha256: computedSha,
        };
        const payload = JSON.stringify(emptyStatus);
        response.writeHead(200, {
          "content-type": "application/json",
          "cache-control": "no-store",
          "content-length": Buffer.byteLength(payload),
        });
        response.end(payload);
        return;
      }

      // Detect post-acceptance alteration or tampering (even if schema-valid!)
      if (fileBytes.length !== acceptanceRecord.bytes || computedSha.toLowerCase() !== acceptanceRecord.sha256.toLowerCase()) {
        const tamperedStatus: EvidenceStatus = {
          runId,
          persisted: true,
          verified: false,
          corrupt: true,
          reason: `Evidence content modified after acceptance: expected length ${acceptanceRecord.bytes} (SHA ${acceptanceRecord.sha256}), got length ${fileBytes.length} (SHA ${computedSha})`,
          filename: targetFileName,
          bytes: fileBytes.length,
          sha256: computedSha,
        };
        const payload = JSON.stringify(tamperedStatus);
        response.writeHead(200, {
          "content-type": "application/json",
          "cache-control": "no-store",
          "content-length": Buffer.byteLength(payload),
        });
        response.end(payload);
        return;
      }

      // Validate JSON syntax and evidence report schema
      let parsed: unknown;
      try {
        parsed = JSON.parse(fileBytes.toString("utf8"));
      } catch (jsonErr) {
        const corruptStatus: EvidenceStatus = {
          runId,
          persisted: true,
          verified: false,
          corrupt: true,
          reason: "Evidence file contains malformed JSON",
          filename: targetFileName,
          bytes: fileBytes.length,
          sha256: computedSha,
        };
        const payload = JSON.stringify(corruptStatus);
        response.writeHead(200, {
          "content-type": "application/json",
          "cache-control": "no-store",
          "content-length": Buffer.byteLength(payload),
        });
        response.end(payload);
        return;
      }

      try {
        validateEvidenceReport(parsed, contract);
      } catch (valErr) {
        const invalidStatus: EvidenceStatus = {
          runId,
          persisted: true,
          verified: false,
          corrupt: true,
          reason: `Evidence content validation failed: ${valErr instanceof Error ? valErr.message : String(valErr)}`,
          filename: targetFileName,
          bytes: fileBytes.length,
          sha256: computedSha,
        };
        const payload = JSON.stringify(invalidStatus);
        response.writeHead(200, {
          "content-type": "application/json",
          "cache-control": "no-store",
          "content-length": Buffer.byteLength(payload),
        });
        response.end(payload);
        return;
      }

      const validStatus: EvidenceStatus = {
        runId,
        persisted: true,
        verified: true,
        corrupt: false,
        filename: targetFileName,
        bytes: fileBytes.length,
        sha256: computedSha,
        acceptedAt: acceptanceRecord.acceptedAt,
      };

      const payload = JSON.stringify(validStatus);
      response.writeHead(200, {
        "content-type": "application/json",
        "cache-control": "no-store",
        "content-length": Buffer.byteLength(payload),
      });
      response.end(payload);
      return;
    }

    // 4. Manifest endpoint (GET /manifest)
    if (pathname === "manifest") {
      const manifestPath = path.join(folder, "manifest.json");
      if (!fs.existsSync(manifestPath)) {
        response.writeHead(404, { "content-type": "text/plain" }).end("not found: manifest");
        return;
      }
      response.writeHead(200, {
        "content-type": "application/json",
        "content-length": fs.statSync(manifestPath).size,
        "cache-control": "no-store",
      });
      fs.createReadStream(manifestPath).pipe(response);
      return;
    }

    // 5. Static catalogue asset serving
    const file = path.join(folder, pathname);
    if (!fs.existsSync(file)) {
      response.writeHead(404, { "content-type": "text/plain" }).end(`not found: ${pathname}`);
      return;
    }
    response.writeHead(200, {
      "content-type": CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream",
      "content-length": fs.statSync(file).size,
      "cache-control": "no-store",
    });
    fs.createReadStream(file).pipe(response);
  });

  server.requestTimeout = 5000;
  return server;
}

// CLI entry point
function isMain(): boolean {
  if (!process.argv[1]) return false;
  return path.resolve(process.argv[1]) === path.resolve(__filename || "");
}

if (isMain()) {
  try {
    const cli = parseCliArgs(process.argv.slice(2));
    const folder = assetsDir();
    const evidenceDir = path.join(process.cwd(), "research", "m2-3a", "evidence", "runs");
    const contract = createTaskContract(cli.architecture, cli.iterations, folder);

    console.log(`[serve-assets] Starting benchmark server on 127.0.0.1:${cli.port}`);
    console.log(`[serve-assets] Immutable task contract created:`);
    console.log(JSON.stringify(contract, null, 2));

    const server = createAssetServer({
      port: cli.port,
      contract,
      folder,
      evidenceDir,
    });

    server.listen(cli.port, "127.0.0.1", () => {
      console.log(`[serve-assets] Serving ${folder} on http://127.0.0.1:${cli.port}`);
      console.log(`[serve-assets] Collecting evidence into ${evidenceDir}`);
    });
  } catch (err) {
    console.error(`[serve-assets] Fatal configuration error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
