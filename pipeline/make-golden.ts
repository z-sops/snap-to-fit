// Writes the golden build fixture from the checked-in CNF fixture.
//
// The golden file is what the determinism test compares against, so it is
// produced by the same code path the test uses.
import fs from "node:fs";
import path from "node:path";
import { buildDataset, SCHEMA_VERSION, type BuildInput } from "../pipeline/build/build";

const root = process.cwd();
const cnfInput: BuildInput = {
  id: "ca-cnf-2026",
  kind: "publisher-archive",
  sha256: "f5faad8977ee6bbdd9d69c8649077cacd87d8658ad200509a4047db1e29edcdd",
  bytes: 26656195,
  region: "CA",
  version: "2026",
  licence: {
    name: "Open Government Licence – Canada",
    commercial_use: "permitted",
    legal_confirmation: "published-licence",
  },
};

const dataset = buildDataset([cnfInput], path.join(root, "pipeline", "fixtures", "cnf-2026"), { mode: "fixture" });
const out = path.join(root, "pipeline", "fixtures", "golden");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(
  path.join(out, "cnf-foods.json"),
  JSON.stringify(
    { foods: dataset.foods, findings: dataset.findings, schema_version: dataset.schema_version },
    null,
    1,
  ) + "\n",
);
console.log("records:", dataset.foods.length, "findings:", dataset.findings.length, "schema:", SCHEMA_VERSION);
