import { test } from "node:test";
import assert from "node:assert/strict";
import { createDexcom, normalizeDexcom } from "../server/dexcom";
test("unconfigured CGM cannot pretend to connect", () => {
  const c = createDexcom({});
  assert.equal(c.status().configured, false);
  assert.throws(() => c.start());
});
test("special LOW and HIGH codes are not displayed as numeric readings", () => {
  const rows = normalizeDexcom(
    [
      {
        recordId: "a",
        systemTime: "2026-10-06T10:00:00",
        value: 39,
        unit: "mg/dL",
      },
      {
        recordId: "b",
        systemTime: "2026-10-06T10:05:00",
        value: 401,
        unit: "mg/dL",
      },
    ],
    false,
  );
  assert.equal(rows[0].value, null);
  assert.equal(rows[0].status, "low");
  assert.equal(rows[1].status, "high");
  assert.ok(rows[0].at.endsWith("Z"));
});
test("sandbox source always identifies simulated values", () => {
  const rows = normalizeDexcom(
    [
      {
        recordId: "a",
        systemTime: "2026-10-06T10:00:00Z",
        value: 120,
        unit: "mg/dL",
      },
    ],
    true,
  );
  assert.match(rows[0].source, /simulated/);
});
test("invalid units and timestamps discarded", () => {
  assert.equal(
    normalizeDexcom(
      [
        { recordId: "a", systemTime: "bad", value: 120, unit: "mg/dL" },
        {
          recordId: "b",
          systemTime: "2026-10-06T10:00:00Z",
          value: 120,
          unit: "unknown",
        },
      ],
      false,
    ).length,
    0,
  );
});
test("OAuth state is required and single use", async () => {
  let calls = 0;
  const mock = (async () => {
    calls++;
    return new Response(
      JSON.stringify({
        access_token: "access",
        refresh_token: "refresh",
        expires_in: 7200,
      }),
    );
  }) as typeof fetch;
  const c = createDexcom(
    {
      DEXCOM_CLIENT_ID: "id",
      DEXCOM_CLIENT_SECRET: "secret",
      DEXCOM_REDIRECT_URI: "https://example.com/cgm/dexcom/callback",
    },
    mock,
  );
  const state = new URL(c.start().url).searchParams.get("state")!;
  await assert.rejects(() => c.callback("wrong", "code"));
  assert.equal(calls, 0);
  await c.callback(state, "code");
  assert.equal(c.status().connected, true);
  await assert.rejects(() => c.callback(state, "code"));
  c.disconnect();
  assert.equal(c.status().connected, false);
});
test("provider tokens survive server adapter restart and disconnect persists revocation", () => {
  let stored: { access: string; refresh: string; expires: number } | null = {
    access: "a",
    refresh: "r",
    expires: Date.now() + 10000,
  };
  const storage = {
    load: () => stored,
    save: (v: typeof stored) => {
      stored = v;
    },
  };
  const env = {
    DEXCOM_CLIENT_ID: "id",
    DEXCOM_CLIENT_SECRET: "secret",
    DEXCOM_REDIRECT_URI: "https://example.com/cgm/dexcom/callback",
  };
  const first = createDexcom(env, fetch, storage);
  assert.equal(first.status().connected, true);
  const restarted = createDexcom(env, fetch, storage);
  assert.equal(restarted.status().connected, true);
  restarted.disconnect();
  assert.equal(stored, null);
});
