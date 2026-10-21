import fs from "node:fs";
import path from "node:path";
import { foodById, popular, recipes } from "../src/core/foods";
import { aliasRegistry } from "../src/core/ingredient-aliases";

/**
 * Writes the golden file that pins what the app does today.
 *
 * It records, for every popular food and every recipe, the numbers the app
 * produces right now: the identifier, the name, the nutrient values, the
 * servings. The alias foundation has to leave all of it exactly as it is,
 * and this is what says so.
 *
 *   npm run aliases:golden
 */
const root = process.cwd();

/** The shape of one pinned food. */
function pin(food: {
  id: string;
  name: string;
  detail: string;
  group: string;
  source: string;
  per100: Record<string, number>;
  servings: { label: string; grams: number }[];
  uncertainty: number;
}) {
  return {
    id: food.id,
    name: food.name,
    detail: food.detail,
    group: food.group,
    source: food.source,
    uncertainty: food.uncertainty,
    per100: Object.fromEntries(Object.entries(food.per100).sort(([a], [b]) => (a < b ? -1 : 1))),
    servings: food.servings,
  };
}

export function buildGolden() {
  const registry = aliasRegistry();
  const popularPins = popular.map((entry) => {
    const food = foodById(`usda:${entry.id}`);
    if (!food) throw new Error(`the popular food ${entry.id} does not resolve`);
    return pin(food);
  });
  const recipePins = recipes.map((recipe) => {
    const food = foodById(`recipe:${recipe.id}`);
    if (!food) throw new Error(`the recipe ${recipe.id} does not resolve`);
    return {
      ...pin(food),
      parts: recipe.parts,
      total_grams: recipe.parts.reduce((sum, [, grams]) => sum + grams, 0),
    };
  });

  return {
    generated_by: "scripts/build-ingredient-alias-golden.ts",
    registry_version: registry.version,
    counts: {
      popular: popularPins.length,
      recipes: recipePins.length,
      registry_entries: registry.ingredients.length,
    },
    popular: popularPins,
    recipes: recipePins,
  };
}

export function goldenPath(): string {
  return path.join(root, "tests", "fixtures", "ingredient-aliases-golden.json");
}

function main() {
  const golden = buildGolden();
  fs.mkdirSync(path.dirname(goldenPath()), { recursive: true });
  fs.writeFileSync(goldenPath(), JSON.stringify(golden, null, 1) + "\n", "utf8");
  console.log(`popular: ${golden.counts.popular}, recipes: ${golden.counts.recipes}`);
  console.log(`wrote ${goldenPath()}`);
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith("build-ingredient-alias-golden.ts")) main();
