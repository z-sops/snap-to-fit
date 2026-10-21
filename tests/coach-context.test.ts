import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// The AI coach's daily totals contract. The server child runs with a fake
// provider in front of it, so the request the model would have received can be
// inspected. No real provider is contacted and no credential is used.
//
// These tests prove what the server sends and refuses to send. They do not
// prove that the model answers correctly.

let child: ChildProcess;
const token = "test-only-pairing-token-12345678";
const base = "http://127.0.0.1:18788";
const MARKER = "__PROVIDER_REQUEST__";
const requests: { url: string; body: string }[] = [];
let buffer = "";
let signalReady: () => void = () => {};

before(async () => {
  // Node needs a file URL for --import on Windows.
  const preload = pathToFileURL(
    join(process.cwd(), "tests", "helpers", "fake-provider.mjs"),
  ).href;
  child = spawn(
    process.execPath,
    ["--import", "tsx", "--import", preload, "server/index.ts"],
    {
      env: {
        ...process.env,
        PORT: "18788",
        SNAP_API_TOKEN: token,
        ALLOW_DEV_PAIRING: "1",
        DATABASE_PATH: ":memory:",
        GEMINI_API_KEY: "test-only-provider-key",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const ready = new Promise<void>((resolve) => {
    signalReady = resolve;
  });
  child.stdout!.setEncoding("utf8");
  child.stdout!.on("data", (chunk: string) => {
    buffer += chunk;
    let index: number;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 1);
      if (line.includes("service ready")) signalReady();
      if (line.startsWith(MARKER)) requests.push(JSON.parse(line.slice(MARKER.length)));
    }
  });
  await Promise.race([
    ready,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Server did not start")), 10000),
    ),
  ]);
});
after(() => child?.kill());

const profile = {
  age: 34,
  sex: "female",
  height: 165,
  weight: 70,
  targetWeight: 65,
  goal: "lose",
  activity: 1.375,
  experience: "beginner",
  days: 3,
  conditions: [] as string[],
  insulin: false,
  medicines: "",
  allergies: "",
  diet: "",
  injuries: "",
  country: "US",
};

const post = (body: unknown) =>
  fetch(`${base}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

/** The context the provider actually received, read from the captured request. */
function lastContext(): Record<string, any> {
  assert.ok(requests.length, "no provider request was captured");
  const payload = JSON.parse(requests[requests.length - 1].body);
  assert.ok(payload.contents?.[0]?.parts?.[0]?.text, "the provider request has no prompt");
  return JSON.parse(payload.contents[0].parts[0].text);
}

test("consented totals reach the provider prompt itself", async () => {
  const response = await post({
    question: "How am I doing against my targets today?",
    language: "en",
    aiConsent: true,
    profile,
    totals: { calories: 1800, protein: 120, carbs: 200, fat: 60 },
  });
  assert.equal(response.status, 200);
  const context = lastContext();
  assert.deepEqual(context.todayTotals, {
    calories: 1800,
    protein: 120,
    carbs: 200,
    fat: 60,
  });
  // The safety policy is still attached to the same request.
  const payload = JSON.parse(requests[requests.length - 1].body);
  assert.match(payload.systemInstruction.parts[0].text, /Never diagnose/);
});

test("a request without totals sends none", async () => {
  const response = await post({
    question: "How am I doing against my targets today?",
    aiConsent: true,
    profile,
  });
  assert.equal(response.status, 200);
  const context = lastContext();
  assert.equal("todayTotals" in context, false);
});

test("a withdrawn consent is refused and nothing reaches the provider", async () => {
  const before = requests.length;
  const response = await post({
    question: "How am I doing against my targets today?",
    aiConsent: false,
    profile,
    totals: { calories: 1800, protein: 120, carbs: 200, fat: 60 },
  });
  assert.equal(response.status, 400);
  assert.equal(requests.length, before, "a refused request must not reach the provider");
});

test("an older client without the consent flag still works and sends no totals", async () => {
  const response = await post({
    question: "How am I doing against my targets today?",
    profile,
    totals: { calories: 1800, protein: 120, carbs: 200, fat: 60 },
  });
  assert.equal(response.status, 200);
  const context = lastContext();
  assert.equal("todayTotals" in context, false);
  assert.ok(context.targets, "targets are still computed for a legacy request");
});

test("invalid and excessive values are dropped, valid ones survive", async () => {
  const response = await post({
    question: "How am I doing against my targets today?",
    aiConsent: true,
    profile,
    totals: {
      calories: 1800,
      protein: 99999,
      carbs: "200",
      fat: 60,
    },
  });
  assert.equal(response.status, 200);
  const context = lastContext();
  assert.deepEqual(context.todayTotals, { calories: 1800, fat: 60 });
});

test("a totals object with nothing usable sends no totals at all", async () => {
  const response = await post({
    question: "How am I doing against my targets today?",
    aiConsent: true,
    profile,
    totals: { calories: -1, protein: "many", carbs: null, fat: 1e12 },
  });
  assert.equal(response.status, 200);
  const context = lastContext();
  assert.equal("todayTotals" in context, false);
});

test("a totals value that is not an object is ignored", async () => {
  for (const totals of ["1800", 1800, [1, 2, 3], null]) {
    const response = await post({
      question: "How am I doing against my targets today?",
      aiConsent: true,
      profile,
      totals,
    });
    assert.equal(response.status, 200);
    const context = lastContext();
    assert.equal("todayTotals" in context, false);
  }
});

test("only allowlisted numbers are forwarded, never meals or identifiers", async () => {
  const response = await post({
    question: "How am I doing against my targets today?",
    aiConsent: true,
    profile,
    totals: {
      calories: 1800,
      protein: 120,
      carbs: 200,
      fat: 60,
      meals: [{ id: "m1", name: "Secret lunch", calories: 900 }],
      name: "Ana",
      userId: "user-123",
      __proto__: { polluted: true },
    },
  });
  assert.equal(response.status, 200);
  const context = lastContext();
  assert.deepEqual(Object.keys(context.todayTotals).sort(), ["calories", "carbs", "fat", "protein"]);
  const serialised = requests[requests.length - 1].body;
  assert.ok(!serialised.includes("Secret lunch"), "meal details must not be forwarded");
  assert.ok(!serialised.includes("Ana"), "identifiers must not be forwarded");
  assert.ok(!serialised.includes("user-123"), "identifiers must not be forwarded");
});

test("a restricted profile keeps null targets and gets no totals", async () => {
  const response = await post({
    question: "How am I doing against my targets today?",
    aiConsent: true,
    profile: { ...profile, conditions: ["type2"] },
    totals: { calories: 1800, protein: 120, carbs: 200, fat: 60 },
  });
  assert.equal(response.status, 200);
  const context = lastContext();
  assert.equal(context.targets, null);
  assert.equal("todayTotals" in context, false);
});

test("the prompt stays minimal: no meal history and no user identity", async () => {
  await post({
    question: "How am I doing against my targets today?",
    aiConsent: true,
    profile,
    history: [
      { role: "user", text: "Earlier question" },
      { role: "assistant", text: "Earlier answer" },
    ],
    totals: { calories: 1800 },
  });
  const context = lastContext();
  assert.equal(context.meals, undefined);
  assert.equal(context.profile.name, "User");
  assert.equal(context.history.length, 2);
  assert.ok(context.history.length <= 8);
});
