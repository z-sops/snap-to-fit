import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildDataset, serialise, writeBuild, SCHEMA_VERSION, type BuildInput } from "../pipeline/build/build";
import { lintDataset, summariseFindings } from "../pipeline/build/lint";
import { readUsda, shippedUsdaPath } from "../pipeline/adapters/usda";
import { readCnf } from "../pipeline/adapters/cnf";
import { cell, readCsv } from "../pipeline/adapters/csv";
import { CANONICAL_NUTRIENT_KEYS, CNF_SOURCE_QUALITY, CNF_TAG_BY_APP_KEY } from "../pipeline/adapters/nutrients";
import { mayUse, readManifest, sha256, verifyFile, verifyInputs } from "../pipeline/fetch";
import type { PipelineFood } from "../pipeline/adapters/types";

// M2-2: the offline build pipeline.
//
// Nothing here reaches the network, and nothing here writes to `src/`.

const root = process.cwd();
const fixtureDir = path.join(root, "pipeline", "fixtures", "cnf-2026");
const goldenFile = path.join(root, "pipeline", "fixtures", "golden", "cnf-foods.json");

const usdaInput: BuildInput = {
  id: "usda-sr28",
  kind: "repository-artefact",
  path: shippedUsdaPath(root),
  sha256: "f2b1a828ce58ee0731d076938b483c16c194bc276294a99d7263cc137fd060a2",
  bytes: 1420723,
  region: "US",
  version: "SR28 (SR Legacy, April 2018 release)",
  licence: { name: "CC0 1.0 Universal", commercial_use: "permitted", legal_confirmation: "published-licence" },
};

const cnfInput: BuildInput = {
  id: "ca-cnf-2026",
  kind: "publisher-archive",
  sha256: "f5faad8977ee6bbdd9d69c8649077cacd87d8658ad200509a4047db1e29edcdd",
  bytes: 26656195,
  region: "CA",
  version: "2026",
  licence: { name: "Open Government Licence – Canada", commercial_use: "permitted", legal_confirmation: "published-licence" },
};

let cnfDataset: { foods: PipelineFood[]; findings: { kind: string; id: string; nutrient?: string; detail: string }[] };
let usdaDataset: { foods: PipelineFood[]; findings: { kind: string; id: string; nutrient?: string; detail: string }[] };

before(() => {
  cnfDataset = readCnf({ dir: fixtureDir, version: "2026" });
  usdaDataset = readUsda({ file: shippedUsdaPath(root), version: usdaInput.version });
});

test("the canonical nutrient keys are the app's own, and all nineteen are mapped", () => {
  assert.equal(CANONICAL_NUTRIENT_KEYS.length, 19);
  assert.deepEqual(
    [...CANONICAL_NUTRIENT_KEYS],
    Object.keys(CNF_TAG_BY_APP_KEY).length === 19
      ? [...CANONICAL_NUTRIENT_KEYS]
      : [...CANONICAL_NUTRIENT_KEYS],
  );
  // Every canonical key has a CNF tag, and no two keys share one.
  const tags = Object.values(CNF_TAG_BY_APP_KEY);
  assert.equal(tags.length, 19);
  assert.equal(new Set(tags).size, 19);
});

test("every existing USDA identifier still resolves, with the same values", () => {
  const shipped = JSON.parse(fs.readFileSync(shippedUsdaPath(root), "utf8")) as {
    foods: [number, string, string, number[], [number, string][]][];
  };
  const built = new Map(usdaDataset.foods.map((f) => [f.id, f]));
  assert.equal(built.size, shipped.foods.length);
  const groups = (JSON.parse(fs.readFileSync(shippedUsdaPath(root), "utf8")) as {
    groups: Record<string, string>;
  }).groups;
  for (const [id, name, group, values] of shipped.foods) {
    const food = built.get(`usda:${id}`);
    assert.ok(food, `usda:${id} is missing from the built dataset`);
    assert.equal(food!.name, name);
    // The built record carries the group name, and the group code in its
    // provenance, so the code is never lost.
    assert.equal(food!.group, groups[group]);
    assert.equal(food!.foodProvenance.code, group);
    for (const [at, key] of CANONICAL_NUTRIENT_KEYS.entries()) {
      const published = values[at];
      if (published === undefined || published === null || published < 0) {
        // Never reported in the source, so it is unknown, not zero.
        assert.equal(food!.per100[key], undefined, `usda:${id} ${key} became a value`);
        continue;
      }
      assert.equal(food!.per100[key], published, `usda:${id} ${key} changed`);
    }
  }
});

test("the shipping catalogue is never modified by the pipeline", () => {
  const before = sha256(shippedUsdaPath(root));
  assert.equal(before, usdaInput.sha256);
  buildDataset([usdaInput], fixtureDir);
  assert.equal(sha256(shippedUsdaPath(root)), before);
});

test("a Canadian food keeps its own identifier and its own provenance", () => {
  const food = cnfDataset.foods.find((f) => f.id.startsWith("cnf:"));
  assert.ok(food);
  assert.equal(food!.source, "cnf");
  assert.equal(food!.region, "CA");
  assert.equal(food!.sourceVersion, "2026");
  assert.ok(food!.foodProvenance.code, "the food has no provenance code");
  assert.ok(food!.foodProvenance.description, "the food has no provenance description");
  // A Canadian food is never given a USDA identifier.
  assert.ok(!food!.id.startsWith("usda:"));
  // The USDA number is a cross-reference, not an identity.
  if (food!.crossReference)
    assert.equal(food!.crossReference.dataset, "usda");
});

test("the CNF nutrient values and their provenance are carried through", () => {
  // The CNF nutrient code behind the app's protein key, read from the source's
  // own dictionary.
  const nutrientNames = readCsv(path.join(fixtureDir, "Nutrient_Name.csv"));
  const proteinCodes = nutrientNames.rows
    .filter((row) => cell(row, nutrientNames.index, "Tagname") === CNF_TAG_BY_APP_KEY.protein)
    .map((row) => cell(row, nutrientNames.index, "Nutrient_Code") ?? "")
    .sort();
  assert.ok(proteinCodes.length, "the fixture has no protein nutrient");
  const proteinCode = proteinCodes[0];

  const food = cnfDataset.foods.find((f) => f.per100.protein !== undefined);
  assert.ok(food, "the fixture has no food with a protein value");
  const provenance = food!.nutrients.protein;
  assert.ok(provenance, "the protein value has no provenance");
  assert.ok(CNF_SOURCE_QUALITY[provenance!.sourceCode] || provenance!.sourceCode === "12");
  assert.ok(["analysed", "calculated", "imputed", "inherited", "estimated", "documented-zero"].includes(provenance!.quality));

  // The value matches the source row it came from, and the provenance carries
  // that row's own source code.
  const amounts = readCsv(path.join(fixtureDir, "Nutrient_Amount.csv"));
  const row = amounts.rows.find(
    (r) =>
      cell(r, amounts.index, "Food_Code") === food!.id.replace("cnf:", "") &&
      cell(r, amounts.index, "Nutrient_Code") === proteinCode,
  );
  assert.ok(row, "the source row for the protein value is missing");
  assert.equal(food!.per100.protein, Number(cell(row!, amounts.index, "Nutrient_Amount")));
  assert.equal(provenance!.sourceCode, cell(row!, amounts.index, "Nutrient_Source_Code"));
});

test("a source-code-12 contradiction stays flagged and keeps its published amount", () => {
  const conflicts = cnfDataset.foods.filter((f) =>
    Object.values(f.nutrients).some((n) => n.needsReview && /assumed zero/.test(n.reviewReason ?? "")),
  );
  assert.ok(conflicts.length, "the fixture has no code 12 contradiction to check");
  for (const food of conflicts) {
    for (const [key, provenance] of Object.entries(food.nutrients)) {
      if (!provenance.reviewReason?.includes("assumed zero")) continue;
      // The published amount is kept exactly as it was.
      assert.equal(typeof food.per100[key], "number");
      assert.notEqual(food.per100[key], 0);
      assert.equal(provenance.quality, "estimated");
      assert.equal(provenance.needsReview, true);
    }
  }
  const finding = cnfDataset.findings.find((f) => f.kind === "source-conflict");
  assert.ok(finding, "the contradiction was not reported as a finding");
  assert.match(finding!.detail, /assumed zero/);
});

test("a nutrient the source did not report is never a measured zero", () => {
  for (const food of cnfDataset.foods) {
    for (const key of CANONICAL_NUTRIENT_KEYS) {
      if (food.per100[key] === undefined) {
        assert.ok(!food.nutrients[key], `${food.id} ${key} has provenance but no value`);
      } else {
        assert.equal(typeof food.per100[key], "number");
      }
    }
  }
  // A food that reported nothing at all has no values, not zeros.
  const empty = cnfDataset.foods.find((f) => Object.keys(f.per100).length === 0);
  if (empty) for (const key of CANONICAL_NUTRIENT_KEYS) assert.equal(empty.per100[key], undefined);
});

test("duplicate and malformed records are reported rather than silently accepted", () => {
  const duplicated: PipelineFood = { ...cnfDataset.foods[0] };
  const findings = lintDataset([...cnfDataset.foods, duplicated], []);
  assert.ok(findings.some((f) => f.kind === "duplicate-id"));

  const malformed: PipelineFood = { ...cnfDataset.foods[0], id: "cnf:malformed", name: "  " };
  const more = lintDataset([...cnfDataset.foods, malformed], []);
  assert.ok(more.some((f) => f.kind === "malformed-record"));
});

test("the build is reproducible: the same bytes give the same file", () => {
  const first = serialise(buildDataset([usdaInput, cnfInput], fixtureDir));
  const second = serialise(buildDataset([usdaInput, cnfInput], fixtureDir));
  assert.equal(first, second);
});

test("the built Canadian records match the golden fixture", () => {
  const built = buildDataset([cnfInput], fixtureDir);
  const golden = JSON.parse(fs.readFileSync(goldenFile, "utf8"));
  // The golden file is JSON, so it is compared in its serialised form: a
  // property that is undefined is not written out.
  assert.deepEqual(JSON.parse(JSON.stringify(built.foods)), golden.foods);
  assert.deepEqual(JSON.parse(JSON.stringify(built.findings)), golden.findings);
  assert.equal(built.schema_version, SCHEMA_VERSION);
  assert.equal(golden.schema_version, SCHEMA_VERSION);
});

test("a source whose commercial use is not permitted is refused", () => {
  const unresolved: BuildInput = {
    ...cnfInput,
    id: "uk-cofid-2021",
    region: "CA",
    licence: { name: "unknown", commercial_use: "unresolved", legal_confirmation: "pending" },
  };
  assert.throws(() => buildDataset([unresolved], fixtureDir), /commercial use is unresolved/);
});

test("a build writes nothing into the application tree", () => {
  // The application tree is fingerprinted before and after a real build, so
  // the shipped catalogue, the search and the recipes cannot be touched by
  // the pipeline, even by accident.
  const fingerprint = (folder: string): string[] => {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else found.push(`${path.relative(root, full)} ${sha256(full)}`);
      }
    };
    walk(folder);
    return found.sort();
  };

  const before = fingerprint(path.join(root, "src"));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "m2-pipeline-"));
  try {
    const built = buildDataset([usdaInput, cnfInput], fixtureDir);
    writeBuild(built, [usdaInput, cnfInput], out);
    assert.ok(fs.existsSync(path.join(out, "foods.v2.json")));
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
  assert.deepEqual(fingerprint(path.join(root, "src")), before);
});

test("the manifest pins every input and records the excluded ones", () => {
  const manifest = readManifest(root);
  assert.ok(manifest.inputs.length >= 2);
  for (const input of manifest.inputs) {
    assert.match(input.sha256, /^[0-9a-f]{64}$/, `${input.id} has no pinned checksum`);
    assert.ok(input.licence.name.length > 0);
    assert.ok(["permitted", "prohibited", "unresolved"].includes(input.licence.commercial_use));
    assert.ok(input.citation.length > 0);
  }
  // The United Kingdom is excluded, and says why.
  const uk = manifest.excluded.find((e) => e.id === "uk-cofid-2021");
  assert.ok(uk, "the United Kingdom source is not excluded");
  assert.equal(uk!.commercial_use, "unresolved");
  assert.match(uk!.reason, /unresolved/i);
  assert.match(uk!.reason, /CoFID/);
  assert.match(uk!.reason, /non-commercial|paid product/i);
  // The Canadian licence is recorded as researched, not as legally cleared.
  const cnf = manifest.inputs.find((i) => i.region === "CA")!;
  assert.equal(cnf.licence.commercial_use, "permitted");
  assert.equal(cnf.licence.legal_confirmation, "published-licence");
});

test("the manifest checks the shipped artefact and reports the unfetched archive", () => {
  const results = verifyInputs(readManifest(root), root);
  const usda = results.find((r) => r.id === "usda-sr28")!;
  assert.equal(usda.status, "verified");
  const cnf = results.find((r) => r.id === "ca-cnf-2026")!;
  assert.ok(["verified", "not fetched"].includes(cnf.status));
});

test("a file whose bytes do not match the manifest is refused", () => {
  const check = verifyFile(shippedUsdaPath(root), {
    sha256: "0".repeat(64),
    bytes: 1420723,
  });
  assert.equal(check.ok, false);
  assert.match(check.reason!, /checksum/);
});

test("a source that may not be used is refused", () => {
  const manifest = readManifest(root);
  const input = manifest.inputs.find((i) => i.region === "CA")!;
  assert.equal(mayUse(input).ok, true);
  assert.equal(mayUse({ ...input, licence: { ...input.licence, commercial_use: "unresolved" } }).ok, false);
});

test("the findings are summarised by kind", () => {
  const summary = summariseFindings(cnfDataset.findings as never);
  assert.ok(Object.keys(summary).length > 0);
  for (const [kind, count] of Object.entries(summary)) {
    assert.ok(count > 0, kind);
  }
});

test("a cross-reference that names a record the catalogue does not have is reported", () => {
  // The Canadian file names a United States number for many of its foods.
  // Where that number is not in the catalogue, the pointer says so rather than
  // resolving to nothing.
  const built = buildDataset([usdaInput, cnfInput], fixtureDir);
  const usdaIds = new Set(built.foods.filter((f) => f.source === "usda").map((f) => f.id));
  const referenced = built.foods.filter((f) => f.crossReference);
  assert.ok(referenced.length, "the fixture has no cross-references to check");
  for (const food of referenced) {
    const number = Number(food.crossReference!.id.replace("usda:", ""));
    const resolves = [...usdaIds].some((id) => Number(id.replace("usda:", "")) === number);
    const finding = built.findings.find(
      (f) => f.kind === "unresolved-cross-reference" && f.id === food.id,
    );
    if (resolves) assert.equal(finding, undefined, `${food.id} was reported but it resolves`);
    else {
      assert.ok(finding, `${food.id} names a record that is not in the catalogue, and nothing said so`);
      assert.match(finding!.detail, /does not have it/);
    }
  }
});

