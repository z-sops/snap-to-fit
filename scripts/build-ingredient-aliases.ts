import fs from "node:fs";
import path from "node:path";
import { popular, recipes } from "../src/core/foods";
import type { AliasEntry, AliasRegistry } from "../src/core/ingredient-aliases";

/**
 * Builds the ingredient alias registry.
 *
 * The registry is **derived from what the app actually uses**, so that it
 * cannot fall behind the recipe library: every USDA number that a popular
 * food or a recipe names is in the registry, with exactly that number.
 *
 * The canonical key is a slug of the ingredient's name: the friendly name the
 * app shows when the food has one, and the catalogue's own name when it does
 * not. The rule is fixed, so the same inputs always produce the same file,
 * and a golden test pins it.
 *
 * This script writes a file and nothing else. It never touches the shipped
 * catalogue, and it never edits the recipe library.
 *
 *   npm run aliases:build
 */
const root = process.cwd();

/**
 * Identifiers that were reviewed and are **not** approved for use.
 *
 * These are Canadian records whose own source contradicts itself, so their
 * nutrient values cannot be treated as equivalent to anything. The list is
 * here, and not in the generated file, because it is a decision rather than
 * derived data.
 */
const NOT_APPROVED: AliasRegistry["not_approved"] = [
  {
    id: "cnf:5224",
    reason:
      "The source marks this food's energy value as an assumed zero and publishes a non-zero amount beside it. The record contradicts itself, so nutritional equivalence is not approved.",
  },
  {
    id: "cnf:7529",
    reason:
      "The source marks this food's cholesterol value as an assumed zero and publishes a non-zero amount beside it. The record contradicts itself, so nutritional equivalence is not approved.",
  },
];

/** The slug rule. It is fixed, and a golden test pins the result. */
export function canonicalSlug(name: string): string {
  return name
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase()
    .replace(/%/g, " percent ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/ +/g, "-");
}

/** The catalogue's own names, by id. */
function catalogueNames(): Map<number, string> {
  const file = path.join(root, "src", "data", "usda-foods.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as { foods: [number, string][] };
  return new Map(data.foods.map((row) => [row[0], row[1]]));
}

/**
 * Build the registry from the app's current references.
 *
 * It throws rather than writing a registry that is incomplete, duplicated or
 * ambiguous: a registry that is wrong in any of those ways is worse than no
 * registry at all.
 */
export function buildRegistry(): AliasRegistry {
  const names = catalogueNames();
  const friendly = new Map(popular.map((entry) => [entry.id, entry.name]));

  const referenced = new Set<number>();
  for (const entry of popular) referenced.add(entry.id);
  for (const recipe of recipes) for (const [id] of recipe.parts) referenced.add(id);

  const bySlug = new Map<string, number[]>();
  for (const id of [...referenced].sort((a, b) => a - b)) {
    const name = friendly.get(id) ?? names.get(id);
    if (!name) throw new Error(`the catalogue has no food ${id}, and the app refers to it`);
    const slug = canonicalSlug(name);
    const owners = bySlug.get(slug) ?? [];
    owners.push(id);
    bySlug.set(slug, owners);
  }
  for (const [slug, owners] of bySlug)
    if (owners.length > 1)
      throw new Error(`the name of ${owners.join(", ")} gives the same key ${slug}; give them different keys`);

  const notApproved = new Set(NOT_APPROVED.map((entry) => entry.id));
  const ingredients: AliasEntry[] = [];
  for (const id of [...referenced].sort((a, b) => a - b)) {
    const name = friendly.get(id) ?? names.get(id)!;
    const source = `usda:${id}`;
    if (notApproved.has(source)) throw new Error(`${source} is not approved and must not be mapped`);
    ingredients.push({
      key: `ingredient:${canonicalSlug(name)}`,
      name,
      ids: { US: source },
    });
  }
  ingredients.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  return {
    version: 1,
    default_market: "US",
    generated_by: "scripts/build-ingredient-aliases.ts",
    ingredients,
    not_approved: NOT_APPROVED,
  };
}

/** The registry as it is written, in a stable shape. */
export function serialise(registry: AliasRegistry): string {
  return JSON.stringify(registry, null, 2) + "\n";
}

/** The file the registry is written to. */
export function registryPath(): string {
  return path.join(root, "src", "data", "ingredient-aliases.json");
}

function main() {
  const registry = buildRegistry();
  fs.writeFileSync(registryPath(), serialise(registry), "utf8");
  console.log(`ingredients: ${registry.ingredients.length}`);
  console.log(`not approved: ${registry.not_approved.length}`);
  console.log(`wrote ${registryPath()}`);
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith("build-ingredient-aliases.ts")) main();
