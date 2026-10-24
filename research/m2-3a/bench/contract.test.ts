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
  type AcceptanceRecord,
  type DeviceReportFileAdapter,
  CONTRACT_VERSION,
  REQUIRED_BENCHMARK_MARKS,
  REQUIRED_BENCHMARK_COUNTS,
  validateTaskContract,
  validateEvidenceReport,
  validateAcceptanceRecord,
  validateCollectorReceipt,
  validateCollectorStatus,
  persistDeviceReport,
} from "../runtime/contract";

function makeValidContract(overrides?: Partial<BenchmarkTaskContract>): BenchmarkTaskContract {
  return {
    contractVersion: 1,
    runId: "m2-3a-B-bundle-1x-test-123456",
    architecture: "B-bundle",
    iterations: 1,
    createdAt: "2026-10-23T12:00:00.000Z",
    gitSha: "52eb197c7d7c49394aa65f8dc51e4f74cb301763",
    dirtyWorktree: true,
    instrumentationRevision: "M2-3A-C1-R2-VERIFIED-v1",
    catalogueManifestSha256: "3cbffe49140801ea8ce76c3dd0151860357d5b9e92bccbd98734d2e43202118b",
    ...overrides,
  };
}

function makeSampleMarks(): { name: string; ms: number; iterations?: number }[] {
  return [
    { name: "open_us", ms: 1400 },
    { name: "open_ca", ms: 1200 },
    { name: "search_cold", ms: 75 },
    { name: "search_warm", ms: 12 },
    { name: "search_fallback", ms: 30 },
    { name: "detail_cold", ms: 40 },
    { name: "detail_warm", ms: 15 },
    { name: "recipe_resolution", ms: 45 },
    { name: "repeated_search", ms: 150, iterations: 50 },
    { name: "market_switch", ms: 80, iterations: 10 },
    { name: "cache_pass", ms: 60 },
  ];
}

function makeSampleCounts(iteration: number, arch: "B-bundle" | "C-split"): Record<string, number> {
  return {
    iteration,
    architecture: arch === "B-bundle" ? 1 : 2,
    open_us_records: 8000,
    open_ca_records: 6000,
    search_results: 20,
    fallback_results: 5,
    fallback_cross_market: 2,
    recipe_keys: 15,
    recipe_resolved: 15,
    cache_entries: 50,
    cache_bytes: 102400,
    detail_found_cold: 1,
    detail_found_warm: 1,
  };
}

function makeValidReport(contract: BenchmarkTaskContract): BenchmarkEvidenceReport {
  const marks = makeSampleMarks();
  const samples = Array.from({ length: contract.iterations }, (_, i) => ({
    iteration: i,
    marks: marks.map((m) => ({ ...m })),
    counts: makeSampleCounts(i, contract.architecture),
  }));

  return {
    contract,
    runId: contract.runId,
    startTime: Date.now() - 5000,
    completedTime: Date.now(),
    completed: true,
    runState: "DEVICE_EVIDENCE_PERSISTED",
    device: {
      platform: "android",
      engine: "Hermes",
      model: "Pixel 6a",
      os_version: "17",
      app_version: "0.3.1",
    },
    marks: samples.flatMap((sample) =>
      sample.marks.map((mark) => ({ ...mark, name: `#${sample.counts.iteration}/${mark.name}` })),
    ),
    memory: {
      platform_required: true,
      note: "Hermes memory note",
    },
    counts: {
      architecture: contract.architecture === "B-bundle" ? 1 : 2,
      iterations: contract.iterations,
      samples: contract.iterations,
      ...samples[samples.length - 1]?.counts,
    },
    samples,
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
  assert.throws(
    () => parseCliArgs(["--arch=A-monolith", "--iter=5"]),
    /Invalid --arch: expected 'B-bundle' or 'C-split'/,
  );
});

test("5. Invalid iteration values rejected (bounds and type)", () => {
  assert.throws(() => parseCliArgs(["--arch=B-bundle", "--iter=0"]), /Invalid --iter: must be between 1 and 100/);
  assert.throws(() => parseCliArgs(["--arch=B-bundle", "--iter=101"]), /Invalid --iter: must be between 1 and 100/);
  assert.throws(() => parseCliArgs(["--arch=B-bundle", "--iter=3.5"]), /Invalid --iter: must be an integer/);
  assert.throws(() => parseCliArgs(["--arch=B-bundle", "--iter=abc"]), /Invalid --iter: must be an integer/);
});

test("6. Unknown or duplicate CLI arguments rejected", () => {
  assert.throws(
    () => parseCliArgs(["--arch=B-bundle", "--iter=5", "--unknown=yes"]),
    /Unknown argument: '--unknown=yes'/,
  );
  assert.throws(
    () => parseCliArgs(["--arch=B-bundle", "--arch=C-split", "--iter=5"]),
    /Duplicate --arch argument/,
  );
});

test("7. Stable run ID across repeated GET /task requests", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m2-3a-test-task-"));
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
  assert.equal(result.architecture, "B-bundle");
  assert.equal(result.iterations, 1);
});

test("9. Unavailable or null task data fails closed", () => {
  assert.throws(() => validateTaskContract(null), /Task contract must be a non-null object/);
  assert.throws(() => validateTaskContract(undefined), /Task contract must be a non-null object/);
  assert.throws(() => validateTaskContract("string"), /Task contract must be a non-null object/);
});

test("10. Invalid/malformed contract schema rejected", () => {
  // Invalid runId format
  assert.throws(
    () => validateTaskContract(makeValidContract({ runId: "bad run id with spaces" })),
    /Invalid runId format/,
  );

  // Missing or out-of-range iterations
  assert.throws(
    () => validateTaskContract(makeValidContract({ iterations: 0 })),
    /Invalid iterations/,
  );

  // Invalid gitSha (not 40 hex chars)
  assert.throws(
    () => validateTaskContract(makeValidContract({ gitSha: "short-sha" })),
    /Invalid gitSha/,
  );

  // Invalid catalogueManifestSha256 (not 64 hex chars)
  assert.throws(
    () => validateTaskContract(makeValidContract({ catalogueManifestSha256: "not-64-chars" })),
    /Invalid catalogueManifestSha256/,
  );
});

test("11. Evidence with mismatched runId or architecture rejected", () => {
  const contract = makeValidContract();
  const report = makeValidReport(contract);

  // RunId mismatch at top-level
  assert.throws(
    () => validateEvidenceReport({ ...report, runId: "mismatch-run-id" }, contract),
    /Evidence runId mismatch/,
  );

  // Architecture mismatch in embedded contract
  const mismatchedContract = { ...contract, architecture: "C-split" as const };
  assert.throws(
    () => validateEvidenceReport({ ...report, contract: mismatchedContract }, contract),
    /Embedded contract architecture mismatch/,
  );
});

test("12. Manifest identity failure rejected when manifest missing", () => {
  const emptyFolder = fs.mkdtempSync(path.join(os.tmpdir(), "m2-3a-test-empty-manifest-"));
  try {
    assert.throws(
      () => createTaskContract("B-bundle", 5, emptyFolder),
      /Catalogue manifest not found at .*manifest\.json/,
    );
  } finally {
    fs.rmSync(emptyFolder, { recursive: true, force: true });
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

test("14. Incomplete iteration data rejected by validator and collector", () => {
  const contract = makeValidContract({ iterations: 3 });
  const report = makeValidReport(contract);

  // Only 2 samples instead of required 3
  report.samples = report.samples.slice(0, 2);

  assert.throws(
    () => validateEvidenceReport(report, contract),
    /Evidence report sample count mismatch: expected 3, got 2/,
  );
});

test("15. Duplicate report submission rejected with 409 Conflict", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m2-3a-test-dup-"));
  const contract = makeValidContract();
  const report = makeValidReport(contract);

  try {
    await withTestServer(contract, tmpDir, tmpDir, async (baseUrl) => {
      const res1 = await fetch(`${baseUrl}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(report),
      });
      assert.equal(res1.status, 200);

      // Duplicate POST
      const res2 = await fetch(`${baseUrl}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(report),
      });
      assert.equal(res2.status, 409);
      const text2 = await res2.text();
      assert.match(text2, /duplicate evidence/);
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
      assert.equal(statusAfter.corrupt, false);
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

// Safe exclusive publication & integrity validation

test("21. Concurrent submissions: two simultaneous submissions cannot both be accepted", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m2-3a-test-concurrent-"));
  const contract = makeValidContract();
  const report = makeValidReport(contract);

  try {
    await withTestServer(contract, tmpDir, tmpDir, async (baseUrl) => {
      // Fire two concurrent POST requests for the same runId simultaneously
      const [p1, p2] = await Promise.all([
        fetch(`${baseUrl}/evidence`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(report),
        }),
        fetch(`${baseUrl}/evidence`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(report),
        }),
      ]);

      const statuses = [p1.status, p2.status].sort();
      assert.deepEqual(statuses, [200, 409], "Exactly one concurrent request succeeds (200) and one fails (409)");

      // Verify file on disk is valid and uncorrupted
      const targetFilePath = path.join(tmpDir, `${contract.runId}.json`);
      assert.ok(fs.existsSync(targetFilePath));
      const parsedOnDisk = JSON.parse(fs.readFileSync(targetFilePath, "utf8"));
      assert.equal(parsedOnDisk.runId, contract.runId);
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("22. Genuine exclusive publication: pre-existing evidence file cannot be overwritten", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m2-3a-test-no-overwrite-"));
  const contract = makeValidContract();
  const report = makeValidReport(contract);

  try {
    const targetFilePath = path.join(tmpDir, `${contract.runId}.json`);
    const originalContent = JSON.stringify({ preExisting: "authoritative evidence", runId: contract.runId });
    fs.writeFileSync(targetFilePath, originalContent, "utf8");
    const originalSha = crypto.createHash("sha256").update(Buffer.from(originalContent)).digest("hex");

    await withTestServer(contract, tmpDir, tmpDir, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(report),
      });

      assert.equal(res.status, 409, "Server must reject overwrite of pre-existing evidence with 409");
      const currentContent = fs.readFileSync(targetFilePath, "utf8");
      const currentSha = crypto.createHash("sha256").update(Buffer.from(currentContent)).digest("hex");
      assert.equal(currentSha, originalSha, "Pre-existing evidence content must remain untouched");
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("23. Server restart detects existing evidence and refuses overwrite", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m2-3a-test-restart-"));
  const contract = makeValidContract();
  const report = makeValidReport(contract);

  try {
    // 1. First server session accepts report
    await withTestServer(contract, tmpDir, tmpDir, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(report),
      });
      assert.equal(res.status, 200);
    });

    // 2. Second server session starts with the same evidence directory
    await withTestServer(contract, tmpDir, tmpDir, async (baseUrl) => {
      // POST must be rejected with 409
      const res = await fetch(`${baseUrl}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(report),
      });
      assert.equal(res.status, 409);
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("24. Status endpoint detects corrupted evidence (malformed JSON) as corrupt", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m2-3a-test-corrupt-json-"));
  const contract = makeValidContract();

  try {
    const targetFilePath = path.join(tmpDir, `${contract.runId}.json`);
    const badJson = "{ truncated or corrupted JSON...";
    fs.writeFileSync(targetFilePath, badJson, "utf8");

    // Also write matching acceptance record so status proceeds to JSON parse check
    const accFilePath = path.join(tmpDir, `${contract.runId}.acceptance.json`);
    const badBytes = Buffer.from(badJson, "utf8");
    const accRecord: AcceptanceRecord = {
      runId: contract.runId,
      filename: `${contract.runId}.json`,
      bytes: badBytes.length,
      sha256: crypto.createHash("sha256").update(badBytes).digest("hex"),
      acceptedAt: new Date().toISOString(),
      contract,
    };
    fs.writeFileSync(accFilePath, JSON.stringify(accRecord, null, 2), "utf8");

    await withTestServer(contract, tmpDir, tmpDir, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/evidence/status?runId=${encodeURIComponent(contract.runId)}`);
      assert.equal(res.status, 200);
      const status = (await res.json()) as EvidenceStatus;
      assert.equal(status.persisted, true);
      assert.equal(status.verified, false);
      assert.equal(status.corrupt, true);
      assert.match(status.reason ?? "", /malformed JSON/);
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("25. Status endpoint detects tampered evidence (schema violation) as corrupt", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m2-3a-test-tampered-"));
  const contract = makeValidContract();
  const report = makeValidReport(contract);

  try {
    // Save report with removed samples to simulate tampering on disk
    const tampered = { ...report, samples: [] };
    const targetFilePath = path.join(tmpDir, `${contract.runId}.json`);
    const tamperedStr = JSON.stringify(tampered, null, 2);
    fs.writeFileSync(targetFilePath, tamperedStr, "utf8");

    const accFilePath = path.join(tmpDir, `${contract.runId}.acceptance.json`);
    const tamperedBytes = Buffer.from(tamperedStr, "utf8");
    const accRecord: AcceptanceRecord = {
      runId: contract.runId,
      filename: `${contract.runId}.json`,
      bytes: tamperedBytes.length,
      sha256: crypto.createHash("sha256").update(tamperedBytes).digest("hex"),
      acceptedAt: new Date().toISOString(),
      contract,
    };
    fs.writeFileSync(accFilePath, JSON.stringify(accRecord, null, 2), "utf8");

    await withTestServer(contract, tmpDir, tmpDir, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/evidence/status?runId=${encodeURIComponent(contract.runId)}`);
      assert.equal(res.status, 200);
      const status = (await res.json()) as EvidenceStatus;
      assert.equal(status.persisted, true);
      assert.equal(status.verified, false);
      assert.equal(status.corrupt, true);
      assert.match(status.reason ?? "", /validation failed/);
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("26. Status endpoint detects empty (0 byte) file as corrupt", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m2-3a-test-empty-"));
  const contract = makeValidContract();

  try {
    const targetFilePath = path.join(tmpDir, `${contract.runId}.json`);
    fs.writeFileSync(targetFilePath, "", "utf8"); // 0 bytes

    const accFilePath = path.join(tmpDir, `${contract.runId}.acceptance.json`);
    const accRecord = {
      runId: contract.runId,
      filename: `${contract.runId}.json`,
      bytes: 0,
      sha256: crypto.createHash("sha256").update(Buffer.alloc(0)).digest("hex"),
      acceptedAt: new Date().toISOString(),
      contract,
    };
    fs.writeFileSync(accFilePath, JSON.stringify(accRecord, null, 2), "utf8");

    await withTestServer(contract, tmpDir, tmpDir, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/evidence/status?runId=${encodeURIComponent(contract.runId)}`);
      assert.equal(res.status, 200);
      const status = (await res.json()) as EvidenceStatus;
      assert.equal(status.persisted, true);
      assert.equal(status.verified, false);
      assert.equal(status.corrupt, true);
      assert.match(status.reason ?? "", /empty|Corrupted or invalid/);
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("27. Authoritative contract provenance: every field must match contract", () => {
  const contract = makeValidContract();
  const report = makeValidReport(contract);

  // Mismatched gitSha
  assert.throws(
    () =>
      validateEvidenceReport(
        { ...report, contract: { ...contract, gitSha: "0000000000000000000000000000000000000000" } },
        contract,
      ),
    /Embedded contract gitSha mismatch/,
  );

  // Mismatched dirtyWorktree
  assert.throws(
    () =>
      validateEvidenceReport(
        { ...report, contract: { ...contract, dirtyWorktree: !contract.dirtyWorktree } },
        contract,
      ),
    /Embedded contract dirtyWorktree mismatch/,
  );

  // Mismatched instrumentationRevision
  assert.throws(
    () =>
      validateEvidenceReport(
        { ...report, contract: { ...contract, instrumentationRevision: "UNAPPROVED-REV" } },
        contract,
      ),
    /Embedded contract instrumentationRevision mismatch/,
  );

  // Mismatched catalogueManifestSha256
  assert.throws(
    () =>
      validateEvidenceReport(
        {
          ...report,
          contract: {
            ...contract,
            catalogueManifestSha256: "0000000000000000000000000000000000000000000000000000000000000000",
          },
        },
        contract,
      ),
    /Embedded contract catalogueManifestSha256 mismatch/,
  );

  // Mismatched createdAt
  assert.throws(
    () =>
      validateEvidenceReport(
        { ...report, contract: { ...contract, createdAt: "2026-01-01T00:00:00.000Z" } },
        contract,
      ),
    /Embedded contract createdAt mismatch/,
  );
});

test("28. Strict measurement schema: iteration missing required benchmark mark is rejected", () => {
  const contract = makeValidContract();
  const report = makeValidReport(contract);

  // Remove required mark 'recipe_resolution' from first sample
  report.samples[0].marks = report.samples[0].marks.filter((m) => m.name !== "recipe_resolution");

  assert.throws(
    () => validateEvidenceReport(report, contract),
    /missing required benchmark mark 'recipe_resolution'/,
  );
});

test("29. Strict measurement schema: negative or non-finite ms is rejected", () => {
  const contract = makeValidContract();
  const report = makeValidReport(contract);

  report.samples[0].marks[0].ms = -1;
  assert.throws(
    () => validateEvidenceReport(report, contract),
    /contains invalid mark/,
  );

  report.samples[0].marks[0].ms = NaN;
  assert.throws(
    () => validateEvidenceReport(report, contract),
    /contains invalid mark/,
  );
});

test("30. Strict measurement schema: missing required count or wrong architecture count is rejected", () => {
  const contract = makeValidContract();
  const report = makeValidReport(contract);

  // Delete 'open_us_records' count
  delete (report.samples[0].counts as any).open_us_records;
  assert.throws(
    () => validateEvidenceReport(report, contract),
    /has invalid or missing count for 'open_us_records'/,
  );

  // Wrong architecture count (e.g. 2 for B-bundle)
  const report2 = makeValidReport(contract);
  report2.samples[0].counts.architecture = 2;
  assert.throws(
    () => validateEvidenceReport(report2, contract),
    /counts\.architecture mismatch/,
  );
});

test("31. Incomplete upload and premature abort handling: server rejects and no evidence persisted", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m2-3a-test-incomplete-"));
  const contract = makeValidContract();

  try {
    await withTestServer(contract, tmpDir, tmpDir, async (baseUrl) => {
      // 1. Truncated / incomplete JSON payload
      const res = await fetch(`${baseUrl}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"truncated": "json-stream-cut-off',
      });
      assert.equal(res.status, 400);
      const text = await res.text();
      assert.match(text, /malformed JSON/);

      // 2. Aborted / severed socket before completion
      const url = new URL(`${baseUrl}/evidence`);
      await new Promise<void>((resolve) => {
        const req = http.request(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "content-length": "10000",
          },
        });
        req.on("error", () => resolve());
        req.write('{"start": "incomplete"');
        req.destroy();
        setTimeout(resolve, 50);
      });

      // Verify no target file was persisted and no residue left
      const remainingFiles = fs.readdirSync(tmpDir);
      assert.equal(remainingFiles.length, 0, "No files should be persisted after aborted or incomplete uploads");
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("32. Exclusive publication cleanly removes temporary files leaving no residue", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m2-3a-test-no-residue-"));
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

      // Verify only the final target files exist, no temporary .tmp-* files linger
      const files = fs.readdirSync(tmpDir).sort();
      assert.deepEqual(files, [`${contract.runId}.acceptance.json`, `${contract.runId}.json`]);
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// C1-R2 Deterministic Regression Tests

test("33. Existing device report cannot be overwritten", () => {
  const contract = makeValidContract();
  const report = makeValidReport(contract);

  let created = false;
  let written = false;

  const mockFile: DeviceReportFileAdapter = {
    exists: true, // File already exists
    create: () => {
      created = true;
    },
    write: () => {
      written = true;
    },
    textSync: () => "pre-existing content",
    uri: "file:///documents/research/evidence/m2-3a-test.json",
  };

  assert.throws(
    () => persistDeviceReport(mockFile, report),
    /already exists for run.*refusing to overwrite existing report/,
  );

  assert.equal(created, false, "create() must not be called when file already exists");
  assert.equal(written, false, "write() must not be called when file already exists");
});

test("34. Duplicate run ID is rejected on device persistence", () => {
  const contract = makeValidContract();
  const report = makeValidReport(contract);

  let fileContent = "";
  let exists = false;

  const mockFile: DeviceReportFileAdapter = {
    get exists() {
      return exists;
    },
    create: () => {
      if (exists) throw new Error("File already exists");
      exists = true;
    },
    write: (content: string) => {
      fileContent = content;
    },
    textSync: () => fileContent,
    uri: "file:///documents/research/evidence/run.json",
  };

  // First persistence succeeds
  const res1 = persistDeviceReport(mockFile, report);
  assert.equal(res1.persisted, true);
  assert.equal(exists, true);

  // Second persistence with duplicate run ID is strictly rejected
  assert.throws(
    () => persistDeviceReport(mockFile, report),
    /Device evidence already exists for run/,
  );
});

test("35. Exact device read-back mismatch is detected", () => {
  const contract = makeValidContract();
  const report = makeValidReport(contract);

  let exists = false;
  const mockFile: DeviceReportFileAdapter = {
    get exists() {
      return exists;
    },
    create: () => {
      exists = true;
    },
    write: () => {
      // Content written
    },
    textSync: () => "corrupted or truncated content", // Mismatch with serialized report!
    uri: "file:///documents/research/evidence/run.json",
  };

  assert.throws(
    () => persistDeviceReport(mockFile, report),
    /Device evidence read-back verification failed: content mismatch/,
  );
});

test("36. Persistence failure does not claim success", () => {
  const contract = makeValidContract();
  const report = makeValidReport(contract);

  const mockFile: DeviceReportFileAdapter = {
    exists: false,
    create: () => {
      throw new Error("Disk full or permission denied");
    },
    write: () => {},
    textSync: () => "",
  };

  assert.throws(
    () => persistDeviceReport(mockFile, report),
    /Disk full or permission denied/,
  );
});

test("37. Valid Windows receipt is accepted", () => {
  const runId = "m2-3a-test-valid-run-123";
  const rawReceipt = {
    status: "accepted",
    runId,
    filename: `${runId}.json`,
    bytes: 4096,
    sha256: "3cbffe49140801ea8ce76c3dd0151860357d5b9e92bccbd98734d2e43202118b",
    acceptedAt: "2026-10-24T12:00:00.000Z",
  };

  const receipt = validateCollectorReceipt(rawReceipt, runId);
  assert.equal(receipt.status, "accepted");
  assert.equal(receipt.runId, runId);
  assert.equal(receipt.bytes, 4096);
  assert.equal(receipt.sha256, "3cbffe49140801ea8ce76c3dd0151860357d5b9e92bccbd98734d2e43202118b");
});

test("38. Invalid receipt run ID is rejected", () => {
  const runId = "m2-3a-expected-run";
  const rawReceipt = {
    status: "accepted",
    runId: "m2-3a-DIFFERENT-run",
    filename: `${runId}.json`,
    bytes: 100,
    sha256: "3cbffe49140801ea8ce76c3dd0151860357d5b9e92bccbd98734d2e43202118b",
    acceptedAt: "2026-10-24T12:00:00.000Z",
  };

  assert.throws(
    () => validateCollectorReceipt(rawReceipt, runId),
    /Collector receipt runId mismatch/,
  );
});

test("39. Invalid receipt filename is rejected", () => {
  const runId = "m2-3a-test-run";
  const rawReceipt = {
    status: "accepted",
    runId,
    filename: "../suspicious.json",
    bytes: 100,
    sha256: "3cbffe49140801ea8ce76c3dd0151860357d5b9e92bccbd98734d2e43202118b",
    acceptedAt: "2026-10-24T12:00:00.000Z",
  };

  assert.throws(
    () => validateCollectorReceipt(rawReceipt, runId),
    /Collector receipt invalid filename/,
  );
});

test("40. Missing or malformed checksum is rejected", () => {
  const runId = "m2-3a-test-run";

  // Invalid SHA format (not 64 hex chars)
  assert.throws(
    () =>
      validateCollectorReceipt(
        {
          status: "accepted",
          runId,
          filename: `${runId}.json`,
          bytes: 100,
          sha256: "invalid-short-hash",
          acceptedAt: "2026-10-24T12:00:00.000Z",
        },
        runId,
      ),
    /Collector receipt invalid SHA-256 digest/,
  );
});

test("41. Receipt vs status byte-count mismatch is rejected", () => {
  const runId = "m2-3a-test-run";
  const receipt: EvidenceReceipt = {
    status: "accepted",
    runId,
    filename: `${runId}.json`,
    bytes: 2048,
    sha256: "3cbffe49140801ea8ce76c3dd0151860357d5b9e92bccbd98734d2e43202118b",
    acceptedAt: "2026-10-24T12:00:00.000Z",
  };

  const statusWithDifferentBytes: EvidenceStatus = {
    runId,
    persisted: true,
    verified: true,
    corrupt: false,
    bytes: 2049, // Mismatch!
    sha256: receipt.sha256,
  };

  assert.throws(
    () => validateCollectorStatus(statusWithDifferentBytes, receipt),
    /Collector status byte count mismatch/,
  );
});

test("42. Unverified or corrupted Windows status is rejected", () => {
  const runId = "m2-3a-test-run";
  const receipt: EvidenceReceipt = {
    status: "accepted",
    runId,
    filename: `${runId}.json`,
    bytes: 2048,
    sha256: "3cbffe49140801ea8ce76c3dd0151860357d5b9e92bccbd98734d2e43202118b",
    acceptedAt: "2026-10-24T12:00:00.000Z",
  };

  // Not verified
  assert.throws(
    () =>
      validateCollectorStatus(
        {
          runId,
          persisted: true,
          verified: false,
          bytes: 2048,
          sha256: receipt.sha256,
        },
        receipt,
      ),
    /Collector status indicates evidence not verified/,
  );

  // Corrupt
  assert.throws(
    () =>
      validateCollectorStatus(
        {
          runId,
          persisted: true,
          verified: true,
          corrupt: true,
          reason: "Schema validation failure",
          bytes: 2048,
          sha256: receipt.sha256,
        },
        receipt,
      ),
    /Collector status indicates evidence is corrupt/,
  );
});

test("43. Status endpoint detects schema-valid timing data tampering against durable acceptance record", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m2-3a-test-tamper-valid-"));
  const contract = makeValidContract();
  const report = makeValidReport(contract);

  try {
    await withTestServer(contract, tmpDir, tmpDir, async (baseUrl) => {
      // 1. Submit legitimate evidence: creates both .json and .acceptance.json
      const postRes = await fetch(`${baseUrl}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(report),
      });
      assert.equal(postRes.status, 200);

      // Verify baseline status is verified
      const status1 = await (await fetch(`${baseUrl}/evidence/status?runId=${encodeURIComponent(contract.runId)}`)).json() as EvidenceStatus;
      assert.equal(status1.verified, true);
      assert.equal(status1.corrupt, false);

      // 2. Tamper with a single measurement mark ms inside .json on disk (keeping schema completely valid!)
      const targetFilePath = path.join(tmpDir, `${contract.runId}.json`);
      const onDiskReport = JSON.parse(fs.readFileSync(targetFilePath, "utf8")) as BenchmarkEvidenceReport;
      onDiskReport.marks[0].ms = 9999.9; // Tampered timing!
      onDiskReport.samples[0].marks[0].ms = 9999.9;
      fs.writeFileSync(targetFilePath, JSON.stringify(onDiskReport, null, 2), "utf8");

      // 3. Query status: durable acceptance record must detect hash/byte mismatch and report corruption!
      const status2 = await (await fetch(`${baseUrl}/evidence/status?runId=${encodeURIComponent(contract.runId)}`)).json() as EvidenceStatus;
      assert.equal(status2.persisted, true);
      assert.equal(status2.verified, false);
      assert.equal(status2.corrupt, true);
      assert.match(status2.reason ?? "", /Evidence content modified after acceptance/);
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("44. Missing durable acceptance record is detected as unverified", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m2-3a-test-missing-acc-"));
  const contract = makeValidContract();
  const report = makeValidReport(contract);

  try {
    // Write only the evidence file (simulating crash before acceptance record was written)
    const targetFilePath = path.join(tmpDir, `${contract.runId}.json`);
    fs.writeFileSync(targetFilePath, JSON.stringify(report, null, 2), "utf8");

    await withTestServer(contract, tmpDir, tmpDir, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/evidence/status?runId=${encodeURIComponent(contract.runId)}`);
      assert.equal(res.status, 200);
      const status = (await res.json()) as EvidenceStatus;
      assert.equal(status.persisted, true);
      assert.equal(status.verified, false);
      assert.equal(status.corrupt, true);
      assert.match(status.reason ?? "", /Missing durable acceptance record/);
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("45. Corrupt durable acceptance record is detected as unverified", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m2-3a-test-corrupt-acc-"));
  const contract = makeValidContract();
  const report = makeValidReport(contract);

  try {
    const targetFilePath = path.join(tmpDir, `${contract.runId}.json`);
    fs.writeFileSync(targetFilePath, JSON.stringify(report, null, 2), "utf8");

    // Corrupt acceptance record (malformed JSON)
    const accFilePath = path.join(tmpDir, `${contract.runId}.acceptance.json`);
    fs.writeFileSync(accFilePath, "{ truncated acceptance record...", "utf8");

    await withTestServer(contract, tmpDir, tmpDir, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/evidence/status?runId=${encodeURIComponent(contract.runId)}`);
      assert.equal(res.status, 200);
      const status = (await res.json()) as EvidenceStatus;
      assert.equal(status.persisted, true);
      assert.equal(status.verified, false);
      assert.equal(status.corrupt, true);
      assert.match(status.reason ?? "", /Corrupted or invalid durable acceptance record/);
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("46. Collector restart preserves existing evidence and acceptance identity", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m2-3a-test-acc-restart-"));
  const contract = makeValidContract();
  const report = makeValidReport(contract);

  try {
    let acceptedReceipt: EvidenceReceipt | undefined;

    // 1. Session 1: Submit evidence
    await withTestServer(contract, tmpDir, tmpDir, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(report),
      });
      assert.equal(res.status, 200);
      acceptedReceipt = (await res.json()) as EvidenceReceipt;
    });

    assert.ok(acceptedReceipt);

    // 2. Session 2: Server restarts with existing evidenceDir
    await withTestServer(contract, tmpDir, tmpDir, async (baseUrl) => {
      // Status endpoint should report verified=true with preserved SHA and byte count
      const resStatus = await fetch(`${baseUrl}/evidence/status?runId=${encodeURIComponent(contract.runId)}`);
      assert.equal(resStatus.status, 200);
      const status = (await resStatus.json()) as EvidenceStatus;
      assert.equal(status.persisted, true);
      assert.equal(status.verified, true);
      assert.equal(status.corrupt, false);
      assert.equal(status.sha256, acceptedReceipt!.sha256);
      assert.equal(status.bytes, acceptedReceipt!.bytes);

      // Re-submitting same runId must be rejected with 409 Conflict
      const dupRes = await fetch(`${baseUrl}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(report),
      });
      assert.equal(dupRes.status, 409);
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("47. Partial acceptance transaction is detected and preserved without overwrite", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m2-3a-test-partial-preserve-"));
  const contract = makeValidContract();
  const report = makeValidReport(contract);

  try {
    // Pre-seed only evidence file (simulating partial/interrupted transaction)
    const targetFilePath = path.join(tmpDir, `${contract.runId}.json`);
    const initialBytes = Buffer.from(JSON.stringify(report, null, 2), "utf8");
    fs.writeFileSync(targetFilePath, initialBytes);

    await withTestServer(contract, tmpDir, tmpDir, async (baseUrl) => {
      // POST must be rejected with 409 Conflict and not overwrite the partial evidence
      const res = await fetch(`${baseUrl}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(report),
      });
      assert.equal(res.status, 409);

      // Confirm partial evidence file was untouched
      const currentBytes = fs.readFileSync(targetFilePath);
      assert.deepEqual(currentBytes, initialBytes);
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
