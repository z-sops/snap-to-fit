import path from "node:path";
import { readCsv, cell } from "./adapters/csv";
import { CNF_TAG_BY_APP_KEY, CNF_ASSUMED_ZERO_CODE } from "./adapters/nutrients";

/**
 * The measurement behind the source-conflict findings.
 *
 * It answers one question about a published Canadian release: how often does
 * the file's own `Nutrient_Source_Code` contradict the amount printed beside
 * it, and how often does that happen on a nutrient the app maps?
 *
 *   node --import tsx pipeline/analyse-conflicts.ts <the unpacked CNF folder>
 */
const dir = process.argv[2] ?? path.join(process.cwd(), "pipeline", ".cache", "ca-cnf-2026");

const nutrientNames = readCsv(path.join(dir, "Nutrient_Name.csv"));
const codeByTag = new Map<string, string[]>();
for (const row of nutrientNames.rows) {
  const tag = cell(row, nutrientNames.index, "Tagname");
  if (!tag) continue;
  const list = codeByTag.get(tag) ?? [];
  list.push(cell(row, nutrientNames.index, "Nutrient_Code")!);
  codeByTag.set(tag, list);
}
const mapped = new Set<string>();
for (const tag of Object.values(CNF_TAG_BY_APP_KEY))
  for (const code of codeByTag.get(tag) ?? []) mapped.add(code);

const amounts = readCsv(path.join(dir, "Nutrient_Amount.csv"));
let rows = 0;
let assumedZeroRows = 0;
let assumedZeroMapped = 0;
let contradictions = 0;
let contradictionsMapped = 0;
const examples: { food: string; nutrient: string; amount: string; observations: string }[] = [];

for (const row of amounts.rows) {
  rows++;
  const code = cell(row, amounts.index, "Nutrient_Source_Code");
  if (code !== CNF_ASSUMED_ZERO_CODE) continue;
  assumedZeroRows++;
  const nutrient = cell(row, amounts.index, "Nutrient_Code")!;
  const isMapped = mapped.has(nutrient);
  if (isMapped) assumedZeroMapped++;
  const amount = cell(row, amounts.index, "Nutrient_Amount")!;
  if (Number(amount) !== 0) {
    contradictions++;
    if (isMapped) {
      contradictionsMapped++;
      if (examples.length < 5)
        examples.push({
          food: cell(row, amounts.index, "Food_Code")!,
          nutrient,
          amount,
          observations: cell(row, amounts.index, "Observations") ?? "",
        });
    }
  }
}

console.log(`rows: ${rows}`);
console.log(`mapped nutrient codes: ${mapped.size}`);
console.log(`"assumed zero" rows: ${assumedZeroRows}, of which on a mapped nutrient: ${assumedZeroMapped}`);
console.log(`contradictions: ${contradictions}, of which on a mapped nutrient: ${contradictionsMapped}`);
console.log("examples:", JSON.stringify(examples));
