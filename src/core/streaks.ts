// Habit loop: logging streaks, daily wins and the weekly report card.
import { localDay, type State } from "./model";
import { nutritionTargets } from "./nutrition";
import { nutrientState, nutrientTotals, nutrientValue, type NutrientState } from "./food-log";
import { proteinGuidance } from "./targets";
import { effectiveProfile } from "./progress";

const dayKey = (d: Date) => localDay(d);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/** Days with at least one logged meal (or workout) count toward the streak. */
export function activeDays(s: State) {
  const days = new Set<string>();
  for (const m of s.meals) days.add(localDay(m.at));
  for (const w of s.workouts) days.add(localDay(w.at));
  return days;
}

/** Current streak keeps counting through today even before today's first log. */
export function streak(s: State, now = new Date()) {
  const days = activeDays(s);
  let cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);
  if (!days.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  let current = 0;
  while (days.has(dayKey(cursor))) { current++; cursor = addDays(cursor, -1); }
  const sorted = [...days].sort();
  let best = 0, run = 0, prev = "";
  for (const d of sorted) {
    run = prev && dayKey(addDays(new Date(`${prev}T12:00:00`), 1)) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best, loggedToday: days.has(dayKey(now)) };
}

export function proteinTarget(s: State) {
  const p = effectiveProfile(s);
  if (!p) return 0;
  const t = nutritionTargets(p);
  if (!t.restricted) return t.protein;
  return proteinGuidance(p)?.low || 0;
}

export interface DaySummary {
  date: string;
  label: string;
  /** The day's calories, or null when no food that day reported them. */
  calories: number | null;
  /** The day's protein, or null when no food that day reported it. */
  protein: number | null;
  /** How complete each of those two figures is. */
  state: { calories: NutrientState; protein: NutrientState };
  meals: number;
  workouts: number;
}
export interface WeekReport {
  days: DaySummary[];
  /** The weekly averages, or null when the week's data is not complete enough. */
  avgCalories: number | null;
  avgProtein: number | null;
  /** True when every logged day reported the calories the average is based on. */
  caloriesComplete: boolean;
  /** True when every logged day reported the protein the average is based on. */
  proteinComplete: boolean;  daysLogged: number;
  proteinDays: number;
  workouts: number;
  weightChange: number | null;
  calorieTarget: number | null;
  proteinTarget: number;
  highlights: string[];
}

export function weekReport(s: State, now = new Date()): WeekReport {
  const p = effectiveProfile(s);
  const t = p ? nutritionTargets(p) : null;
  const pt = proteinTarget(s);
  const days: DaySummary[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(now, -i);
    const key = dayKey(d);
    const meals = s.meals.filter((m) => localDay(m.at) === key);
    // The same completeness contract as the day's totals: a value no food
    // reported is unknown, not zero, and a partly reported one is a bound.
    const day = nutrientTotals(meals);
    const calories = nutrientValue(day, "calories");
    const protein = nutrientValue(day, "protein");
    days.push({
      date: key,
      label: d.toLocaleDateString(undefined, { weekday: "narrow" }),
      calories: calories === undefined ? null : Math.round(calories),
      protein: protein === undefined ? null : Math.round(protein),
      state: { calories: nutrientState(day, "calories"), protein: nutrientState(day, "protein") },
      meals: meals.length,
      workouts: s.workouts.filter((w) => localDay(w.at) === key).length,
    });
  }
  const logged = days.filter((d) => d.meals > 0);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const from = addDays(now, -7).toISOString();
  const weights = s.readings.filter((r) => r.kind === "weight" && r.at >= from).sort((a, b) => a.at.localeCompare(b.at));
  const weightChange = weights.length >= 2 ? Math.round((weights[weights.length - 1].value - weights[0].value) * 10) / 10 : null;
  // A day counts as reaching the protein goal when the protein that is known
  // already passes the target: a complete day's total is final, and a partly
  // reported day can only be higher than the part that was reported. A day
  // that reported no protein at all cannot be counted.
  const proteinDays = pt
    ? logged.filter((d) => d.protein !== null && d.protein >= pt).length
    : 0;
  const workouts = days.reduce((a, d) => a + d.workouts, 0);
  const highlights: string[] = [];
  const st = streak(s, now);
  if (st.current >= 3) highlights.push(`🔥 ${st.current}-day logging streak`);
  if (proteinDays) highlights.push(`💪 Protein goal hit on ${proteinDays} day${proteinDays > 1 ? "s" : ""}`);
  if (workouts) highlights.push(`🏋️ ${workouts} workout${workouts > 1 ? "s" : ""} logged`);
  if (logged.length === 7) highlights.push("⭐ Logged every day this week");
  // A week of partly reported data still gives an average, but it is a lower
  // bound rather than a confirmed figure, and the report says so.
  const calorieDays = logged.filter((d) => d.calories !== null);
  const proteinValues = logged.filter((d) => d.protein !== null);
  return {
    days,
    avgCalories: calorieDays.length ? avg(calorieDays.map((d) => d.calories!)) : null,
    avgProtein: proteinValues.length ? avg(proteinValues.map((d) => d.protein!)) : null,
    caloriesComplete: logged.length > 0 && logged.every((d) => d.state.calories === "known"),
    proteinComplete: logged.length > 0 && logged.every((d) => d.state.protein === "known"),
    daysLogged: logged.length,
    proteinDays,
    workouts,
    weightChange,
    calorieTarget: t && !t.restricted ? t.calories : null,
    proteinTarget: pt,
    highlights,
  };
}

/** Badges unlocked from history (shown on the report and profile). */
export function achievements(s: State, now = new Date()) {
  const st = streak(s, now);
  const days = activeDays(s).size;
  const list = [
    { id: "first-log", label: "First bite", detail: "Logged your first meal", done: s.meals.length > 0 },
    { id: "streak-3", label: "On a roll", detail: "3-day streak", done: st.best >= 3 },
    { id: "streak-7", label: "One full week", detail: "7-day streak", done: st.best >= 7 },
    { id: "streak-30", label: "Habit built", detail: "30-day streak", done: st.best >= 30 },
    { id: "days-50", label: "Fifty days", detail: "Active on 50 days", done: days >= 50 },
    { id: "workout-10", label: "Ten sessions", detail: "10 workouts logged", done: s.workouts.length >= 10 },
  ];
  return list;
}
