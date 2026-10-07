import { doctorNotice } from "./safety";
import { localDay, type Profile, type State } from "./model";
import type {
  DietType,
  MealPlan,
  MacroBudget,
  MealSlot,
  CarePlan,
} from "./planning-types";
import { nutritionTargets } from "./nutrition";
import { mealIdeasForCuisine } from "./meal-catalog";
export function weekStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDay(d);
}
export function dietaryType(p: Profile): DietType {
  if (p.dietType) return p.dietType;
  const text = p.diet.toLowerCase();
  return /\bvegan\b/.test(text) && !/non.?vegan/.test(text)
    ? "vegan"
    : /\bvegetarian\b/.test(text)
      ? "vegetarian"
      : "omnivore";
}
export function planSignature(p: Profile, date = new Date()) {
  return JSON.stringify([
    weekStart(date),
    p.country || "",
    p.cuisine || "american",
    dietaryType(p),
    p.allergyFoods || [],
    p.allergies,
    p.familiarFoods || "",
    p.age,
    p.sex,
    p.height,
    p.weight,
    p.goal,
    p.activity,
    p.experience,
    p.conditions,
    p.insulin,
    p.medicines,
  ]);
}
export function hasOtherAllergy(p: Profile) {
  return (
    !!p.allergies.trim() &&
    !/^(none|no(ne)? known( allergies)?|no allergies|nka|nil)$/i.test(
      p.allergies.trim(),
    )
  );
}
const shares: Record<MealSlot, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.3,
  snack: 0.1,
};
export const mealSlots = ["breakfast", "lunch", "dinner", "snack"] as const;
export function buildMealPlan(p: Profile, date = new Date()): MealPlan {
  const targets = nutritionTargets(p),
    country = p.country || "",
    diet = dietaryType(p),
    week = weekStart(date);
  const mode = targets.restricted
    ? "care-plan"
    : hasOtherAllergy(p)
      ? "allergy-review"
      : "fitness";
  const totals: MacroBudget = {
    calories: targets.calories,
    protein: targets.protein,
    carbs: targets.carbs,
    fat: targets.fat,
    fibre: targets.fibre,
  };
  const notes = [
    doctorNotice,
    "Meal targets are planning budgets, not measured nutrition for the pictured or suggested recipe. Portions and cooking ingredients need confirmation.",
    "Cuisine preferences are starting meal ideas, not a rule about nationality. Recipes, sauces and cross-contact need ingredient review.",
  ];
  if (mode === "care-plan")
    notes.push(
      "Your seven-day organizer is ready. Add meals and targets from your existing individual care plan. The app does not generate a medical diet or adjust medication.",
    );
  if (mode === "allergy-review")
    notes.push(
      "Free-text allergies require individual ingredient review. Automatic meal suggestions are paused until those restrictions are clarified.",
    );
  if (diet === "vegan")
    notes.push(
      "Include varied plant protein sources. Fortified foods and nutrients such as vitamin B12 need attention; a vegan pattern does not automatically increase your protein target.",
    );
  const allocations: Record<string, number[]> = {};
  for (const key of Object.keys(totals) as (keyof MacroBudget)[]) {
    let used = 0;
    allocations[key] = mealSlots.map((slot, i) => {
      const value =
        i === 3 ? totals[key] - used : Math.round(totals[key] * shares[slot]);
      used += value;
      return value;
    });
  }
  const monday = new Date(week + "T12:00:00");
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return {
      date: localDay(d),
      weekday: d.toLocaleDateString("en", { weekday: "long" }),
      meals: mealSlots.map((slot, j) => {
        const options = mealIdeasForCuisine(p.cuisine || "american", diet, slot).filter(
          (x) => !x.allergens.some((a) => (p.allergyFoods || []).includes(a)),
        );
        const item =
          mode === "fitness" ? options[i % options.length] : undefined;
        return {
          slot,
          name:
            item?.name ||
            (mode === "care-plan"
              ? "Add your existing care-plan meal"
              : "Add a familiar meal"),
          ingredients: item?.ingredients || [],
          proteinSources: item?.proteinSources || [],
          budget: item
            ? (Object.fromEntries(
                Object.keys(totals).map((key) => [key, allocations[key][j]]),
              ) as unknown as MacroBudget)
            : null,
          note: item
            ? "Adjust portions to your planning budget. Check labels and hidden ingredients."
            : "No automatic recipe or portion prescription.",
        };
      }),
    };
  });
  return {
    week,
    signature: planSignature(p, date),
    mode,
    country,
    diet,
    days,
    notes,
  };
}
export function conditionNotes(p: Profile) {
  const notes: string[] = [];
  if (
    p.conditions.includes("type1") ||
    p.conditions.includes("type2") ||
    p.insulin
  )
    notes.push(
      "Keep carbohydrate portions and meal timing aligned with your prescribed plan. Photos and delayed CGM history cannot decide whether a meal is safe right now.",
    );
  if (p.conditions.includes("hypertension"))
    notes.push(
      "Check added salt and packaged-food labels against your existing BP plan; salt cannot be measured from a photo.",
    );
  if (p.conditions.includes("heart"))
    notes.push(
      "Use your existing heart-care nutrition plan. Food suggestions do not establish safety after bypass or angioplasty.",
    );
  if (p.conditions.includes("kidney"))
    notes.push(
      "Kidney-care protein, potassium, sodium and fluid needs vary. Use your individual plan; do not apply a generic high-protein menu.",
    );
  if (p.conditions.includes("pregnant"))
    notes.push(
      "Use your pregnancy/breastfeeding nutrition plan; automatic fitness deficits are paused.",
    );
  if (p.conditions.includes("eating-disorder"))
    notes.push(
      "Prioritize your recovery plan. Flexible-meal rewards and automatic restriction targets are unavailable.",
    );
  return notes;
}
export function validateCarePlan(plan: CarePlan) {
  if (
    typeof plan.acknowledged !== "boolean" ||
    !plan.targets ||
    typeof plan.targets !== "object" ||
    !plan.meals ||
    typeof plan.meals !== "object"
  )
    throw new Error("Invalid existing care plan.");
  for (const [key, value] of Object.entries(plan.targets)) {
    if (
      !["calories", "protein", "carbs", "fat", "fibre"].includes(key) ||
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > (key === "calories" ? 6000 : 600)
    )
      throw new Error("Invalid entered nutrition target.");
  }
  for (const [key, value] of Object.entries(plan.meals)) {
    if (
      !mealSlots.includes(key as MealSlot) ||
      typeof value !== "string" ||
      value.length > 1000
    )
      throw new Error("Invalid care-plan meal.");
  }
}
export function flexibleMealStatus(
  state: State,
  p: Profile,
  date = new Date(),
) {
  const eligible = !nutritionTargets(p).restricted;
  const used = (state.flexibleMeals || []).some(
    (x) => x.week === weekStart(date),
  );
  return {
    eligible,
    used,
    available: eligible && !used,
    reason: !eligible
      ? "Flexible-meal rewards are unavailable for your health context. Keep using your individual care plan; you can always log what you actually ate."
      : used
        ? "Your optional flexible meal is already selected for this week."
        : "One optional flexible meal each week. It does not add calories, erase food logs or certify a meal as safe.",
  };
}
