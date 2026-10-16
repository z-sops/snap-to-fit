// "My numbers": BMR, TDEE, BMI, adaptive expenditure and protein guidance.
// Estimates only; the app never sets targets for people whose care team should.
import { localDay, type Profile, type State } from "./model";

export interface BodyNumbers {
  bmr: number;
  tdee: number;
  bmi: number;
  bmiLabel: string;
  activityLabel: string;
}
const activityLabels: Record<number, string> = { 1.2: "Mostly sitting", 1.375: "Lightly active", 1.55: "Active", 1.725: "Very active" };

/** Mifflin–St Jeor BMR × activity factor; BMI = kg / m². */
export function bodyNumbers(p: Profile): BodyNumbers {
  const bmr = Math.round(10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === "male" ? 5 : -161));
  const bmi = Math.round((p.weight / (p.height / 100) ** 2) * 10) / 10;
  const bmiLabel = bmi < 18.5 ? "Below the adult reference range" : bmi < 25 ? "Within the adult reference range" : bmi < 30 ? "Above the reference range" : "Well above the reference range";
  return { bmr, tdee: Math.round(bmr * p.activity), bmi, bmiLabel, activityLabel: activityLabels[p.activity] || "" };
}

export interface ProteinGuidance { low: number; high: number; perKg: string; reason: string }

/**
 * Daily protein range in grams. Uses a reference weight capped at BMI 27 so the range is
 * not inflated by body fat. Not offered for kidney disease, pregnancy or eating-disorder
 * history, where a clinician must set intake.
 */
export function proteinGuidance(p: Profile): ProteinGuidance | null {
  if (p.conditions.some((c) => ["kidney", "pregnant", "eating-disorder"].includes(c))) return null;
  const ref = Math.min(p.weight, 27 * (p.height / 100) ** 2);
  const glp1 = !!p.glp1 || /glp-?1|semaglutide|tirzepatide|ozempic|wegovy|mounjaro|zepbound/i.test(p.medicines);
  const [lo, hi] = p.age >= 65 || glp1 ? [1.0, 1.2] : p.experience === "experienced" ? [1.4, 1.8] : [1.2, 1.6];
  return {
    low: Math.round(ref * lo), high: Math.round(ref * hi), perKg: `${lo}–${hi} g per kg`,
    reason: glp1
      ? "On a GLP-1 medicine, eating enough protein and strength training help you keep muscle while you lose weight."
      : p.age >= 65 ? "After 65 your muscles need more protein to stay strong." : "Enough protein helps you build and keep muscle when you train.",
  };
}

/**
 * Adaptive TDEE (MacroFactor-style): average logged intake minus the energy implied by the
 * weight trend. Needs ≥14 days with ≥10 logged days and two weigh-ins ≥10 days apart.
 */
export function adaptiveTdee(s: State, now = new Date()): { tdee: number; days: number } | null {
  const from = new Date(now.getTime() - 28 * 864e5);
  const weights = s.readings.filter((r) => r.kind === "weight" && new Date(r.at) >= from).sort((a, b) => a.at.localeCompare(b.at));
  if (weights.length < 2) return null;
  const first = weights[0], last = weights[weights.length - 1];
  const span = (new Date(last.at).getTime() - new Date(first.at).getTime()) / 864e5;
  if (span < 10) return null;
  const perDay = new Map<string, number>();
  for (const m of s.meals) if (new Date(m.at) >= new Date(first.at) && new Date(m.at) <= new Date(last.at))
    perDay.set(localDay(m.at), (perDay.get(localDay(m.at)) || 0) + m.calories);
  const logged = [...perDay.values()].filter((v) => v >= 800);
  if (logged.length < 10) return null;
  const intake = logged.reduce((a, b) => a + b, 0) / logged.length;
  const kgChange = (last.unit === "lb" ? 0.4536 : 1) * (last.value - first.value);
  const tdee = Math.round(intake - (kgChange * 7700) / span);
  return tdee > 1000 && tdee < 5000 ? { tdee, days: Math.round(span) } : null;
}
