import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
let child: ChildProcess;
const token = "test-only-pairing-token-12345678";
const base = "http://127.0.0.1:18787";
before(async () => {
  child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    env: {
      ...process.env,
      PORT: "18787",
      SNAP_API_TOKEN: token,
      ALLOW_DEV_PAIRING: "1",
      DATABASE_PATH: ":memory:",
      GEMINI_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await Promise.race([
    once(child.stdout!, "data"),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Server did not start")), 10000),
    ),
  ]);
});
after(() => child?.kill());
const post = (path: string, body: unknown, auth = token) =>
  fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth}`,
    },
    body: JSON.stringify(body),
  });
test("health endpoint reports unconfigured AI truthfully", async () => {
  const r = await fetch(`${base}/health`);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).aiConfigured, false);
});
test("unauthorized requests cannot reach AI", async () =>
  assert.equal(
    (await post("/chat", { question: "Hello" }, "wrong")).status,
    401,
  ));
test("emergency request works without provider", async () => {
  const r = await post("/chat", { question: "Chest pain while running" });
  assert.equal(r.status, 200);
  assert.match((await r.json()).text, /emergency/);
});
test("injection break is not recommended", async () => {
  const r = await post("/chat", {
    question: "Should I stop my Mounjaro injection?",
  });
  assert.equal(r.status, 200);
  assert.match((await r.json()).text, /prescriber/);
});
test("invalid profile rejected before upstream call", async () => {
  const r = await post("/chat", {
    question: "My protein target",
    profile: { age: 12 },
  });
  assert.equal(r.status, 400);
});
test("missing AI provider returns error instead of fabricated answer", async () => {
  const r = await post("/food", { mimeType: "image/jpeg", image: "dGVzdA==" });
  assert.equal(r.status, 503);
  assert.match((await r.json()).error, /configured/);
});
test("non-JPEG requests are rejected", async () =>
  assert.equal(
    (await post("/food", { mimeType: "text/plain", image: "dGVzdA==" })).status,
    400,
  ));
test("two authenticated clients have isolated backups, guarded AI and revocable accounts", async () => {
  const password = "long-service-test-password";
  const aResponse = await post(
    "/auth/register",
    { username: "client_a", password },
    "",
  );
  assert.equal(aResponse.status, 201);
  const a = await aResponse.json();
  const bResponse = await post(
    "/auth/register",
    { username: "client_b", password },
    "",
  );
  assert.equal(bResponse.status, 201);
  const b = await bResponse.json();
  const { emptyState } = await import("../src/core/model");
  assert.equal(
    (await post("/backup/put", { revision: 0, state: emptyState }, a.token))
      .status,
    200,
  );
  const backup = await post("/backup/get", {}, b.token);
  assert.equal((await backup.json()).state, null);
  const urgent = await post(
    "/chat",
    { question: "I have chest pain" },
    a.token,
  );
  assert.equal(urgent.status, 200);
  assert.match((await urgent.json()).text, /emergency/);
  assert.equal(
    (await post("/auth/delete", { password: "wrong" }, a.token)).status,
    401,
  );
  assert.equal((await post("/auth/delete", { password }, a.token)).status, 200);
  assert.equal((await post("/backup/get", {}, a.token)).status, 401);
  assert.equal((await post("/backup/get", {}, b.token)).status, 200);
});
