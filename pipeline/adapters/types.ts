/**
 * The record shape the pipeline produces, and the rules it must keep.
 *
 * This is a build-time shape. It is not the app's `Food` type and it is not
 * imported by any production module: the shipping catalogue is untouched by
 * M2-2, and this pipeline exists to prove that a Canadian catalogue could be
 * built safely, not to ship one.
 */

/**
 * How a value was arrived at, in the source's own terms.
 *
 * The states are the same ones the M2-0 research established. `unknown` is
 * not a state of a value but the absence of one, so it is not listed here: a
 * nutrient that the source did not report is simply missing from the record.
 */
export type ValueQuality =
  | "analysed"
  | "calculated"
  | "imputed"
  | "inherited"
  | "estimated"
  | "documented-zero";

/** How complete a value is. */
export type ValueState = "known" | "partial" | "unknown";

/** Where one value came from. */
export interface NutrientProvenance {
  /** How the value was arrived at. */
  quality: ValueQuality;
  /** The source's own code for it. */
  sourceCode: string;
  /** The source's own words for it. */
  sourceDescription?: string;
  /** The number of analytical observations, where the source reports one. */
  observations?: number;
  /** The source's own stated uncertainty, where it reports one. */
  standardError?: number;
  /** True when the source's data contradicts itself and a person must look. */
  needsReview?: boolean;
  /** Why it needs review. */
  reviewReason?: string;
}

/** Where a food came from, in the source's own terms. */
export interface FoodProvenance {
  code: string;
  description: string;
}

export type FindingKind =
  | "duplicate-id"
  | "malformed-record"
  | "missing-value"
  | "unknown-source-code"
  | "source-conflict"
  | "unresolved-cross-reference"
  | "out-of-range"
  | "missing-provenance"
  | "unexpected-unit";

/** A problem a person needs to look at. */
export interface Finding {
  /** What kind of problem this is. */
  kind: FindingKind;
  /** Which record it concerns. */
  id: string;
  /** The nutrient, when the problem is about one. */
  nutrient?: string;
  /** What is wrong, in plain words. */
  detail: string;
}

/** One food, normalised. */
export interface PipelineFood {
  /** Stable identifier: "usda:<ndb>" or "cnf:<code>". */
  id: string;
  name: string;
  group: string;
  /** Per 100 g of edible portion, in the app's units. A missing key is unknown. */
  per100: Partial<Record<string, number>>;
  servings: { label: string; grams: number }[];
  /** Which dataset the record came from. */
  source: "usda" | "cnf";
  /** The market the dataset belongs to. */
  region: "US" | "CA";
  /** The exact release the bytes came from. */
  sourceVersion: string;
  /** The publisher's own description of where the food's values came from. */
  foodProvenance: FoodProvenance;
  /** Per nutrient, how the value was arrived at. */
  nutrients: Record<string, NutrientProvenance>;
  /**
   * The inedible parts of the food, as the source publishes them.
   *
   * The release expresses the refuse as a share of the food as purchased: for
   * raw meats the items are raw as purchased, and for cooked meats the refuse
   * is the inedible material from the cooked state. A value of 11 therefore
   * means eleven parts per hundred of the food as purchased.
   *
   * These are not servings. The nutrient values are per 100 g of the *edible*
   * part, so a measure of the food and its refuse are two different things.
   */
  refuse?: { label: string; per100: number }[];
  /** The source's own identifier for the same food in another dataset, if any. */
  crossReference?: { dataset: string; id: string };
}

/** The whole normalised dataset. */
export interface PipelineDataset {
  /** The schema version, so a consumer knows what it is reading. */
  schema_version: number;
  /**
   * How the inputs were checked: `verified` means every input was compared
   * with the manifest before anything was parsed, `fixture` means the build
   * ran against the checked-in slice, whose bytes are not the published ones.
   */
  verification: "verified" | "fixture";
  /** When the bytes were built, from the manifest, not from the clock. */
  built_from: { source_id: string; sha256: string }[];
  /** The records, in a deterministic order. */
  foods: PipelineFood[];
  /** Every problem found, across every source. */
  findings: Finding[];
}
