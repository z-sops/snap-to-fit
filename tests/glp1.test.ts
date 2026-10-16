import { test } from "node:test";
import assert from "node:assert/strict";
import { nextSite, nextScheduled, sideEffectAlerts, doctorSummary, isGlp1Name, glp1Week } from "../src/core/glp1";
import { emptyState, newProfile, type Medicine, type DoseLog } from "../src/core/model";

const med: Medicine = { id: "g", name: "Wegovy (semaglutide)", dose: "0.5 mg", kind: "injection", time: "09:00", nextDate: "2026-10-10", frequency: "weekly" };
const dose = (at: string, site?: string): DoseLog => ({ id: at, at, medicineId: "g", name: med.name, dose: med.dose, symptoms: "", site });

test("site rotation picks an unused site, then the least recently used", () => {
  assert.equal(nextSite([]), "abdomen-left");
  assert.equal(nextSite([dose("2026-10-01T09:00:00Z", "abdomen-left")]), "abdomen-right");
  const all = ["abdomen-left", "abdomen-right", "thigh-left", "thigh-right", "arm-left", "arm-right"].map((s, i) => dose(`2026-10-0${i + 1}T09:00:00Z`, s));
  assert.equal(nextSite(all), "abdomen-left");
});

test("weekly schedule rolls forward 7 days from the last logged dose, never backwards", () => {
  assert.equal(nextScheduled(med, [dose("2026-10-10T09:00:00Z")]), "2026-10-17");
  assert.equal(nextScheduled(med, []), "2026-10-10");
  assert.equal(nextScheduled({ ...med, frequency: "daily" }, [dose("2026-10-10T09:00:00Z")]), "2026-10-10");
});

test("label-based alerts never give dosing or stop instructions", () => {
  const a = sideEffectAlerts({ "stomach-pain": 3, vomiting: 2 });
  assert.equal(a[0].level, "urgent");
  assert.match(a[0].text, /Call your doctor/);
  for (const x of a) assert.doesNotMatch(x.text, /\b(stop|skip|reduce|increase|lower|taper)\b.*\b(dose|medicine|injection)/i);
  assert.equal(sideEffectAlerts({ nausea: 1 }).length, 0);
});

test("doctor summary lists medicines, doses with sites and worst side effects", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const s = { ...emptyState, profile: { ...newProfile, name: "Sam" }, medicines: [med], doses: [dose("2026-10-15T09:00:00Z", "thigh-left")],
    glp1Checkins: [{ id: "c", at: "2026-10-16T09:00:00Z", effects: { nausea: 2 } }] };
  const text = doctorSummary(s, now);
  assert.match(text, /Wegovy \(semaglutide\) — 0.5 mg, weekly/);
  assert.match(text, /site: Thigh · left/);
  assert.match(text, /Nausea: Moderate/);
  assert.equal(isGlp1Name("Zepbound (tirzepatide)"), true);
  assert.equal(glp1Week(s, now).doses, 1);
});
