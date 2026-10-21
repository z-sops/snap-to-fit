// GLP-1 companion: record-keeping only. The app copies what the prescription says,
// rotates injection sites as the Medication Guides instruct, logs side effects and points
// to the doctor for any treatment decision. It never suggests a dose, a change, a pause,
// stopping or tapering.
import type { DoseLog, Medicine, State } from "./model";

// Brand names as printed on US prescriptions. Recorded only; the app never advises on dosing.
export const glp1Choices = [
  "Ozempic (semaglutide)",
  "Wegovy (semaglutide)",
  "Rybelsus / Wegovy pill (oral semaglutide)",
  "Mounjaro (tirzepatide)",
  "Zepbound (tirzepatide)",
  "Saxenda / Victoza (liraglutide)",
  "Trulicity (dulaglutide)",
  "Other GLP-1 medication",
];

export const isGlp1Name = (name: string) =>
  /glp-?1|semaglutide|tirzepatide|liraglutide|dulaglutide|ozempic|wegovy|rybelsus|mounjaro|zepbound|saxenda|victoza|trulicity/i.test(name);

export type InjectionSite = "abdomen-left" | "abdomen-right" | "thigh-left" | "thigh-right" | "arm-left" | "arm-right";
export const injectionSites: { id: InjectionSite; label: string }[] = [
  { id: "abdomen-left", label: "Stomach · left" },
  { id: "abdomen-right", label: "Stomach · right" },
  { id: "thigh-left", label: "Thigh · left" },
  { id: "thigh-right", label: "Thigh · right" },
  { id: "arm-left", label: "Upper arm · left" },
  { id: "arm-right", label: "Upper arm · right" },
];

/** Least-recently-used site for the next injection (the labels say to rotate sites each time). */
export function nextSite(doses: DoseLog[], medicineId?: string): InjectionSite {
  const used = new Map<string, string>();
  for (const d of doses) if (d.site && (!medicineId || d.medicineId === medicineId)) {
    const prev = used.get(d.site);
    if (!prev || d.at > prev) used.set(d.site, d.at);
  }
  const never = injectionSites.find((s) => !used.has(s.id));
  if (never) return never.id;
  return [...used.entries()].sort((a, b) => a[1].localeCompare(b[1]))[0][0] as InjectionSite;
}

/** The user's own schedule rolled forward (weekly = +7 days from the last logged dose). */
export function nextScheduled(m: Medicine, doses: DoseLog[]): string {
  const last = doses.filter((d) => d.medicineId === m.id).sort((a, b) => b.at.localeCompare(a.at))[0];
  if (!last || m.frequency !== "weekly") return m.nextDate;
  const d = new Date(last.at);
  d.setDate(d.getDate() + 7);
  const key = d.toISOString().slice(0, 10);
  return key > m.nextDate ? key : m.nextDate;
}

export function daysUntil(date: string, now = new Date()) {
  const a = new Date(`${date}T12:00:00`).getTime();
  const b = new Date(now.toISOString().slice(0, 10) + "T12:00:00").getTime();
  return Math.round((a - b) / 864e5);
}

export const sideEffects = [
  { id: "nausea", label: "Nausea", emoji: "🤢" },
  { id: "vomiting", label: "Vomiting", emoji: "🤮" },
  { id: "diarrhea", label: "Diarrhea", emoji: "🚽" },
  { id: "constipation", label: "Constipation", emoji: "🧱" },
  { id: "stomach-pain", label: "Stomach pain", emoji: "😣" },
  { id: "heartburn", label: "Heartburn / burping", emoji: "🔥" },
  { id: "fatigue", label: "Tiredness", emoji: "😴" },
  { id: "dizziness", label: "Dizziness", emoji: "💫" },
  { id: "low-appetite", label: "Very low appetite", emoji: "🍽️" },
  { id: "hair", label: "Hair shedding", emoji: "💇" },
  { id: "site", label: "Injection-site reaction", emoji: "📍" },
] as const;
export type SideEffectId = (typeof sideEffects)[number]["id"];
export const severityLabels = ["None", "Mild", "Moderate", "Severe"];

/** Label-based prompts: when what the user logged means they should contact a clinician. */
export function sideEffectAlerts(effects: Partial<Record<SideEffectId, number>>, onInsulinOrSU = false): { level: "urgent" | "call"; text: string }[] {
  const out: { level: "urgent" | "call"; text: string }[] = [];
  if ((effects["stomach-pain"] || 0) >= 3)
    out.push({ level: "urgent", text: "Severe stomach pain that won’t go away (with or without vomiting) can be a sign of pancreatitis. Call your doctor right away; your Medication Guide explains what to do." });
  if ((effects.vomiting || 0) >= 2 || (effects.diarrhea || 0) >= 2)
    out.push({ level: "call", text: "Ongoing vomiting or diarrhea can dehydrate you, which can harm your kidneys. Sip fluids and tell your doctor." });
  if ((effects.dizziness || 0) >= 2 && onInsulinOrSU)
    out.push({ level: "call", text: "Dizziness with insulin or a sulfonylurea can mean low blood sugar. Check your glucose and follow your low-glucose plan." });
  if ((effects["low-appetite"] || 0) >= 3)
    out.push({ level: "call", text: "Eating very little makes it hard to get enough protein and nutrients. Tell your doctor or dietitian." });
  return out;
}

/** Always-visible "call your doctor / get help" list from the US Medication Guides. */
export const labelWarnings = [
  "Lump or swelling in your neck, hoarseness, trouble swallowing or shortness of breath (thyroid).",
  "Severe stomach pain that won’t go away, with or without vomiting (pancreas).",
  "Pain in your upper right stomach, fever, yellow skin or eyes, or clay-colored stools (gallbladder).",
  "Swelling of your face, lips, tongue or throat, trouble breathing, or a severe rash — call your local emergency number (911 in the US and Canada, 999 in the UK).",
  "Vision changes, if you have diabetes.",
  "A racing heartbeat at rest.",
  "Low blood sugar signs if you also take insulin or a sulfonylurea: shakiness, sweating, confusion.",
];

export interface Glp1Week { doses: number; sites: string[]; checkins: number; worst: { id: string; label: string; severity: number }[] }
export function glp1Week(s: State, now = new Date()): Glp1Week {
  const from = new Date(now.getTime() - 7 * 864e5).toISOString();
  const doses = s.doses.filter((d) => d.at >= from && isGlp1Name(d.name));
  const checkins = (s.glp1Checkins || []).filter((c) => c.at >= from);
  const worstMap = new Map<string, number>();
  for (const c of checkins) for (const [k, v] of Object.entries(c.effects)) worstMap.set(k, Math.max(worstMap.get(k) || 0, v || 0));
  const worst = [...worstMap.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
    .map(([id, severity]) => ({ id, severity, label: sideEffects.find((x) => x.id === id)?.label || id }));
  return { doses: doses.length, sites: doses.map((d) => d.site || "").filter(Boolean), checkins: checkins.length, worst };
}

/** Plain-text summary the user can share with their doctor. */
export function doctorSummary(s: State, now = new Date()): string {
  const from = new Date(now.getTime() - 30 * 864e5).toISOString();
  const doses = s.doses.filter((d) => d.at >= from).sort((a, b) => a.at.localeCompare(b.at));
  const weights = s.readings.filter((r) => r.kind === "weight" && r.at >= from).sort((a, b) => a.at.localeCompare(b.at));
  const checkins = (s.glp1Checkins || []).filter((c) => c.at >= from);
  const lines = [
    `Snap to Fit — 30-day summary for ${s.profile?.name || "me"} (${now.toLocaleDateString()})`,
    "",
    "Medicines as I entered them from my prescription:",
    ...s.medicines.map((m) => `• ${m.name} — ${m.dose}${m.frequency ? `, ${m.frequency}` : ""}`),
    "",
    `Doses logged (${doses.length}):`,
    ...doses.map((d) => `• ${new Date(d.at).toLocaleDateString()} ${d.name} ${d.dose}${d.site ? ` · site: ${injectionSites.find((x) => x.id === d.site)?.label}` : ""}${d.symptoms ? ` · note: ${d.symptoms}` : ""}`),
  ];
  if (weights.length >= 2) lines.push("", `Weight: ${weights[0].value} → ${weights[weights.length - 1].value} kg (${weights.length} weigh-ins)`);
  if (checkins.length) {
    const worst = new Map<string, number>();
    for (const c of checkins) for (const [k, v] of Object.entries(c.effects)) worst.set(k, Math.max(worst.get(k) || 0, v || 0));
    lines.push("", `Side effects (${checkins.length} check-ins, worst severity):`);
    for (const [k, v] of worst) if (v > 0) lines.push(`• ${sideEffects.find((x) => x.id === k)?.label || k}: ${severityLabels[v]}`);
  }
  lines.push("", "Questions for my doctor:", "• ", "", "This is my own log, not medical advice.");
  return lines.join("\n");
}
