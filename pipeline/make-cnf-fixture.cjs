// Builds the checked-in CNF fixture from the cached release.
//
// It takes a deterministic slice: the first foods by code, plus the specific
// foods that exercise the rules the pipeline has to keep — a code 12
// contradiction, a value carried over from USDA, a laboratory value, a
// calculated value, and a food with a USDA cross-reference.
const fs = require("node:fs");
const path = require("node:path");

const src = process.argv[2];
const out = process.argv[3];
if (!src || !out) throw new Error("usage: make-cnf-fixture.cjs <extracted cnf dir> <out dir>");

const read = (f) =>
  fs.readFileSync(path.join(src, f), "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);

function parse(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
function table(f) {
  const lines = read(f);
  const header = parse(lines[0]);
  const index = new Map();
  header.forEach((h, i) => index.set(h, i));
  return { header, index, rows: lines.slice(1).map(parse) };
}
const cell = (row, index, name) => { const at = index.get(name); return at === undefined ? undefined : row[at]; };

const foodName = table("Food_Name.csv");
const nutrientAmount = table("Nutrient_Amount.csv");

// The mapped nutrient codes: the nineteen the app tracks.
const nutrientName = table("Nutrient_Name.csv");
const codeByTag = new Map();
for (const row of nutrientName.rows) {
  const tag = cell(row, nutrientName.index, "Tagname");
  if (!tag) continue;
  const list = codeByTag.get(tag) ?? [];
  list.push(cell(row, nutrientName.index, "Nutrient_Code"));
  codeByTag.set(tag, list);
}
const APP_TAGS = ["ENERC_KCAL","PROCNT","CHOCDF","FAT","FIBTG","SUGAR","FASAT","NA","K","CA","FE","MG","ZN","VITC","VITD","VITB12","FOLDFE","VITA_RAE","CHOLE"];
const mapped = new Set();
for (const tag of APP_TAGS) for (const code of codeByTag.get(tag) ?? []) mapped.add(code);

// The code 12 rows whose amount is not zero: the contradictions. The ones on
// a mapped nutrient are the ones the app would actually surface, so those are
// the ones the fixture must carry.
const conflicts = new Set();
const conflictsOnMapped = new Set();
for (const row of nutrientAmount.rows) {
  if (cell(row, nutrientAmount.index, "Nutrient_Source_Code") !== "12") continue;
  const amount = Number(cell(row, nutrientAmount.index, "Nutrient_Amount"));
  if (!Number.isFinite(amount) || amount === 0) continue;
  const food = cell(row, nutrientAmount.index, "Food_Code");
  conflicts.add(food);
  if (mapped.has(cell(row, nutrientAmount.index, "Nutrient_Code"))) conflictsOnMapped.add(food);
}

// A food whose values carry an unknown nutrient source code, if there is one.
const knownCodes = new Set(table("Nutrient_Source.csv").rows.map((r) => cell(r, table("Nutrient_Source.csv").index, "Nutrient_Source_Code")));
const unknownCodeFoods = new Set();
for (const row of nutrientAmount.rows) {
  const code = cell(row, nutrientAmount.index, "Nutrient_Source_Code");
  if (code && !knownCodes.has(code)) unknownCodeFoods.add(cell(row, nutrientAmount.index, "Food_Code"));
}

// A food with a USDA cross-reference and a laboratory value.
const laboratory = new Set();
for (const row of nutrientAmount.rows) {
  if (cell(row, nutrientAmount.index, "Nutrient_Source_Code") === "3") laboratory.add(cell(row, nutrientAmount.index, "Food_Code"));
}

const chosen = new Set();
// The two foods the publisher's own documentation works through: food 1700,
// 250 ml of unsweetened applesauce, is 257.819 g, and food 7215, one medium
// Granny Smith apple, is 167 g. The fixture carries both, so the tests can
// check the conversion against the publisher's own numbers.
chosen.add("1700");
chosen.add("7215");
for (const row of foodName.rows) {
  const code = cell(row, foodName.index, "Food_Code");
  if (chosen.size < 10) chosen.add(code);
}
// The contradictions on a mapped nutrient come first: they are the ones the
// pipeline has to keep flagging.
for (const code of [...conflictsOnMapped].sort()) if (chosen.size < 14) chosen.add(code);
for (const code of [...conflicts].sort()) if (chosen.size < 18) chosen.add(code);
for (const code of [...unknownCodeFoods].sort()) if (chosen.size < 20) chosen.add(code);
for (const code of [...laboratory].sort()) if (chosen.size < 22) chosen.add(code);

fs.mkdirSync(out, { recursive: true });
const write = (name, header, rows) => {
  const quote = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  fs.writeFileSync(path.join(out, name), [header.map(quote).join(","), ...rows.map((r) => r.map(quote).join(","))].join("\n") + "\n");
};

// Food_Name: the chosen foods, in code order.
const foodRows = foodName.rows
  .filter((r) => chosen.has(cell(r, foodName.index, "Food_Code")))
  .sort((a, b) => Number(cell(a, foodName.index, "Food_Code")) - Number(cell(b, foodName.index, "Food_Code")));
write("Food_Name.csv", foodName.header, foodRows);

// Nutrient_Amount: every row for the chosen foods.
const amountRows = nutrientAmount.rows.filter((r) => chosen.has(cell(r, nutrientAmount.index, "Food_Code")));
write("Nutrient_Amount.csv", nutrientAmount.header, amountRows);

// The small code tables, in full.
for (const name of ["Nutrient_Name.csv", "Nutrient_Source.csv", "Food_Source.csv", "CNF_Food_Group.csv", "Measure_Type.csv", "Measure_Name.csv"]) {
  const t = table(name);
  write(name, t.header, t.rows);
}
// The measure conversions for the chosen foods.
const mwc = table("Measure_Weight_Conversion.csv");
const measureRows = mwc.rows.filter((r) => chosen.has(cell(r, mwc.index, "Food_Code")));
write("Measure_Weight_Conversion.csv", mwc.header, measureRows);

console.log("chosen foods:", chosen.size, "conflicts:", conflicts.size, "unknown-code foods:", unknownCodeFoods.size);
console.log("Nutrient_Amount rows:", amountRows.length);
