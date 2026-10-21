import { test } from "node:test";
import assert from "node:assert/strict";
import { mealFromFood } from "../src/core/meals";
import { nutrientTotals } from "../src/core/food-log";
import { validateMeal } from "../src/core/nutrition";
import { nutrientUnknown, type Meal } from "../src/core/model";
import { nutrientKeys, type Food } from "../src/core/foods";

/** A food that knows its macros but none of its micronutrients. */
const partialFood: Food = {
  id: "test:partial",
  name: "Test food",
  detail: "",
  group: "",
  source: "usda",
  per100: { calories: 100, protein: 10, carbs: 20, fat: 5 },
  servings: [{ label: "100 g", grams: 100 }],
  uncertainty: 0.1,
};

/** A food that knows everything. */
const fullFood: Food = {
  ...partialFood,
  id: "test:full",
  per100: Object.fromEntries(nutrientKeys.map((k) => [k, 10])) as Food["per100"],
};

const mealFrom = (food: Food) => mealFromFood(food, 100, 1, "100 g", "none", "lunch");

test("a nutrient the source does not know is recorded as unknown", () => {
  const meal = mealFrom(partialFood);
  assert.ok(meal.unknownNutrients?.includes("sodium"), "sodium was never reported");
  assert.ok(meal.unknownNutrients?.includes("fibre"), "fibre was never reported");
  assert.ok(meal.unknownNutrients?.includes("iron"), "iron was never reported");
  // The macros were reported, so they are known.
  assert.ok(!meal.unknownNutrients?.includes("protein"));
  assert.ok(!meal.unknownNutrients?.includes("calories"));
  // The stored numbers are still there, so old and new records share a shape.
  assert.equal(meal.protein, 10);
  assert.equal(meal.fat, 5);
  assert.ok(nutrientUnknown(meal, "sodium"));
  assert.ok(!nutrientUnknown(meal, "protein"));
});

test("a food that reports everything has no unknown nutrients", () => {
  const meal = mealFrom(fullFood);
  assert.equal(meal.unknownNutrients, undefined);
  assert.equal(meal.micros?.sodium, 10);
});

test("added cooking oil does not turn an unknown nutrient into a known one", () => {
  const meal = mealFromFood(partialFood, 100, 1, "100 g", "tbsp", "lunch");
  // Saturated fat is worked out from the oil alone, so the food's own value
  // is still unknown.
  assert.ok(meal.unknownNutrients?.includes("satFat"));
  assert.ok(meal.unknownNutrients?.includes("fibre"));
});

test("a day total is unknown, not zero, when no food reported the nutrient", () => {
  const meals: Meal[] = [
    { id: "a", at: "2026-10-21T12:00:00Z", name: "Lunch", calories: 400, protein: 20, carbs: 40, fat: 10, fibre: 0, source: "quick", unknownNutrients: ["fibre", "sodium", "iron"] },
  ];
  const { totals, unknown, partial } = nutrientTotals(meals);
  // Nobody reported sodium, so the day total is not a number at all.
  assert.ok(unknown.includes("sodium"));
  assert.equal(totals.sodium, undefined);
  assert.equal(totals.calories, 400);
  // A nutrient some foods reported is a lower bound, not a confirmed value.
  assert.equal(partial.length, 0);
});

test("a nutrient only some foods reported is a lower bound", () => {
  const meals: Meal[] = [
    { id: "a", at: "2026-10-21T12:00:00Z", name: "Known", calories: 400, protein: 20, carbs: 40, fat: 10, fibre: 3, source: "database", micros: { sodium: 200 } },
    { id: "b", at: "2026-10-21T13:00:00Z", name: "Unknown", calories: 200, protein: 10, carbs: 20, fat: 5, fibre: 0, source: "quick", unknownNutrients: ["sodium"] },
  ];
  const { totals, unknown, partial } = nutrientTotals(meals);
  // Sodium was only known for one of the two foods, so the total is a bound.
  assert.ok(partial.includes("sodium"));
  assert.ok(!unknown.includes("sodium"));
  assert.equal(totals.sodium, 200);
  // A nutrient both foods reported is a real total.
  assert.equal(totals.calories, 600);
  assert.ok(!partial.includes("calories"));
});

test("older meal records keep exactly the totals they always had", () => {
  // A record saved before the completeness metadata existed carries none.
  const old: Meal = {
    id: "old",
    at: "2026-10-21T12:00:00Z",
    name: "Old entry",
    calories: 500,
    protein: 25,
    carbs: 50,
    fat: 15,
    fibre: 0,
    source: "database",
    micros: { sodium: 300 },
  };
  const { totals, unknown, partial } = nutrientTotals([old]);
  assert.deepEqual(unknown, []);
  assert.deepEqual(partial, []);
  assert.equal(totals.calories, 500);
  assert.equal(totals.sodium, 300);
  // A zero that was really measured as zero stays a zero.
  assert.equal(totals.fibre, 0);
});

test("invalid completeness metadata is rejected", () => {
  const base = { name: "Lunch", calories: 400, protein: 20, carbs: 40, fat: 10, fibre: 3, source: "quick" as const };
  assert.doesNotThrow(() => validateMeal({ ...base, unknownNutrients: ["sodium"] }));
  assert.throws(() => validateMeal({ ...base, unknownNutrients: ["not_a_nutrient"] as never }), /completeness/i);
  assert.throws(() => validateMeal({ ...base, unknownNutrients: "sodium" as never }), /completeness/i);
  assert.throws(() => validateMeal({ ...base, unknownNutrients: Array(40).fill("sodium") }), /completeness/i);
});

test("every nutrient key can be recorded as unknown", () => {
  const meal = mealFromFood(
    { ...partialFood, per100: {} },
    100,
    1,
    "100 g",
    "none",
    "lunch",
  );
  for (const k of nutrientKeys) assert.ok(meal.unknownNutrients?.includes(k), k);
});
