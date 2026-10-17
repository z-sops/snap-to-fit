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
import { cuisineGroups, dishIngredients, dishTraits, foodById, recipes, scale } from "./foods";
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
    "dishes-v2",
    weekStart(date),
    p.workoutDays || [],
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
  const training = new Set(p.workoutDays || []);
  const floor = p.sex === "male" ? 1500 : 1200;
  // Training days get a little more food (mostly carbs) and rest days a little less, so the
  // weekly average still equals the daily target. Only for general fitness plans.
  const boost = mode === "fitness" && training.size > 0 && training.size < 7 ? Math.round(totals.calories * 0.08) : 0;
  const cut = boost ? Math.round((boost * training.size) / (7 - training.size)) : 0;
  const dayTarget = (isTraining: boolean): MacroBudget => {
    const delta = isTraining ? boost : -Math.min(cut, Math.max(0, totals.calories - floor));
    return { ...totals, calories: totals.calories + delta, carbs: Math.max(0, totals.carbs + Math.round(delta / 4)) };
  };
  const cuisine = p.cuisine || "american";
  const allergies = p.allergyFoods || [];
  const fits = (id: string) => {
    const t = dishTraits(id);
    const dietOk = diet === "vegan" ? t.diet === "vegan" : diet === "vegetarian" ? t.diet !== "omnivore" : true;
    return dietOk && !t.allergens.some((a) => allergies.includes(a));
  };
  // Lunch and dinner must be a real meal: at least 10 g protein per serving.
  const mealSized = (id: string, slot: MealSlot) => {
    if (slot !== "lunch" && slot !== "dinner") return true;
    const f = foodById(`recipe:${id}`)!;
    return (scale(f, f.servings[0].grams).protein || 0) >= 10;
  };
  const pool = (slot: MealSlot) => {
    for (const c of [cuisine, "american"] as const) {
      const own = recipes.filter((r) => r.group === cuisineGroups[c] && r.slots.includes(slot) && fits(r.id) && mealSized(r.id, slot));
      if (own.length) return own;
    }
    return recipes.filter((r) => r.slots.includes(slot) && fits(r.id) && mealSized(r.id, slot));
  };
  const density = (id: string) => {
    const f = foodById(`recipe:${id}`)!;
    const n = scale(f, 100);
    return (n.protein || 0) / Math.max(1, n.calories || 1);
  };
  const byProtein = <T extends { id: string }>(list: T[]) => [...list].sort((a, b) => density(b.id) - density(a.id));
  const monday = new Date(week + "T12:00:00");
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const isTraining = training.has(d.getDay());
    const target = dayTarget(isTraining);
    const used = new Set<string>();
    const meals = mealSlots.map((slot, j) => {
      const budget = Object.fromEntries(
        (Object.keys(target) as (keyof MacroBudget)[]).map((k) => {
          // Snacks take the remainder so the four meals add up exactly to the day's target.
          const share = (x: MealSlot) => Math.round(target[k] * shares[x]);
          return [k, slot === "snack" ? target[k] - share("breakfast") - share("lunch") - share("dinner") : share(slot)];
        }),
      ) as unknown as MacroBudget;
      if (mode !== "fitness")
        return {
          slot,
          name: mode === "care-plan" ? "Add your existing care-plan meal" : "Add a familiar meal",
          ingredients: [], proteinSources: [], budget: null,
          note: "No automatic recipe or portion prescription.",
        };
      // Rotate day by day; breakfasts and snacks lean towards the most protein per calorie.
      const options = slot === "breakfast" || slot === "snack" ? byProtein(pool(slot)).slice(0, 5) : pool(slot);
      if (!options.length)
        return { slot, name: "Add a familiar meal", ingredients: [], proteinSources: [], budget, note: "No dish in the library fits your diet and allergy choices for this meal. Add one you know is safe for you." };
      let pick = options[(i + j) % options.length];
      for (let k = 1; used.has(pick.id) && k < options.length; k++) pick = options[(i + j + k) % options.length];
      used.add(pick.id);
      const food = foodById(`recipe:${pick.id}`)!;
      const one = scale(food, food.servings[0].grams);
      const kcal = one.calories || 1;
      const servings = Math.min(slot === "lunch" || slot === "dinner" ? 2.5 : 2, Math.max(0.5, Math.round((budget.calories / kcal) * 4) / 4));
      const n = scale(food, food.servings[0].grams * servings);
      return {
        slot,
        name: pick.name,
        dishId: pick.id,
        servings,
        servingLabel: food.servings[0].label,
        ingredients: dishIngredients(pick.id).map((x) => x.name),
        proteinSources: dishIngredients(pick.id).filter((x) => x.protein >= 8).map((x) => x.name),
        budget,
        nutrition: {
          calories: Math.round(n.calories || 0), protein: Math.round(n.protein || 0), carbs: Math.round(n.carbs || 0),
          fat: Math.round(n.fat || 0), fibre: Math.round(n.fibre || 0),
        },
        note: "Portion sized to your daily target. Adjust to hunger, check labels and hidden ingredients.",
      };
    });
    return { date: localDay(d), weekday: d.toLocaleDateString("en", { weekday: "long" }), meals, training: isTraining, target };
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
