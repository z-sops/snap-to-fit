import { doctorNotice } from "./safety";
import { nutrientKeys, type NutrientKey } from "./foods";
import { mealsOn, nutrientTotals, type NutrientTotals } from "./food-log";
import {
  type Profile,
  type Targets,
  type Meal,
  validateProfile,
} from "./model";
export function nutritionTargets(p: Profile): Targets {
  validateProfile(p);
  const bmi = p.weight / (p.height / 100) ** 2;
  const bmr =
    10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === "male" ? 5 : -161);
  const maintenance = Math.round(bmr * p.activity);
  const restricted =
    p.conditions.length > 0 ||
    p.insulin ||
    !!p.medicines.trim() ||
    bmi < 18.5 ||
    p.age > 78;
  const notes = [
    doctorNotice,
    "Estimates, not a measured metabolism. Mifflin–St Jeor equation and your selected activity level.",
    "Meal photographs cannot measure hidden oils or exact portions. Confirm every estimate.",
  ];
  if (restricted)
    notes.push(
      "Health context needs an individual care plan. Automatic calorie and macro targets are paused; logging and general education remain available.",
    );
  const adjustment =
    p.goal === "lose"
      ? -Math.min(400, maintenance * 0.15)
      : p.goal === "gain"
        ? 200
        : 0;
  const calories = Math.round(
    Math.max(p.sex === "male" ? 1500 : 1200, maintenance + adjustment),
  );
  // Implementation defaults for general adult fitness, not clinical prescriptions.
  const referenceWeight = Math.min(p.weight, 27 * (p.height / 100) ** 2);
  const protein = Math.round(
    referenceWeight * (p.experience === "experienced" ? 1.6 : 1.2),
  );
  const fat = Math.round((calories * 0.3) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return {
    calories,
    protein,
    fat,
    carbs,
    fibre: Math.round((calories / 1000) * 14),
    maintenance,
    bmi: Math.round(bmi * 10) / 10,
    notes,
    restricted,
  };
}
/**
 * The day's totals, with the same completeness contract as every other total
 * in the app: a nutrient no food reported is unknown, not zero, and one only
 * some food reported is a lower bound. There is one aggregation, not several.
 */
export function todayTotals(meals: Meal[], date = new Date()): NutrientTotals {
  return nutrientTotals(mealsOn(meals, date));
}
export function weightProjection(p: Profile) {
  const t = nutritionTargets(p);
  const difference = Math.abs(p.weight - p.targetWeight);
  if (t.restricted || p.goal === "maintain" || difference < 0.5) return null;
  // A broad planning window, not a prediction or guaranteed deadline.
  return {
    minWeeks: Math.ceil(difference / 0.5),
    maxWeeks: Math.ceil(difference / 0.25),
    label: "Planning range only; progress is not linear.",
  };
}
export function validateMeal(m: Omit<Meal, "id" | "at">) {
  if (!m.name.trim()) throw new Error("Add a meal name.");
  for (const k of ["calories", "protein", "carbs", "fat", "fibre"] as const)
    if (
      !Number.isFinite(m[k]) ||
      m[k] < 0 ||
      m[k] > (k === "calories" ? 5000 : 500)
    )
      throw new Error(`Invalid ${k}.`);
  // The nutrients the source did not know must be named from the known list.
  if (
    m.unknownNutrients !== undefined &&
    (!Array.isArray(m.unknownNutrients) ||
      m.unknownNutrients.length > 30 ||
      m.unknownNutrients.some((k) => !nutrientKeys.includes(k as NutrientKey)))
  )
    throw new Error("Invalid nutrient completeness metadata.");
}
