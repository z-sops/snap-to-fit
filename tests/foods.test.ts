import { test } from "node:test";
import assert from "node:assert/strict";
import { searchFoods, foodById, recipes, popular, scale, withAddedFat, calorieRange } from "../src/core/foods";
import { foodFromOFF, validBarcode } from "../src/core/barcode";
import { bodyNumbers, proteinGuidance, adaptiveTdee } from "../src/core/targets";
import { bySlot, nutrientTotals } from "../src/core/food-log";
import { emptyState, newProfile, mealSlotOf } from "../src/core/model";

test("search ranks friendly popular foods first and understands synonyms", () => {
  assert.equal(searchFoods("chicken breast")[0].name, "Chicken breast, grilled");
  assert.equal(searchFoods("fries")[0].name, "French fries (fast food, small)");
  assert.ok(searchFoods("coke").slice(0, 2).some((f) => /cola/i.test(f.name)));
  assert.ok(searchFoods("biryani").some((f) => f.id === "recipe:chicken-biryani"));
  assert.ok(searchFoods("big mac").length > 0);
  assert.ok(searchFoods("").length >= 12);
});

test("every popular food and recipe resolves to USDA data with calories", () => {
  for (const p of popular) assert.ok(foodById(`usda:${p.id}`)?.per100.calories !== undefined, p.name);
  for (const r of recipes) {
    const f = foodById(`recipe:${r.id}`)!;
    const n = scale(f, f.servings[0].grams);
    assert.ok(n.calories! > 50 && n.calories! < 1200, `${r.name} ${n.calories}`);
    assert.equal(f.uncertainty, 0.25);
  }
});

test("USDA values: grilled chicken breast per 100 g matches SR28", () => {
  const f = foodById("usda:5747")!;
  assert.equal(f.per100.calories, 151);
  assert.equal(f.per100.protein, 30.5);
  assert.ok(f.per100.sodium! > 0 && f.per100.potassium! > 0);
  assert.deepEqual(f.servings[0], { label: "1 breast (6 oz)", grams: 170 });
});

test("hidden fat adds ~120 kcal per tbsp and ranges round to 10 kcal", () => {
  const n = withAddedFat({ calories: 300, fat: 10 }, "tbsp");
  assert.equal(n.calories, 300 + Math.round(13.5 * 8.84));
  assert.equal(n.fat, 23.5);
  assert.deepEqual(calorieRange(500, 0.1), [450, 550]);
  assert.deepEqual(calorieRange(400, 0.3), [280, 520]);
});

test("Open Food Facts product parsing: kcal, kJ fallback, sodium g→mg, serving", () => {
  assert.equal(validBarcode("012345678905"), true);
  assert.equal(validBarcode("12ab"), false);
  const f = foodFromOFF("012345678905", { product_name: "Oat Bar", brands: "Acme, Other", serving_size: "1 bar (40 g)", serving_quantity: 40,
    nutriments: { "energy-kcal_100g": 450, proteins_100g: 10, carbohydrates_100g: 60, fat_100g: 18, sodium_100g: 0.3 } })!;
  assert.equal(f.per100.sodium, 300);
  assert.equal(f.brand, "Acme");
  assert.deepEqual(f.servings[0], { label: "1 bar (40 g)", grams: 40 });
  const kj = foodFromOFF("1", { product_name: "Juice", nutriments: { energy_100g: 418.4 } })!;
  assert.equal(kj.per100.calories, 100);
  assert.equal(foodFromOFF("1", { product_name: "No data" }), null);
});

test("BMR, TDEE and BMI use Mifflin–St Jeor and kg/m²", () => {
  const p = { ...newProfile, name: "A", sex: "male" as const, age: 30, height: 180, weight: 80, activity: 1.55 as const, consent: true };
  const n = bodyNumbers(p);
  assert.equal(n.bmr, 1780);
  assert.equal(n.tdee, 2759);
  assert.equal(n.bmi, 24.7);
});

test("protein guidance: GLP-1 users get a range, kidney/pregnancy/ED do not", () => {
  const base = { ...newProfile, name: "A", age: 45, height: 165, weight: 100, consent: true };
  const g = proteinGuidance({ ...base, glp1: "Wegovy (semaglutide)" })!;
  const ref = 27 * 1.65 ** 2;
  assert.deepEqual([g.low, g.high], [Math.round(ref), Math.round(ref * 1.2)]);
  assert.match(g.reason, /GLP-1/);
  assert.equal(proteinGuidance({ ...base, conditions: ["kidney"] }), null);
  assert.equal(proteinGuidance({ ...base, conditions: ["pregnant"] }), null);
  assert.equal(proteinGuidance({ ...base, conditions: ["eating-disorder"] }), null);
});

test("adaptive TDEE from intake and weight trend", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const meals = Array.from({ length: 14 }, (_, i) => ({ id: `m${i}`, at: new Date(now.getTime() - (i + 1) * 864e5).toISOString(), name: "x", calories: 2000, protein: 0, carbs: 0, fat: 0, fibre: 0, source: "manual" as const }));
  const readings = [
    { id: "a", at: new Date(now.getTime() - 15 * 864e5).toISOString(), kind: "weight" as const, value: 80, unit: "kg", context: "", source: "manual" },
    { id: "b", at: new Date(now.getTime() - 1 * 864e5 + 3600e3).toISOString(), kind: "weight" as const, value: 79, unit: "kg", context: "", source: "manual" },
  ];
  const r = adaptiveTdee({ ...emptyState, meals, readings }, now)!;
  assert.ok(r.tdee > 2450 && r.tdee < 2650, String(r.tdee));
  assert.equal(adaptiveTdee({ ...emptyState, meals, readings: readings.slice(0, 1) }, now), null);
});

test("meal sections use saved slots, else time of day; micronutrient totals add up", () => {
  const at = new Date(); at.setHours(8, 0, 0, 0);
  const meals = [
    { id: "1", at: at.toISOString(), name: "Oats", calories: 300, protein: 10, carbs: 50, fat: 5, fibre: 8, source: "database" as const, micros: { sodium: 100, iron: 2 } },
    { id: "2", at: at.toISOString(), name: "Snack", calories: 200, protein: 5, carbs: 20, fat: 10, fibre: 1, source: "quick" as const, slot: "snack" as const },
  ];
  assert.equal(mealSlotOf(meals[0]), "breakfast");
  assert.equal(bySlot(meals).snack.length, 1);
  const t = nutrientTotals(meals);
  assert.equal(t.totals.calories, 500);
  assert.equal(t.totals.sodium, 100);
  assert.equal(t.coverage, 0.5);
});

import { photoFood } from "../src/core/photo-estimate";
test("photo estimate is priced from USDA when every AI item matches, AI totals otherwise", () => {
  const f = photoFood({ name: "Chicken and rice", calories: 999, protein: 1, carbs: 1, fat: 1, fibre: 0, uncertainty: "x",
    items: [{ name: "chicken breast, grilled", grams: 150 }, { name: "white rice, cooked", grams: 200 }] });
  assert.equal(f.per100.calories, Math.round((150 * 1.51 + 200 * 1.3) * 10) / 10);
  assert.equal(f.uncertainty, 0.2);
  assert.equal(f.items![0].matched, "Chicken breast, grilled");
  const g = photoFood({ name: "Mystery", calories: 450, protein: 20, carbs: 40, fat: 20, fibre: 3, uncertainty: "x", items: [{ name: "zzqx", grams: 100 }] });
  assert.equal(g.per100.calories, 450);
  assert.equal(g.uncertainty, 0.3);
});

import { streak, weekReport, achievements } from "../src/core/streaks";
test("streak counts consecutive active days and survives until today's first log", () => {
  const now = new Date("2026-10-20T15:00:00");
  const day = (n: number) => { const d = new Date(now); d.setDate(d.getDate() - n); return d.toISOString(); };
  const meal = (n: number, protein = 20) => ({ id: `m${n}`, at: day(n), name: "x", calories: 500, protein, carbs: 0, fat: 0, fibre: 0, source: "manual" as const });
  const s = { ...emptyState, profile: { ...newProfile, name: "A", age: 30, height: 175, weight: 80, targetWeight: 80, consent: true }, meals: [meal(1), meal(2), meal(3), meal(5)] };
  assert.deepEqual(streak(s, now), { current: 3, best: 3, loggedToday: false });
  const withToday = { ...s, meals: [...s.meals, meal(0, 200)] };
  assert.equal(streak(withToday, now).current, 4);
  const r = weekReport(withToday, now);
  assert.equal(r.daysLogged, 5);
  assert.equal(r.proteinDays, 1);
  assert.ok(r.highlights.some((h) => h.includes("4-day")));
  assert.equal(achievements(withToday, now).find((a) => a.id === "streak-3")!.done, true);
});
