import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emergencyInstruction,
  emergencyNumber,
  emergencyService,
  formatDate,
  formatDateTime,
  formatDayMonth,
  formatNumber,
  formatTime,
  regionFor,
  regionalLocale,
  speechLocales,
  weightDisplayOptions,
} from "../src/core/locale";
import {
  formatWeight,
  heightToCm,
  KG_PER_LB,
  kgToStone,
  kgToWeightValue,
  lbToStone,
  loadToKg,
  loadUnitFor,
  presentationFor,
  stoneParts,
  stoneToKg,
  stoneToLb,
  weightDisplayFor,
  weightOptions,
  weightToKg,
} from "../src/core/units";
import { localDay, newProfile, validateProfile } from "../src/core/model";
import { todayTotals } from "../src/core/nutrition";
import { defaultUnits } from "../src/core/regions";

/** Runs a check with a fixed IANA time zone so local-day results are deterministic. */
function inTimeZone(zone: string, run: () => void) {
  const before = process.env.TZ;
  process.env.TZ = zone;
  try {
    run();
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
}

test("the market comes from the chosen country, not from the app language", () => {
  assert.equal(regionFor("US"), "US");
  assert.equal(regionFor("CA"), "CA");
  assert.equal(regionFor("GB"), "GB");
  assert.equal(regionFor("gb"), "GB");
  assert.equal(regionFor("  ca "), "CA");
  assert.equal(regionFor("DE"), "INTL");
  assert.equal(regionFor(undefined), "INTL");
  assert.equal(regionFor(""), "INTL");
  // English in Canada and English in the US are different markets.
  assert.equal(regionalLocale(regionFor("CA")), "en-CA");
  assert.equal(regionalLocale(regionFor("GB")), "en-GB");
  assert.equal(regionalLocale(regionFor("US")), "en-US");
});

test("each market writes dates, times and numbers its own way", () => {
  const d = new Date(2026, 9, 21, 13, 5);
  assert.equal(formatDate(d, "US"), "10/21/2026");
  assert.equal(formatDate(d, "CA"), "2026-10-21");
  assert.equal(formatDate(d, "GB"), "21/10/2026");
  assert.equal(formatTime(d, "US"), "1:05 PM");
  assert.equal(formatTime(d, "CA"), "1:05 PM");
  assert.equal(formatTime(d, "GB"), "13:05");
  assert.equal(formatNumber(1234567.5, "US"), "1,234,567.5");
  assert.equal(formatNumber(1234567.5, "CA"), "1,234,567.5");
  assert.equal(formatNumber(1234567.5, "GB"), "1,234,567.5");
  assert.equal(formatNumber(-1234.5, "US"), "-1,234.5");
  assert.equal(formatNumber(0, "US"), "0");
});

test("emergency wording uses the number of the market the user is in", () => {
  assert.equal(emergencyNumber("US"), "911");
  assert.equal(emergencyNumber("CA"), "911");
  assert.equal(emergencyNumber("GB"), "999");
});

test("a spoken voice falls back when the exact region voice is missing", () => {
  assert.deepEqual(speechLocales("GB")[0], "en-GB");
  assert.ok(speechLocales("GB").includes("en"));
  assert.ok(speechLocales("CA").includes("en"));
  assert.ok(speechLocales("US").includes("en"));
});

test("each market offers the weight units people actually use", () => {
  assert.deepEqual(weightDisplayOptions("US"), ["lb", "kg"]);
  assert.deepEqual(weightDisplayOptions("CA"), ["kg", "lb"]);
  assert.deepEqual(weightDisplayOptions("GB"), ["kg", "st", "lb"]);
  // The unit system a market starts with; the user's own choice always wins.
  assert.equal(defaultUnits("US"), "imperial");
  assert.equal(defaultUnits("CA"), "metric");
  assert.equal(defaultUnits("GB"), "metric");
});

test("stone and pounds convert to and from kilograms without losing the value", () => {
  assert.equal(stoneToLb(1), 14);
  assert.equal(lbToStone(14), 1);
  assert.ok(Math.abs(kgToStone(72.5) - 72.5 / 6.35029318) < 1e-9);
  // 11 st 2 lb is 156 lb.
  assert.deepEqual(stoneParts(156 * KG_PER_LB), { stone: 11, pounds: 2 });
  // A whole stone shows without a pounds part.
  assert.deepEqual(stoneParts(14 * KG_PER_LB), { stone: 1, pounds: 0 });
  assert.equal(stoneToKg(11), 11 * 6.35029318);
  assert.equal(kgToStone(6.35029318), 1);
});

test("repeated conversion cycles settle instead of drifting", () => {
  // kg â†’ displayed pounds â†’ kg. The second cycle must return the same value as
  // the first, and the drift from the original stays inside half a pound.
  const original = 72.5;
  const first = weightToKg(kgToWeightValue(original, "imperial"), "imperial");
  const second = weightToKg(kgToWeightValue(first, "imperial"), "imperial");
  assert.equal(second, first);
  assert.ok(Math.abs(first - original) <= 0.11, `drifted to ${first}`);

  // The same for the UK stone display, which is written in pounds.
  const stoneFirst = weightToKg(kgToWeightValue(original, "metric", "st"), "metric", "st");
  const stoneSecond = weightToKg(kgToWeightValue(stoneFirst, "metric", "st"), "metric", "st");
  assert.equal(stoneSecond, stoneFirst);
  assert.ok(Math.abs(stoneFirst - original) <= 0.11);
});

test("stone display shows stone and pounds, and accepts pounds back", () => {
  const kg = stoneToKg(11) + 2 * KG_PER_LB;
  assert.equal(formatWeight(kg, "metric", "st"), "11 st 2 lb");
  assert.equal(formatWeight(stoneToKg(11), "metric", "st"), "11 st");
  assert.equal(formatWeight(kg, "metric", "lb"), "156 lb");
  assert.equal(formatWeight(kg, "metric", "kg"), "70.8 kg");
  // The wheel works in pounds and labels them the UK way.
  const option = weightOptions("metric", "st").find((o) => o.value === 156);
  assert.equal(option?.label, "11 st 2 lb");
});

test("old saved profiles still work and still show what they showed before", () => {
  // A profile saved before the weight display existed.
  const legacy = { ...newProfile, units: "imperial" as const, weight: 72.5, height: 170, name: "Ana", age: 34, targetWeight: 70, consent: true };
  assert.equal(weightDisplayFor(legacy), "lb");
  assert.equal(formatWeight(legacy.weight, legacy.units), "160 lb");
  assert.doesNotThrow(() => validateProfile(legacy));

  const legacyMetric = { ...legacy, units: "metric" as const };
  assert.equal(weightDisplayFor(legacyMetric), "kg");
  assert.equal(formatWeight(legacyMetric.weight, legacyMetric.units), "72.5 kg");
  assert.doesNotThrow(() => validateProfile(legacyMetric));
});

test("an invalid weight display is rejected instead of silently ignored", () => {
  const base = { ...newProfile, name: "Ana", age: 34, height: 170, weight: 72.5, targetWeight: 70, consent: true };
  assert.throws(() => validateProfile({ ...base, weightDisplay: "furlongs" as never }), /weight display/i);
  assert.doesNotThrow(() => validateProfile({ ...base, weightDisplay: "st" }));
});

test("changing the market or the units never rewrites the stored weight or height", () => {
  const profile = { ...newProfile, country: "US", units: "imperial" as const, weight: 72.5, height: 170 };
  const before = { weight: profile.weight, height: profile.height };
  const american = presentationFor(profile);
  const canadian = presentationFor({ ...profile, country: "CA" });
  const british = presentationFor({ ...profile, country: "GB", units: "metric", weightDisplay: "st" });
  // Same canonical values in every market.
  assert.equal(american.units, "imperial");
  assert.equal(canadian.units, "imperial", "a manual unit choice wins over the market default");
  assert.equal(british.weightDisplay, "st");
  assert.deepEqual({ weight: profile.weight, height: profile.height }, before);
  // The market changes the presentation, not the data.
  assert.notEqual(american.dateFormat, british.dateFormat);
  assert.equal(canadian.dateFormat, "2026-10-21");
});

test("a manual unit choice is never overwritten by the market default", () => {
  // A Canadian user who prefers pounds keeps pounds.
  const canadian = presentationFor({ country: "CA", units: "imperial", weightDisplay: "lb" });
  assert.equal(canadian.units, "imperial");
  assert.equal(canadian.weightDisplay, "lb");
  // A US user who prefers metric keeps metric.
  const american = presentationFor({ country: "US", units: "metric", weightDisplay: "kg" });
  assert.equal(american.units, "metric");
  assert.equal(american.weightDisplay, "kg");
});

test("unusual boundaries convert without producing nonsense", () => {
  assert.equal(formatWeight(0, "metric", "kg"), "0 kg");
  assert.equal(formatWeight(0, "metric", "st"), "0 st");
  assert.equal(formatWeight(6.35029318, "metric", "st"), "1 st");
  // Just under a stone rounds up to the next whole stone rather than 13 lb.
  assert.equal(formatWeight(6.3, "metric", "st"), "1 st");
  // The tallest and shortest allowed profiles convert cleanly.
  assert.equal(heightToCm(48, "imperial"), 121.9);
  assert.equal(heightToCm(90, "imperial"), 228.6);
  // The heaviest allowed profile in pounds stays inside the wheel.
  const heaviest = weightOptions("imperial").at(-1)!;
  assert.equal(heaviest.value, 771);
  assert.ok(weightToKg(heaviest.value, "imperial") <= 350);
});

test("the local day follows the local calendar across a daylight-saving change", () => {
  inTimeZone("America/New_York", () => {
    // Spring forward: 8 March 2026, clocks jump from 02:00 to 03:00.
    assert.equal(localDay("2026-03-08T04:59:00Z"), "2026-03-07");
    assert.equal(localDay("2026-03-08T05:00:00Z"), "2026-03-08");
    assert.equal(localDay("2026-03-08T06:59:00Z"), "2026-03-08");
    assert.equal(localDay("2026-03-08T07:00:00Z"), "2026-03-08");
    // The hour that does not exist locally is still placed on the right day.
    assert.equal(localDay(new Date(2026, 2, 8, 2, 30).toISOString()), "2026-03-08");
    // Fall back: 1 November 2026, clocks go from 02:00 back to 01:00.
    assert.equal(localDay("2026-11-01T03:59:00Z"), "2026-10-31");
    assert.equal(localDay("2026-11-01T04:00:00Z"), "2026-11-01");
    assert.equal(localDay("2026-11-01T05:30:00Z"), "2026-11-01");
    assert.equal(localDay("2026-11-01T06:30:00Z"), "2026-11-01");
  });
  inTimeZone("Europe/London", () => {
    // Spring forward: 29 March 2026, 01:00 becomes 02:00.
    assert.equal(localDay("2026-03-29T00:59:00Z"), "2026-03-29");
    assert.equal(localDay("2026-03-29T01:00:00Z"), "2026-03-29");
    // Fall back: 25 October 2026, 02:00 becomes 01:00.
    assert.equal(localDay("2026-10-25T00:59:00Z"), "2026-10-25");
    assert.equal(localDay("2026-10-25T01:30:00Z"), "2026-10-25");
  });
});

test("a meal is counted on the day the user actually ate it", () => {
  inTimeZone("America/New_York", () => {
    const meals = [
      { id: "a", at: "2026-03-08T04:30:00Z", name: "Late dinner", calories: 500, protein: 20, carbs: 40, fat: 20, fibre: 5, source: "quick" as const },
      { id: "b", at: "2026-03-08T12:00:00Z", name: "Lunch", calories: 600, protein: 25, carbs: 60, fat: 20, fibre: 8, source: "quick" as const },
    ];
    // 23:30 on 7 March locally is still the 7th, even though it is the 8th in UTC.
    const totalsFor7 = todayTotals(meals, new Date("2026-03-08T04:30:00Z"));
    assert.equal(totalsFor7.calories, 500);
    const totalsFor8 = todayTotals(meals, new Date("2026-03-08T12:00:00Z"));
    assert.equal(totalsFor8.calories, 600);
  });
});

test("exercise loads use their own unit, never a stone display", () => {
  // A British user who reads their body weight in stone still enters loads
  // in plain pounds, so a number in the load field means one thing only.
  const british = { country: "GB", units: "metric" as const, weightDisplay: "st" as const };
  assert.equal(loadUnitFor(british), "lb");
  assert.equal(loadUnitFor({ country: "US", units: "imperial" as const }), "lb");
  assert.equal(loadUnitFor({ country: "CA", units: "metric" as const }), "kg");
  // An explicit choice wins over everything else.
  assert.equal(loadUnitFor({ ...british, loadUnits: "metric" as const }), "kg");
  assert.equal(loadUnitFor({ country: "US", units: "imperial" as const, loadUnits: "metric" as const }), "kg");
  // A stone preference never produces a stone load.
  for (const display of ["kg", "lb", "st"] as const)
    assert.notEqual(loadUnitFor({ units: "metric", weightDisplay: display }), "st");
  // A load is stored in kilograms whatever unit it was entered in.
  assert.equal(loadToKg(100, "lb"), 45.4);
  assert.equal(loadToKg(100, "kg"), 100);
  // 100 pounds is nowhere near 100 stone.
  assert.ok(loadToKg(100, "lb") < 50);
});
