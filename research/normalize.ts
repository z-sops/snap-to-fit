// M2-0 research: how a food-composition value is described before it is
// allowed anywhere near the app.
//
// This module is a SPECIFICATION, expressed as code so it can be tested. It is
// not imported by `src/` or `server/` and cannot reach a device build.
//
// The central rule it encodes: a value's QUALITY, its PROVENANCE and its
// MISSINGNESS are three different things and must never be collapsed into one.
//
//   - quality     -> "analysed" | "calculated" | "imputed" | "estimated"
//                    | "trace" | "unknown" | "documented-zero"
//   - provenance  -> the source's own code and description for that value
//   - missingness -> whether the source reported a value at all
//
// A value with no analytical observations is NOT missing. A calculated or
// assumed value is a real value with a weaker evidence base, and it is kept.

/** How a value was arrived at. */
export type NutrientValueState =
  /** Measured in a laboratory. */
  | "analysed"
  /** Derived from other data by the compiler. */
  | "calculated"
  /** Filled in from a similar food. */
  | "imputed"
  /** A judgement or literature value, not measured. */
  | "estimated"
  /** Present, but below the source's quantification limit. */
  | "trace"
  /** Not reported by the source. */
  | "unknown"
  /** A zero the source stands behind. */
  | "documented-zero";

/** One nutrient value for one food, with everything needed to describe it. */
export interface NutrientValue {
  /** The value per 100 g, in the unit the caller asked for. Absent when unknown or trace. */
  value?: number;
  /** How the value was arrived at. */
  state: NutrientValueState;
  /** The source's own identifier for the value, for the audit trail. */
  sourceCode?: string;
  /** The source's own words for where the value came from. */
  sourceDescription?: string;
  /**
   * The number of analytical observations, when the source reports one.
   * Meaningful only for an `analysed` value. Never used to decide whether a
   * value exists.
   */
  observations?: number;
  /** The source's own stated uncertainty, when it reports one. */
  standardError?: number;
}

/** True when the value is a number the app may store and display. */
export function isUsableValue(v: NutrientValue): v is NutrientValue & { value: number } {
  return typeof v.value === "number" && Number.isFinite(v.value);
}

/**
 * A value the app may show as a number: everything except unknown and trace.
 * A trace is not a number and must not become a zero.
 */
export function isDisplayableNumber(v: NutrientValue): boolean {
  return isUsableValue(v) && v.state !== "trace";
}

/* ------------------------------------------------------------------ *
 * Health Canada, Canadian Nutrient File 2026
 * ------------------------------------------------------------------ */

/**
 * The `Nutrient_Source_Code` values published in CNF 2026, mapped to the
 * quality of the value they describe.
 *
 * The codes are the authority here, not the observation count. CNF publishes
 * `Observations` for laboratory work; calculated, imputed, estimated and
 * assumed values legitimately have no observation count, and the source code
 * is what says so.
 */
export const CNF_NUTRIENT_SOURCE_QUALITY: Record<string, NutrientValueState> = {
  "0": "analysed", //  No change from USDA
  "1": "calculated", // Nutrient levels changed to meet the Canadian regulations
  "2": "calculated", // Nutrient calculated from data other than USDA
  "3": "analysed", //  Nutrient analyzed in a Canadian government lab
  "4": "calculated", // Nutrient calculated from USDA data
  "5": "imputed", //    Nutrient imputed from a similar USDA food
  "6": "estimated", //   Nutrient from Canadian industry. Documentation incomplete.
  "7": "analysed", //    Nutrient analyzed in a Canadian product (non-government lab)
  "8": "estimated", //   Nutrient value of food created for the Nutrition Canada Survey
  "9": "estimated", //   Nutrient from the label declaration
  "10": "estimated", //  Nutrient derived from scientific literature
  "12": "documented-zero", // Nutrient value is an assumed zero
  "14": "estimated", //  Provisional data
  "15": "imputed", //    Nutrient value imputed from data other than USDA
  "16": "calculated", // Calculated field
  "17": "calculated", // Calculated from analytical Canadian data
  "50": "calculated", // Calculated from literature for surveys only
  "51": "calculated", // Calculated using a recipe
  "81": "analysed", //   International database
  "82": "analysed", //   Danish Food Composition Databank
  "83": "analysed", //   Fineli, Finnish food composition database
};

/** The `Nutrient_Source_Code` values that mean the value is not a laboratory figure. */
export const CNF_NON_LABORATORY_SOURCE_CODES = Object.keys(CNF_NUTRIENT_SOURCE_QUALITY).filter(
  (code) => CNF_NUTRIENT_SOURCE_QUALITY[code] !== "analysed",
);

/** A row of CNF 2026 `Nutrient_Amount.csv`, as published. */
export interface CnfNutrientAmountRow {
  food_code: string;
  nutrient_code: string;
  /** The value per 100 g. */
  nutrient_amount: string;
  standard_error: string;
  /** The number of analytical observations, where the value is laboratory work. */
  observations: string;
  nutrient_source_code: string;
  nutrient_last_updated_date: string;
}

/**
 * Normalise one CNF value.
 *
 * The rule that matters: a value of zero with a source code of 12 is an
 * *assumed zero* — a real, documented value that the source stands behind —
 * and it is kept. A value is unknown only when the source did not report a
 * row for that food and nutrient at all, which is handled by the caller
 * passing no row.
 */
export function normalizeCnfValue(
  row: CnfNutrientAmountRow | undefined,
  sourceDescriptions: Record<string, string> = {},
): NutrientValue {
  if (!row) return { state: "unknown" };
  const code = row.nutrient_source_code;
  const quality = CNF_NUTRIENT_SOURCE_QUALITY[code];
  const observations = row.observations === "" ? undefined : Number(row.observations);
  const standardError = row.standard_error === "" ? undefined : Number(row.standard_error);
  const base = {
    sourceCode: code,
    sourceDescription: sourceDescriptions[code],
    observations: observations !== undefined && Number.isFinite(observations) ? observations : undefined,
    standardError: standardError !== undefined && Number.isFinite(standardError) ? standardError : undefined,
  };
  if (!quality) {
    // An unknown source code is not a licence to guess. Keep the value, but
    // treat it as estimated until the code table is extended.
    const value = Number(row.nutrient_amount);
    return {
      ...base,
      value: Number.isFinite(value) ? value : undefined,
      state: "estimated",
    };
  }
  if (quality === "documented-zero") {
    // The source states the value is an assumed zero. That is a value, not a
    // missing measurement.
    return { ...base, value: 0, state: "documented-zero" };
  }
  const value = Number(row.nutrient_amount);
  if (!Number.isFinite(value)) return { ...base, state: "unknown" };
  if (value === 0) {
    // A zero that the source stands behind, whatever produced it.
    return { ...base, value: 0, state: "documented-zero" };
  }
  return { ...base, value, state: quality };
}

/* ------------------------------------------------------------------ *
 * UK, McCance and Widdowson CoFID
 * ------------------------------------------------------------------ */

/**
 * The sentinel values documented for the CoFID nutrient columns.
 *
 * The specification is taken from the published CoFID user guide. No CoFID
 * file has been downloaded, parsed or redistributed for this project, because
 * its commercial-use terms are unresolved.
 */
export const COFID_SENTINELS = {
  /** No reliable amount, although the nutrient is present in significant quantity. */
  NOT_DETERMINED: "N",
  /** A trace: present, but below the quantification limit. */
  TRACE: "Tr",
} as const;

/**
 * Parse one CoFID cell.
 *
 * A value in round brackets is an estimate, not a measurement, and not a
 * missing value. A trace is present but unquantified and must never be turned
 * into a zero. "N" means the amount is not known.
 */
export function normalizeCofidValue(raw: string): NutrientValue {
  const text = (raw ?? "").trim();
  if (!text) return { state: "unknown" };
  if (text === COFID_SENTINELS.NOT_DETERMINED) return { state: "unknown" };
  if (text === COFID_SENTINELS.TRACE) return { state: "trace" };
  const bracketed = /^\(\s*([0-9]*\.?[0-9]+)\s*\)$/.exec(text);
  if (bracketed) return { value: Number(bracketed[1]), state: "estimated" };
  const value = Number(text);
  if (!Number.isFinite(value)) return { state: "unknown" };
  if (value === 0) return { value: 0, state: "documented-zero" };
  return { value, state: "analysed" };
}

/* ------------------------------------------------------------------ *
 * The app's nutrient keys
 * ------------------------------------------------------------------ */

/** The 19 nutrient keys the app stores, in `src/core/foods.ts` order. */
export const APP_NUTRIENT_KEYS = [
  "calories", "protein", "carbs", "fat", "fibre", "sugar", "satFat",
  "sodium", "potassium", "calcium", "iron", "magnesium", "zinc", "vitaminC",
  "vitaminD", "vitaminB12", "folate", "vitaminA", "cholesterol",
] as const;

export type AppNutrientKey = (typeof APP_NUTRIENT_KEYS)[number];

/**
 * The CNF 2026 nutrient codes behind each app key, by INFOODS tagname.
 *
 * Two CNF nutrients are deliberately excluded:
 *   - `ENERC_KJ` (kilojoules) is not used; the app stores kilocalories and
 *     CNF publishes `ENERC_KCAL` directly, so no conversion is needed.
 *   - `VITD_IU` (International Units) is not used; the app's vitamin D is in
 *     micrograms and CNF's `VITD` is in micrograms. Mixing the two would
 *     produce a value that is off by a factor of 40.
 */
export const CNF_TAGS_BY_APP_KEY: Record<AppNutrientKey, string> = {
  calories: "ENERC_KCAL",
  protein: "PROCNT",
  carbs: "CHOCDF",
  fat: "FAT",
  fibre: "FIBTG",
  sugar: "SUGAR",
  satFat: "FASAT",
  sodium: "NA",
  potassium: "K",
  calcium: "CA",
  iron: "FE",
  magnesium: "MG",
  zinc: "ZN",
  vitaminC: "VITC",
  vitaminD: "VITD",
  vitaminB12: "VITB12",
  folate: "FOLDFE",
  vitaminA: "VITA_RAE",
  cholesterol: "CHOLE",
};

/** CNF nutrient codes that must never be mapped onto an app key. */
export const CNF_EXCLUDED_TAGS: Record<string, string> = {
  ENERC_KJ: "kilojoules; the app stores kilocalories",
  VITD_IU: "International Units; the app stores vitamin D in micrograms",
};
