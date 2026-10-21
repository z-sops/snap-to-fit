import { test } from "node:test";
import assert from "node:assert/strict";
import { quickAddMeal } from "../src/core/meals";
import { nutrientState, nutrientValue, nutrientTotals, verifiedTotals } from "../src/core/food-log";
import { todayTotals } from "../src/core/nutrition";
import { weekReport } from "../src/core/streaks";
import { emptyState, newProfile, type Meal, type State } from "../src/core/model";

// The whole nutrition completeness chain, from what the user typed to what the
// AI provider and the weekly report are told.
//
// The scenario is the one that started this: a quick add of 500 kcal with the
// protein, carbohydrate and fat fields left empty.

const DAY = "2026-10-21";
const at = `${DAY}T12:00:00.000Z`;

function stateWith(meals: Meal[]): State {
  return {
    ...emptyState,
    profile: { ...newProfile, name: "Ana", age: 34, height: 165, weight: 70, targetWeight: 65, consent: true },
    meals,
  };
}

const quickAdd = quickAddMeal(
  { name: "Sandwich", calories: "500", protein: "", carbs: "", fat: "", fibre: "" },
  "lunch",
);

test("a quick add with empty fields records them as unknown, not as zero", () => {
  assert.equal(quickAdd.calories, 500);
  assert.equal(quickAdd.protein, 0);
  assert.deepEqual(quickAdd.unknownNutrients, ["protein", "carbs", "fat", "fibre"]);
  // The calories were typed, so they are known.
  assert.ok(!quickAdd.unknownNutrients!.includes("calories"));
});

test("a quick add with every field filled records nothing as unknown", () => {
  const full = quickAddMeal(
    { name: "Sandwich", calories: "500", protein: "20", carbs: "60", fat: "15", fibre: "4" },
    "lunch",
  );
  assert.equal(full.unknownNutrients, undefined);
  assert.equal(full.protein, 20);
});

test("the day's totals know the calories and do not know the macros", () => {
  const day = todayTotals([{ ...quickAdd, id: "m1", at }], new Date(at));
  assert.equal(nutrientValue(day, "calories"), 500);
  assert.equal(nutrientState(day, "calories"), "known");
  assert.equal(nutrientValue(day, "protein"), undefined);
  assert.equal(nutrientState(day, "protein"), "unknown");
  assert.equal(nutrientState(day, "carbs"), "unknown");
  assert.equal(nutrientState(day, "fat"), "unknown");
});

test("the AI coach is sent the calories and nothing that was never reported", () => {
  const day = todayTotals([{ ...quickAdd, id: "m1", at }], new Date(at));
  const totals = verifiedTotals(day);
  // The macros were never reported, so they are not in the prompt at all.
  assert.deepEqual(totals, { calories: { value: 500, complete: true } });
  assert.ok(!("protein" in totals));
  assert.ok(!("carbs" in totals));
  assert.ok(!("fat" in totals));
});

test("a partly reported day is sent as a lower bound", () => {
  const known: Meal = {
    id: "m2",
    at,
    name: "Oats",
    calories: 300,
    protein: 10,
    carbs: 50,
    fat: 5,
    fibre: 8,
    source: "database",
  };
  const day = todayTotals([known, { ...quickAdd, id: "m1", at }], new Date(at));
  assert.equal(nutrientState(day, "calories"), "known");
  assert.equal(nutrientState(day, "protein"), "partial");
  const totals = verifiedTotals(day);
  assert.deepEqual(totals, {
    calories: { value: 800, complete: true },
    protein: { value: 10, complete: false },
    carbs: { value: 50, complete: false },
    fat: { value: 5, complete: false },
  });
});

test("the weekly report does not present an incomplete week as complete", () => {
  const state = stateWith([{ ...quickAdd, id: "m1", at }]);
  const report = weekReport(state, new Date(at));
  const day = report.days.find((d) => d.date === DAY)!;
  assert.equal(day.calories, 500);
  assert.equal(day.state.calories, "known");
  assert.equal(day.protein, null);
  assert.equal(day.state.protein, "unknown");
  // The averages are there, but the report says they are not complete.
  assert.equal(report.avgCalories, 500);
  assert.equal(report.caloriesComplete, true);
  assert.equal(report.avgProtein, null);
  assert.equal(report.proteinComplete, false);
  // A day that reported no protein cannot count as reaching the goal.
  assert.equal(report.proteinDays, 0);
});

test("a week of complete days still reports complete averages", () => {
  const complete: Meal = {
    id: "m1",
    at,
    name: "Oats",
    calories: 500,
    protein: 30,
    carbs: 60,
    fat: 15,
    fibre: 8,
    source: "database",
  };
  const report = weekReport(stateWith([complete]), new Date(at));
  assert.equal(report.avgCalories, 500);
  assert.equal(report.avgProtein, 30);
  assert.equal(report.caloriesComplete, true);
  assert.equal(report.proteinComplete, true);
  assert.equal(report.days.find((d) => d.date === DAY)!.state.protein, "known");
});

test("older records without the metadata keep reporting what they always did", () => {
  const old: Meal = {
    id: "old",
    at,
    name: "Old entry",
    calories: 500,
    protein: 0,
    carbs: 0,
    fat: 0,
    fibre: 0,
    source: "quick",
  };
  const day = nutrientTotals([old]);
  // Nothing says it was unknown, so it is treated as measured.
  assert.equal(nutrientValue(day, "protein"), 0);
  assert.equal(nutrientState(day, "protein"), "known");
  const report = weekReport(stateWith([old]), new Date(at));
  assert.equal(report.avgProtein, 0);
  assert.equal(report.proteinComplete, true);
});
