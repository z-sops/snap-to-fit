import { test } from "node:test";
import assert from "node:assert/strict";
import { cmToFtIn, ftInToCm, heightOptions, heightToCm, cmToHeightValue, kgToWeightValue, weightToKg, weightOptions, formatWeight, formatHeight } from "../src/core/units";
import { newProfile, validateProfile } from "../src/core/model";

test("imperial height and weight round-trip into stored metric values", () => {
  assert.deepEqual(cmToFtIn(170), { ft: 5, inch: 7 });
  assert.equal(ftInToCm(5, 7), 170.2);
  assert.equal(heightToCm(67, "imperial"), 170.2);
  assert.equal(cmToHeightValue(170.2, "imperial"), 67);
  assert.equal(weightToKg(180, "imperial"), 81.6);
  assert.equal(kgToWeightValue(81.6, "imperial"), 180);
  assert.equal(kgToWeightValue(81.6, "metric"), 82);
  assert.equal(formatWeight(81.6, "imperial"), "180 lb");
  assert.equal(formatHeight(170.2, "imperial"), "5 ft 7 in");
});

test("wheel ranges stay inside the profile validation limits", () => {
  for (const u of ["imperial", "metric"] as const) {
    const h = heightOptions(u).map((o) => heightToCm(o.value, u));
    const w = weightOptions(u).map((o) => weightToKg(o.value, u));
    assert.ok(Math.min(...h) >= 100 && Math.max(...h) <= 230, `${u} height`);
    assert.ok(Math.min(...w) >= 30 && Math.max(...w) <= 350, `${u} weight`);
  }
});

test("profile accepts units and a recorded GLP-1, rejects invalid values", () => {
  const ok = { ...newProfile, name: "Zee", age: 34, height: 175, weight: 82, targetWeight: 76, goal: "lose" as const, consent: true, units: "imperial" as const, glp1: "Zepbound (tirzepatide)" };
  validateProfile(ok);
  assert.throws(() => validateProfile({ ...ok, units: "stone" as never }), /unit/);
  assert.throws(() => validateProfile({ ...ok, glp1: "x".repeat(81) }), /medication/);
});
