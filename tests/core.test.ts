import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newProfile,
  validateProfile,
  numeric,
  localDay,
  type Reading,
} from "../src/core/model";
import {
  nutritionTargets,
  todayTotals,
  validateMeal,
  weightProjection,
} from "../src/core/nutrition";
import { workoutPlan, lastPerformance } from "../src/core/workouts";
import { waistRatio, plateauReview } from "../src/core/trends";
import { urgentMessage, medicationRequest, restrictedHealthAdvice } from "../src/core/safety";
import { weeklySchedule } from "../src/core/schedule";
import { checkQuestion, validatePhotoResult } from "../server/policy.mjs";
const profile = {
  ...newProfile,
  name: "Test",
  age: 30,
  height: 175,
  weight: 80,
  targetWeight: 75,
  goal: "lose" as const,
  sex: "male" as const,
  consent: true,
};
test("rejects missing and nonfinite inputs", () => {
  assert.throws(() => numeric("", 0, 10, "Value"));
  assert.throws(() => numeric("NaN", 0, 10, "Value"));
  assert.throws(() => numeric("Infinity", 0, 10, "Value"));
});
test("adult onboarding rejects minors", () =>
  assert.throws(() => validateProfile({ ...profile, age: 17 })));
test("workout days must be unique, in range and match the requested count", () => {
  for (const workoutDays of [[1,1,2], [1,2], [1,2,7]])
    assert.throws(() => validateProfile({ ...profile, days: 3, workoutDays }));
  for (const days of [1,2,3,4,5,6,7])
    assert.doesNotThrow(() => validateProfile({ ...profile, days, workoutDays: [1,2,3,4,5,6,0].slice(0,days) }));
  assert.doesNotThrow(() => validateProfile(profile)); // Legacy profiles remain readable.
});
test("weight target must agree with goal", () =>
  assert.throws(() => validateProfile({ ...profile, targetWeight: 85 })));
test("underweight weight-loss target is refused", () =>
  assert.throws(() => validateProfile({ ...profile, targetWeight: 40 })));
test("Mifflin estimate and macro energy reconcile within rounding", () => {
  const t = nutritionTargets(profile);
  assert.equal(t.maintenance, 2099);
  assert.ok(
    Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.calories) < 10,
  );
  assert.equal(t.restricted, false);
});
test("medical conditions pause automatic nutrition targets", () => {
  for (const c of [
    "type1",
    "type2",
    "hypertension",
    "heart",
    "kidney",
    "pregnant",
    "eating-disorder",
  ] as const)
    assert.ok(nutritionTargets({ ...profile, conditions: [c] }).restricted);
});
test("insulin and unspecified medication pause targets", () => {
  assert.ok(nutritionTargets({ ...profile, insulin: true }).restricted);
  assert.ok(
    nutritionTargets({ ...profile, medicines: "BP tablet" }).restricted,
  );
});
test("totals use local calendar date and exclude yesterday", () => {
  const at = new Date(2026, 9, 6, 12);
  const prev = new Date(2026, 9, 5, 12);
  const base = {
    id: "x",
    name: "Meal",
    protein: 10,
    carbs: 20,
    fat: 5,
    fibre: 2,
    calories: 165,
    source: "manual" as const,
  };
  assert.equal(
    todayTotals(
      [
        { ...base, at: at.toISOString() },
        { ...base, id: "y", at: prev.toISOString() },
      ],
      at,
    ).calories,
    165,
  );
  assert.equal(localDay(at), "2026-10-06");
});
test("negative AI food estimates refused", () =>
  assert.throws(() =>
    validatePhotoResult({
      name: "Food",
      calories: 100,
      protein: -1,
      carbs: 0,
      fat: 0,
      fibre: 0,
      uncertainty: "estimate",
    }),
  ));
test("meal validation rejects nonfinite estimates", () =>
  assert.throws(() =>
    validateMeal({
      name: "Food",
      calories: NaN,
      protein: 1,
      carbs: 1,
      fat: 1,
      fibre: 1,
      source: "manual",
    }),
  ));
test("medical workout plan cannot prescribe sets or reps", () => {
  const plan = workoutPlan({ ...profile, conditions: ["heart"] }, "gym", 0);
  assert.ok(plan.restricted);
  assert.equal(plan.sets, 0);
});
test("all three workout locations have exercises", () => {
  for (const place of ["gym", "home", "walk"] as const)
    assert.ok(workoutPlan(profile, place, 0).items.length);
});
test("injury context pauses intensity", () =>
  assert.ok(
    workoutPlan({ ...profile, injuries: "Knee pain" }, "home", 0).restricted,
  ));
test("latest matching performance returned", () => {
  const logs = [
    {
      id: "1",
      at: "",
      exerciseId: "squat",
      name: "Squat",
      sets: 2,
      reps: 10,
      weight: 0,
      minutes: 5,
    },
    {
      id: "2",
      at: "",
      exerciseId: "curl",
      name: "Curl",
      sets: 2,
      reps: 10,
      weight: 5,
      minutes: 5,
    },
  ];
  assert.equal(lastPerformance(logs, "squat")?.id, "1");
});
test("waist ratio is a measurement ratio only", () => {
  assert.equal(waistRatio(180, 90), 0.5);
  assert.equal(waistRatio(0, 90), null);
});
test("sparse readings cannot trigger a plateau alert", () =>
  assert.equal(plateauReview([]).review, false));
test("four stable weekly averages trigger review, never taper", () => {
  const now = new Date("2026-10-06T12:00:00Z");
  const readings: Reading[] = [];
  for (let week = 0; week < 4; week++)
    for (const offset of [1, 3])
      readings.push({
        id: `${week}-${offset}`,
        at: new Date(
          now.getTime() - (week * 7 + offset) * 86400000,
        ).toISOString(),
        kind: "weight",
        value: 80,
        unit: "kg",
        context: "",
        source: "manual",
      });
  const result = plateauReview(readings, now);
  assert.ok(result.review);
  assert.match(result.message, /not a recommendation/);
});
test("clinical profiles have no promised weight-loss timeline", () =>
  assert.equal(weightProjection({ ...profile, conditions: ["type2"] }), null));
test("emergency symptoms bypass AI", () =>
  assert.match(urgentMessage("I have chest pain") || "", /emergency/));
test("medication-break requests are blocked client and server", () => {
  assert.ok(medicationRequest("Should I stop my injection?"));
  assert.match(checkQuestion("Can I reduce insulin dose?") || "", /cannot/);
});
test("steroid protocols and reproductive predictions are refused by both paths", () => {
  for (const question of [
    "Give me an anabolic steroid cycle and dosing protocol",
    "How much testosterone should I inject?",
    "Calculate my safe days to avoid pregnancy",
    "Predict my fertile window",
    "Diagnose PCOS from my periods",
  ]) {
    const reply = restrictedHealthAdvice(question);
    assert.ok(reply, question);
    assert.equal(checkQuestion(question), reply);
  }
  for (const question of ["Explain steroid misuse risks", "What are period cramps?", "How can I record meals?"])
    assert.equal(restrictedHealthAdvice(question), null);
  assert.match(checkQuestion("I have chest pain; calculate my fertile days")!, /emergency/);
});
test("both exercise planners pause underweight and out-of-scope age intensity", () => {
  for (const p of [
    { ...profile, goal: "maintain" as const, weight: 45, targetWeight: 45 },
    { ...profile, age: 79 },
  ]) {
    assert.ok(workoutPlan(p, "home", 0).restricted);
    assert.ok(weeklySchedule(p, [], "home").every(d =>
      d.restricted && d.sets === 0 && d.reps === 0 && d.duration === 0));
  }
  assert.equal(workoutPlan(profile, "home", 0).restricted, false);
});
