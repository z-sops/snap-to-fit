import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyState, newProfile, type State } from "../src/core/model";
import { insulinNotices, recentLow, usesInsulin, preWorkoutChecks } from "../src/core/insulin-safety";

const now = new Date(2026, 9, 19, 15, 0); // Monday afternoon
const profile = { ...newProfile, name: "Sam", insulin: true, consent: true, days: 3, workoutDays: [1, 3, 5] };
const base: State = {
  ...emptyState,
  profile,
  medicines: [{ id: "r", name: "Mealtime insulin", dose: "6 u at 08:00", kind: "insulin", time: "08:00", nextDate: "2026-10-19", insulinType: "rapid", schedule: [{ time: "08:00", units: 6 }] }],
};

test("nobody without insulin sees insulin notices", () => {
  const s = { ...base, profile: { ...profile, insulin: false }, medicines: [] };
  assert.equal(usesInsulin(s), false);
  assert.deepEqual(insulinNotices(s, { now }), []);
});

test("little food + planned workout warns about low glucose", () => {
  const notices = insulinNotices(base, { now });
  assert.ok(notices.some((n) => /Very little food/.test(n.text)));
});

test("rapid insulin in the last two hours before training is flagged", () => {
  const s = { ...base, doses: [{ id: "d", at: new Date(now.getTime() - 60 * 60_000).toISOString(), medicineId: "r", name: "Mealtime insulin", dose: "6 u", symptoms: "" }] };
  assert.ok(insulinNotices(s, { now, aboutToTrain: true }).some((n) => /Rapid-acting/.test(n.text)));
});

test("a recent low reading is urgent; CGM lows count too", () => {
  const manual = { ...base, readings: [{ id: "g", at: new Date(now.getTime() - 3600_000).toISOString(), kind: "glucose" as const, value: 62, unit: "mg/dL", context: "", source: "manual" }] };
  assert.equal(insulinNotices(manual, { now })[0].level, "urgent");
  const cgm = { ...base, cgm: [{ id: "c", at: new Date(now.getTime() - 3600_000).toISOString(), value: 3.5, unit: "mmol/L" as const, trend: null, status: "low" as const, source: "dexcom" }] };
  assert.equal(recentLow(cgm, now), true);
});

test("notices never tell anyone to change insulin units", () => {
  const s = { ...base, workouts: [{ id: "w", at: new Date(now.getTime() - 3600_000).toISOString(), exerciseId: "x", name: "x", sets: 1, reps: 1, weight: 0, minutes: 30 }],
    readings: [{ id: "g", at: now.toISOString(), kind: "glucose" as const, value: 60, unit: "mg/dL", context: "", source: "manual" }] };
  const text = insulinNotices(s, { now, aboutToTrain: true }).map((n) => n.text).join(" ") + preWorkoutChecks.map((c) => c.text).join(" ");
  assert.doesNotMatch(text, /(reduce|lower|increase|skip|take less|take more).{0,30}(insulin|units|dose)/i);
});
