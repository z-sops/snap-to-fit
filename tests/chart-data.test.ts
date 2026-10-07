import { test } from "node:test";
import assert from "node:assert/strict";
import { readingTrend, weeklyActivity } from "../src/core/chart-data";
import type { Reading, WorkoutLog } from "../src/core/model";
test("reading charts sort by time and never mix glucose units", () => {
  const readings = [
    { kind: "glucose", value: 6, unit: "mmol/L", at: "2026-10-03T12:00:00Z" },
    { kind: "glucose", value: 110, unit: "mg/dL", at: "2026-10-02T12:00:00Z" },
    { kind: "glucose", value: 90, unit: "mg/dL", at: "2026-10-01T12:00:00Z" },
    { kind: "glucose", value: 50, unit: "mg/dL", at: "invalid" },
  ] as Reading[];
  assert.deepEqual(
    readingTrend(readings, "glucose", "mg/dL").map((p) => p.value),
    [90, 110],
  );
  assert.deepEqual(readingTrend([], "weight", "kg"), []);
});
test("weekly activity counts logs on each local calendar day, including zero days", () => {
  const now = new Date(2026, 9, 6, 12);
  const today = new Date(2026, 9, 6, 10).toISOString();
  const yesterday = new Date(2026, 9, 5, 10).toISOString();
  const old = new Date(2026, 8, 1, 10).toISOString();
  const points = weeklyActivity(
    [
      { at: today },
      { at: today },
      { at: yesterday },
      { at: old },
    ] as WorkoutLog[],
    now,
  );
  assert.equal(points.length, 7);
  assert.deepEqual(
    points.map((p) => p.value),
    [0, 0, 0, 0, 0, 1, 2],
  );
});
