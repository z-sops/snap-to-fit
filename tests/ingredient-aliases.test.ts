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
import {
  buildRegistry,
  canonicalSlug,
  readBaseline,
  serialise,
  type AliasBaseline,
} from "../scripts/build-ingredient-aliases";
import { buildGolden } from "../scripts/build-ingredient-alias-golden";

/**
 * M2-4: the ingredient alias foundation.
 *
 * The foundation is isolated on purpose. The recipe engine still resolves
 * ingredients exactly as it always has, and these tests exist to prove that
 * it does, and that the registry is complete, valid, deterministic and
 * fail-closed.
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
  for (const id of [...popularIds, ...recipeIds]) {
    const owners = registry.ingredients.filter((entry) => entry.ids.US === `usda:${id}`);
    assert.equal(owners.length, 1);
  }
});

test("the registry is deterministic: the same references give the same file", () => {
  const rebuilt = buildRegistry();
  assert.equal(serialise(rebuilt), serialise(aliasRegistry()));
  // And the committed file is exactly what the generator writes.
  const committed = fs.readFileSync(path.join(root, "src", "data", "ingredient-aliases.json"), "utf8");
  assert.equal(committed, serialise(rebuilt));
});

test("every key is pinned in the baseline, and every name is the app's own", () => {
  const registry = aliasRegistry();
  const baseline = readBaseline();
  const pinned = new Map(baseline.ingredients.map((entry) => [entry.ids.US, entry.key]));
  const friendly = new Map(popular.map((entry) => [entry.id, entry.name]));

  assert.equal(pinned.size, 165);
  for (const entry of registry.ingredients) {
    // The key comes from the baseline, not from the name.
    assert.equal(pinned.get(entry.ids.US), entry.key, `${entry.ids.US} has the key ${entry.key}`);
    assert.match(entry.key, /^ingredient:[a-z0-9-]+$/);
    const number = Number(entry.ids.US.slice("usda:".length));
    const food = foodById(entry.ids.US);
    assert.ok(food, `${entry.ids.US} does not resolve`);
    // The name is the friendly one when the app has one, and the
    // catalogue's own name when it does not.
    const expected = friendly.get(number) ?? food.name;
    assert.equal(entry.name, expected, `${entry.ids.US} has the name ${entry.name}`);
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
  const entry = (key: string, ids: Record<string, string>) => ({ key, name: key, ids, reviewed: { US: "2026-10-22" } });

  const missing = validateRegistry({
    ...base,
    ingredients: [{ key: "ingredient:x", name: "X", ids: { US: "" }, reviewed: { US: "2026-10-22" } }],
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
      { key: "ingredient:x", name: "X", ids: { US: "usda:1" }, reviewed: { US: "2026-10-22" }, alias_of: "ingredient:y" },
      { key: "ingredient:y", name: "Y", ids: { US: "usda:2" }, reviewed: { US: "2026-10-22" }, alias_of: "ingredient:x" },
    ],
  });
  assert.ok(cyclic.some((problem) => problem.kind === "cyclic-alias"));

  const unknownAlias = validateRegistry({
    ...base,
    ingredients: [
      { key: "ingredient:x", name: "X", ids: { US: "usda:1" }, reviewed: { US: "2026-10-22" }, alias_of: "ingredient:nothing" },
    ],
  });
  assert.ok(unknownAlias.some((problem) => problem.kind === "unknown-alias"));

  const refused = validateRegistry({
    ...base,
    ingredients: [entry("ingredient:x", { US: "cnf:5224" })],
  });
  assert.ok(refused.some((problem) => problem.kind === "not-approved"));

  const unreviewed = validateRegistry({
    ...base,
    ingredients: [{ key: "ingredient:x", name: "X", ids: { US: "usda:1" } }],
  });
  assert.ok(unreviewed.some((problem) => problem.kind === "unreviewed-mapping"));

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
        reviewed: { US: "2026-10-22", CA: "2026-10-22" },
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

/**
 * C1: the resolution is fail-closed.
 *
 * Every case below calls `resolveIngredient()` **without** running
 * `validateRegistry()` first, because a caller may not, and a registry that
 * has not been checked still must not produce an identifier the rules
 * forbid.
 */
test("C1: a mapping that was reviewed and refused never resolves", () => {
  const registry: AliasRegistry = {
    ...aliasRegistry(),
    ingredients: [
      {
        key: "ingredient:goose",
        name: "Goose",
        ids: { US: "cnf:5224", CA: "cnf:5224" },
        reviewed: { US: "2026-10-22", CA: "2026-10-22" },
      },
    ],
  };
  const direct = resolveIngredient("ingredient:goose", "US", registry);
  assert.equal(direct.outcome, "unavailable");
  assert.equal(direct.id, undefined);
  assert.match(direct.reason ?? "", /not approved/i);

  // And it is not usable as a fallback either.
  const fallback = resolveIngredient("ingredient:goose", "GB", registry);
  assert.equal(fallback.outcome, "unavailable");
  assert.equal(fallback.id, undefined);
  assert.match(fallback.reason ?? "", /not approved/i);
});

test("C1: a cyclic alias chain resolves to nothing", () => {
  const registry: AliasRegistry = {
    ...aliasRegistry(),
    ingredients: [
      {
        key: "ingredient:x",
        name: "X",
        ids: { US: "usda:1" },
        reviewed: { US: "2026-10-22" },
        alias_of: "ingredient:y",
      },
      {
        key: "ingredient:y",
        name: "Y",
        ids: { US: "usda:2" },
        reviewed: { US: "2026-10-22" },
        alias_of: "ingredient:x",
      },
    ],
  };
  const result = resolveIngredient("ingredient:x", "US", registry);
  assert.equal(result.outcome, "unavailable");
  assert.equal(result.id, undefined);
  assert.match(result.reason ?? "", /loops/i);
});

test("C1: an alias that points at nothing resolves to nothing", () => {
  const registry: AliasRegistry = {
    ...aliasRegistry(),
    ingredients: [
      {
        key: "ingredient:x",
        name: "X",
        ids: { US: "usda:1" },
        reviewed: { US: "2026-10-22" },
        alias_of: "ingredient:nothing",
      },
    ],
  };
  const result = resolveIngredient("ingredient:x", "US", registry);
  assert.equal(result.outcome, "unavailable");
  assert.equal(result.id, undefined);
  assert.match(result.reason ?? "", /not in the registry/i);
});

test("C1: an identifier in an unknown namespace does not resolve", () => {
  for (const id of ["food:123", "usda:", "12345", "", "ca:1"]) {
    const registry: AliasRegistry = {
      ...aliasRegistry(),
      ingredients: [
        { key: "ingredient:x", name: "X", ids: { US: id }, reviewed: { US: "2026-10-22" } },
      ],
    };
    const result = resolveIngredient("ingredient:x", "US", registry);
    assert.equal(result.outcome, "unavailable", `${id} resolved`);
    assert.equal(result.id, undefined);
  }
});

test("C1: a mapping that has not been reviewed is an arbitrary string and is not used", () => {
  const registry: AliasRegistry = {
    ...aliasRegistry(),
    ingredients: [
      // No review date: this is a string that was typed in, not a mapping.
      { key: "ingredient:x", name: "X", ids: { US: "usda:1" } },
    ],
  };
  const result = resolveIngredient("ingredient:x", "US", registry);
  assert.equal(result.outcome, "unavailable");
  assert.equal(result.id, undefined);
  assert.match(result.reason ?? "", /not been reviewed/i);
});

test("C1: a malformed registry resolves to nothing rather than to something", () => {
  const malformed = { ...aliasRegistry(), ingredients: "not an array" } as unknown as AliasRegistry;
  const result = resolveIngredient("ingredient:apple", "US", malformed);
  assert.equal(result.outcome, "unavailable");
  assert.equal(result.id, undefined);
  assert.match(result.reason ?? "", /malformed/i);

  const noEntries = { ...aliasRegistry(), ingredients: [] } as AliasRegistry;
  const empty = resolveIngredient("ingredient:apple", "US", noEntries);
  assert.equal(empty.outcome, "unavailable");
});

test("C1: a Canadian cross-reference is never proof of equivalence", () => {
  // The Canadian file names a United States record for many of its foods.
  // That pointer is not a mapping, so a registry without a Canadian entry
  // resolves in Canada to the United States record, and never to the
  // Canadian one.
  const registry = aliasRegistry();
  const apple = registry.ingredients.find((entry) => entry.key === "ingredient:apple")!;
  assert.equal(apple.ids.US, "usda:9003");
  assert.equal(apple.ids.CA, undefined);

  const result = resolveIngredient("ingredient:apple", "CA", registry);
  assert.equal(result.outcome, "fallback");
  assert.equal(result.id, "usda:9003");
  assert.equal(result.source, "usda");
  assert.equal(result.source_market, "US");
  assert.equal(result.cross_market, true);
});

/**
 * C2: the canonical keys are stable, and the generation is not destructive.
 */
test("C2: a display-name change does not rename the canonical key", () => {
  // The baseline pins the key. The name in the app is not what decides it.
  const baseline = readBaseline();
  const renamed: AliasBaseline = {
    ...baseline,
    ingredients: baseline.ingredients.map((entry) =>
      entry.ids.US === "usda:5747" ? { ...entry, key: "ingredient:chicken-breast-grilled-legacy" } : entry,
    ),
  };
  const built = buildRegistry(renamed);
  const chicken = built.ingredients.find((entry) => entry.ids.US === "usda:5747")!;
  // The key is the one the baseline pinned, and the name is the app's own.
  assert.equal(chicken.key, "ingredient:chicken-breast-grilled-legacy");
  assert.equal(chicken.name, "Chicken breast, grilled");
  // The other 164 keys are untouched.
  assert.equal(built.ingredients.length, 165);
  assert.equal(
    built.ingredients.filter((entry) => entry.key === "ingredient:chicken-breast-grilled").length,
    0,
  );
});

test("C2: an ingredient the baseline does not know needs a reviewed entry", () => {
  const baseline = readBaseline();
  const without = baseline.ingredients.filter((entry) => entry.ids.US !== "usda:12061");
  assert.throws(
    () => buildRegistry({ ...baseline, ingredients: without }),
    /the baseline has no entry for usda:12061/,
  );
  // And with the entry, the build succeeds and the key is the pinned one.
  const built = buildRegistry(baseline);
  const almonds = built.ingredients.find((entry) => entry.ids.US === "usda:12061")!;
  assert.equal(almonds.key, "ingredient:almonds");
});

test("C2: an identifier the app no longer uses needs an explicit migration", () => {
  const baseline = readBaseline();
  const extra: AliasBaseline = {
    ...baseline,
    ingredients: [...baseline.ingredients, { key: "ingredient:gone", ids: { US: "usda:999999" } }],
  };
  assert.throws(() => buildRegistry(extra), /is in the baseline but the app no longer refers to it/);
});

test("C2: a duplicated or conflicting baseline is refused", () => {
  const baseline = readBaseline();
  const duplicated: AliasBaseline = {
    ...baseline,
    ingredients: [...baseline.ingredients, { key: "ingredient:almonds", ids: { US: "usda:12061" } }],
  };
  assert.throws(() => buildRegistry(duplicated), /the baseline has the key ingredient:almonds twice/);

  const conflicting: AliasBaseline = {
    ...baseline,
    // Two ingredients claiming one identifier.
    ingredients: baseline.ingredients.map((entry) =>
      entry.ids.US === "usda:12061" ? { ...entry, ids: { US: "usda:9003" } } : entry,
    ),
  };
  assert.throws(() => buildRegistry(conflicting), /the baseline gives usda:9003 to both/);
});

test("C2: a reviewed Canadian mapping in the baseline is preserved", () => {
  // A synthetic baseline, so that no Canadian equivalent is introduced into
  // the registry the app ships.
  const baseline = readBaseline();
  const withMarket: AliasBaseline = {
    ...baseline,
    ingredients: baseline.ingredients.map((entry) =>
      entry.ids.US === "usda:9003"
        ? { ...entry, markets: { CA: { id: "cnf:13552", reviewed: "2026-10-22" } } }
        : entry,
    ),
  };
  const built = buildRegistry(withMarket);
  const apple = built.ingredients.find((entry) => entry.ids.US === "usda:9003")!;
  assert.equal(apple.ids.CA, "cnf:13552");
  assert.equal(apple.reviewed?.CA, "2026-10-22");
  // And it resolves in Canada, with its own source.
  const result = resolveIngredient(apple.key, "CA", built);
  assert.equal(result.outcome, "resolved");
  assert.equal(result.id, "cnf:13552");
  assert.equal(result.source, "cnf");
  // The committed registry still has no Canadian mapping at all.
  assert.equal(aliasRegistry().ingredients.some((entry) => entry.ids.CA), false);
});

test("C2: the not-approved decisions are preserved by the generator", () => {
  const built = buildRegistry();
  assert.deepEqual(built.not_approved, aliasRegistry().not_approved);
  assert.deepEqual(built.not_approved.map((entry) => entry.id), ["cnf:5224", "cnf:7529"]);
});

test("C2: the generation is deterministic, whatever the input order", () => {
  const baseline = readBaseline();
  const shuffled: AliasBaseline = { ...baseline, ingredients: [...baseline.ingredients].reverse() };
  assert.equal(serialise(buildRegistry(shuffled)), serialise(buildRegistry(baseline)));
});

/**
 * C3: the composition outcomes say exactly what happened.
 */
test("C3: a composition with no ingredients is not a complete recipe", () => {
  const result = resolveComposition([], "US", aliasRegistry());
  assert.equal(result.outcome, "unavailable");
  assert.equal(result.complete, false);
  assert.equal(result.parts.length, 0);
  assert.ok(result.reason);
});

test("C3: one ingredient that resolves is a resolved composition", () => {
  const registry = aliasRegistry();
  const key = registry.ingredients[0].key;
  const result = resolveComposition([{ key, grams: 120 }], "US", registry);
  assert.equal(result.outcome, "resolved");
  assert.equal(result.complete, true);
  assert.equal(result.missing.length, 0);
  assert.equal(result.fallbacks.length, 0);
  assert.equal(result.parts[0].grams, 120);
});

test("C3: one ingredient that does not resolve is an unavailable composition", () => {
  const result = resolveComposition([{ key: "ingredient:nothing", grams: 50 }], "US", aliasRegistry());
  assert.equal(result.outcome, "unavailable");
  assert.equal(result.complete, false);
  assert.equal(result.missing.length, 1);
  assert.equal(result.parts[0].grams, 50);
  assert.equal(result.parts[0].id, undefined);
});

test("C3: a composition with some ingredients missing is incomplete", () => {
  const registry = aliasRegistry();
  const parts = [
    { key: registry.ingredients[0].key, grams: 180 },
    { key: "ingredient:nothing", grams: 20 },
    { key: registry.ingredients[1].key, grams: 30 },
  ];
  const result = resolveComposition(parts, "US", registry);
  assert.equal(result.outcome, "incomplete");
  assert.equal(result.complete, false);
  assert.equal(result.missing.length, 1);
  assert.equal(result.missing[0].key, "ingredient:nothing");
  assert.ok(result.reason);
  // Every gram quantity is preserved, including the missing part's.
  assert.deepEqual(result.parts.map((part) => part.grams), [180, 20, 30]);
  // Nothing is substituted, and nothing became a zero.
  assert.equal(result.parts[1].id, undefined);
});

test("C3: a composition where nothing resolves is unavailable", () => {
  const result = resolveComposition(
    [
      { key: "ingredient:nothing-a", grams: 10 },
      { key: "ingredient:nothing-b", grams: 20 },
    ],
    "US",
    aliasRegistry(),
  );
  assert.equal(result.outcome, "unavailable");
  assert.equal(result.complete, false);
  assert.equal(result.missing.length, 2);
  assert.deepEqual(result.parts.map((part) => part.grams), [10, 20]);
});

test("C3: a composition that resolves across markets is a fallback, and says which market", () => {
  const registry = aliasRegistry();
  const parts = registry.ingredients.slice(0, 3).map((entry) => ({ key: entry.key, grams: 100 }));
  const result = resolveComposition(parts, "CA", registry);
  assert.equal(result.outcome, "fallback");
  assert.equal(result.complete, true);
  assert.equal(result.missing.length, 0);
  assert.equal(result.fallbacks.length, 3);
  for (const fallback of result.fallbacks) {
    assert.equal(fallback.source, "usda");
    assert.equal(fallback.source_market, "US");
    assert.ok(fallback.id.startsWith("usda:"));
  }
});

test("C3: a composition with one direct and one fallback is a fallback", () => {
  const registry: AliasRegistry = {
    ...aliasRegistry(),
    ingredients: [
      {
        key: "ingredient:apple",
        name: "Apple",
        ids: { US: "usda:9003", CA: "cnf:13552" },
        reviewed: { US: "2026-10-22", CA: "2026-10-22" },
      },
      {
        key: "ingredient:banana",
        name: "Banana",
        ids: { US: "usda:9040" },
        reviewed: { US: "2026-10-22" },
      },
    ],
  };
  const result = resolveComposition(
    [
      { key: "ingredient:apple", grams: 150 },
      { key: "ingredient:banana", grams: 120 },
    ],
    "CA",
    registry,
  );
  assert.equal(result.outcome, "fallback");
  assert.equal(result.complete, true);
  assert.equal(result.fallbacks.length, 1);
  assert.equal(result.fallbacks[0].key, "ingredient:banana");
  assert.equal(result.fallbacks[0].source_market, "US");
  // The one that resolved directly is not listed as a fallback.
  assert.equal(result.parts[0].result.outcome, "resolved");
  assert.equal(result.parts[1].result.outcome, "fallback");
});
