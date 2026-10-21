import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { foodById, popular, recipes } from "../src/core/foods";
import {
  aliasRegistry,
  resolveComposition,
  resolveIngredient,
  sourceOf,
  validateRegistry,
  type AliasRegistry,
} from "../src/core/ingredient-aliases";
import { buildRegistry, canonicalSlug, serialise } from "../scripts/build-ingredient-aliases";
import { buildGolden } from "../scripts/build-ingredient-alias-golden";

/**
 * M2-4: the ingredient alias foundation.
 *
 * The foundation is isolated on purpose. The recipe engine still resolves
 * ingredients exactly as it always has, and these tests exist to prove that
 * it does, and that the registry is complete, valid and deterministic.
 */
const root = process.cwd();
const goldenFile = path.join(root, "tests", "fixtures", "ingredient-aliases-golden.json");
const golden = JSON.parse(fs.readFileSync(goldenFile, "utf8")) as ReturnType<typeof buildGolden>;

/** The ids the app refers to, and how many of each. */
function inventory() {
  const popularIds = popular.map((entry) => entry.id);
  const recipeIds = new Set<number>();
  for (const recipe of recipes) for (const [id] of recipe.parts) recipeIds.add(id);
  const union = new Set([...popularIds, ...recipeIds]);
  return {
    popularIds,
    recipeIds,
    union,
    recipeParts: recipes.reduce((sum, recipe) => sum + recipe.parts.length, 0),
  };
}

test("the inventory counts what the app actually refers to", () => {
  const { popularIds, recipeIds, union, recipeParts } = inventory();
  assert.equal(popularIds.length, 74);
  assert.equal(new Set(popularIds).size, 74);
  assert.equal(recipes.length, 116);
  assert.equal(recipeParts, 443);
  assert.equal(recipeIds.size, 138);
  assert.equal(union.size, 165);
  // Every referenced id has a row in the shipped catalogue, today.
  for (const id of union) assert.ok(foodById(`usda:${id}`), `usda:${id} does not resolve`);
});

test("the registry covers every referenced id, exactly once", () => {
  const { popularIds, recipeIds, union } = inventory();
  const registry = aliasRegistry();
  assert.equal(registry.ingredients.length, union.size);

  const byId = new Map<string, string[]>();
  for (const entry of registry.ingredients)
    for (const [market, id] of Object.entries(entry.ids)) {
      const list = byId.get(`${market}:${id}`) ?? [];
      list.push(entry.key);
      byId.set(`${market}:${id}`, list);
    }
  for (const id of union) {
    const owners = byId.get(`US:usda:${id}`) ?? [];
    assert.equal(owners.length, 1, `usda:${id} is claimed ${owners.length} times`);
  }
  // Nothing else is in the registry.
  assert.equal(byId.size, union.size);

  // Every popular food and every recipe ingredient is reachable by its key.
  const byKey = new Map(registry.ingredients.map((entry) => [entry.key, entry]));
  for (const id of [...popularIds, ...recipeIds]) {
    const owners = registry.ingredients.filter((entry) => entry.ids.US === `usda:${id}`);
    assert.equal(owners.length, 1);
    assert.ok(byKey.has(owners[0].key));
  }
});

test("the registry is deterministic: the same references give the same file", () => {
  const rebuilt = buildRegistry();
  assert.equal(serialise(rebuilt), serialise(aliasRegistry()));
  // And the committed file is exactly what the generator writes.
  const committed = fs.readFileSync(path.join(root, "src", "data", "ingredient-aliases.json"), "utf8");
  assert.equal(committed, serialise(rebuilt));
});

test("every key is the slug of its own name, and every name is the app's", () => {
  const registry = aliasRegistry();
  const friendly = new Map(popular.map((entry) => [entry.id, entry.name]));
  for (const entry of registry.ingredients) {
    assert.equal(entry.key, `ingredient:${canonicalSlug(entry.name)}`);
    const id = entry.ids.US;
    assert.ok(id.startsWith("usda:"));
    const number = Number(id.slice("usda:".length));
    const food = foodById(id);
    assert.ok(food, `${id} does not resolve`);
    // The name is the friendly one when the app has one, and the catalogue's
    // own name when it does not. A food with a friendly name carries the
    // catalogue's name in its detail.
    const expected = friendly.get(number) ?? food.name;
    assert.equal(entry.name, expected, `${id} has the name ${entry.name}`);
  }
});

test("the popular foods and the recipes are exactly as they were", () => {
  // The golden pins what the app produced before this milestone. Nothing in
  // the foundation may move a number.
  assert.equal(golden.counts.popular, popular.length);
  assert.equal(golden.counts.recipes, recipes.length);

  for (const pinned of golden.popular) {
    const food = foodById(pinned.id);
    assert.ok(food, `${pinned.id} does not resolve`);
    assert.equal(food!.name, pinned.name);
    assert.equal(food!.detail, pinned.detail);
    assert.equal(food!.group, pinned.group);
    assert.equal(food!.source, pinned.source);
    assert.equal(food!.uncertainty, pinned.uncertainty);
    assert.deepEqual(food!.per100, pinned.per100);
    assert.deepEqual(food!.servings, pinned.servings);
  }

  for (const pinned of golden.recipes) {
    const food = foodById(pinned.id);
    assert.ok(food, `${pinned.id} does not resolve`);
    assert.equal(food!.name, pinned.name);
    assert.equal(food!.group, pinned.group);
    assert.equal(food!.uncertainty, pinned.uncertainty);
    assert.deepEqual(food!.per100, pinned.per100);
    assert.deepEqual(food!.servings, pinned.servings);
    // The recipe's parts and their gram weights are untouched.
    const recipe = recipes.find((entry) => `recipe:${entry.id}` === pinned.id)!;
    assert.deepEqual(recipe.parts, pinned.parts);
    assert.equal(recipe.parts.reduce((sum, [, grams]) => sum + grams, 0), pinned.total_grams);
  }
});

test("the golden file is what the app produces now", () => {
  assert.deepEqual(buildGolden(), golden);
});

test("the foundation is not wired into the recipe engine", () => {
  // The recipe engine must not have been changed to use the registry. This
  // milestone adds the foundation; it does not move the engine.
  const source = fs.readFileSync(path.join(root, "src", "core", "foods.ts"), "utf8");
  assert.ok(!/ingredient-aliases/.test(source), "the recipe engine now depends on the alias registry");
  // And the shipped catalogue is untouched.
  const shipped = fs.readFileSync(path.join(root, "src", "data", "usda-foods.json"), "utf8");
  assert.equal(
    require("node:crypto").createHash("sha256").update(shipped).digest("hex"),
    "f2b1a828ce58ee0731d076938b483c16c194bc276294a99d7263cc137fd060a2",
  );
});

test("the shipped registry has no problems", () => {
  assert.deepEqual(validateRegistry(aliasRegistry()), []);
});

test("the registry names no Canadian identifier, and none is approved", () => {
  const registry = aliasRegistry();
  // No Canadian mapping exists yet, and none may be created by inference.
  for (const entry of registry.ingredients) {
    for (const [market, id] of Object.entries(entry.ids)) {
      assert.equal(market, "US", `${entry.key} has a ${market} mapping`);
      assert.ok(id.startsWith("usda:"), `${entry.key} maps to ${id}`);
    }
  }
  // The two records whose source contradicts itself are recorded, and are not
  // used anywhere.
  const notApproved = registry.not_approved.map((entry) => entry.id);
  assert.deepEqual(notApproved, ["cnf:5224", "cnf:7529"]);
  for (const entry of registry.not_approved) {
    assert.match(entry.reason, /not approved|contradicts itself/i);
    assert.equal(sourceOf(entry.id), "cnf");
  }
  for (const entry of registry.ingredients)
    for (const id of Object.values(entry.ids)) assert.ok(!notApproved.includes(id));
});

test("the validation finds a missing, a duplicate, a conflict, a loop and a refusal", () => {
  const base = aliasRegistry();
  const entry = (key: string, ids: Record<string, string>) => ({ key, name: key, ids });

  const missing = validateRegistry({
    ...base,
    ingredients: [{ key: "ingredient:x", name: "X", ids: { US: "" } }],
  });
  assert.ok(missing.some((problem) => problem.kind === "missing-id"));

  const duplicateKey = validateRegistry({
    ...base,
    ingredients: [entry("ingredient:x", { US: "usda:1" }), entry("ingredient:x", { US: "usda:2" })],
  });
  assert.ok(duplicateKey.some((problem) => problem.kind === "duplicate-key"));

  const conflicting = validateRegistry({
    ...base,
    ingredients: [entry("ingredient:x", { US: "usda:1" }), entry("ingredient:y", { US: "usda:1" })],
  });
  assert.ok(conflicting.some((problem) => problem.kind === "conflicting-id"));

  const cyclic = validateRegistry({
    ...base,
    ingredients: [
      { key: "ingredient:x", name: "X", ids: { US: "usda:1" }, alias_of: "ingredient:y" },
      { key: "ingredient:y", name: "Y", ids: { US: "usda:2" }, alias_of: "ingredient:x" },
    ],
  });
  assert.ok(cyclic.some((problem) => problem.kind === "cyclic-alias"));

  const unknownAlias = validateRegistry({
    ...base,
    ingredients: [{ key: "ingredient:x", name: "X", ids: { US: "usda:1" }, alias_of: "ingredient:nothing" }],
  });
  assert.ok(unknownAlias.some((problem) => problem.kind === "unknown-alias"));

  const refused = validateRegistry({
    ...base,
    ingredients: [entry("ingredient:x", { US: "cnf:5224" })],
  });
  assert.ok(refused.some((problem) => problem.kind === "not-approved"));

  const malformed = validateRegistry({
    ...base,
    ingredients: [{ key: "not-a-key", name: "", ids: {} } as never],
  });
  assert.ok(malformed.some((problem) => problem.kind === "malformed-entry"));
});

test("resolving an ingredient says exactly what happened", () => {
  const registry = aliasRegistry();
  const key = registry.ingredients[0].key;

  // In the market it was mapped for, it simply resolves.
  const direct = resolveIngredient(key, "US", registry);
  assert.equal(direct.outcome, "resolved");
  assert.equal(direct.cross_market, false);
  assert.equal(direct.source_market, "US");
  assert.equal(direct.source, "usda");
  assert.ok(direct.id?.startsWith("usda:"));

  // In a market it was not mapped for, it falls back, and says so.
  const fallback = resolveIngredient(key, "CA", registry);
  assert.equal(fallback.outcome, "fallback");
  assert.equal(fallback.cross_market, true);
  assert.equal(fallback.source_market, "US");
  assert.equal(fallback.source, "usda");
  assert.ok(fallback.reason);

  // A key that is not in the registry is unavailable, not guessed at.
  const missing = resolveIngredient("ingredient:nothing-at-all", "US", registry);
  assert.equal(missing.outcome, "unavailable");
  assert.equal(missing.id, undefined);
  assert.equal(missing.attempted.length, 0);
});

test("a reviewed Canadian mapping resolves in Canada, with its own source", () => {
  const registry: AliasRegistry = {
    ...aliasRegistry(),
    ingredients: [
      {
        key: "ingredient:apple",
        name: "Apple",
        ids: { US: "usda:9003", CA: "cnf:13552" },
      },
    ],
  };
  const result = resolveIngredient("ingredient:apple", "CA", registry);
  assert.equal(result.outcome, "resolved");
  assert.equal(result.id, "cnf:13552");
  assert.equal(result.source, "cnf");
  assert.equal(result.source_market, "CA");
  assert.equal(result.cross_market, false);
  // And the United States still resolves to its own record.
  const us = resolveIngredient("ingredient:apple", "US", registry);
  assert.equal(us.id, "usda:9003");
  assert.equal(us.source, "usda");
});

test("an unresolved ingredient makes the composition incomplete, and changes nothing else", () => {
  const registry = aliasRegistry();
  const parts = [
    { key: registry.ingredients[0].key, grams: 180 },
    { key: "ingredient:an-ingredient-that-does-not-exist", grams: 20 },
    { key: registry.ingredients[1].key, grams: 30 },
  ];
  const result = resolveComposition(parts, "US", registry);

  assert.equal(result.outcome, "incomplete");
  assert.equal(result.complete, false);
  assert.equal(result.missing.length, 1);
  assert.equal(result.missing[0].key, "ingredient:an-ingredient-that-does-not-exist");

  // The parts that resolved keep their exact gram weights.
  assert.equal(result.parts.length, 3);
  assert.equal(result.parts[0].grams, 180);
  assert.equal(result.parts[2].grams, 30);
  assert.equal(result.parts[0].result.outcome, "resolved");
  assert.equal(result.parts[2].result.outcome, "resolved");
  // The missing part is still there, with its weight, and it is not zero.
  assert.equal(result.parts[1].grams, 20);
  assert.equal(result.parts[1].result.outcome, "unavailable");
  assert.equal(result.parts[1].id, undefined);
});

test("a composition that resolves completely says so, and labels its fallbacks", () => {
  const registry = aliasRegistry();
  const parts = registry.ingredients.slice(0, 3).map((entry) => ({ key: entry.key, grams: 100 }));
  const complete = resolveComposition(parts, "US", registry);
  assert.equal(complete.outcome, "resolved");
  assert.equal(complete.complete, true);
  assert.equal(complete.missing.length, 0);
  assert.equal(complete.fallbacks.length, 0);

  const crossMarket = resolveComposition(parts, "CA", registry);
  assert.equal(crossMarket.complete, true);
  assert.equal(crossMarket.fallbacks.length, 3);
  for (const fallback of crossMarket.fallbacks) {
    assert.equal(fallback.source, "usda");
    assert.equal(fallback.source_market, "US");
    assert.ok(fallback.id.startsWith("usda:"));
  }
});
