import { test } from "node:test";
import assert from "node:assert/strict";
import { weeklySchedule } from "../src/core/schedule";
import { effectiveProfile } from "../src/core/progress";
import { exercises } from "../src/core/workouts";
import { emptyState, newProfile } from "../src/core/model";
const profile = {
  ...newProfile,
  name: "Alex",
  age: 30,
  height: 175,
  weight: 80,
  targetWeight: 72,
  goal: "lose" as const,
  consent: true,
};
test("weekly plan respects training days and starts on Monday across month boundaries", () => {
  for (const count of [1, 2, 3, 4, 5, 6, 7]) {
    const week = weeklySchedule(
      { ...profile, days: count, workoutDays: [1,2,3,4,5,6,0].slice(0,count) },
      [],
      "gym",
      new Date(2026, 9, 1, 12),
    );
    assert.equal(week.length, 7);
    assert.equal(week[0].date, "2026-09-28");
    assert.equal(week.filter((d) => !d.rest).length, count);
    assert.ok(week.filter((d) => !d.rest).every((d) => d.items.length > 0));
  }
});
test("walking plans use only walking and medical context pauses automatic prescriptions", () => {
  const walk = weeklySchedule({ ...profile, workoutDays: [1,2,3] }, [], "walk");
  assert.ok(walk.flatMap((d) => d.items).every((e) => e.id === "walk"));
  for (const p of [
    { ...profile, insulin: true },
    { ...profile, conditions: ["type2" as const] },
    { ...profile, injuries: "Recent knee injury" },
  ])
    assert.ok(
      weeklySchedule(p, [], "home").every(
        (d) => d.restricted && d.sets === 0 && d.reps === 0,
      ),
    );
});
test("the calendar never assigns alternate days or moves a user's consecutive days", () => {
  const date = new Date(2026, 9, 7, 12);
  const week = weeklySchedule({ ...profile, workoutDays: [1,2,3] }, [], "gym", date);
  assert.deepEqual(week.filter(d => !d.rest).map(d => d.weekday), ["Mon", "Tue", "Wed"]);
  assert.ok(weeklySchedule(profile, [], "gym", date).every(d => d.rest));
  assert.ok(week.filter(d => d.rest).every(d => d.title === "No workout scheduled"));
});
test("new weight updates fitness targets and reached goal transitions to maintenance", () => {
  const state = {
    ...emptyState,
    profile,
    readings: [
      {
        id: "1",
        at: "2026-10-02T12:00:00Z",
        kind: "weight" as const,
        value: 72,
        unit: "kg",
        context: "",
        source: "manual",
      },
    ],
  };
  assert.equal(effectiveProfile(state)!.weight, 72);
  assert.equal(effectiveProfile(state)!.goal, "maintain");
  assert.equal(state.profile.goal, "lose");
});
test("exercise IDs are unique and every schedule resolves its movements", () => {
  assert.equal(new Set(exercises.map((e) => e.id)).size, exercises.length);
  for (const place of ["home", "gym", "walk"] as const)
    for (const count of [1, 2, 3, 4, 5, 6, 7]) {
      const week = weeklySchedule(
        { ...profile, experience: "experienced", days: count, workoutDays: [1,2,3,4,5,6,0].slice(0,count) },
        [],
        place,
      );
      assert.ok(
        week
          .flatMap((d) => d.items)
          .every((e) => exercises.some((x) => x.id === e.id)),
      );
    }
});
