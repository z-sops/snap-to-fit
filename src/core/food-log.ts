import { localDay, mealSlotOf, type Meal, type MealSlotName } from "./model";
import { nutrientKeys, type NutrientKey } from "./foods";

export function mealsOn(meals: Meal[], date = new Date()) {
  const day = localDay(date);
  return meals.filter((m) => localDay(m.at) === day).sort((a, b) => a.at.localeCompare(b.at));
}

export function bySlot(meals: Meal[]): Record<MealSlotName, Meal[]> {
  const out: Record<MealSlotName, Meal[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
  for (const m of meals) out[mealSlotOf(m)].push(m);
  return out;
}

export const sumCalories = (meals: Meal[]) => Math.round(meals.reduce((a, m) => a + m.calories, 0));

/** Day totals for every nutrient; micronutrients only count meals that carry them. */
export function nutrientTotals(meals: Meal[]): { totals: Partial<Record<NutrientKey, number>>; coverage: number } {
  const totals: Partial<Record<NutrientKey, number>> = {};
  let withMicros = 0;
  for (const m of meals) {
    totals.calories = (totals.calories || 0) + m.calories;
    totals.protein = (totals.protein || 0) + m.protein;
    totals.carbs = (totals.carbs || 0) + m.carbs;
    totals.fat = (totals.fat || 0) + m.fat;
    totals.fibre = (totals.fibre || 0) + m.fibre;
    if (m.micros && Object.keys(m.micros).length) withMicros++;
    for (const k of nutrientKeys)
      if (!["calories", "protein", "carbs", "fat", "fibre"].includes(k) && m.micros?.[k] !== undefined)
        totals[k] = (totals[k] || 0) + m.micros[k];
  }
  for (const k of Object.keys(totals) as NutrientKey[]) totals[k] = Math.round(totals[k]! * 10) / 10;
  return { totals, coverage: meals.length ? withMicros / meals.length : 0 };
}
