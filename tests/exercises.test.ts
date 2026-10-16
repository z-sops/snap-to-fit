import { test } from "node:test";
import assert from "node:assert/strict";
import { library, filterLibrary, safetyFor, exerciseById, planExerciseMedia } from "../src/core/exercise-library";
import { newProfile } from "../src/core/model";

const base = { ...newProfile, name: "A", age: 35, height: 175, weight: 80, consent: true };

test("library has 870+ exercises with steps and images", () => {
  assert.ok(library().length >= 870);
  const e = exerciseById("Goblet_Squat")!;
  assert.ok(e.steps.length > 2 && e.images[0].endsWith("Goblet_Squat/0.jpg"));
  for (const id of Object.values(planExerciseMedia)) assert.ok(exerciseById(id), id);
});

test("filters by muscle group and equipment", () => {
  const chest = filterLibrary({ group: "chest", equipment: "dumbbell" });
  assert.ok(chest.length > 5);
  assert.ok(chest.every((r) => r.e.primary.includes("chest") && r.e.equipment === "dumbbell"));
  assert.ok(filterLibrary({ query: "plank" }).some((r) => r.e.id === "Plank"));
});

test("slip disc hides deadlifts and sit-ups; neck hides shrugs; knee hides jumps", () => {
  const back = { ...base, limits: ["lower-back" as const] };
  assert.equal(safetyFor(exerciseById("Barbell_Deadlift")!, back)?.level, "hide");
  assert.ok(!filterLibrary({ query: "deadlift" }, back).some((r) => /deadlift/i.test(r.e.name)));
  const neck = { ...base, limits: ["neck" as const] };
  assert.ok(!filterLibrary({ query: "shrug" }, neck).length);
  const knee = { ...base, limits: ["knee" as const] };
  assert.ok(!filterLibrary({ group: "legs" }, knee).some((r) => r.e.category === "plyometrics"));
  const heart = { ...base, conditions: ["heart" as const] };
  assert.ok(!filterLibrary({}, heart).some((r) => r.e.category === "powerlifting"));
  assert.equal(safetyFor(exerciseById("Plank")!, base), null);
});
