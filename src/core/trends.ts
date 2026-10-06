import type { Reading } from "./model";
export function waistRatio(heightCm: number, waistCm: number) {
  if (
    !Number.isFinite(heightCm) ||
    !Number.isFinite(waistCm) ||
    heightCm <= 0 ||
    waistCm <= 0
  )
    return null;
  return Math.round((waistCm / heightCm) * 100) / 100;
}
export function plateauReview(readings: Reading[], now = new Date()) {
  const end = now.getTime();
  const start = end - 28 * 86400000;
  const weights = readings.filter(
    (r) =>
      r.kind === "weight" &&
      new Date(r.at).getTime() >= start &&
      new Date(r.at).getTime() <= end,
  );
  // Need repeated readings spread across four weeks, not two nearby points.
  const buckets = [0, 1, 2, 3].map((week) =>
    weights.filter((r) => {
      const age = (end - new Date(r.at).getTime()) / 86400000;
      return age >= week * 7 && age < (week + 1) * 7;
    }),
  );
  if (buckets.some((b) => b.length < 2))
    return {
      review: false,
      message:
        "At least two weight entries in each of four weeks are needed for a trend review.",
    };
  const averages = buckets.map(
    (b) => b.reduce((sum, r) => sum + r.value, 0) / b.length,
  );
  const range = Math.max(...averages) - Math.min(...averages);
  return {
    review: range < 0.5,
    message:
      range < 0.5
        ? "Your weekly average weight has changed little over four weeks. Review your logs, routine and treatment with your prescriber. This is not a recommendation to stop or change medication."
        : "Your weekly averages are changing. Continue recording your progress; this does not determine medication duration.",
  };
}
