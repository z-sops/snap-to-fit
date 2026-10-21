import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CA_REFERENCE_VALUES,
  ENABLED_MARKETS,
  GB_REFERENCE_VALUES,
  marketForCountry,
  missingFor,
  resolvePercent,
  resolveReference,
  type Market,
} from "../src/core/reference-values";
import { nutrientInfo } from "../src/core/foods";
import { regionFor } from "../src/core/locale";

// M2-1: the regional reference-value resolver.
//
// A reference value is a labelling denominator, never a personal target, and
// never borrowed from another market.

test("the market follows the country the user chose", () => {
  assert.equal(marketForCountry("US"), "US");
  assert.equal(marketForCountry("CA"), "CA");
  assert.equal(marketForCountry("GB"), "GB");
  // The region mapping M1 built is the single source of the country mapping.
  assert.equal(regionFor("CA"), "CA");
  assert.equal(regionFor("GB"), "GB");
  assert.equal(regionFor("US"), "US");
});

test("a country with no reference-value table has no market", () => {
  // A country outside the three markets is not given another country's
  // numbers.
  assert.equal(marketForCountry("DE"), undefined);
  assert.equal(marketForCountry("FR"), undefined);
  assert.equal(marketForCountry("IN"), undefined);
  assert.equal(resolveReference(undefined, "protein").status, "not-enabled");
  assert.equal(resolvePercent(undefined, "protein", 30).percent, undefined);
});

test("an older profile with no country keeps the behaviour it has today", () => {
  // A profile saved before the country setting existed has no country. It
  // keeps the incumbent United States denominator rather than losing its
  // percentages.
  assert.equal(marketForCountry(undefined), "US");
  assert.equal(marketForCountry(""), "US");
  assert.equal(marketForCountry("  "), "US");
  assert.equal(resolvePercent(marketForCountry(undefined), "protein", 25).percent, 50);
});

test("only the incumbent market is enabled", () => {
  // The legal and clinical review has not been done, so Canada and the
  // United Kingdom are held back. An agent is not the authority that can
  // change that.
  assert.deepEqual([...ENABLED_MARKETS], ["US"]);
  assert.equal(resolveReference("CA", "protein").status, "not-enabled");
  assert.equal(resolveReference("GB", "protein").status, "not-enabled");
  // And a market that is not enabled never produces a percentage.
  assert.equal(resolvePercent("CA", "protein", 30).percent, undefined);
  assert.equal(resolvePercent("GB", "protein", 30).percent, undefined);
  // The Canadian and British values are still there for the review to check.
  assert.equal(resolveReference("CA", "protein").market, "CA");
  assert.equal(resolveReference("GB", "protein").market, "GB");
});

test("an unapproved market never borrows a United States percentage", () => {
  for (const market of ["CA", "GB"] as Market[]) {
    for (const key of Object.keys(nutrientInfo)) {
      const resolved = resolvePercent(market, key, 100);
      assert.equal(resolved.percent, undefined, `${market} ${key}`);
      assert.equal(resolved.status, "not-enabled", `${market} ${key}`);
    }
  }
});

test("the United States output is identical to what the app shows today", () => {
  // The app currently renders Math.round(value / nutrientInfo[key].dv * 100).
  // The resolver must produce exactly the same numbers.
  for (const [key, info] of Object.entries(nutrientInfo)) {
    for (const amount of [0, 1, 7.5, 25, 100, 399, 2500]) {
      const expected =
        info.dv === undefined ? undefined : Math.round((amount / info.dv) * 100);
      const resolved = resolvePercent("US", key, amount);
      assert.equal(resolved.percent, expected, `${key} at ${amount}`);
    }
  }
});

test("the Canadian and British values are the researched ones", () => {
  // Held back pending review, but they must be the values that were
  // researched. The resolver deliberately hands out no value for a market that
  // is not enabled, so the tables are read directly here.
  assert.equal(CA_REFERENCE_VALUES.values.potassium?.value, 3400);
  assert.equal(CA_REFERENCE_VALUES.values.potassium?.scope, "adults-or-other");
  assert.equal(GB_REFERENCE_VALUES.values.vitaminD?.value, 5);
  assert.equal(GB_REFERENCE_VALUES.values.vitaminD?.scope, "adults");
  // And the resolver names the market it would have used.
  assert.equal(resolveReference("CA", "potassium").market, "CA");
  assert.equal(resolveReference("GB", "vitaminD").market, "GB");
});

test("a nutrient with no reference value produces no percentage", () => {
  // The United States is enabled, and it has no Daily Value for total sugars.
  assert.equal(resolveReference("US", "sugar").status, "no-value");
  assert.equal(resolvePercent("US", "sugar", 30).percent, undefined);
  assert.equal(resolveReference("US", "calories").status, "no-value");
  // A market that is not enabled reports the market first, because there is
  // nothing to show either way.
  assert.equal(resolveReference("CA", "sugar").status, "not-enabled");
});

test("a value that was never reported produces no percentage", () => {
  // Unknown is unknown. It is never a zero and never a percentage.
  const unknown = resolvePercent("US", "sodium", undefined, "unknown");
  assert.equal(unknown.percent, undefined);
  assert.equal(unknown.lowerBound, false);
  const explicit = resolvePercent("US", "sodium", 0, "unknown");
  assert.equal(explicit.percent, undefined);
});

test("a partly known value is a lower bound, and so is its percentage", () => {
  const partial = resolvePercent("US", "sodium", 500, "partial");
  assert.equal(partial.percent, Math.round((500 / 2300) * 100));
  assert.equal(partial.lowerBound, true);
  const known = resolvePercent("US", "sodium", 500, "known");
  assert.equal(known.percent, Math.round((500 / 2300) * 100));
  assert.equal(known.lowerBound, false);
});

test("no reference value is invented for a nutrient that is missing", () => {
  for (const market of ["US", "CA", "GB"] as Market[]) {
    for (const key of missingFor(market)) {
      const resolved = resolveReference(market, key);
      assert.notEqual(resolved.status, "available", `${market} ${key}`);
      assert.equal(resolved.value, undefined, `${market} ${key}`);
    }
  }
});
