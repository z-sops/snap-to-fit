import type { Finding, PipelineFood } from "../adapters/types";
import { CANONICAL_NUTRIENT_KEYS, CANONICAL_UNITS } from "../adapters/nutrients";

/**
 * Integrity checks on a normalised dataset.
 *
 * Every problem is reported as a finding rather than fixed, so a person looks
 * at it. The one thing that is never done is turning an unknown value into a
 * zero.
 */
export function lintDataset(foods: PipelineFood[], findings: Finding[]): Finding[] {
  const out = [...findings];
  const seen = new Map<string, PipelineFood>();
  // The identifiers the United States records answer to, by number. The
  // Canadian file writes them with leading zeros, and writes some foods that
  // are not in the shipped catalogue at all.
  const usdaIds = new Map<number, string>();
  for (const food of foods) {
    if (food.source !== "usda") continue;
    const number = Number(food.id.slice("usda:".length));
    if (Number.isFinite(number)) usdaIds.set(number, food.id);
  }

  for (const food of foods) {
    if (seen.has(food.id)) {
      out.push({ kind: "duplicate-id", id: food.id, detail: "the identifier appears twice in the built dataset" });
      continue;
    }
    seen.set(food.id, food);

    if (!food.name.trim())
      out.push({ kind: "malformed-record", id: food.id, detail: "the food has no name" });
    if (!food.foodProvenance?.code)
      out.push({ kind: "missing-provenance", id: food.id, detail: "the food has no provenance code" });

    // A cross-reference must point at a record that exists. The Canadian file
    // names a United States number for many of its foods, and some of those
    // numbers are not in the catalogue the app ships.
    if (food.crossReference) {
      const target = food.crossReference.id;
      const number = Number(target.slice("usda:".length));
      if (!Number.isFinite(number) || !usdaIds.has(number)) {
        out.push({
          kind: "unresolved-cross-reference",
          id: food.id,
          detail: `the source names ${target} as the matching record, and this catalogue does not have it`,
        });
      }
    }

    for (const key of CANONICAL_NUTRIENT_KEYS) {
      const value = food.per100[key];
      if (value === undefined) continue; // unknown, and that is allowed
      if (typeof value !== "number" || !Number.isFinite(value)) {
        out.push({ kind: "malformed-record", id: food.id, nutrient: key, detail: "the value is not a finite number" });
        continue;
      }
      if (value < 0)
        out.push({ kind: "out-of-range", id: food.id, nutrient: key, detail: `the value ${value} is negative` });
      const provenance = food.nutrients[key];
      if (!provenance) {
        out.push({ kind: "missing-provenance", id: food.id, nutrient: key, detail: "the value has no provenance" });
        continue;
      }
      if (!provenance.sourceCode)
        out.push({ kind: "missing-provenance", id: food.id, nutrient: key, detail: "the value has no source code" });
    }

    for (const key of Object.keys(food.nutrients)) {
      if (!CANONICAL_NUTRIENT_KEYS.includes(key))
        out.push({ kind: "malformed-record", id: food.id, nutrient: key, detail: "the nutrient is not one of the canonical keys" });
      if (food.per100[key] === undefined)
        out.push({ kind: "missing-value", id: food.id, nutrient: key, detail: "the nutrient has provenance but no value" });
    }
  }

  return out;
}

/** The kinds of finding, and how many of each, for the build report. */
export function summariseFindings(findings: Finding[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const finding of findings) counts[finding.kind] = (counts[finding.kind] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

export { CANONICAL_UNITS };
