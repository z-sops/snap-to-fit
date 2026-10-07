import { localDay, type Reading, type WorkoutLog } from "./model";
export function weeklyActivity(workouts: WorkoutLog[], now = new Date()) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - 6 + i);
    const day = localDay(date.toISOString());
    return {
      label: date.toLocaleDateString("en", { weekday: "short" }),
      value: workouts.filter((w) => localDay(w.at) === day).length,
    };
  });
}
export function readingTrend(
  readings: Reading[],
  kind: Reading["kind"],
  unit?: string,
) {
  return readings
    .filter(
      (r) =>
        r.kind === kind &&
        (!unit || r.unit === unit) &&
        Number.isFinite(r.value) &&
        Number.isFinite(Date.parse(r.at)),
    )
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map((r) => ({
      label: new Date(r.at).toLocaleDateString("en", {
        month: "short",
        day: "numeric",
      }),
      value: r.value,
      at: Date.parse(r.at),
    }));
}
