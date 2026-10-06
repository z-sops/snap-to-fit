import { validateRoutine, validateEducation } from "../src/core/routine";
import { validateCarePlan, buildMealPlan } from "../src/core/meal-planning";
import { effectiveProfile } from "../src/core/progress";
import { backupState } from "../src/core/backup-state";
import { validateProfile, type State } from "../src/core/model";
import { ServiceError } from "./database";
export function validatedBackup(value: unknown): State {
  if (!value || typeof value !== "object")
    throw new ServiceError(400, "Invalid backup.");
  const s = value as State;
  if (s.version !== 1)
    throw new ServiceError(400, "Unsupported backup version.");
  if (s.profile) validateProfile(s.profile);
  for (const name of [
    "meals",
    "readings",
    "medicines",
    "doses",
    "workouts",
    "messages",
    "cgm",
  ] as const) {
    if (!Array.isArray(s[name]) || s[name].length > 15000)
      throw new ServiceError(400, `Invalid ${name} list.`);
    if (s[name].some((x) => typeof x.id !== "string" || x.id.length > 180))
      throw new ServiceError(400, `Invalid ${name} record.`);
  }
  if (
    s.meals.some(
      (m) =>
        !Number.isFinite(m.calories) || m.calories < 0 || m.calories > 5000,
    )
  )
    throw new ServiceError(400, "Invalid meal records.");
  if (
    s.readings.some(
      (r) =>
        !Number.isFinite(r.value) || !Number.isFinite(new Date(r.at).getTime()),
    )
  )
    throw new ServiceError(400, "Invalid health readings.");
  if (s.routine) validateRoutine(s.routine);
  if (s.education) validateEducation(s.education);
  if (s.carePlan) validateCarePlan(s.carePlan);
  if (
    s.routineEvents !== undefined &&
    (!Array.isArray(s.routineEvents) ||
      s.routineEvents.length > 500 ||
      s.routineEvents.some(
        (e) =>
          !e ||
          typeof e.id !== "string" ||
          !["wake", "breakfast", "lunch", "dinner"].includes(e.kind) ||
          !Number.isFinite(new Date(e.at).getTime()),
      ))
  )
    throw new ServiceError(400, "Invalid routine check-ins.");
  if (
    s.flexibleMeals !== undefined &&
    (!Array.isArray(s.flexibleMeals) ||
      s.flexibleMeals.length > 2500 ||
      s.flexibleMeals.some(
        (e) =>
          !e ||
          typeof e.id !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(e.week) ||
          !Number.isFinite(new Date(e.at).getTime()),
      ))
  )
    throw new ServiceError(400, "Invalid flexible-meal history.");
  const p = effectiveProfile(s);
  return backupState({ ...s, mealPlan: p ? buildMealPlan(p) : undefined });
}
