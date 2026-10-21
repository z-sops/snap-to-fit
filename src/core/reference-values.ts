// M2-1: food-labelling reference values, and the resolver that uses them.
//
// A reference value here is a LABELLING denominator: the reference amount a
// nutrition declaration uses for its percent daily value. It is not an
// individual dietary requirement, and it is not a personal target. The app's
// own calorie, protein, glucose and medication targets are category C
// requirements and live in core/nutrition.ts, core/targets.ts and
// core/insulin-safety.ts. Nothing in this file changes them.
//
// The tables themselves were researched and specified in M2-0 and are
// documented in docs/m2/LABELLING_REFERENCE_VALUES.md, with their sources,
// age scopes, units and rounding rules.

import { regionFor } from "./locale";
import { nutrientKeys, type NutrientKey } from "./foods";

export type Market = "US" | "CA" | "GB";

/** The population a labelling value applies to. */
export type ValueScope =
  /** Adults, and children aged 4 and over in the US table. */
  | "adults"
  /** Canadian column 2: food intended solely for children 1–4 years. */
  | "children-1-4"
  /** Canadian column 3: infants 6–12 months, or children 1–4 years. */
  | "infants-6-12-or-children-1-4"
  /** Canadian column 4: any other case, which is children 4+ and adults. */
  | "adults-or-other";

export interface ReferenceValue {
  /** The denominator, in the app's unit. */
  value: number;
  /** The unit the value is expressed in. */
  unit: "g" | "mg" | "mcg" | "kcal";
  /**
   * The quantity the value actually measures, when it is not the obvious one.
   * "folate" is 400 micrograms of dietary folate equivalents in the US and
   * Canada and 200 micrograms of folic acid in the United Kingdom.
   */
  basis?: string;
  /** The population the value applies to. */
  scope: ValueScope;
}

export interface MarketReferenceValues {
  market: Market;
  /** The instrument the values come from. */
  source: string;
  sourceUrl: string;
  /** The version of the instrument. */
  version: string;
  /** When the values were checked. */
  reviewed: string;
  /**
   * True once the legal and clinical review recorded in
   * docs/m2/LABELLING_REFERENCE_VALUES.md has been done. It is false on every
   * table, and an agent is not the authority that can change it.
   */
  approved: boolean;
  values: Partial<Record<NutrientKey, ReferenceValue>>;
}

/* ------------------------------------------------------------------ *
 * United States
 * ------------------------------------------------------------------ */

/**
 * The FDA Daily Values, 21 CFR 101.9, for adults and children aged 4 and
 * over.
 *
 * This table reproduces exactly the values the app has always used, so using
 * it changes nothing for a United States user. The app shows no percentage for
 * calories and none for sugars, and this table keeps both absent.
 */
export const US_REFERENCE_VALUES: MarketReferenceValues = {
  market: "US",
  source: "FDA Daily Values, 21 CFR 101.9 (Nutrition and Supplement Facts)",
  sourceUrl:
    "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-D",
  version: "as in force 2026-10-21",
  reviewed: "2026-10-21",
  approved: false,
  values: {
    protein: { value: 50, unit: "g", scope: "adults" },
    carbs: { value: 275, unit: "g", scope: "adults" },
    fat: { value: 78, unit: "g", scope: "adults" },
    fibre: { value: 28, unit: "g", scope: "adults" },
    satFat: { value: 20, unit: "g", basis: "saturated fat", scope: "adults" },
    sodium: { value: 2300, unit: "mg", scope: "adults" },
    potassium: { value: 4700, unit: "mg", scope: "adults" },
    calcium: { value: 1300, unit: "mg", scope: "adults" },
    iron: { value: 18, unit: "mg", scope: "adults" },
    magnesium: { value: 420, unit: "mg", scope: "adults" },
    zinc: { value: 11, unit: "mg", scope: "adults" },
    vitaminC: { value: 90, unit: "mg", scope: "adults" },
    vitaminD: { value: 20, unit: "mcg", scope: "adults" },
    vitaminB12: { value: 2.4, unit: "mcg", scope: "adults" },
    folate: { value: 400, unit: "mcg", basis: "dietary folate equivalents (DFE)", scope: "adults" },
    vitaminA: { value: 900, unit: "mcg", basis: "retinol activity equivalents (RAE)", scope: "adults" },
    cholesterol: { value: 300, unit: "mg", scope: "adults" },
  },
};

/* ------------------------------------------------------------------ *
 * Canada
 * ------------------------------------------------------------------ */

/**
 * Health Canada's Nutrition Labelling Table of Daily Values, published
 * 20 October 2022 and incorporated by reference in the Food and Drug
 * Regulations. The 2016 transitional table no longer applies.
 *
 * The app's audience is adults, so the adult columns are used: Part 1 column 3
 * (children 4 and over and adults) and Part 2 column 4 (any other case).
 *
 * **There is deliberately no saturated-fat value.** Canada's 20 g labelling
 * Daily Value is for the *sum of saturated and trans fatty acids*, which is
 * not the quantity the app holds: `satFat` is saturated fat on its own
 * (USDA "Fatty acids, saturated, total", CNF `FASAT`, CoFID "Saturates per
 * 100 g food"). Dividing a saturated-fat-only value by a combined
 * saturated-plus-trans denominator would report a percentage of the wrong
 * thing, so the Canadian saturated-fat percentage is unavailable until a
 * properly matched quantity is supported.
 */
export const CA_REFERENCE_VALUES: MarketReferenceValues = {
  market: "CA",
  source: "Health Canada, Nutrition labelling — Table of daily values (2022)",
  sourceUrl:
    "https://www.canada.ca/en/health-canada/services/technical-documents-labelling-requirements/table-daily-values.html",
  version: "2022-10-20",
  reviewed: "2026-10-21",
  approved: false,
  values: {
    fat: { value: 75, unit: "g", scope: "adults-or-other" },
    fibre: { value: 28, unit: "g", scope: "adults-or-other" },
    sugar: { value: 100, unit: "g", basis: "total sugars", scope: "adults-or-other" },
    cholesterol: { value: 300, unit: "mg", scope: "adults-or-other" },
    sodium: { value: 2300, unit: "mg", scope: "adults-or-other" },
    potassium: { value: 3400, unit: "mg", scope: "adults-or-other" },
    calcium: { value: 1300, unit: "mg", scope: "adults-or-other" },
    iron: { value: 18, unit: "mg", scope: "adults-or-other" },
    magnesium: { value: 420, unit: "mg", scope: "adults-or-other" },
    zinc: { value: 11, unit: "mg", scope: "adults-or-other" },
    vitaminC: { value: 90, unit: "mg", scope: "adults-or-other" },
    vitaminD: { value: 20, unit: "mcg", scope: "adults-or-other" },
    vitaminB12: { value: 2.4, unit: "mcg", scope: "adults-or-other" },
    folate: { value: 400, unit: "mcg", basis: "dietary folate equivalents (DFE)", scope: "adults-or-other" },
    vitaminA: { value: 900, unit: "mcg", basis: "retinol activity equivalents (RAE)", scope: "adults-or-other" },
  },
};

/* ------------------------------------------------------------------ *
 * United Kingdom
 * ------------------------------------------------------------------ */

/**
 * The retained Regulation (EU) No 1169/2011, Annex XIII — the nutrition
 * declaration reference values for adults.
 *
 * Three gaps are deliberate and are not filled in from anywhere else:
 *   - the annex sets SALT, not sodium, so the app's sodium key has no United
 *     Kingdom value;
 *   - the annex sets neither cholesterol nor fibre, so neither key has one;
 *   - the annex's folate value is *folic acid*, which is not the quantity the
 *     app holds (the app's `folate` is dietary folate equivalents), so the
 *     United Kingdom folate percentage is unavailable until a compatible basis
 *     has been verified.
 *
 * The United Kingdom's Nutrient Reference Intakes and Dietary Reference Values
 * are individual dietary requirements, not labelling values, and are not used.
 */
export const GB_REFERENCE_VALUES: MarketReferenceValues = {
  market: "GB",
  source: "Regulation (EU) No 1169/2011, Annex XIII, as retained in UK law",
  sourceUrl: "https://www.legislation.gov.uk/eur/2011/1169/annex/XIII",
  version: "as retained 2026-10-21",
  reviewed: "2026-10-21",
  approved: false,
  values: {
    calories: { value: 2000, unit: "kcal", basis: "8400 kJ / 2000 kcal reference intake", scope: "adults" },
    protein: { value: 50, unit: "g", scope: "adults" },
    carbs: { value: 260, unit: "g", scope: "adults" },
    fat: { value: 70, unit: "g", scope: "adults" },
    satFat: { value: 20, unit: "g", basis: "saturates, as published in Annex XIII Part B", scope: "adults" },
    sugar: { value: 90, unit: "g", basis: "total sugars", scope: "adults" },
    vitaminA: { value: 800, unit: "mcg", scope: "adults" },
    vitaminD: { value: 5, unit: "mcg", scope: "adults" },
    vitaminC: { value: 80, unit: "mg", scope: "adults" },
    vitaminB12: { value: 2.5, unit: "mcg", scope: "adults" },
    potassium: { value: 2000, unit: "mg", scope: "adults" },
    calcium: { value: 800, unit: "mg", scope: "adults" },
    iron: { value: 14, unit: "mg", scope: "adults" },
    magnesium: { value: 375, unit: "mg", scope: "adults" },
    zinc: { value: 10, unit: "mg", scope: "adults" },
  },
};

/**
 * Canada's labelling Daily Value for the SUM of saturated and trans fatty
 * acids.
 *
 * It is recorded separately because it is **not** the quantity the app holds:
 * the app's `satFat` is saturated fat on its own. It must never be used as
 * the denominator for a saturated-fat-only value.
 */
export const CA_SATURATED_PLUS_TRANS_DAILY_VALUE: ReferenceValue = {
  value: 20,
  unit: "g",
  basis:
    "sum of saturated and trans fatty acids; a different quantity from the app's saturated fat",
  scope: "adults-or-other",
};

/**
 * The United Kingdom's salt reference intake.
 *
 * It is recorded separately because it is not the app's sodium key, and
 * substituting it would change the quantity being measured.
 */
export const GB_SALT_REFERENCE_INTAKE: ReferenceValue = {
  value: 6,
  unit: "g",
  basis: "salt, as published in Annex XIII Part B",
  scope: "adults",
};

/**
 * The United Kingdom's folic acid reference intake.
 *
 * It is recorded separately because the app's `folate` key is dietary folate
 * equivalents, which is a different quantity. It must not be used as the
 * denominator for the app's folate values until a compatible basis has been
 * explicitly verified.
 */
export const GB_FOLIC_ACID_REFERENCE_INTAKE: ReferenceValue = {
  value: 200,
  unit: "mcg",
  basis: "folic acid; not the same quantity as dietary folate equivalents",
  scope: "adults",
};

/**
 * The US Daily Value for ADDED sugars.
 *
 * It is recorded here so that it cannot be mistaken for the app's total
 * sugars key. The FDA states that there is no Daily Value for total sugars,
 * and that the Daily Value for added sugars is 50 g. The app tracks total
 * sugars, so the added-sugars value must never be used for it.
 */
export const US_ADDED_SUGARS_DAILY_VALUE: ReferenceValue = {
  value: 50,
  unit: "g",
  basis: "added sugars only; a different nutrient from total sugars",
  scope: "adults",
};

/* ------------------------------------------------------------------ *
 * The market, and what may be shown
 * ------------------------------------------------------------------ */

export const REFERENCE_VALUES: Record<Market, MarketReferenceValues> = {
  US: US_REFERENCE_VALUES,
  CA: CA_REFERENCE_VALUES,
  GB: GB_REFERENCE_VALUES,
};

/**
 * The markets whose own labelling values may be shown.
 *
 * The United States is the incumbent: its values are what the app has always
 * shown, so using its table changes nothing and needs no new clearance. The
 * legal and clinical review recorded in `docs/m2/LABELLING_REFERENCE_VALUES.md`
 * has not been done, so the `approved` flag on every table is still false and
 * an agent is not the authority that can set it.
 *
 * Canada and the United Kingdom are held back until that review is done.
 * Until then they show an unavailable state rather than a United States
 * number, which would be the wrong denominator.
 */
export const ENABLED_MARKETS: readonly Market[] = ["US"];

/**
 * The market a country belongs to, or undefined when it has no table.
 *
 * The country is the one the user chose in the app, so a manual choice always
 * wins. A profile with no country at all predates the country setting and
 * gets the incumbent United States market, which is what it sees today.
 */
export function marketForCountry(country?: string): Market | undefined {
  if (!country || !country.trim()) return "US";
  const region = regionFor(country);
  if (region === "US") return "US";
  if (region === "CA") return "CA";
  if (region === "GB") return "GB";
  return undefined;
}

export type ReferenceStatus =
  /** The market publishes a value and the market is enabled to show it. */
  | "available"
  /** The market publishes no value for this nutrient. */
  | "no-value"
  /** The market's own values may not be shown yet. */
  | "not-enabled";

export interface ResolvedReference {
  status: ReferenceStatus;
  /** The market the value would come from. */
  market?: Market;
  /** The reference value, when the market publishes one. */
  value?: ReferenceValue;
}

/**
 * The reference value for a nutrient in a market.
 *
 * There is deliberately no fallback to another market. A market that is not
 * enabled, or that publishes no value for the nutrient, resolves to a status
 * the screen can explain. It never resolves to another country's number.
 */
export function resolveReference(market: Market | undefined, key: string): ResolvedReference {
  if (!market) return { status: "not-enabled" };
  if (!ENABLED_MARKETS.includes(market)) return { status: "not-enabled", market };
  const value = REFERENCE_VALUES[market].values[key as NutrientKey];
  if (!value) return { status: "no-value", market };
  return { status: "available", market, value };
}

/** How complete a quantity is, which decides whether a percentage means anything. */
export type AmountState = "known" | "partial" | "unknown";

export interface ReferencePercent {
  /** The percentage, when one can honestly be given. */
  percent?: number;
  /** True when the amount is a lower bound, so the percentage is one too. */
  lowerBound: boolean;
  /** Why there is no percentage, when there is none. */
  status: ReferenceStatus;
  /** The reference value the percentage was taken against. */
  value?: ReferenceValue;
}

/**
 * The percentage of a market's reference value that an amount represents.
 *
 * A quantity that was never reported has no percentage at all. A quantity that
 * is only partly known is a lower bound, and so is its percentage. A market
 * whose values are not enabled has no percentage either, and never borrows one.
 */
export function resolvePercent(
  market: Market | undefined,
  key: string,
  amount: number | undefined,
  state: AmountState = "known",
): ReferencePercent {
  const reference = resolveReference(market, key);
  if (reference.status !== "available" || !reference.value)
    return { lowerBound: false, status: reference.status };
  if (amount === undefined || !Number.isFinite(amount) || state === "unknown")
    return { lowerBound: false, status: reference.status, value: reference.value };
  const percent = Math.round((amount / reference.value.value) * 100);
  return {
    percent,
    lowerBound: state === "partial",
    status: "available",
    value: reference.value,
  };
}

/** The nutrients a market publishes no value for, within the app's key set. */
export function missingFor(market: Market | undefined): string[] {
  if (!market) return [...nutrientKeys];
  const table = REFERENCE_VALUES[market];
  if (!table) return [...nutrientKeys];
  return nutrientKeys.filter((k) => !(k in table.values));
}

