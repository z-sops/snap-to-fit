import fs from "node:fs";
import path from "node:path";
import { CANONICAL_NUTRIENT_KEYS, CANONICAL_UNITS } from "./nutrients";
import type { Finding, PipelineFood } from "./types";

/**
 * The USDA adapter.
 *
 * It reads the catalogue the app already ships, `src/data/usda-foods.json`,
 * and normalises it. **It never writes to that file.** The shipping catalogue
 * is the input, and the pipeline's output is a separate artefact.
 *
 * The file is the compact row form the M2-0 research documented:
 * `[id, name, group, values, servings]` where `values` is positional against
 * the canonical nutrient keys and `-1` means the value was never reported.
 */
export interface UsdaInput {
  /** The path to the shipped catalogue. */
  file: string;
  /** The release the catalogue was built from. */
  version: string;
}

interface UsdaDataset {
  v: number;
  source: string;
  groups: Record<string, string>;
  foods: [number, string, string, number[], [number, string][]][];
}

export function readUsda(input: UsdaInput): { foods: PipelineFood[]; findings: Finding[] } {
  const raw = JSON.parse(fs.readFileSync(input.file, "utf8")) as UsdaDataset;
  const findings: Finding[] = [];
  const foods: PipelineFood[] = [];
  const seen = new Set<string>();

  for (const row of raw.foods) {
    const [id, name, group, values, servings] = row;
    const key = `usda:${id}`;
    if (seen.has(key)) {
      findings.push({ kind: "duplicate-id", id: key, detail: "the same identifier appears twice in the USDA catalogue" });
      continue;
    }
    seen.add(key);

    const per100: Record<string, number> = {};
    const nutrients: PipelineFood["nutrients"] = {};
    CANONICAL_NUTRIENT_KEYS.forEach((name, i) => {
      const value = values[i];
      if (value === undefined || value === null || value < 0) return; // never reported
      per100[name] = value;
      nutrients[name] = {
        // SR28 publishes no per-value provenance, so the quality is inherited
        // from the original laboratory analysis rather than stated here.
        quality: "inherited",
        sourceCode: `SR28:${group}`,
        sourceDescription: `USDA SR28 food group ${group} (${raw.groups[group] ?? "unknown"})`,
      };
    });

    const list = (servings ?? []).map(([grams, label]) => ({ label, grams }));
    for (const standard of [{ label: "100 g", grams: 100 }, { label: "1 oz", grams: 28.35 }]) {
      if (!list.some((s) => s.label === standard.label)) list.push(standard);
    }

    foods.push({
      id: key,
      name,
      group: raw.groups[group] ?? group,
      per100,
      servings: list,
      source: "usda",
      region: "US",
      sourceVersion: input.version,
      foodProvenance: {
        code: group,
        description: `USDA SR28 food group: ${raw.groups[group] ?? "unknown"}`,
      },
      nutrients,
    });
  }

  return { foods, findings };
}

/** The shipped catalogue's path, resolved from the repository root. */
export function shippedUsdaPath(root = process.cwd()): string {
  return path.join(root, "src", "data", "usda-foods.json");
}

export { CANONICAL_UNITS };
