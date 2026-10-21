import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CA_REFERENCE_VALUES,
  GB_REFERENCE_VALUES,
  GB_SALT_REFERENCE_INTAKE,
  US_ADDED_SUGARS_DAILY_VALUE,
  US_REFERENCE_VALUES,
  missingFor,
  percentDailyValue,
  referenceValueFor,
  type Market,
} from "../research/reference-values";
import { nutrientInfo } from "../src/core/foods";

// M2-1 preparation, read-only. The reference tables are specified and tested
// here. Nothing in this file is enabled in the app, and no personal target is
// touched.

test("the United States table reproduces the values the app uses today", () => {
  // This is the guarantee that enabling the tables changes nothing for a US
  // user: the research table and the app's own nutrient table must agree
  // exactly, including the nutrients the app deliberately leaves out.
  for (const [key, info] of Object.entries(nutrientInfo)) {
    const research = US_REFERENCE_VALUES.values[key as keyof typeof US_REFERENCE_VALUES.values];
    if (info.dv === undefined) {
      assert.equal(research, undefined, `${key} must stay without a Daily Value`);
    } else {
      assert.ok(research, `${key} is missing from the research table`);
      assert.equal(research!.value, info.dv, `${key}`);
      // The app writes the basis into the unit ("mcg DFE", "mcg RAE"); the
      // research table keeps the base unit and records the basis separately.
      assert.ok(
        info.unit.startsWith(research!.unit),
        `${key} unit ${info.unit} is not built on ${research!.unit}`,
      );
    }
  }
  // The two bases the app writes into its unit strings are recorded explicitly.
  assert.match(US_REFERENCE_VALUES.values.folate!.basis!, /folate equivalents/);
  assert.match(US_REFERENCE_VALUES.values.vitaminA!.basis!, /retinol activity equivalents/);
  // And the app has no Daily Value for total sugars, which stays true.
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
  assert.equal(referenceValueFor("US", "sugar"), undefined);
  assert.equal(percentDailyValue("US", "sugar", 30), undefined);
});

test("Canada uses the adult columns, including the corrected potassium", () => {
  assert.equal(CA_REFERENCE_VALUES.values.potassium?.value, 3400);
  assert.equal(CA_REFERENCE_VALUES.values.potassium?.scope, "adults-or-other");
  assert.equal(CA_REFERENCE_VALUES.values.fat?.value, 75);
  assert.equal(CA_REFERENCE_VALUES.values.fibre?.value, 28);
  assert.equal(CA_REFERENCE_VALUES.values.sugar?.value, 100);
  assert.equal(CA_REFERENCE_VALUES.values.sodium?.value, 2300);
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
  assert.equal(referenceValueFor("GB", "sodium"), undefined);
  assert.equal(percentDailyValue("GB", "sodium", 500), undefined);
  // And the salt figure must never be registered as a sodium value.
  assert.ok(!("sodium" in GB_REFERENCE_VALUES.values));
  assert.match(GB_SALT_REFERENCE_INTAKE.basis!, /salt/);
});

test("the United Kingdom annex has no cholesterol and no fibre value", () => {
  // Neither is in Annex XIII, and neither may be borrowed from another market.
  assert.equal(GB_REFERENCE_VALUES.values.cholesterol, undefined);
  assert.equal(GB_REFERENCE_VALUES.values.fibre, undefined);
  assert.equal(referenceValueFor("GB", "cholesterol"), undefined);
  assert.equal(referenceValueFor("GB", "fibre"), undefined);
});

test("folate records the basis it is measured on", () => {
  const us = US_REFERENCE_VALUES.values.folate!;
  const ca = CA_REFERENCE_VALUES.values.folate!;
  const gb = GB_REFERENCE_VALUES.values.folate!;
  assert.equal(us.value, 400);
  assert.match(us.basis!, /folate equivalents/);
  assert.equal(ca.value, 400);
  assert.match(ca.basis!, /folate equivalents/);
  // The UK value is folic acid, which is a different quantity.
  assert.equal(gb.value, 200);
  assert.match(gb.basis!, /folic acid/);
  assert.notEqual(gb.basis, us.basis);
});

test("a market never borrows another market's value", () => {
  // The bug this app has today: the United States Daily Values are shown to
  // Canadian and British users.
  assert.equal(referenceValueFor("CA", "potassium")?.value, 3400);
  assert.notEqual(referenceValueFor("CA", "potassium")?.value, 4700);
  assert.equal(referenceValueFor("GB", "vitaminD")?.value, 5);
  assert.notEqual(referenceValueFor("GB", "vitaminD")?.value, 20);
  // A nutrient with no value in a market has no value, not another country's.
  assert.equal(referenceValueFor("CA", "protein"), undefined);
  assert.equal(referenceValueFor("CA", "carbs"), undefined);
  assert.equal(referenceValueFor("US", "calories"), undefined);
  // An unknown market has nothing at all.
  assert.equal(referenceValueFor(undefined, "protein"), undefined);
  assert.equal(referenceValueFor("ZZ" as Market, "protein"), undefined);
});

test("a missing reference value produces no percentage", () => {
  assert.equal(percentDailyValue("US", "protein", 25), 50);
  assert.equal(percentDailyValue("CA", "potassium", 1700), 50);
  assert.equal(percentDailyValue("GB", "vitaminD", 2.5), 50);
  // No value, no number.
  assert.equal(percentDailyValue("US", "sugar", 30), undefined);
  assert.equal(percentDailyValue("GB", "sodium", 500), undefined);
  assert.equal(percentDailyValue("CA", "protein", 30), undefined);
  // No amount, no number.
  assert.equal(percentDailyValue("US", "protein", undefined), undefined);
  assert.equal(percentDailyValue("US", "protein", Number.NaN), undefined);
});

test("the missing values for each market are known", () => {
  assert.ok(missingFor("GB").includes("sodium"));
  assert.ok(missingFor("GB").includes("cholesterol"));
  assert.ok(missingFor("GB").includes("fibre"));
  assert.ok(missingFor("CA").includes("protein"));
  assert.ok(missingFor("US").includes("sugar"));
  // Every market publishes a value for the macronutrients the app shows.
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
