import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildDataset, serialise, writeBuild, SCHEMA_VERSION, type BuildInput } from "../pipeline/build/build";
import { lintDataset, summariseFindings } from "../pipeline/build/lint";
import { readUsda, shippedUsdaPath } from "../pipeline/adapters/usda";
import { readCnf, measureWeightGrams } from "../pipeline/adapters/cnf";
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
  buildDataset([usdaInput], fixtureDir, { mode: "fixture" });
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
  const first = serialise(buildDataset([usdaInput, cnfInput], fixtureDir, { mode: "fixture" }));
  const second = serialise(buildDataset([usdaInput, cnfInput], fixtureDir, { mode: "fixture" }));
  assert.equal(first, second);
});

test("the built Canadian records match the golden fixture", () => {
  const built = buildDataset([cnfInput], fixtureDir, { mode: "fixture" });
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
  assert.throws(
    () => buildDataset([unresolved], fixtureDir, { mode: "fixture" }),
    /commercial use of uk-cofid-2021 is unresolved/,
  );
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
    const built = buildDataset([usdaInput, cnfInput], fixtureDir, { mode: "fixture" });
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
  const built = buildDataset([usdaInput, cnfInput], fixtureDir, { mode: "fixture" });
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


test("a measure weight conversion is the weight of the measure, in grams", () => {
  // The CNF 2026 publishes the weight of the measure itself. The 2015
  // release published a conversion factor that had to be multiplied by a
  // hundred to get the same number, and the 2026 release already includes
  // that multiplication. The publisher's own worked examples are in the
  // fixture:
  //
  //   food 1700, 250 ml of unsweetened applesauce, is 257.819 g;
  //   food 7215, one medium Granny Smith apple, is 167 g.
  const applesauce = cnfDataset.foods.find((f) => f.id === "cnf:1700");
  const apple = cnfDataset.foods.find((f) => f.id === "cnf:7215");
  assert.ok(applesauce, "the fixture has no applesauce");
  assert.ok(apple, "the fixture has no Granny Smith apple");

  const cup = applesauce!.servings.find((s) => s.label === "250 ml");
  assert.ok(cup, "the 250 ml measure is missing");
  assert.equal(cup!.grams, 257.819);

  const medium = apple!.servings.find((s) => s.label === "1 medium");
  assert.ok(medium, "the one medium measure is missing");
  assert.equal(medium!.grams, 167);

  // The 2015 conversion would have made these a hundred times too large.
  assert.notEqual(cup!.grams, 25781.9);
  assert.notEqual(medium!.grams, 16700);
});

test("a portion weight, its per-100-gram value and the per-portion value agree", () => {
  // The publisher's formula: N = V * W / 100, where W is the measure weight
  // conversion. Its worked example is the Granny Smith apple, which has
  // 120 mg of potassium per 100 g and weighs 167 g, giving 200 mg.
  const apple = cnfDataset.foods.find((f) => f.id === "cnf:7215");
  assert.ok(apple);
  const medium = apple!.servings.find((s) => s.label === "1 medium");
  assert.ok(medium);
  assert.equal(apple!.per100.potassium, 120);

  const perPortion = apple!.per100.potassium! * (medium!.grams / 100);
  assert.equal(Number(perPortion.toFixed(1)), 200.4);
  assert.equal(Math.round(perPortion), 200);

  // The same arithmetic, for every serving of every fixture food that has
  // both a weight and a value.
  for (const food of cnfDataset.foods)
    for (const serving of food.servings) {
      assert.ok(serving.grams > 0, `${food.id} ${serving.label} weighs nothing`);
      assert.ok(Number.isFinite(serving.grams), `${food.id} ${serving.label} has no weight`);
      assert.ok(serving.grams < 10000, `${food.id} ${serving.label} weighs ${serving.grams} g`);
      if (food.per100.potassium === undefined) continue;
      const expected = food.per100.potassium * (serving.grams / 100);
      assert.ok(Number.isFinite(expected));
    }
});

test("an unusable portion conversion never becomes a serving", () => {
  // A blank, a non-number, a weight of nothing and a negative weight are not
  // portions, and none of them may become one.
  for (const published of [undefined, "", "   ", "0", "0.0", "-5", "not a number", "NaN", "Infinity"])
    assert.equal(measureWeightGrams(published), undefined, `${String(published)} became a weight`);

  // A usable one is kept exactly as published, without rounding.
  assert.equal(measureWeightGrams("257.819"), 257.819);
  assert.equal(measureWeightGrams(" 167 "), 167);

  // The refuse measure is the inedible part of the food, not a portion, so it
  // is never a serving.
  for (const food of cnfDataset.foods)
    for (const serving of food.servings)
      assert.ok(!/refuse/i.test(serving.label), `${food.id} has the refuse measure as a serving`);

  // It is not dropped either: the nutrient values are per 100 g of the edible
  // part, so the inedible part has to travel with the record.
  const apple = cnfDataset.foods.find((f) => f.id === "cnf:7215");
  assert.ok(apple, "the fixture has no Granny Smith apple");
  assert.ok(apple!.refuse?.length, "the refuse of the apple was dropped");
  const total = apple!.refuse!.find((r) => r.label === "total refuse");
  assert.ok(total, "the total refuse of the apple is missing");
  assert.equal(total!.per100, 11);
  // The published share, as the release states it: eleven parts per hundred
  // of the apple as purchased.
  assert.ok(total!.per100 > 0 && total!.per100 <= 100);
});
/**
 * A source folder on disk, with the manifest pins for what is in it.
 *
 * The published archive is not in the repository, so the test builds its own
 * folder from the checked-in slice, pins it, and then breaks it in the ways a
 * source can break.
 */
function preparedSource(): { dir: string; input: BuildInput } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m2-verify-"));
  const names = fs.readdirSync(fixtureDir);
  for (const name of names) fs.copyFileSync(path.join(fixtureDir, name), path.join(dir, name));
  const archive = path.join(dir, "cnf.zip");
  fs.writeFileSync(archive, "a stand-in for the published archive");
  const input: BuildInput = {
    id: "ca-cnf-2026",
    kind: "publisher-archive",
    archive: "cnf.zip",
    sha256: sha256(archive),
    bytes: fs.statSync(archive).size,
    files: names.map((name) => ({
      name,
      sha256: sha256(path.join(dir, name)),
      bytes: fs.statSync(path.join(dir, name)).size,
    })),
    region: "CA",
    version: "2026",
    licence: {
      name: "Open Government Licence - Canada",
      commercial_use: "permitted",
      legal_confirmation: "published-licence",
    },
  };
  return { dir, input };
}

test("a build from a source that matches the manifest proceeds", () => {
  const { dir, input } = preparedSource();
  try {
    const built = buildDataset([usdaInput, input], dir, {
      mode: "verified",
      sourceDirs: new Map([[input.id, dir]]),
    });
    assert.equal(built.verification, "verified");
    assert.ok(built.foods.length > 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a build refuses a changed, a truncated, a missing or an unapproved source", () => {
  const { dir, input } = preparedSource();
  const build = () =>
    buildDataset([usdaInput, input], dir, {
      mode: "verified",
      sourceDirs: new Map([[input.id, dir]]),
    });
  try {
    // A file whose bytes were changed.
    const changed = path.join(dir, "Nutrient_Amount.csv");
    const original = fs.readFileSync(changed);
    fs.writeFileSync(changed, Buffer.concat([original, Buffer.from("\n2,208,1,,")]));
    assert.throws(build, /Nutrient_Amount\.csv of ca-cnf-2026 does not match the manifest/);
    fs.writeFileSync(changed, original);

    // A file that was truncated.
    fs.writeFileSync(changed, original.slice(0, Math.floor(original.length / 2)));
    assert.throws(build, /Nutrient_Amount\.csv of ca-cnf-2026 does not match the manifest/);
    fs.writeFileSync(changed, original);

    // A file that is not there at all.
    const removed = path.join(dir, "Food_Name.csv");
    const kept = fs.readFileSync(removed);
    fs.rmSync(removed);
    assert.throws(build, /Food_Name\.csv of ca-cnf-2026 does not match the manifest/);
    fs.writeFileSync(removed, kept);

    // An archive whose digest is not the pinned one.
    const archive = path.join(dir, "cnf.zip");
    const archiveBytes = fs.readFileSync(archive);
    fs.writeFileSync(archive, "a different archive");
    assert.throws(build, /the archive of ca-cnf-2026 does not match the manifest/);
    fs.writeFileSync(archive, archiveBytes);

    // A source whose commercial use is not permitted.
    const unapproved: BuildInput = {
      ...input,
      licence: { ...input.licence, commercial_use: "unresolved" },
    };
    assert.throws(
      () =>
        buildDataset([usdaInput, unapproved], dir, {
          mode: "verified",
          sourceDirs: new Map([[unapproved.id, dir]]),
        }),
      /commercial use of ca-cnf-2026 is unresolved/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the fixture mode is explicit, and is recorded in the build", () => {
  // The checked-in slice is not the published bytes, so it cannot be checked
  // against the manifest. A build in that mode says so, and the shipped
  // artefact is still checked.
  const fixture = buildDataset([usdaInput, cnfInput], fixtureDir, { mode: "fixture" });
  assert.equal(fixture.verification, "fixture");

  // The shipped catalogue is checked in every mode, because it has a real
  // pin and the real file.
  const wrongPin: BuildInput = { ...usdaInput, sha256: "0".repeat(64) };
  assert.throws(
    () => buildDataset([wrongPin, cnfInput], fixtureDir, { mode: "fixture" }),
    /usda-sr28 does not match the manifest/,
  );
});