import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CA_REFERENCE_VALUES,
  CA_SATURATED_PLUS_TRANS_DAILY_VALUE,
  GB_FOLIC_ACID_REFERENCE_INTAKE,
  GB_REFERENCE_VALUES,
  GB_SALT_REFERENCE_INTAKE,
  US_ADDED_SUGARS_DAILY_VALUE,
  US_REFERENCE_VALUES,
  missingFor,
  resolvePercent,
  resolveReference,
  type Market,
} from "../src/core/reference-values";
import { nutrientInfo } from "../src/core/foods";

// The reference-value tables, and the rules that keep them honest.
//
// A reference value here is a labelling denominator. It is never an
// individual dietary requirement, and the app's personalised targets are not
// touched by anything in this file.

test("the United States table reproduces the values the app uses today", () => {
  // This is the guarantee that using these tables changes nothing for a United
  // States user: the research table and the app's own nutrient table must
  // agree exactly, including the nutrients the app deliberately leaves out.
  for (const [key, info] of Object.entries(nutrientInfo)) {
    const research = US_REFERENCE_VALUES.values[key as keyof typeof US_REFERENCE_VALUES.values];
    if (info.dv === undefined) {
      assert.equal(research, undefined, `${key} must stay without a Daily Value`);
    } else {
      assert.ok(research, `${key} is missing from the research table`);
      assert.equal(research!.value, info.dv, `${key}`);
      // The app writes the basis into the unit ("mcg DFE", "mcg RAE"); the
      // table keeps the base unit and records the basis separately.
      assert.ok(
        info.unit.startsWith(research!.unit),
        `${key} unit ${info.unit} is not built on ${research!.unit}`,
      );
    }
  }
  // The two bases the app writes into its unit strings are recorded explicitly.
  assert.match(US_REFERENCE_VALUES.values.folate!.basis!, /folate equivalents/);
  assert.match(US_REFERENCE_VALUES.values.vitaminA!.basis!, /retinol activity equivalents/);
  // The app has no Daily Value for total sugars, which stays true.
  assert.equal(nutrientInfo.sugar.dv, undefined);
  assert.equal(US_REFERENCE_VALUES.values.sugar, undefined);
  assert.equal(US_REFERENCE_VALUES.values.calories, undefined);
});

test("the added sugars Daily Value is never used for total sugars", () => {
  // The FDA states there is no Daily Value for total sugars, and that the
  // Daily Value for added sugars is 50 g. The app's key is TOTAL sugars, so
  // the added-sugars value must not be substituted for it.
  assert.equal(US_ADDED_SUGARS_DAILY_VALUE.value, 50);
  assert.equal(US_REFERENCE_VALUES.values.sugar, undefined);
  assert.equal(CA_REFERENCE_VALUES.values.sugar?.value, 100);
  assert.equal(CA_REFERENCE_VALUES.values.sugar?.basis, "total sugars");
  // A missing value must not fall back to the added-sugars figure.
  assert.equal(resolveReference("US", "sugar").status, "no-value");
  assert.equal(resolvePercent("US", "sugar", 30).percent, undefined);
});

test("Canada uses the adult columns, including the corrected potassium", () => {
  assert.equal(CA_REFERENCE_VALUES.values.potassium?.value, 3400);
  assert.equal(CA_REFERENCE_VALUES.values.potassium?.scope, "adults-or-other");
  assert.equal(CA_REFERENCE_VALUES.values.fat?.value, 75);
  assert.equal(CA_REFERENCE_VALUES.values.fibre?.value, 28);
  assert.equal(CA_REFERENCE_VALUES.values.sugar?.value, 100);
  assert.equal(CA_REFERENCE_VALUES.values.sodium?.value, 2300);
});

test("Canada's saturated fat percentage is unavailable, not a substitution", () => {
  // Canada's 20 g labelling Daily Value is for the SUM of saturated and trans
  // fatty acids. The app's satFat is saturated fat on its own, so dividing it
  // by that denominator would report a percentage of the wrong quantity. The
  // Canadian saturated-fat percentage is therefore unavailable.
  assert.equal(CA_REFERENCE_VALUES.values.satFat, undefined);
  assert.equal(resolveReference("CA", "satFat").status, "not-enabled");
  assert.equal(resolvePercent("CA", "satFat", 10).percent, undefined);
  // The combined value is kept separately, and is never a saturated-fat
  // denominator.
  assert.equal(CA_SATURATED_PLUS_TRANS_DAILY_VALUE.value, 20);
  assert.match(CA_SATURATED_PLUS_TRANS_DAILY_VALUE.basis!, /sum of saturated and trans/);
  assert.notEqual(
    CA_SATURATED_PLUS_TRANS_DAILY_VALUE.basis,
    US_REFERENCE_VALUES.values.satFat?.basis,
  );
});

test("the United States saturated fat value is for saturated fat", () => {
  // The FDA's 20 g Daily Value is for saturated fat, which is the quantity
  // the app holds.
  assert.equal(US_REFERENCE_VALUES.values.satFat?.value, 20);
  assert.equal(US_REFERENCE_VALUES.values.satFat?.basis, "saturated fat");
  assert.ok(!/trans/.test(US_REFERENCE_VALUES.values.satFat!.basis!));
  // And the United States does produce a saturated-fat percentage.
  assert.equal(resolvePercent("US", "satFat", 10).percent, 50);
});

test("the United Kingdom uses the adult annex values", () => {
  assert.equal(GB_REFERENCE_VALUES.values.vitaminD?.value, 5);
  assert.equal(GB_REFERENCE_VALUES.values.vitaminD?.scope, "adults");
  assert.equal(GB_REFERENCE_VALUES.values.calcium?.value, 800);
  assert.equal(GB_REFERENCE_VALUES.values.potassium?.value, 2000);
  assert.equal(GB_REFERENCE_VALUES.values.iron?.value, 14);
  assert.equal(GB_REFERENCE_VALUES.values.magnesium?.value, 375);
  assert.equal(GB_REFERENCE_VALUES.values.zinc?.value, 10);
  assert.equal(GB_REFERENCE_VALUES.values.fat?.value, 70);
  assert.equal(GB_REFERENCE_VALUES.values.carbs?.value, 260);
  assert.equal(GB_REFERENCE_VALUES.values.sugar?.value, 90);
  assert.equal(GB_REFERENCE_VALUES.values.protein?.value, 50);
});

test("the United Kingdom sets salt, not sodium, and salt is not sodium", () => {
  assert.equal(GB_SALT_REFERENCE_INTAKE.value, 6);
  assert.equal(GB_SALT_REFERENCE_INTAKE.unit, "g");
  // The annex has no sodium value, so the app's sodium key has none either.
  assert.equal(GB_REFERENCE_VALUES.values.sodium, undefined);
  assert.equal(resolveReference("GB", "sodium").status, "not-enabled");
  assert.equal(resolvePercent("GB", "sodium", 500).percent, undefined);
  // And the salt figure must never be registered as a sodium value.
  assert.ok(!("sodium" in GB_REFERENCE_VALUES.values));
  assert.match(GB_SALT_REFERENCE_INTAKE.basis!, /salt/);
});

test("the United Kingdom folic acid value is not used for dietary folate equivalents", () => {
  // The app's folate key is dietary folate equivalents. Annex XIII's folate
  // value is folic acid, a different quantity, so it must not be applied
  // without an explicitly verified compatible basis.
  assert.equal(GB_REFERENCE_VALUES.values.folate, undefined);
  assert.equal(resolveReference("GB", "folate").status, "not-enabled");
  assert.equal(resolvePercent("GB", "folate", 200).percent, undefined);
  // It is recorded separately, with its basis stated.
  assert.equal(GB_FOLIC_ACID_REFERENCE_INTAKE.value, 200);
  assert.match(GB_FOLIC_ACID_REFERENCE_INTAKE.basis!, /folic acid/);
  assert.notEqual(GB_FOLIC_ACID_REFERENCE_INTAKE.basis, US_REFERENCE_VALUES.values.folate?.basis);
});

test("the United Kingdom annex has no cholesterol and no fibre value", () => {
  // Neither is in Annex XIII, and neither may be borrowed from another market.
  assert.equal(GB_REFERENCE_VALUES.values.cholesterol, undefined);
  assert.equal(GB_REFERENCE_VALUES.values.fibre, undefined);
  assert.equal(resolveReference("GB", "cholesterol").status, "not-enabled");
  assert.equal(resolveReference("GB", "fibre").status, "not-enabled");
});

test("folate records the basis it is measured on", () => {
  const us = US_REFERENCE_VALUES.values.folate!;
  const ca = CA_REFERENCE_VALUES.values.folate!;
  assert.equal(us.value, 400);
  assert.match(us.basis!, /folate equivalents/);
  assert.equal(ca.value, 400);
  assert.match(ca.basis!, /folate equivalents/);
});

test("the missing values for each market are known", () => {
  assert.ok(missingFor("GB").includes("sodium"));
  assert.ok(missingFor("GB").includes("cholesterol"));
  assert.ok(missingFor("GB").includes("fibre"));
  assert.ok(missingFor("GB").includes("folate"));
  assert.ok(missingFor("CA").includes("protein"));
  // Canada's saturated-fat DV measures a different quantity, so there is none.
  assert.ok(missingFor("CA").includes("satFat"));
  assert.ok(missingFor("US").includes("sugar"));
  for (const market of ["US", "CA", "GB"] as Market[]) {
    assert.ok(!missingFor(market).includes("calories") || market === "US" || market === "CA");
  }
});

test("no table is marked approved before review", () => {
  for (const table of [US_REFERENCE_VALUES, CA_REFERENCE_VALUES, GB_REFERENCE_VALUES]) {
    assert.equal(table.approved, false, `${table.market} must not be enabled before review`);
    assert.ok(table.source.length > 0);
    assert.ok(table.sourceUrl.startsWith("https://"));
    assert.ok(table.reviewed.length > 0);
  }
});

test("every value carries a unit and a scope", () => {
  for (const table of [US_REFERENCE_VALUES, CA_REFERENCE_VALUES, GB_REFERENCE_VALUES])
    for (const [key, value] of Object.entries(table.values)) {
      assert.ok(value, key);
      assert.ok(["g", "mg", "mcg", "kcal"].includes(value!.unit), `${key} unit`);
      assert.ok(value!.scope.length > 0, `${key} scope`);
      assert.ok(value!.value > 0, `${key} value`);
    }
});

