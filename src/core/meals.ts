// Building a logged meal from a food entry.
//
// This is domain logic, not screen logic, so it lives here: the nutrient
// completeness contract is then covered by the fast unit tests.
import { calorieRange, scale, withAddedFat, nutrientKeys, type AddedFat, type Food } from "./foods";
import type { Meal, MealSlotName } from "./model";

export type NewMeal = Omit<Meal, "id" | "at">;

/** The nutrients a food entry reports on its own. */
const micros = nutrientKeys.filter((k) => !["calories", "protein", "carbs", "fat"].includes(k));

/**
 * Builds the meal entry for an amount of a food, with range and hidden fat.
 *
 * A nutrient the source does not provide is recorded in `unknownNutrients`, so
 * it is never read back as a measured zero. The stored number stays in place
 * so old and new records have one shape.
 */
export function mealFromFood(
  food: Food,
  grams: number,
  servings: number,
  servingLabel: string,
  fat: AddedFat,
  slot: MealSlotName,
  photo?: boolean,
): NewMeal {
  // The nutrients the source actually provides. A missing one stays missing.
  const base = scale(food, grams);
  const n = withAddedFat(base, fat);
  const r = (x?: number) => Math.round((x || 0) * 10) / 10;
  const microValues: Record<string, number> = {};
  for (const k of micros) if (n[k] !== undefined) microValues[k] = r(n[k]);
  const calories = Math.round(n.calories || 0);
  const fatUncertainty = fat === "none" ? 0 : 0.05;
  const unknownNutrients = nutrientKeys.filter((k) => base[k] === undefined);
  return {
    name: food.name,
    source: photo ? "photo" : food.source === "barcode" ? "barcode" : "database",
    calories,
    protein: r(n.protein),
    carbs: r(n.carbs),
    fat: r(n.fat),
    fibre: r(n.fibre),
    slot,
    foodId: photo ? undefined : food.id,
    grams: Math.round(grams),
    servings,
    servingLabel,
    range: calorieRange(calories, food.uncertainty + fatUncertainty),
    addedFat: fat,
    micros: microValues,
    unknownNutrients: unknownNutrients.length ? unknownNutrients : undefined,
  };
}
