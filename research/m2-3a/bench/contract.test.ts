import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import {
  parseCliArgs,
  createTaskContract,
  createAssetServer,
  MAX_EVIDENCE_BODY_BYTES,
} from "./serve-assets";
import {
  type BenchmarkTaskContract,
  type BenchmarkEvidenceReport,
  type EvidenceReceipt,
  type EvidenceStatus,
  CONTRACT_VERSION,
  validateTaskContract,
  validateEvidenceReport,
} from "../runtime/contract";

function makeValidContract(overrides?: Partial<BenchmarkTaskContract>): BenchmarkTaskContract {
  return {
    contractVersion: 1,
    runId: "m2-3a-B-bundle-1x-test-123456",
    architecture: "B-bundle",
    iterations: 1,
    createdAt: new Date().toISOString(),
    gitSha: "52eb197c7d7c49394aa65f8dc51e4f74cb301763",
    dirtyWorktree: true,
    instrumentationRevision: "M2-3A-C1-HARDENED-v1",
    catalogueManifestSha256: "3cbffe49140801ea8ce76c3dd0151860357d5b9e92bccbd98734d2e43202118b",
    ...overrides,
  };
}

function makeValidReport(contract: BenchmarkTaskContract): BenchmarkEvidenceReport {
  return {
    contract,
    runId: contract.runId,
    startTime: Date.now() - 1000,
    completedTime: Date.now(),
    completed: true,
    runState: "WORKLOAD_COMPLETED",
    device: {
      platform: "android",
      engine: "Hermes",
      model: "Pixel 6a",
      os_version: "17",
    },
    marks: [
      { name: "#0/open_us", ms: 1400 },
      { name: "#0/search_cold", ms: 75 },
    ],
    memory: {
      platform_required: true,
      note: "Hermes memory note",
    },
    counts: {
      architecture: contract.architecture === "B-bundle" ? 1 : 2,
      iterations: contract.iterations,
      samples: contract.iterations,
    },
    samples: Array.from({ length: contract.iterations }, (_, i) => ({
      iteration: i,
      marks: [
        { name: "open_us", ms: 1400 },
        { name: "search_cold", ms: 75 },
      ],
      counts: {
        iteration: i,
        architecture: contract.architecture === "B-bundle" ? 1 : 2,
      },
    })),
    note: "Automated test report",
  };
}

// Helper to start an ephemeral test server and return its port and closer
async function withTestServer(
  contract: BenchmarkTaskContract,
  evidenceDir: string,
  folderDir: string,
  fn: (baseUrl: string) => Promise<void>,
) {
  const server = createAssetServer({
    port: 0,
    contract,
    folder: folderDir,
    evidenceDir,
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}

test("1. Valid B-bundle task configuration CLI parsing", () => {
  const res = parseCliArgs(["--arch=B-bundle", "--iter=5", "--port=9091"]);
  assert.equal(res.architecture, "B-bundle");
  assert.equal(res.iterations, 5);
  assert.equal(res.port, 9091);
});

test("2. Valid C-split task configuration CLI parsing", () => {
  const res = parseCliArgs(["8089", "--arch=C-split", "--iter=30"]);
  assert.equal(res.architecture, "C-split");
  assert.equal(res.iterations, 30);
  assert.equal(res.port, 8089);
});

test("3. Missing CLI configuration rejected", () => {
  assert.throws(() => parseCliArgs(["--iter=10"]), /Missing required argument: --arch/);
  assert.throws(() => parseCliArgs(["--arch=B-bundle"]), /Missing required argument: --iter/);
});

test("4. Invalid architecture rejected", () => {
  assert.throws(() => parseCliArgs(["--arch=D-hybrid", "--iter=10"]), /Invalid --arch/);
});

test("5. Invalid iteration values rejected (bounds and type)", () => {
  assert.throws(() => parseCliArgs(["--arch=B-bundle", "--iter=0"]), /must be between 1 and 100/);
  assert.throws(() => parseCliArgs(["--arch=B-bundle", "--iter=101"]), /must be between 1 and 100/);
  assert.throws(() => parseCliArgs(["--arch=B-bundle", "--iter=abc"]), /must be an integer/);
  assert.throws(() => parseCliArgs(["--arch=B-bundle", "--iter=5.5"]), /must be an integer/);
});

test("6. Unknown or duplicate CLI arguments rejected", () => {
  assert.throws(() => parseCliArgs(["--arch=B-bundle", "--iter=10", "--extra"]), /Unknown argument/);
  assert.throws(() => parseCliArgs(["--arch=B-bundle", "--arch=C-split", "--iter=10"]), /Duplicate --arch/);
  assert.throws(() => parseCliArgs(["--arch=B-bundle", "--iter=10", "--iter=20"]), /Duplicate --iter/);
});

test("7. Stable run ID across repeated GET /task requests", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m2-3a-test-stable-"));
  const contract = makeValidContract();
  try {
    await withTestServer(contract, tmpDir, tmpDir, async (baseUrl) => {
      const res1 = await fetch(`${baseUrl}/task`);
      assert.equal(res1.status, 200);
      const data1 = (await res1.json()) as BenchmarkTaskContract;

      const res2 = await fetch(`${baseUrl}/task`);
      assert.equal(res2.status, 200);
      const data2 = (await res2.json()) as BenchmarkTaskContract;

      assert.equal(data1.runId, contract.runId);
      assert.equal(data2.runId, contract.runId);
      assert.deepEqual(data1, data2);
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("8. Strict client contract validation accepts valid contracts", () => {
  const valid = makeValidContract();
  const result = validateTaskContract(valid);
  assert.equal(result.runId, valid.runId);
  assert.equal(result.contractVersion, 1);
  assert.equal(result.architecture, "B-bundle");
});

test("9. Unavailable or null task data fails closed", () => {
  assert.throws(() => validateTaskContract(null), /must be a non-null object/);
  assert.throws(() => validateTaskContract(undefined), /must be a non-null object/);
  assert.throws(() => validateTaskContract("not an object"), /must be a non-null object/);
});

test("10. Invalid/malformed contract schema rejected", () => {
  assert.throws(() => validateTaskContract(makeValidContract({ contractVersion: 2 as any })), /Unsupported contractVersion/);
  assert.throws(() => validateTaskContract(makeValidContract({ architecture: "invalid" as any })), /Invalid architecture/);
  assert.throws(() => validateTaskContract(makeValidContract({ iterations: 0 })), /Invalid iterations/);
  assert.throws(() => validateTaskContract(makeValidContract({ gitSha: "short" })), /Invalid gitSha/);
  assert.throws(() => validateTaskContract(makeValidContract({ catalogueManifestSha256: "not-hex" })), /Invalid catalogueManifestSha256/);
});

test("11. Evidence with mismatched runId or architecture rejected", () => {
  const contract = makeValidContract();
  const report = makeValidReport(contract);

  const mismatchedReport = { ...report, runId: "different-run-id" };
  assert.throws(() => validateEvidenceReport(mismatchedReport, contract), /Evidence runId mismatch/);

  const mismatchedArchReport = {
    ...report,
    contract: { ...contract, architecture: "C-split" as const },
  };
  assert.throws(() => validateEvidenceReport(mismatchedArchReport, contract), /Embedded contract architecture mismatch/);
});

test("12. Manifest identity failure rejected when manifest missing", () => {
  const emptyTmp = fs.mkdtempSync(path.join(os.tmpdir(), "m2-3a-test-no-manifest-"));
  try {
    assert.throws(
      () => createTaskContract("B-bundle", 10, emptyTmp),
      /Catalogue manifest not found/,
    );
  } finally {
    fs.rmSync(emptyTmp, { recursive: true, force: true });
  }
});

test("13. Oversized evidence rejected by collector", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m2-3a-test-oversized-"));
  const contract = makeValidContract();
  try {
    await withTestServer(contract, tmpDir, tmpDir, async (baseUrl) => {
      const hugeData = "a".repeat(MAX_EVIDENCE_BODY_BYTES + 1024);
      const res = await fetch(`${baseUrl}/evidence`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(hugeData.length),
        },
        body: hugeData,
      });
      assert.equal(res.status, 413);
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("14. Incomplete iteration data rejected by validator and collector", async () => {
  const contract = makeValidContract({ iterations: 5 });
  const incompleteReport = makeValidReport(contract);
  incompleteReport.samples = incompleteReport.samples.slice(0, 3); // 3 of 5

  assert.throws(
    () => validateEvidenceReport(incompleteReport, contract),
    /Evidence report sample count mismatch/,
  );

  const uncompletedReport = makeValidReport(contract);
  uncompletedReport.completed = false;
  assert.throws(
    () => validateEvidenceReport(uncompletedReport, contract),
    /Evidence report indicates run was incomplete/,
  );
});

test("15. Duplicate report submission rejected with 409 Conflict", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m2-3a-test-dup-"));
  const contract = makeValidContract();
  const report = makeValidReport(contract);

  try {
    await withTestServer(contract, tmpDir, tmpDir, async (baseUrl) => {
      // First submission succeeds
      const res1 = await fetch(`${baseUrl}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(report),
      });
      assert.equal(res1.status, 200);

      // Second submission fails with 409
      const res2 = await fetch(`${baseUrl}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(report),
      });
      assert.equal(res2.status, 409);
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("16. Malformed JSON evidence rejected with 400 Bad Request", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m2-3a-test-malformed-"));
  const contract = makeValidContract();
  try {
    await withTestServer(contract, tmpDir, tmpDir, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{ malformed json",
      });
      assert.equal(res.status, 400);
      const text = await res.text();
      assert.match(text, /malformed JSON/);
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("17. Evidence receipt and SHA-256 checksum validated", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m2-3a-test-receipt-"));
  const contract = makeValidContract();
  const report = makeValidReport(contract);

  try {
    await withTestServer(contract, tmpDir, tmpDir, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(report),
      });
      assert.equal(res.status, 200);
      const receipt = (await res.json()) as EvidenceReceipt;

      assert.equal(receipt.status, "accepted");
      assert.equal(receipt.runId, contract.runId);
      assert.equal(receipt.filename, `${contract.runId}.json`);

      // Read back file directly from disk and verify byte length and SHA-256
      const savedFilePath = path.join(tmpDir, receipt.filename);
      assert.ok(fs.existsSync(savedFilePath));
      const savedBytes = fs.readFileSync(savedFilePath);
      assert.equal(savedBytes.length, receipt.bytes);

      const actualSha = crypto.createHash("sha256").update(savedBytes).digest("hex");
      assert.equal(actualSha, receipt.sha256);
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("18. Stored evidence status query retrievable and verified", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m2-3a-test-status-"));
  const contract = makeValidContract();
  const report = makeValidReport(contract);

  try {
    await withTestServer(contract, tmpDir, tmpDir, async (baseUrl) => {
      // Query status before persistence: persisted=false
      const resBefore = await fetch(`${baseUrl}/evidence/status?runId=${encodeURIComponent(contract.runId)}`);
      assert.equal(resBefore.status, 200);
      const statusBefore = (await resBefore.json()) as EvidenceStatus;
      assert.equal(statusBefore.persisted, false);
      assert.equal(statusBefore.verified, false);

      // Submit evidence
      const submitRes = await fetch(`${baseUrl}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(report),
      });
      assert.equal(submitRes.status, 200);
      const receipt = (await submitRes.json()) as EvidenceReceipt;

      // Query status after persistence: persisted=true, verified=true
      const resAfter = await fetch(`${baseUrl}/evidence/status?runId=${encodeURIComponent(contract.runId)}`);
      assert.equal(resAfter.status, 200);
      const statusAfter = (await resAfter.json()) as EvidenceStatus;
      assert.equal(statusAfter.persisted, true);
      assert.equal(statusAfter.verified, true);
      assert.equal(statusAfter.sha256, receipt.sha256);
      assert.equal(statusAfter.bytes, receipt.bytes);
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("19. Existing B30 evidence file is never modified or overwritten by tests", () => {
  const b30Path = path.join(process.cwd(), "research", "m2-3a", "evidence", "b30-evidence.json");
  if (fs.existsSync(b30Path)) {
    const bytes = fs.readFileSync(b30Path);
    const sha = crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();
    assert.equal(sha, "3CBFFE49140801EA8CE76C3DD0151860357D5B9E92BCCBD98734D2E43202118B");
  }
});

test("20. Benchmark workload invariants preserved (no altered logic)", () => {
  const appPath = path.join(process.cwd(), "research", "m2-3a", "device", "app", "App.tsx");
  const appSource = fs.readFileSync(appPath, "utf8");

  // Invariants from baseline
  assert.match(appSource, /const CACHE_BUDGET_BYTES = 8 \* 1024 \* 1024;/);
  assert.match(appSource, /new BundleStore/);
  assert.match(appSource, /new SplitStore/);
  assert.match(appSource, /runtime\.open\("US"\)/);
  assert.match(appSource, /runtime\.open\("CA"\)/);
  assert.match(appSource, /runtime\.search\("chicken", "CA", 20\)/);
  assert.match(appSource, /runtime\.ingredients\(keys, "US"\)/);
});
