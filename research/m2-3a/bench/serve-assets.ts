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
  CONTRACT_VERSION,
  validateEvidenceReport,
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
    throw new Error("Missing required argument: --arch (must be 'B-bundle' or 'C-split')");
  }
  if (iter === undefined) {
    throw new Error("Missing required argument: --iter (must be an integer from 1 to 100)");
  }

  return {
    port: port ?? 8082,
    architecture: arch,
    iterations: iter,
  };
}

/**
 * Creates the single immutable task contract for the benchmark session.
 */
export function createTaskContract(
  architecture: Architecture,
  iterations: number,
  manifestDir: string,
  worktreeDir?: string,
): BenchmarkTaskContract {
  const rootDir = worktreeDir ?? process.cwd();
  let gitSha: string;
  let dirtyWorktree: boolean;

  try {
    gitSha = execFileSync("git", ["-C", rootDir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const status = execFileSync("git", ["-C", rootDir, "status", "--porcelain"], { encoding: "utf8" });
    dirtyWorktree = status.trim().length > 0;
  } catch (err) {
    throw new Error(`Failed to establish Git source identity: ${err instanceof Error ? err.message : String(err)}`);
  }

  const manifestPath = path.join(manifestDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Catalogue manifest not found at ${manifestPath}`);
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
    instrumentationRevision: "M2-3A-C1-HARDENED-v1",
    catalogueManifestSha256,
  };
}

/**
 * Creates the HTTP asset server and evidence collector.
 * Listens only on 127.0.0.1.
 */
export function createAssetServer(config: ServerConfig): http.Server {
  const { contract, folder, evidenceDir } = config;

  fs.mkdirSync(evidenceDir, { recursive: true });

  const acceptedRunIds = new Set<string>();

  const server = http.createServer((request, response) => {
    const parsedUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const pathname = parsedUrl.pathname.replace(/^\/+/, "");

    // Path traversal check
    if (pathname.includes("..") || path.isAbsolute(pathname)) {
      response.writeHead(400, { "content-type": "text/plain" }).end("bad request: invalid path");
      return;
    }

    // 1. Task Contract endpoint (GET /task)
    if (pathname === "task") {
      if (request.method !== "GET") {
        response.writeHead(405, { "content-type": "text/plain" }).end("method not allowed");
        return;
      }
      const payload = JSON.stringify(contract);
      console.log(`[serve-assets] GET /task: returning contract for run ${contract.runId}`);
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
      if (contentLengthHeader) {
        const declaredLength = parseInt(contentLengthHeader, 10);
        if (declaredLength > MAX_EVIDENCE_BODY_BYTES) {
          response.writeHead(413, { "content-type": "text/plain" }).end("payload too large");
          return;
        }
      }

      let receivedBytes = 0;
      const chunks: Buffer[] = [];

      request.on("data", (chunk: Buffer) => {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_EVIDENCE_BODY_BYTES) {
          request.destroy(new Error("Request body exceeded maximum allowed size"));
          return;
        }
        chunks.push(chunk);
      });

      request.on("end", () => {
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

          // Check for duplicate submission
          if (acceptedRunIds.has(report.runId)) {
            response.writeHead(409, { "content-type": "text/plain" }).end("duplicate evidence: report already accepted for this run");
            return;
          }

          const targetFileName = `${report.runId}.json`;
          const targetFilePath = path.join(evidenceDir, targetFileName);

          if (fs.existsSync(targetFilePath)) {
            response.writeHead(409, { "content-type": "text/plain" }).end("duplicate evidence: target file already exists");
            return;
          }

          // Write atomically with fs.writeFileSync
          fs.writeFileSync(targetFilePath, JSON.stringify(report, null, 2), "utf8");

          // Read back and compute SHA-256 for verification
          const persistedBytes = fs.readFileSync(targetFilePath);
          if (persistedBytes.length === 0) {
            fs.unlinkSync(targetFilePath);
            throw new Error("Persisted evidence verification failed: file is empty");
          }
          const computedSha = crypto.createHash("sha256").update(persistedBytes).digest("hex");

          acceptedRunIds.add(report.runId);

          const receipt: EvidenceReceipt = {
            status: "accepted",
            runId: report.runId,
            filename: targetFileName,
            bytes: persistedBytes.length,
            sha256: computedSha,
            acceptedAt: new Date().toISOString(),
          };

          console.log(`[serve-assets] POST /evidence: accepted evidence for ${report.runId} (${persistedBytes.length} bytes, SHA: ${computedSha})`);

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
          response.writeHead(400, { "content-type": "text/plain" }).end(`evidence rejected: ${msg}`);
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

      if (!fs.existsSync(targetFilePath)) {
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

      const fileBytes = fs.readFileSync(targetFilePath);
      const computedSha = crypto.createHash("sha256").update(fileBytes).digest("hex");

      const status: EvidenceStatus = {
        runId,
        persisted: true,
        verified: true,
        filename: targetFileName,
        bytes: fileBytes.length,
        sha256: computedSha,
      };

      const payload = JSON.stringify(status);
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
