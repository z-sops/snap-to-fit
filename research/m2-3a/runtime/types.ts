/**
 * The records the prototype runtime works with.
 *
 * These are the M2-2 pipeline's own records, carried unchanged: the same
 * identifiers, the same nutrient values, the same per-value provenance. The
 * prototype does not interpret a value, and it does not invent one.
 */

/** A source a record came from. */
export type RecordSource = "usda" | "cnf";

/** The market a record belongs to. */
export type Market = "US" | "CA";

/** One food, as the prototype holds it. */
export interface FoodRecord {
  /** `usda:<ndb>` or `cnf:<Food_Code>`. */
  id: string;
  name: string;
  group: string;
  region: Market;
  source: RecordSource;
  /** Per 100 g. A missing key is unknown, never zero. */
  per100: Record<string, number>;
  servings: { label: string; grams: number }[];
  /** How each value was arrived at, in the source's own terms. */
  nutrients: Record<string, { quality: string; sourceCode: string; observations?: number }>;
}

/** A search result, with the label the user has to see. */
export interface LabelledResult {
  id: string;
  name: string;
  source: RecordSource;
  region: Market;
  /**
   * True when the record came from another market than the one that was
   * asked for. The caller has to say so.
   */
  cross_market: boolean;
  /** The market the record actually came from. */
  source_market: Market;
}

/** The source of a record, from its namespace. */
export function sourceOf(id: string): RecordSource | null {
  if (id.startsWith("usda:")) return "usda";
  if (id.startsWith("cnf:")) return "cnf";
  return null;
}

/** The market a record belongs to, from its namespace. */
export function marketOf(id: string): Market | null {
  const source = sourceOf(id);
  if (source === "usda") return "US";
  if (source === "cnf") return "CA";
  return null;
}
