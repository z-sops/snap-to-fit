// Insulin safety notices. Snap to Fit records the prescribed insulin schedule but never suggests,
// calculates or changes units, carbs-per-unit or timing — that is the care team's job (and dose
// calculators are regulated medical devices). What it can do is notice combinations that make low
// blood sugar more likely — little food logged, a workout, a recent low, rapid insulin just taken —
// and remind the person to check their glucose and follow their own plan.
import { localDay, type Medicine, type State } from "./model";
import { nutrientTotals, nutrientValue } from "./food-log";

export interface InsulinNotice { level: "urgent" | "caution" | "info"; text: string }

export const usesInsulin = (s: Pick<State, "profile" | "medicines">) =>
  !!s.profile?.insulin || s.medicines.some((m) => m.kind === "insulin");

const isLow = (value: number, unit: string) => (unit === "mmol/L" ? value < 3.9 : value < 70);

/** Glucose readings (manual and CGM history) in the last `hours`. */
export function recentLow(s: Pick<State, "readings" | "cgm">, now = new Date(), hours = 24) {
  const since = now.getTime() - hours * 3600_000;
  const manual = s.readings.some((r) => r.kind === "glucose" && new Date(r.at).getTime() >= since && isLow(r.value, r.unit));
  const cgm = (s.cgm || []).some((r) => r.value !== null && new Date(r.at).getTime() >= since && isLow(r.value, r.unit));
  return manual || cgm;
}

export function insulinNotices(
  s: Pick<State, "profile" | "medicines" | "doses" | "meals" | "readings" | "cgm" | "workouts" | "mealPlan">,
  opts: { now?: Date; aboutToTrain?: boolean } = {},
): InsulinNotice[] {
  if (!usesInsulin(s)) return [];
  const now = opts.now || new Date();
  const today = localDay(now);
  const out: InsulinNotice[] = [];
  const plannedToday = s.mealPlan?.days.find((d) => d.date === today)?.training || (s.profile?.workoutDays || []).includes(now.getDay());
  const trainingSoon = opts.aboutToTrain || plannedToday;
  // The day's carbohydrates through the shared completeness contract. A meal
  // that never reported its carbohydrates counts as none, which keeps the
  // notice conservative: an incomplete log may be treated as a small one, never
  // the other way round. The safety behaviour is unchanged.
  const dayMeals = s.meals.filter((m) => localDay(m.at) === today);
  const carbsToday = nutrientValue(nutrientTotals(dayMeals), "carbs") ?? 0;
  const insulinIds = new Set(s.medicines.filter((m) => m.kind === "insulin").map((m) => m.id));
  const rapid = new Set(s.medicines.filter((m: Medicine) => m.kind === "insulin" && (m.insulinType === "rapid" || m.insulinType === "mixed")).map((m) => m.id));
  const rapidRecently = s.doses.some((d) => rapid.has(d.medicineId) && now.getTime() - new Date(d.at).getTime() < 2 * 3600_000);
  const insulinToday = s.doses.some((d) => insulinIds.has(d.medicineId) && localDay(d.at) === today);
  const trainedRecently = s.workouts.some((w) => now.getTime() - new Date(w.at).getTime() < 24 * 3600_000);

  if (recentLow(s, now))
    out.push({ level: "urgent", text: "You logged a low glucose reading in the last 24 hours. Lows are more likely again today, especially with exercise. Follow your low-glucose plan and ask your care team before a hard workout." });
  if (trainingSoon && rapidRecently)
    out.push({ level: "caution", text: "Rapid-acting insulin in the last 2 hours plus exercise can drop your glucose quickly. Check your glucose first and follow your care team's plan for exercise." });
  if (trainingSoon && now.getHours() >= 11 && carbsToday < 30)
    out.push({ level: "caution", text: "Very little food is logged today and a workout is planned. With insulin, that combination raises the risk of low blood sugar. Check your glucose and follow your plan before training." });
  if (trainingSoon && insulinToday && !opts.aboutToTrain)
    out.push({ level: "info", text: "Workout day: check your glucose before, during long sessions and after. Keep fast-acting sugar with you." });
  if (trainedRecently)
    out.push({ level: "info", text: "Exercise can lower glucose for up to 24 hours, including overnight. Check it again later today and before bed." });
  return out;
}

/** Before-workout checklist shown to insulin users; the first two must be ticked. */
export const preWorkoutChecks = [
  { id: "checked", text: "I checked my glucose and it's in the range my care team set for exercise", required: true },
  { id: "sugar", text: "I have fast-acting sugar with me (juice, glucose tablets)", required: true },
  { id: "phone", text: "Someone knows I'm training, or my phone is with me", required: false },
] as const;
