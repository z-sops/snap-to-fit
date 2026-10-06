import { test } from "node:test";
import assert from "node:assert/strict";
import { AccountDatabase } from "../server/database";
import { validatedBackup } from "../server/validate-state";
import { emptyState, newProfile } from "../src/core/model";
const password = "a-long-private-password";
test("accounts isolate encrypted backups and reject stale writes", async () => {
  const db = new AccountDatabase(":memory:");
  try {
    const a = await db.register("person_a", password),
      b = await db.register("person_b", password);
    const state = {
      ...emptyState,
      profile: {
        ...newProfile,
        name: "Private Person",
        age: 30,
        height: 170,
        weight: 70,
        targetWeight: 70,
        consent: true,
      },
    };
    assert.equal(db.authenticate(a.token).id, a.userId);
    assert.equal(db.saveBackup(a.userId, state, 0).revision, 1);
    assert.equal(
      db.readBackup(a.userId).state?.profile?.name,
      "Private Person",
    );
    assert.equal(db.readBackup(b.userId).state, null);
    const stored = db.db
      .prepare("SELECT payload FROM backups WHERE user_id=?")
      .get(a.userId) as { payload: string };
    assert.ok(!stored.payload.includes("Private Person"));
    assert.throws(() => db.decrypt(stored.payload, b.userId));
    assert.throws(() => db.saveBackup(a.userId, state, 0), /another device/);
    db.setProvider(a.userId, {
      access: "provider-secret",
      refresh: "private-refresh",
      expires: Date.now() + 10000,
    });
    assert.equal(db.getProvider(b.userId), null);
    assert.equal(db.getProvider(a.userId)?.access, "provider-secret");
  } finally {
    db.close();
  }
});
test("refresh rotates both tokens; logout revokes the session", async () => {
  const db = new AccountDatabase(":memory:");
  try {
    const original = await db.register("refresh_user", password);
    const next = db.refresh(original.refreshToken);
    assert.throws(() => db.authenticate(original.token));
    assert.throws(() => db.refresh(original.refreshToken));
    assert.equal(db.authenticate(next.token).id, original.userId);
    db.logout(next.token);
    assert.throws(() => db.refresh(next.refreshToken));
  } finally {
    db.close();
  }
});
test("recovery code is single-use and concurrent recovery cannot reuse it", async () => {
  const db = new AccountDatabase(":memory:");
  try {
    const a = await db.register("recovery_user", password);
    const outcomes = await Promise.allSettled([
      db.recover("recovery_user", a.recoveryCode, "a-second-private-password"),
      db.recover("recovery_user", a.recoveryCode, "a-third-private-password"),
    ]);
    assert.equal(outcomes.filter((x) => x.status === "fulfilled").length, 1);
    assert.throws(() => db.authenticate(a.token));
    await assert.rejects(db.login("recovery_user", password));
  } finally {
    db.close();
  }
});
test("account deletion requires password and cascades private records", async () => {
  const db = new AccountDatabase(":memory:");
  try {
    const a = await db.register("delete_user", password);
    db.saveBackup(a.userId, emptyState, 0);
    db.setProvider(a.userId, { access: "x", refresh: "y", expires: 0 });
    db.useAI(a.userId, 5);
    await assert.rejects(db.remove(a.userId, "wrong"));
    assert.equal(db.authenticate(a.token).id, a.userId);
    await db.remove(a.userId, password);
    for (const table of [
      "users",
      "sessions",
      "backups",
      "provider_tokens",
      "usage",
    ]) {
      const row = db.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as {
        n: number;
      };
      assert.equal(row.n, 0);
    }
    assert.throws(() => db.authenticate(a.token));
  } finally {
    db.close();
  }
});
test("quota exhaustion never increments further", async () => {
  const db = new AccountDatabase(":memory:");
  try {
    const a = await db.register("quota_user", password);
    db.useAI(a.userId, 2);
    db.useAI(a.userId, 2);
    assert.throws(() => db.useAI(a.userId, 2), /allowance/);
    assert.equal(
      (db.db.prepare("SELECT count FROM usage").get() as { count: number })
        .count,
      2,
    );
  } finally {
    db.close();
  }
});
test("backup excludes private photos and device-specific reminders", () => {
  const value = {
    ...emptyState,
    photos: [{ id: "p", at: new Date().toISOString(), image: "photo" }],
    medicines: [
      {
        id: "m",
        name: "As prescribed",
        dose: "Prescribed amount",
        kind: "tablet" as const,
        time: "09:00",
        nextDate: "2026-10-08",
        reminderId: "old-device",
      },
    ],
  };
  const cleaned = validatedBackup(value);
  assert.equal(cleaned.photos.length, 0);
  assert.equal(cleaned.medicines[0].reminderId, undefined);
  assert.equal(value.medicines[0].reminderId, "old-device");
});
