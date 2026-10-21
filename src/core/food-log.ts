import { localDay, mealSlotOf, type Meal, type MealSlotName } from "./model";
import { macroKeys, nutrientKeys, type NutrientKey } from "./foods";

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

const macroSet = new Set<string>(macroKeys);

export interface NutrientTotals {
  /** The summed value of every nutrient that could be known. */
  totals: Partial<Record<NutrientKey, number>>;
  /** Nutrients no meal in the list provided, so the day total is not a number. */
  unknown: NutrientKey[];
  /** Nutrients only some meals provided, so the day total is a lower bound. */
  partial: NutrientKey[];
  coverage: number;
}

/**
 * Day totals for every nutrient.
 *
 * A nutrient that no meal provided is unknown, not zero. A nutrient that only
 * some meals provided is a lower bound. A meal saved before this metadata
 * existed carries none, so its numbers are all treated as known and the
 * totals are exactly what they always were.
 */
export function nutrientTotals(meals: Meal[]): NutrientTotals {
  const totals: Partial<Record<NutrientKey, number>> = {};
  const unknown: NutrientKey[] = [];
  const partial: NutrientKey[] = [];
  let withMicros = 0;
  for (const m of meals) {
    for (const k of macroKeys) totals[k] = (totals[k] || 0) + m[k];
    if (m.micros && Object.keys(m.micros).length) withMicros++;
    for (const k of nutrientKeys)
      if (!macroSet.has(k) && m.micros?.[k] !== undefined)
        totals[k] = (totals[k] || 0) + m.micros[k];
  }
  if (meals.length)
    for (const k of nutrientKeys) {
      const missing = meals.filter((m) => m.unknownNutrients?.includes(k));
      if (!missing.length) continue;
      if (missing.length === meals.length) {
        unknown.push(k);
        delete totals[k];
      } else partial.push(k);
    }
  for (const k of Object.keys(totals) as NutrientKey[]) totals[k] = Math.round(totals[k]! * 10) / 10;
  return { totals, unknown, partial, coverage: meals.length ? withMicros / meals.length : 0 };
}
