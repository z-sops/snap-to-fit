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
  /** Measured in a laboratory, as the source states. */
  | "analysed"
  /** Derived from other data by the compiler. */
  | "calculated"
  /** Filled in from a similar food. */
  | "imputed"
  /** A judgement or literature value, not measured. */
  | "estimated"
  /**
   * Carried over unchanged from another dataset, whose own quality this source
   * does not state. It is a value, but "analysed" would over-claim it.
   */
  | "inherited"
  /** Present, but below the source's quantification limit. */
  | "trace"
  /** Not reported by the source. */
  | "unknown"
  /** A zero the source stands behind. */
  | "documented-zero";

/** The states that may be shown as a number. */
export const NUMERIC_STATES: readonly NutrientValueState[] = [
  "analysed",
  "calculated",
  "imputed",
  "estimated",
  "inherited",
  "documented-zero",
];

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
   * Meaningful only for a value the source describes as laboratory work.
   * Never used to decide whether a value exists.
   */
  observations?: number;
  /** The source's own stated uncertainty, when it reports one. */
  standardError?: number;
  /**
   * Set when the source's own data contradicts itself, or when the source code
   * is not in the published table. The value is kept and shown, but it must not
   * be treated as verified-quality data until a person has looked at it.
   */
  needsReview?: boolean;
  /** Why the value needs review, in the researcher's words. */
  reviewReason?: string;
}

/** True when the value is a number the app may store and display. */
export function isUsableValue(v: NutrientValue): v is NutrientValue & { value: number } {
  return typeof v.value === "number" && Number.isFinite(v.value);
}

/**
 * A value the app may show as a number: it must carry a number, and its state
 * must be one that means "this is a figure". An unknown or a trace is never a
 * number, whatever else it carries.
 */
export function isDisplayableNumber(v: NutrientValue): boolean {
  return isUsableValue(v) && NUMERIC_STATES.includes(v.state);
}

/**
 * A value the app may treat as settled, without a review flag.
 */
export function isSettled(v: NutrientValue): boolean {
  return isDisplayableNumber(v) && !v.needsReview;
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
 *
 * Note what is deliberately *not* claimed:
 *   - code 0 ("No change from USDA") says the value is inherited, not that it
 *     was laboratory analysed. The CNF does not state the quality of the
 *     value it carries over, so the state is `inherited`.
 *   - codes 81/82/83 name another national dataset. That dataset's own
 *     quality is not restated here, so they are `inherited` too.
 *   - code 12 is handled separately, because it is a statement about a zero
 *     and can contradict the amount beside it.
 */
export const CNF_NUTRIENT_SOURCE_QUALITY: Record<string, NutrientValueState> = {
  "0": "inherited", //  No change from USDA
  "1": "calculated", // Nutrient levels changed to meet the canadian regulations
  "2": "calculated", // Nutrient calculated from data other than USDA
  "3": "analysed", //  Nutrient analyzed in a Canadian government lab
  "4": "calculated", // Nutrient calculated from USDA data
  "5": "imputed", //    Nutrient imputed from a similar USDA food
  "6": "estimated", //   Nutrient from Canadian industry. Documentation incomplete.
  "7": "analysed", //    Nutrient analyzed in Canadian product (non-government lab)
  "8": "estimated", //   Nutrient value of food created for the Nutrition Canada Survey
  "9": "estimated", //   Nutrient from the label declaration
  "10": "estimated", //  Nutrient derived from scientific literature
  "14": "estimated", //  Provisional data
  "15": "imputed", //    Nutrient value imputed from data other than USDA
  "16": "calculated", // Calculated field
  "17": "calculated", // Calculated from analytical Canadian data
  "50": "calculated", // Calculated from literature for surveys only
  "51": "calculated", // Calculated using a recipe
  "81": "inherited", //   International database
  "82": "inherited", //   Danish Food Composition Databank
  "83": "inherited", //   Fineli, Finnish food composition database
};

/**
 * The source code for an assumed zero.
 *
 * It describes a *zero*, so it can only be applied to a row whose amount is
 * actually zero. A row that pairs this code with a non-zero amount is a
 * conflict in the source data and is handled as such.
 */
export const CNF_ASSUMED_ZERO_SOURCE_CODE = "12";

/** The `Nutrient_Source_Code` values that mean the value is not laboratory work. */
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
 * The rules that matter:
 *
 *  - A row that is absent is the only thing that means unknown.
 *  - A blank amount is not a zero. `Number("")` is 0, and reading it that way
 *    would invent a measurement.
 *  - A value of zero is a zero the source stands behind.
 *  - Source code 12 says the value is an *assumed zero*. It is applied only
 *    to a row whose amount really is zero. Paired with a non-zero amount it is
 *    a conflict in the source data: the amount is kept, the conflict is
 *    flagged, and the value is not claimed to be verified.
 *  - An unrecognised source code keeps the amount but is flagged for review
 *    rather than being given a quality it has not earned.
 */
export function normalizeCnfValue(
  row: CnfNutrientAmountRow | undefined,
  sourceDescriptions: Record<string, string> = {},
): NutrientValue {
  if (!row) return { state: "unknown" };
  const code = row.nutrient_source_code;
  const observations = row.observations === "" ? undefined : Number(row.observations);
  const standardError = row.standard_error === "" ? undefined : Number(row.standard_error);
  const base = {
    sourceCode: code,
    sourceDescription: sourceDescriptions[code],
    observations: observations !== undefined && Number.isFinite(observations) ? observations : undefined,
    standardError: standardError !== undefined && Number.isFinite(standardError) ? standardError : undefined,
  };

  // A blank amount is a missing amount, not a zero.
  const raw = (row.nutrient_amount ?? "").trim();
  if (raw === "") return { ...base, state: "unknown" };
  const amount = Number(raw);
  if (!Number.isFinite(amount))
    return {
      ...base,
      state: "unknown",
      needsReview: true,
      reviewReason: `the source amount "${raw}" is not a number`,
    };

  // An assumed zero, applied only where the amount really is zero.
  if (code === CNF_ASSUMED_ZERO_SOURCE_CODE) {
    if (amount === 0) return { ...base, value: 0, state: "documented-zero" };
    return {
      ...base,
      value: amount,
      state: "estimated",
      needsReview: true,
      reviewReason:
        "the source marks this value as an assumed zero, but the amount it published is not zero",
    };
  }

  const quality = CNF_NUTRIENT_SOURCE_QUALITY[code];
  if (!quality) {
    // An unknown source code is not a licence to guess. The value is kept and
    // flagged, so a person can extend the code table deliberately.
    return {
      ...base,
      value: amount,
      state: "estimated",
      needsReview: true,
      reviewReason: `nutrient source code ${code} is not in the published CNF 2026 table`,
    };
  }

  if (amount === 0) {
    // A zero that the source stands behind, whatever produced it.
    return { ...base, value: 0, state: "documented-zero" };
  }
  return { ...base, value: amount, state: quality };
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
 * missing value. A value with a bracketed footnote needs that footnote to be
 * understood, so it is flagged rather than presented as settled. A trace is
 * present but unquantified and must never be turned into a zero. "N" means the
 * amount is not known.
 */
export function normalizeCofidValue(raw: string): NutrientValue {
  const text = (raw ?? "").trim();
  if (!text) return { state: "unknown" };
  if (text === COFID_SENTINELS.NOT_DETERMINED) return { state: "unknown" };
  if (text === COFID_SENTINELS.TRACE) return { state: "trace" };
  const bracketed = /^\(\s*([0-9]*\.?[0-9]+)\s*\)$/.exec(text);
  if (bracketed) return { value: Number(bracketed[1]), state: "estimated" };
  const footnoted = /^([0-9]*\.?[0-9]+)\s*\[\d+\]$/.exec(text);
  if (footnoted)
    return {
      value: Number(footnoted[1]),
      state: "estimated",
      needsReview: true,
      reviewReason: "the source attaches a footnote to this value, so it must be read with it",
    };
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
