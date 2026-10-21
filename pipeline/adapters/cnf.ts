import path from "node:path";
import { cell, readCsv } from "./csv";
import { CANONICAL_NUTRIENT_KEYS, CNF_ASSUMED_ZERO_CODE, CNF_SOURCE_QUALITY, CNF_TAG_BY_APP_KEY } from "./nutrients";
import type { Finding, PipelineFood } from "./types";

/**
 * The Health Canada CNF adapter.
 *
 * It reads the published 2026 relational CSV release and normalises it. The
 * rules it keeps are the ones M2-0 established against that release:
 *
 *   - a nutrient the source did not report is **unknown**, and unknown is
 *     never a zero;
 *   - the `Observations` column is evidence about the *quality* of a value,
 *     never a test for whether the value exists;
 *   - `Nutrient_Source_Code` is the authority on quality, and the codes that
 *     only say "unchanged from USDA" or name another national database do not
 *     establish that a value was laboratory analysed;
 *   - source code 12 says the value is an *assumed zero*. It is applied only
 *     where the amount really is zero. A row that pairs it with a non-zero
 *     amount is a contradiction in the source data, and it is kept and
 *     flagged rather than rewritten.
 */
export interface CnfInput {
  /** The folder holding the nine extracted CSV files. */
  dir: string;
  /** The release, as published. */
  version: string;
}

interface CnfNutrient {
  code: string;
  symbol: string;
  unit: string;
  name: string;
  tag: string;
  decimals: string;
}

/**
 * The weight of a measure, in grams, from a published conversion.
 *
 * The CNF 2026 publishes the weight of the measure itself. The 2015 release
 * published a conversion *factor* that had to be multiplied by a hundred to
 * get the same number, and the 2026 release already includes that
 * multiplication. The publisher says so in the database structure and file
 * content description:
 *
 *   "Portion size conversion factors from the 2015 publication are no longer
 *   used. They have been replaced by measure weight conversions where you do
 *   not have to multiply the portion size by 100 to know the weight of a
 *   measure. [...] In the CNF 2026, the measure weight conversion already
 *   includes the multiplication by 100 and is equal to 257.819 g."
 *
 * and gives the formula for a portion's nutrient value:
 *
 *   "N = V*W/100, where N is the nutrient value per portion, V is the nutrient
 *   value per 100 grams, and W is the measure weight conversion."
 *
 * Its own worked example, which is in this release: food 1700, 250 ml of
 * unsweetened applesauce, is 257.819 g, and food 7215, one medium Granny
 * Smith apple, is 167 g.
 *
 * So the published number is the weight in grams, unchanged, and a conversion
 * that cannot be read as a weight never becomes a portion.
 */
export function measureWeightGrams(published: string | undefined): number | undefined {
  if (published === undefined) return undefined;
  const text = published.trim();
  if (!text) return undefined;
  const grams = Number(text);
  // A blank, a non-number, or a weight of nothing is not a portion.
  if (!Number.isFinite(grams) || grams <= 0) return undefined;
  return grams;
}

/**
 * The share of a food that is inedible, from a published refuse measure.
 *
 * A refuse measure is not a portion of food, so it is not a weight and it is
 * not held to the same rule as one. The release expresses it as a share of
 * the food as purchased: for raw meats the items are raw as purchased, and
 * for cooked meats the refuse is the inedible material from the cooked state.
 * A value of 11 therefore means eleven parts per hundred of the food as
 * purchased.
 *
 * **A published zero is a known zero.** The publisher states that the food
 * has no inedible part, which is different from the publisher not saying
 * anything at all, so a zero is kept. It is also different from a serving of
 * no weight, which is not a serving and never becomes one.
 *
 * A share outside the range a share can take is not a share, and is refused.
 */
export function refuseShare(published: string | undefined): number | undefined {
  if (published === undefined) return undefined;
  const text = published.trim();
  if (!text) return undefined;
  const share = Number(text);
  if (!Number.isFinite(share) || share < 0 || share > 100) return undefined;
  return share;
}

export function readCnf(input: CnfInput): { foods: PipelineFood[]; findings: Finding[] } {
  const findings: Finding[] = [];
  const dir = input.dir;

  const nutrientNames = readCsv(path.join(dir, "Nutrient_Name.csv"));
  const nutrientsByCode = new Map<string, CnfNutrient>();
  const codeByTag = new Map<string, string[]>();
  for (const row of nutrientNames.rows) {
    const nutrient: CnfNutrient = {
      code: cell(row, nutrientNames.index, "Nutrient_Code") ?? "",
      symbol: cell(row, nutrientNames.index, "Nutrient_Symbol") ?? "",
      unit: cell(row, nutrientNames.index, "Nutrient_Unit") ?? "",
      name: cell(row, nutrientNames.index, "Nutrient_Name_EN") ?? "",
      tag: cell(row, nutrientNames.index, "Tagname") ?? "",
      decimals: cell(row, nutrientNames.index, "Nutrient_Decimals") ?? "",
    };
    if (!nutrient.code) continue;
    nutrientsByCode.set(nutrient.code, nutrient);
    if (!nutrient.tag) continue;
    const list = codeByTag.get(nutrient.tag) ?? [];
    list.push(nutrient.code);
    codeByTag.set(nutrient.tag, list);
  }

  const sourceDescriptions = new Map<string, string>();
  {
    const table = readCsv(path.join(dir, "Nutrient_Source.csv"));
    for (const row of table.rows) {
      const code = cell(row, table.index, "Nutrient_Source_Code");
      if (code) sourceDescriptions.set(code, cell(row, table.index, "Nutrient_Source_Description_EN") ?? "");
    }
  }

  const foodSourceDescriptions = new Map<string, string>();
  {
    const table = readCsv(path.join(dir, "Food_Source.csv"));
    for (const row of table.rows) {
      const code = cell(row, table.index, "Food_Source_Code");
      if (code) foodSourceDescriptions.set(code, cell(row, table.index, "Food_Source_Description_EN") ?? "");
    }
  }

  const groupNames = new Map<string, string>();
  {
    const table = readCsv(path.join(dir, "CNF_Food_Group.csv"));
    for (const row of table.rows) {
      const code = cell(row, table.index, "CNF_Food_Group_Code");
      if (code) groupNames.set(code, cell(row, table.index, "CNF_Food_Group_Description_EN") ?? "");
    }
  }

  const measureNames = new Map<string, string>();
  {
    const table = readCsv(path.join(dir, "Measure_Name.csv"));
    for (const row of table.rows) {
      const code = cell(row, table.index, "Measure_Code");
      if (code) measureNames.set(code, cell(row, table.index, "Measure_Description_and_Unit_EN") ?? "");
    }
  }

  // The app key for each CNF nutrient code, through the INFOODS tag.
  const appKeyByNutrientCode = new Map<string, string>();
  for (const [key, tag] of Object.entries(CNF_TAG_BY_APP_KEY)) {
    const codes = codeByTag.get(tag) ?? [];
    if (!codes.length) {
      findings.push({ kind: "missing-value", id: `tag:${tag}`, nutrient: key, detail: `no CNF nutrient carries the tag ${tag}` });
      continue;
    }
    if (codes.length > 1) {
      findings.push({
        kind: "source-conflict",
        id: `tag:${tag}`,
        nutrient: key,
        detail: `${codes.length} CNF nutrients carry the tag ${tag}; the lowest code is used`,
      });
    }
    appKeyByNutrientCode.set([...codes].sort()[0], key);
  }

  // The servings for each food, and the inedible parts of it.
  const servingsByFood = new Map<string, { label: string; grams: number }[]>();
  const refuseByFood = new Map<string, { label: string; per100: number }[]>();
  {
    const table = readCsv(path.join(dir, "Measure_Weight_Conversion.csv"));
    for (const row of table.rows) {
      const foodCode = cell(row, table.index, "Food_Code");
      const type = cell(row, table.index, "Measure_Type_Code");
      const measure = cell(row, table.index, "Measure_Code");
      const published = cell(row, table.index, "Measure_Weight_Conversion");
      if (!foodCode || !measure) continue;
      const label = measureNames.get(measure) ?? measure;

      if (type === "3") {
        // A refuse measure is the inedible part of the food, not a portion of
        // it, so it is never a serving. It is kept, because the nutrient
        // values are per 100 g of the edible part and the difference matters.
        // Its own rule: a published zero is a known zero, and a share outside
        // the range a share can take is not a share.
        const share = refuseShare(published);
        if (share === undefined) {
          findings.push({
            kind: "malformed-record",
            id: `cnf:${foodCode}`,
            detail: `the refuse measure ${label} has a value that is not a share of the food: ${published ?? "nothing"}`,
          });
          continue;
        }
        const list = refuseByFood.get(foodCode) ?? [];
        if (!list.some((r) => r.label === label)) list.push({ label, per100: share });
        refuseByFood.set(foodCode, list);
        continue;
      }

      // The published value is the weight of the measure, in grams. A weight
      // of nothing is not a portion.
      const grams = measureWeightGrams(published);
      if (grams === undefined) continue;
      const list = servingsByFood.get(foodCode) ?? [];
      if (!list.some((s) => s.label === label)) list.push({ label, grams });
      servingsByFood.set(foodCode, list);
    }
  }

  // The foods.
  interface CnfFood {
    code: string;
    name: string;
    alternate?: string;
    foodSource: string;
    ndb?: string;
    group: string;
    comment?: string;
  }
  const foodsByCode = new Map<string, CnfFood>();
  {
    const table = readCsv(path.join(dir, "Food_Name.csv"));
    for (const row of table.rows) {
      const code = cell(row, table.index, "Food_Code");
      if (!code) continue;
      foodsByCode.set(code, {
        code,
        name: cell(row, table.index, "Food_Description_EN") ?? "",
        alternate: cell(row, table.index, "Alternate_Description_EN") ?? undefined,
        foodSource: cell(row, table.index, "Food_Source_Code") ?? "",
        ndb: cell(row, table.index, "USDA_NDB_Code") ?? undefined,
        group: cell(row, table.index, "CNF_Food_Group_Code") ?? "",
        comment: cell(row, table.index, "Comment_EN") ?? undefined,
      });
    }
  }

  // The values.
  const perFood = new Map<string, { per100: Record<string, number>; nutrients: PipelineFood["nutrients"] }>();
  {
    const table = readCsv(path.join(dir, "Nutrient_Amount.csv"));
    for (const row of table.rows) {
      const foodCode = cell(row, table.index, "Food_Code");
      const nutrientCode = cell(row, table.index, "Nutrient_Code");
      const amountText = cell(row, table.index, "Nutrient_Amount");
      const sourceCode = cell(row, table.index, "Nutrient_Source_Code") ?? "";
      if (!foodCode || !nutrientCode) continue;
      const appKey = appKeyByNutrientCode.get(nutrientCode);
      if (!appKey) continue; // a CNF nutrient the app does not track
      const amount = amountText === undefined || amountText === "" ? Number.NaN : Number(amountText);
      const observationsText = cell(row, table.index, "Observations");
      const standardErrorText = cell(row, table.index, "STD_Error");
      const observations = observationsText === "" || observationsText === undefined ? undefined : Number(observationsText);
      const standardError = standardErrorText === "" || standardErrorText === undefined ? undefined : Number(standardErrorText);
      const sourceDescription = sourceDescriptions.get(sourceCode);

      const entry = perFood.get(foodCode) ?? { per100: {}, nutrients: {} };
      const provenance: PipelineFood["nutrients"][string] = {
        quality: "estimated",
        sourceCode,
        sourceDescription,
        observations: observations !== undefined && Number.isFinite(observations) ? observations : undefined,
        standardError: standardError !== undefined && Number.isFinite(standardError) ? standardError : undefined,
      };

      if (!Number.isFinite(amount)) {
        // A blank amount is a missing amount, never a zero.
        provenance.quality = "estimated";
        provenance.needsReview = true;
        provenance.reviewReason = "the source published no amount for this nutrient";
        findings.push({
          kind: "missing-value",
          id: `cnf:${foodCode}`,
          nutrient: appKey,
          detail: "the source published no amount for this nutrient",
        });
        perFood.set(foodCode, entry);
        continue;
      }

      if (sourceCode === CNF_ASSUMED_ZERO_CODE) {
        if (amount === 0) {
          entry.per100[appKey] = 0;
          provenance.quality = "documented-zero";
        } else {
          // A contradiction in the source data. The amount is kept exactly as
          // published, and the row is flagged for a person to look at.
          entry.per100[appKey] = amount;
          provenance.quality = "estimated";
          provenance.needsReview = true;
          provenance.reviewReason =
            "the source marks this value as an assumed zero, but the amount it published is not zero";
          findings.push({
            kind: "source-conflict",
            id: `cnf:${foodCode}`,
            nutrient: appKey,
            detail: "the source marks this value as an assumed zero, but the amount it published is not zero",
          });
        }
        entry.nutrients[appKey] = provenance;
        perFood.set(foodCode, entry);
        continue;
      }

      const quality = CNF_SOURCE_QUALITY[sourceCode];
      if (!quality) {
        // An unknown source code is not a licence to guess. The value is kept
        // and flagged, so the code table can be extended deliberately.
        provenance.quality = "estimated";
        provenance.needsReview = true;
        provenance.reviewReason = `nutrient source code ${sourceCode} is not in the published CNF 2026 table`;
        findings.push({
          kind: "unknown-source-code",
          id: `cnf:${foodCode}`,
          nutrient: appKey,
          detail: `nutrient source code ${sourceCode} is not in the published CNF 2026 table`,
        });
      } else {
        provenance.quality = quality;
      }

      entry.per100[appKey] = amount;
      entry.nutrients[appKey] = provenance;
      perFood.set(foodCode, entry);
    }
  }

  // The records.
  const foods: PipelineFood[] = [];
  const seen = new Set<string>();
  for (const food of [...foodsByCode.values()].sort((a, b) => Number(a.code) - Number(b.code))) {
    const key = `cnf:${food.code}`;
    if (seen.has(key)) {
      findings.push({ kind: "duplicate-id", id: key, detail: "the same identifier appears twice in the CNF release" });
      continue;
    }
    seen.add(key);
    const values = perFood.get(food.code);
    if (!values) {
      findings.push({ kind: "malformed-record", id: key, detail: "the food has no nutrient values at all" });
    }
    const servings = servingsByFood.get(food.code) ?? [];
    if (!servings.some((s) => s.label === "100 g")) servings.push({ label: "100 g", grams: 100 });
    const refuse = refuseByFood.get(food.code) ?? [];
    const record: PipelineFood = {
      id: key,
      name: food.name,
      group: groupNames.get(food.group) ?? food.group,
      per100: values?.per100 ?? {},
      servings,
      source: "cnf",
      region: "CA",
      sourceVersion: input.version,
      foodProvenance: {
        code: food.foodSource,
        description: foodSourceDescriptions.get(food.foodSource) ?? "unknown food source",
      },
      nutrients: values?.nutrients ?? {},
    };
    if (refuse.length) record.refuse = refuse;
    // The CNF points at the USDA number for many of its foods. That is a
    // cross-reference between two datasets, not an identity: the Canadian food
    // keeps its own identifier and its own provenance.
    if (food.ndb) record.crossReference = { dataset: "usda", id: `usda:${food.ndb}` };
    foods.push(record);
  }

  return { foods, findings };
}
