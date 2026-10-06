import { test } from "node:test";
import assert from "node:assert/strict";
import { newProfile, emptyState, type Profile } from "../src/core/model";
import { nutritionTargets } from "../src/core/nutrition";
import { mealIdeas } from "../src/core/meal-catalog";
import {
  buildMealPlan,
  flexibleMealStatus,
  weekStart,
  validateCarePlan,
} from "../src/core/meal-planning";
import { foodReview } from "../src/core/food-review";
import {
  defaultRoutine,
  reminderSpecs,
  routineTimes,
  clockMinutes,
  breakfastStatus,
  validateEducation,
  defaultEducation,
  educationCards,
} from "../src/core/routine";
import { backupState } from "../src/core/backup-state";
import { validatedBackup } from "../server/validate-state";
const p: Profile = {
  ...newProfile,
  name: "Alex",
  age: 30,
  height: 175,
  weight: 80,
  targetWeight: 80,
  consent: true,
  country: "PK",
  dietType: "vegan",
};
test("Pakistan vegan weekly ideas use local plant sources and have no animal ingredients", () => {
  const plan = buildMealPlan(p, new Date(2026, 9, 6, 12));
  assert.equal(plan.days.length, 7);
  assert.equal(plan.mode, "fitness");
  const text = plan.days.flatMap((d) => d.meals.map((m) => m.name)).join(" ");
  assert.match(text, /daal|Daal|chana|Chana|Lobia/);
  assert.doesNotMatch(text, /chicken|fish|paneer|yogurt|egg/i);
  assert.ok(
    plan.days.every((d) => d.meals.every((m) => m.proteinSources.length > 0)),
  );
});
test("meal budget totals equal computed daily goals; budgets are never recipe nutrition claims", () => {
  for (const country of ["PK", "US", "GB", "AE", "TR"])
    for (const dietType of ["vegan", "vegetarian", "omnivore"] as const) {
      const profile = { ...p, country, dietType };
      const targets = nutritionTargets(profile);
      for (const day of buildMealPlan(profile).days)
        for (const key of [
          "calories",
          "protein",
          "carbs",
          "fat",
          "fibre",
        ] as const)
          assert.equal(
            day.meals.reduce((sum, m) => sum + (m.budget?.[key] || 0), 0),
            targets[key],
          );
    }
});
test("countries and dietary preferences select different meal ideas", () => {
  assert.notEqual(
    mealIdeas("PK", "vegan", "breakfast")[0].name,
    mealIdeas("US", "vegan", "breakfast")[0].name,
  );
  assert.match(mealIdeas("PK", "omnivore", "lunch")[0].name, /chicken/i);
  assert.doesNotMatch(
    mealIdeas("PK", "vegetarian", "lunch")
      .map((m) => m.name)
      .join(" "),
    /chicken|fish/i,
  );
});
test("medical profiles receive a seven-day care organizer without generated portions or clinical macros", () => {
  for (const profile of [
    { ...p, conditions: ["type2" as const] },
    { ...p, insulin: true },
    { ...p, conditions: ["kidney" as const] },
  ]) {
    const plan = buildMealPlan(profile);
    assert.equal(plan.mode, "care-plan");
    assert.ok(
      plan.days.every((d) =>
        d.meals.every(
          (m) => m.budget === null && m.proteinSources.length === 0,
        ),
      ),
    );
    assert.equal(flexibleMealStatus(emptyState, profile).eligible, false);
  }
});
test("missing local coverage does not silently serve an American menu", () => {
  for (const country of [undefined, "OTHER"]) {
    const plan = buildMealPlan({ ...p, country });
    assert.equal(plan.mode, "local-setup");
    assert.ok(plan.days.every((d) => d.meals.every((m) => m.budget === null)));
  }
});
test("selected known allergies filter catalog ideas; unknown allergies pause generation", () => {
  const profile = { ...p, allergyFoods: ["soy" as const, "wheat" as const] };
  const plan = buildMealPlan(profile);
  assert.ok(
    plan.days
      .flatMap((d) => d.meals)
      .every((m) => !m.ingredients.some((i) => /roti|soy|tofu|bread/i.test(i))),
  );
  assert.equal(
    buildMealPlan({ ...p, allergies: "An unusual spice allergy" }).mode,
    "allergy-review",
  );
});
test("optional flexible meal is once per local week and never grants extra calories", () => {
  const now = new Date(2026, 9, 6, 12);
  const state = {
    ...emptyState,
    flexibleMeals: [{ id: "x", week: weekStart(now), at: now.toISOString() }],
  };
  assert.equal(flexibleMealStatus(state, p, now).available, false);
  assert.equal(
    flexibleMealStatus(state, p, new Date(2026, 9, 13, 12)).available,
    true,
  );
});
test("photo review flags medical context and possible ingredients without claiming a dangerous spike", () => {
  const result = foodReview(
    { ...p, conditions: ["type2"], allergyFoods: ["milk"] },
    { name: "Milk and jalebi", carbs: 70 },
    { carbs: 100 },
    50,
  );
  assert.equal(result.requiresReview, true);
  assert.equal(foodReview({...p,allergyFoods:["milk"]},{name:"Chicken and rice",carbs:40}).requiresReview,true);
  assert.ok(result.messages.some((m) => m.includes("Possible milk")));
  assert.ok(result.messages.some((m) => m.includes("cannot predict")));
  assert.ok(result.messages.some((m) => m.includes("entered 100")));
  assert.doesNotMatch(
    result.messages.join(" "),
    /will.*dangerous|guaranteed safe/i,
  );
});
test("routine selects weekend times, creates correct weekday triggers and validates clock input", () => {
  const r = { ...defaultRoutine, reminders: true, wakeReminder: false };
  const specs = reminderSpecs(r);
  assert.equal(specs.length, 21);
  assert.equal(
    specs.find((s) => s.weekday === 1 && s.kind === "breakfast")?.hour,
    10,
  );
  assert.equal(
    specs.find((s) => s.weekday === 2 && s.kind === "breakfast")?.hour,
    8,
  );
  assert.equal(routineTimes(r, new Date(2026, 9, 10)).breakfast, "10:00");
  assert.equal(reminderSpecs({ ...r, wakeReminder: true }).length, 28);
  for (const text of ["25:00", "9:00", "12:60", ""])
    assert.throws(() => clockMinutes(text));
  assert.equal(clockMinutes("23:59"), 1439);
});
test("schedule alone never starts an actual meal clock", () => {
  assert.equal(breakfastStatus([], new Date(2026, 9, 6, 12)), null);
  const at = new Date(2026, 9, 6, 9).toISOString();
  assert.equal(
    breakfastStatus(
      [{ id: "x", kind: "breakfast", at }],
      new Date(2026, 9, 6, 9, 30),
    )?.elapsedMinutes,
    30,
  );
});
test("backups validate new settings, remove every device reminder and preserve user check-ins", () => {
  const state = {
    ...emptyState,
    profile: p,
    routine: {
      ...defaultRoutine,
      reminders: true,
      reminderIds: ["device-only"],
    },
    education: {
      ...defaultEducation,
      enabled: true,
      reminderIds: ["device-education"],
    },
    routineEvents: [
      { id: "x", kind: "breakfast" as const, at: new Date().toISOString() },
    ],
  };
  const backup = validatedBackup(state);
  assert.deepEqual(backup.routine?.reminderIds, []);
  assert.equal(backup.routine?.reminders, false);
  assert.equal(backup.education?.enabled, false);
  assert.equal(backup.routineEvents?.length, 1);
  assert.equal(state.routine.reminders, true);
  assert.deepEqual(backupState(state).education?.reminderIds, []);
  assert.throws(() =>
    validatedBackup({
      ...state,
      routine: {
        ...state.routine,
        regular: { ...state.routine.regular, lunch: "99:00" },
      },
    }),
  );
});
test("care references and education schedule reject malformed values", () => {
  assert.throws(() =>
    validateCarePlan({
      meals: {},
      acknowledged: true,
      targets: { protein: NaN },
    }),
  );
  assert.throws(() => validateEducation({ ...defaultEducation, weekday: 0 }));
  assert.throws(() =>
    validateEducation({ ...defaultEducation, time: "99:01" }),
  );
  assert.ok(educationCards.some((c) => /corticosteroid/i.test(c.text)));
  assert.doesNotMatch(
    educationCards.map((c) => c.text).join(" "),
    /100%|permanent muscle|zero side effects/,
  );
});
