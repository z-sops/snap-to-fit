import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  APP_NUTRIENT_KEYS,
  CNF_EXCLUDED_TAGS,
  CNF_NUTRIENT_SOURCE_QUALITY,
  CNF_TAGS_BY_APP_KEY,
  isDisplayableNumber,
  isSettled,
  isUsableValue,
  normalizeCnfValue,
  normalizeCofidValue,
  type CnfNutrientAmountRow,
} from "../research/normalize";

// M2-0 research tests. They pin the normalisation rules before any data is
// ingested. They touch no production module and no network.

const fixtures = path.join(process.cwd(), "research", "fixtures");

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let first = true;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      first = false;
    } else if (c !== "\r") {
      // The published files carry a byte-order mark.
      if (first && field.length === 0 && c.charCodeAt(0) === 0xfeff) continue;
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1);
}

function readCsv(name: string): string[][] {
  return parseCsv(fs.readFileSync(path.join(fixtures, name), "utf8"));
}

const nutrientAmount = readCsv("cnf-2026-nutrient-amount.synthetic.csv");
const nutrientAmountHeader = nutrientAmount[0];
const cnfRows: CnfNutrientAmountRow[] = nutrientAmount.slice(1).map((r) => ({
  food_code: r[0],
  nutrient_code: r[1],
  nutrient_amount: r[2],
  standard_error: r[3],
  observations: r[4],
  nutrient_source_code: r[5],
  nutrient_last_updated_date: r[6],
}));

test("every app nutrient key maps to exactly one CNF tag", () => {
  const tags = Object.values(CNF_TAGS_BY_APP_KEY);
  assert.equal(tags.length, APP_NUTRIENT_KEYS.length);
  assert.equal(new Set(tags).size, tags.length, "a CNF tag is used twice");
  for (const key of APP_NUTRIENT_KEYS) assert.ok(CNF_TAGS_BY_APP_KEY[key], key);
});

test("the two CNF nutrients that must not be mapped are recorded as excluded", () => {
  assert.ok(CNF_EXCLUDED_TAGS.ENERC_KJ);
  assert.ok(CNF_EXCLUDED_TAGS.VITD_IU);
  const used = new Set(Object.values(CNF_TAGS_BY_APP_KEY));
  for (const tag of Object.keys(CNF_EXCLUDED_TAGS)) assert.ok(!used.has(tag), tag);
});

test("the published CNF nutrient code table matches the quality map", () => {
  const rows = readCsv("cnf-2026-nutrient-source.csv");
  const header = rows[0];
  const codeIndex = header.indexOf("Nutrient_Source_Code");
  assert.ok(codeIndex >= 0);
  for (const r of rows.slice(1)) {
    const code = r[codeIndex];
    assert.ok(
      code === "12" || CNF_NUTRIENT_SOURCE_QUALITY[code],
      `CNF nutrient source code ${code} has no quality mapping`,
    );
  }
});

test("a value with no laboratory observations is still a value", () => {
  // Observations is 0 for calculated, imputed and assumed values. That must
  // never be read as "missing".
  const calculated = cnfRows.find((r) => r.food_code === "203" && r.nutrient_code === "291")!;
  assert.equal(calculated.observations, "0");
  const value = normalizeCnfValue(calculated);
  assert.equal(value.state, "calculated");
  assert.equal(value.value, 1.1);
  assert.ok(isUsableValue(value));
  assert.ok(isDisplayableNumber(value));
});

test("an assumed zero is a documented zero, not a missing value", () => {
  const assumed = cnfRows.find((r) => r.food_code === "204" && r.nutrient_code === "204")!;
  assert.equal(assumed.nutrient_source_code, "12");
  assert.equal(Number(assumed.nutrient_amount), 0);
  const value = normalizeCnfValue(assumed);
  assert.equal(value.state, "documented-zero");
  assert.equal(value.value, 0);
  assert.ok(isUsableValue(value), "a documented zero is a real number");
});

test("an assumed zero paired with a non-zero amount is a conflict, not a zero", () => {
  // The source code says "assumed zero" but the published amount is not zero.
  // The amount must survive, and the row must be flagged rather than silently
  // rewritten or treated as verified data.
  const conflict = cnfRows.find((r) => r.food_code === "207" && r.nutrient_code === "204")!;
  assert.equal(conflict.nutrient_source_code, "12");
  assert.equal(Number(conflict.nutrient_amount), 0.02);
  const value = normalizeCnfValue(conflict);
  assert.equal(value.value, 0.02, "the published amount must be preserved");
  assert.notEqual(value.value, 0, "the amount must not be replaced with zero");
  assert.equal(value.state, "estimated", "a conflict must not claim a verified quality");
  assert.equal(value.needsReview, true);
  assert.match(value.reviewReason!, /assumed zero/);
  assert.ok(!isSettled(value), "a conflicted value is not settled");
  // It is still a number the user can see, flagged for review.
  assert.ok(isDisplayableNumber(value));
});

test("an assumed zero with a large non-zero amount is also a conflict", () => {
  const conflict = cnfRows.find((r) => r.food_code === "208" && r.nutrient_code === "204")!;
  assert.equal(conflict.nutrient_source_code, "12");
  assert.equal(Number(conflict.nutrient_amount), 7.71);
  const value = normalizeCnfValue(conflict);
  assert.equal(value.value, 7.71);
  assert.equal(value.needsReview, true);
  assert.equal(value.state, "estimated");
});

test("a blank amount is never a zero", () => {
  // Number("") is 0, and reading it that way would invent a measurement.
  const blank = cnfRows.find((r) => r.food_code === "209" && r.nutrient_code === "204")!;
  assert.equal(blank.nutrient_amount, "");
  const value = normalizeCnfValue(blank);
  assert.equal(value.state, "unknown");
  assert.equal(value.value, undefined);
  assert.ok(!isUsableValue(value));
  assert.ok(!isDisplayableNumber(value));
});

test("a laboratory value keeps its observations and its source", () => {
  const analysed = cnfRows.find((r) => r.food_code === "203" && r.nutrient_code === "203")!;
  const value = normalizeCnfValue(analysed, { "3": "Nutrient analyzed in a Canadian government lab" });
  assert.equal(value.state, "analysed");
  assert.equal(value.value, 12.5);
  assert.equal(value.observations, 8);
  assert.equal(value.standardError, 0.4);
  assert.equal(value.sourceCode, "3");
  assert.equal(value.sourceDescription, "Nutrient analyzed in a Canadian government lab");
});

test("imputed, estimated and calculated values are told apart", () => {
  const imputed = cnfRows.find((r) => r.food_code === "204" && r.nutrient_code === "203")!;
  assert.equal(normalizeCnfValue(imputed).state, "imputed");
  const calculated = cnfRows.find((r) => r.food_code === "205" && r.nutrient_code === "208" && r.nutrient_source_code === "51")!;
  assert.equal(normalizeCnfValue(calculated).state, "calculated");
  const estimated = cnfRows.find((r) => r.food_code === "206" && r.nutrient_code === "307")!;
  assert.equal(normalizeCnfValue(estimated).state, "estimated");
});

test("a value carried over from USDA is not claimed to be laboratory analysed", () => {
  // Code 0 says only that the value is unchanged from USDA. The CNF does not
  // state the quality of the value it carries over.
  const inherited = cnfRows.find((r) => r.food_code === "204" && r.nutrient_code === "208")!;
  assert.equal(inherited.nutrient_source_code, "0");
  const value = normalizeCnfValue(inherited);
  assert.equal(value.state, "inherited");
  assert.notEqual(value.state, "analysed");
  assert.equal(value.value, 210);
});

test("an international database value is not claimed to be laboratory analysed", () => {
  const international = cnfRows.find((r) => r.food_code === "210" && r.nutrient_code === "203")!;
  assert.equal(international.nutrient_source_code, "81");
  const value = normalizeCnfValue(international);
  assert.equal(value.state, "inherited");
  assert.notEqual(value.state, "analysed");
  // No positive observation count, so nothing here establishes analysis.
  assert.ok(!(value.observations && value.observations > 0));
});

test("an unknown source code is flagged for review, not treated as verified", () => {
  const unknown = cnfRows.find((r) => r.food_code === "211" && r.nutrient_code === "203")!;
  assert.equal(unknown.nutrient_source_code, "999");
  const value = normalizeCnfValue(unknown);
  assert.equal(value.value, 4.5, "the amount is kept");
  assert.equal(value.needsReview, true);
  assert.match(value.reviewReason!, /not in the published/);
  assert.ok(!isSettled(value));
});

test("an absent row is the only thing that means unknown", () => {
  const value = normalizeCnfValue(undefined);
  assert.equal(value.state, "unknown");
  assert.equal(value.value, undefined);
  assert.ok(!isUsableValue(value));
  assert.ok(!isDisplayableNumber(value));
});

test("a zero that was measured is a documented zero", () => {
  const measured = cnfRows.find((r) => r.food_code === "206" && r.nutrient_code === "601")!;
  const value = normalizeCnfValue(measured);
  assert.equal(value.state, "documented-zero");
  assert.equal(value.value, 0);
});

test("an unrecognised source code keeps the value but does not claim quality", () => {
  const value = normalizeCnfValue({
    food_code: "999",
    nutrient_code: "203",
    nutrient_amount: "5.0",
    standard_error: "",
    observations: "",
    nutrient_source_code: "999",
    nutrient_last_updated_date: "2026-01-28",
  });
  assert.equal(value.state, "estimated");
  assert.equal(value.value, 5);
  assert.equal(value.sourceCode, "999");
  assert.equal(value.needsReview, true);
});

test("the CoFID sentinels are read the way the user guide documents them", () => {
  const rows = readCsv("cofid-2021-sentinels.synthetic.csv");
  const header = rows[0];
  const at = (food: string, nutrient: string) => {
    const r = rows.slice(1).find((x) => x[0] === food && x[1] === nutrient)!;
    return r[header.indexOf("value")];
  };
  // N: present, but no reliable amount.
  const notDetermined = normalizeCofidValue(at("9002", "Energy (kcal)"));
  assert.equal(notDetermined.state, "unknown");
  assert.equal(notDetermined.value, undefined);
  // Tr: present, but below the quantification limit. Not a zero.
  const trace = normalizeCofidValue(at("9002", "Sodium (mg)"));
  assert.equal(trace.state, "trace");
  assert.equal(trace.value, undefined);
  assert.ok(!isDisplayableNumber(trace), "a trace must never be shown as a number");
  // Bracketed: an estimate, not a measurement, and not missing.
  const estimated = normalizeCofidValue(at("9003", "Energy (kcal)"));
  assert.equal(estimated.state, "estimated");
  assert.equal(estimated.value, 187);
  assert.ok(isDisplayableNumber(estimated));
  // Empty: not reported.
  assert.equal(normalizeCofidValue(at("9004", "Energy (kcal)")).state, "unknown");
  // Zero: a documented zero.
  const zero = normalizeCofidValue(at("9003", "Sodium (mg)"));
  assert.equal(zero.state, "documented-zero");
  assert.equal(zero.value, 0);
  // A value with a footnote must be read with its footnote.
  const footnoted = normalizeCofidValue(at("9006", "Energy (kcal)"));
  assert.equal(footnoted.value, 98.2);
  assert.equal(footnoted.needsReview, true);
  assert.ok(!isSettled(footnoted));
});

test("no CNF fixture row turns an unknown into a number", () => {
  for (const row of cnfRows) {
    const value = normalizeCnfValue(row);
    if (value.state === "unknown") assert.equal(value.value, undefined, JSON.stringify(row));
  }
});

test("a value is never displayed when its state says it is not a number", () => {
  for (const row of cnfRows) {
    const value = normalizeCnfValue(row);
    if (value.state === "trace" || value.state === "unknown")
      assert.ok(!isDisplayableNumber(value), JSON.stringify(row));
  }
});

test("no fixture row silently replaces a published amount with zero", () => {
  for (const row of cnfRows) {
    const published = Number(row.nutrient_amount);
    if (!Number.isFinite(published) || published === 0) continue;
    const value = normalizeCnfValue(row);
    assert.equal(value.value, published, JSON.stringify(row));
  }
});
