// M2-0 research: measures the published Health Canada CNF 2026 release.
//
// This script produces the numbers quoted in docs/m2/CNF_2026_NORMALIZATION.md
// so they can be re-derived rather than trusted. It is a research tool: it is
// not part of the app, it is not run by the test suite, and it needs the
// official archive to be present.
//
// Usage:
//   node research/measure-cnf-2026.mjs <path to the extracted CNF 2026 folder>
//
// The folder must contain the nine relational CSV files from
// cnf_fcen_all-files-data_2026.zip.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = process.argv[2];
if (!dir) {
  console.error("Pass the folder holding the extracted CNF 2026 CSV files.");
  process.exit(1);
}

const read = (f) =>
  fs
    .readFileSync(path.join(dir, f), "utf8")
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter(Boolean);

function parseCsv(line) {
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

const table = (f) => {
  const lines = read(f);
  const hdr = parseCsv(lines[0]);
  const ix = {};
  hdr.forEach((h, i) => (ix[h] = i));
  return { hdr, ix, rows: lines.slice(1).map(parseCsv) };
};

const na = table("Nutrient_Amount.csv");
const V = na.ix.Nutrient_Amount;
const O = na.ix.Observations;
const S = na.ix.Nutrient_Source_Code;

const obsStatus = (v) => {
  if (v === "" || v === undefined) return "obs-empty";
  const n = Number(v);
  if (!Number.isFinite(n)) return "obs-unparseable";
  return n > 0 ? "obs-positive" : "obs-zero";
};
const valueStatus = (v) => {
  if (v === "" || v === undefined) return "value-empty";
  const n = Number(v);
  if (!Number.isFinite(n)) return "value-unparseable";
  return n === 0 ? "value-zero" : "value-nonzero";
};

/* ------------------------------------------------------------------ *
 * 1. The cross-tab: source code x value status x observation status
 * ------------------------------------------------------------------ */

const cell = new Map();
const codeTotals = new Map();
let totalRows = 0;
const values = [];

for (const r of na.rows) {
  totalRows++;
  const code = r[S];
  const vs = valueStatus(r[V]);
  const os = obsStatus(r[O]);
  const key = `${code}|${vs}|${os}`;
  cell.set(key, (cell.get(key) || 0) + 1);
  codeTotals.set(code, (codeTotals.get(code) || 0) + 1);
  values.push({ code, vs, os, amount: r[V], obs: r[O] });
}

console.log("### CNF 2026 Nutrient_Amount.csv");
console.log("rows=" + totalRows);
console.log("distinct foods=" + new Set(na.rows.map((r) => r[na.ix.Food_Code])).size);
console.log("distinct nutrients=" + new Set(na.rows.map((r) => r[na.ix.Nutrient_Code])).size);
console.log("");

/* ------------------------------------------------------------------ *
 * 2. The summary table the documentation quotes
 * ------------------------------------------------------------------ */

const sourceDesc = {};
table("Nutrient_Source.csv").rows.forEach((r) => (sourceDesc[r[0]] = r[1]));

const summary = [];
const codes = [...codeTotals.keys()].sort((a, b) => Number(a) - Number(b));
for (const code of codes) {
  const count = (vs, os) => cell.get(`${code}|${vs}|${os}`) || 0;
  summary.push({
    code,
    rows: codeTotals.get(code),
    value_zero: count("value-zero", "obs-positive") + count("value-zero", "obs-zero") + count("value-zero", "obs-empty") + count("value-zero", "obs-unparseable"),
    value_nonzero:
      count("value-nonzero", "obs-positive") +
      count("value-nonzero", "obs-zero") +
      count("value-nonzero", "obs-empty") +
      count("value-nonzero", "obs-unparseable"),
    value_empty:
      count("value-empty", "obs-positive") +
      count("value-empty", "obs-zero") +
      count("value-empty", "obs-empty") +
      count("value-empty", "obs-unparseable"),
    obs_positive: count("value-zero", "obs-positive") + count("value-nonzero", "obs-positive") + count("value-empty", "obs-positive"),
    obs_zero: count("value-zero", "obs-zero") + count("value-nonzero", "obs-zero") + count("value-empty", "obs-zero"),
    obs_empty: count("value-zero", "obs-empty") + count("value-nonzero", "obs-empty") + count("value-empty", "obs-empty"),
    description: sourceDesc[code] || "(not in Nutrient_Source.csv)",
  });
}

console.log("code|rows|value-zero|value-nonzero|value-empty|obs-positive|obs-zero|obs-empty|description");
for (const s of summary)
  console.log(
    `${s.code}|${s.rows}|${s.value_zero}|${s.value_nonzero}|${s.value_empty}|${s.obs_positive}|${s.obs_zero}|${s.obs_empty}|${s.description}`,
  );
console.log("");

/* ------------------------------------------------------------------ *
 * 3. The figures the review asked to be reconciled
 * ------------------------------------------------------------------ */

const code12 = values.filter((v) => v.code === "12");
const code12NonZero = code12.filter((v) => v.vs === "value-nonzero");
console.log("### code 12 (assumed zero)");
console.log("rows=" + code12.length);
console.log("value-zero=" + code12.filter((v) => v.vs === "value-zero").length);
console.log("value-nonzero=" + code12NonZero.length);
console.log("value-empty=" + code12.filter((v) => v.vs === "value-empty").length);
console.log("non-zero rows with observations>0=" + code12NonZero.filter((v) => v.os === "obs-positive").length);
console.log("distinct non-zero amounts (first 20):");
console.log(
  [...new Set(code12NonZero.map((v) => v.amount))]
    .slice(0, 20)
    .map((a) => "  " + a)
    .join("\n"),
);
console.log("");

const noObs = values.filter((v) => v.vs === "value-nonzero" && (v.os === "obs-zero" || v.os === "obs-empty"));
console.log("### non-zero values with no positive observation count (all source codes)");
console.log("rows=" + noObs.length);
const byCode = {};
for (const v of noObs) byCode[v.code] = (byCode[v.code] || 0) + 1;
console.log(
  Object.keys(byCode)
    .sort((a, b) => Number(a) - Number(b))
    .map((c) => `  code ${c}: ${byCode[c]}`)
    .join("\n"),
);
console.log("");

const zeroNoObs = values.filter((v) => v.vs === "value-zero" && (v.os === "obs-zero" || v.os === "obs-empty"));
console.log("### zero values with no positive observation count (all source codes)");
console.log("rows=" + zeroNoObs.length);
console.log("");

const conflicts = values.filter(
  (v) => v.code === "12" && v.vs === "value-nonzero",
);
console.log("### source-code conflicts to review");
console.log("code 12 with a non-zero amount=" + conflicts.length);

/* ------------------------------------------------------------------ *
 * 4. The generated summary artefact
 * ------------------------------------------------------------------ */

const outPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "cnf-2026-nutrient-amount-summary.csv",
);
const csv = [
  "nutrient_source_code,description,rows,value_zero,value_nonzero,value_empty,obs_positive,obs_zero,obs_empty",
  ...summary.map(
    (s) =>
      `${s.code},"${String(s.description).replace(/"/g, '""')}",${s.rows},${s.value_zero},${s.value_nonzero},${s.value_empty},${s.obs_positive},${s.obs_zero},${s.obs_empty}`,
  ),
].join("\n");
fs.writeFileSync(outPath, csv + "\n", "utf8");
console.log("");
console.log("wrote " + outPath);
