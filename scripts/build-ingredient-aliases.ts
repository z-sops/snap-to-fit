import fs from "node:fs";
import path from "node:path";
import { popular, recipes } from "../src/core/foods";
import { MARKET_SOURCES, sourceOf, type AliasRegistry } from "../src/core/ingredient-aliases";

/**
 * Builds the ingredient alias registry.
 *
 * The registry is **derived from two hand-reviewed sources**: the pinned
 * baseline in `src/data/ingredient-alias-baseline.json`, and the recipe
 * library the app actually uses. It is never derived from the registry
 * itself, because a registry that regenerates itself cannot notice when it
 * has been changed.
 *
 * **A canonical key is a stable identifier.** It comes from the baseline,
 * which pins the assignment of key to identifier, so a change to a display
 * name never renames a key. The generator only derives a key for an
 * identifier the baseline does not know, and then it refuses to write
 * anything: a new ingredient needs a reviewed entry in the baseline first.
 *
 * The generator writes a file and nothing else. It never touches the shipped
 * catalogue, and it never edits the recipe library.
 *
 *   npm run aliases:build
 */
const root = process.cwd();

/** The baseline, as it is reviewed. */
export interface AliasBaseline {
  version: number;
  default_market: string;
  /** The date the default market's mappings were reviewed. */
  reviewed_on: string;
  note?: string;
  /** The pinned assignment of key to identifier. */
  ingredients: {
    key: string;
    ids: Record<string, string>;
    markets?: Record<string, { id: string; reviewed: string; evidence: string }>;
  }[];
  /** Identifiers that were reviewed and are not approved for use. */
  not_approved: { id: string; reason: string }[];
}

/** The slug rule. It is fixed, and a test pins the result. */
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

/** The baseline file. */
export function baselinePath(): string {
  return path.join(root, "src", "data", "ingredient-alias-baseline.json");
}

/** The registry file. */
export function registryPath(): string {
  return path.join(root, "src", "data", "ingredient-aliases.json");
}

/** The baseline, read from the reviewed file. */
export function readBaseline(): AliasBaseline {
  return JSON.parse(fs.readFileSync(baselinePath(), "utf8")) as AliasBaseline;
}

/** The catalogue's own names, by id. */
function catalogueNames(): Map<number, string> {
  const file = path.join(root, "src", "data", "usda-foods.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as { foods: [number, string][] };
  return new Map(data.foods.map((row) => [row[0], row[1]]));
}

/** The identifiers the app refers to, and the name it shows for each. */
export function referencedIngredients(): Map<string, { name: string; popular: boolean }> {
  const names = catalogueNames();
  const friendly = new Map(popular.map((entry) => [entry.id, entry.name]));
  const referenced = new Set<number>();
  for (const entry of popular) referenced.add(entry.id);
  for (const recipe of recipes) for (const [id] of recipe.parts) referenced.add(id);

  const out = new Map<string, { name: string; popular: boolean }>();
  for (const id of [...referenced].sort((a, b) => a - b)) {
    const name = friendly.get(id) ?? names.get(id);
    if (!name) throw new Error(`the catalogue has no food ${id}, and the app refers to it`);
    out.set(`usda:${id}`, { name, popular: friendly.has(id) });
  }
  return out;
}

/**
 * Build the registry from the baseline and the app.
 *
 * It throws rather than writing a registry that is incomplete, duplicated,
 * ambiguous or destructive. A registry that is wrong in any of those ways is
 * worse than no registry at all.
 */
export function buildRegistry(baseline: AliasBaseline = readBaseline()): AliasRegistry {
  const referenced = referencedIngredients();

  // The baseline is the authority for the keys, so they are checked for
  // duplication and for a conflict before anything is written.
  const keys = new Map<string, string>();
  const byKey = new Map<string, { key: string; ids: Record<string, string>; markets?: Record<string, { id: string; reviewed: string }> }>();
  for (const entry of baseline.ingredients ?? []) {
    if (!entry?.key?.startsWith("ingredient:"))
      throw new Error(`the baseline has an entry with no canonical key: ${JSON.stringify(entry)}`);
    if (keys.has(entry.key)) throw new Error(`the baseline has the key ${entry.key} twice`);
    keys.set(entry.key, entry.key);
    byKey.set(entry.key, entry);
  }
  const owners = new Map<string, string>();
  const claims = new Map<string, string>();
  for (const entry of baseline.ingredients ?? []) {
    for (const [market, id] of Object.entries(entry.ids ?? {})) {
      const owner = owners.get(id);
      if (owner) throw new Error(`the baseline gives ${id} to both ${owner} and ${entry.key}`);
      owners.set(id, entry.key);
      claims.set(`${market}:${id}`, entry.key);
    }
    // A reviewed mapping to another market is a claim like any other, and it
    // may not collide with another ingredient's claim in that market.
    for (const [market, mapping] of Object.entries(entry.markets ?? {})) {
      const claim = `${market}:${mapping?.id}`;
      const owner = claims.get(claim);
      if (owner && owner !== entry.key)
        throw new Error(`the baseline gives ${mapping.id} in ${market} to both ${owner} and ${entry.key}`);
      claims.set(claim, entry.key);
    }
  }

  // An identifier that the app no longer refers to is a removal, and a
  // removal has to be a decision rather than a side effect.
  for (const entry of baseline.ingredients ?? [])
    for (const id of Object.values(entry.ids ?? {}))
      if (!referenced.has(id))
        throw new Error(
          `${id} is in the baseline but the app no longer refers to it; remove it from the baseline explicitly, with a migration note`,
        );

  // An identifier the app now refers to, and the baseline does not know, is
  // an addition, and an addition has to be reviewed too.
  const missing: string[] = [];
  for (const [id, info] of referenced) {
    if (!owners.has(id)) missing.push(`${id} (${info.name}, which would be ingredient:${canonicalSlug(info.name)})`);
  }
  if (missing.length)
    throw new Error(
      `the baseline has no entry for ${missing.join(", ")}; add it to the baseline, with its canonical key, before the registry is built`,
    );

  const notApproved = new Set((baseline.not_approved ?? []).map((entry) => entry.id));
  const ingredients: AliasRegistry["ingredients"] = [];
  for (const entry of baseline.ingredients ?? []) {
    const id = Object.values(entry.ids ?? {})[0];
    const info = referenced.get(id);
    if (!info) continue; // checked above
    for (const mapped of Object.values(entry.ids ?? {}))
      if (notApproved.has(mapped))
        throw new Error(`${mapped} is not approved and must not be mapped`);

    const ids: Record<string, string> = { ...entry.ids };
    const reviewed: Record<string, string> = {};
    const evidence: Record<string, string> = {};
    for (const [market, mapped] of Object.entries(entry.ids ?? {})) reviewed[market] = baseline.reviewed_on;
    for (const [market, mapping] of Object.entries(entry.markets ?? {})) {
      if (!mapping?.id) throw new Error(`the ${market} mapping of ${entry.key} has no identifier`);
      if (notApproved.has(mapping.id))
        throw new Error(`${mapping.id} is not approved and must not be mapped`);
      if (!mapping.reviewed)
        throw new Error(`the ${market} mapping of ${entry.key} has no review date, so it is not reviewed`);
      // A review date is a marker that a review happened. The evidence is
      // what the reviewer read, and a mapping without it is refused.
      if (!mapping.evidence?.trim())
        throw new Error(
          `the ${market} mapping of ${entry.key} has no evidence of the review, so it is not a reviewed mapping`,
        );
      // A market's numbers have to come from that market's own source.
      const source = sourceOf(mapping.id);
      const allowed = MARKET_SOURCES[market];
      if (!allowed) throw new Error(`the market ${market} is not one the app maps`);
      if (!source) throw new Error(`the ${market} identifier ${mapping.id} is not a well-formed identifier`);
      if (source !== allowed)
        throw new Error(
          `the ${market} identifier ${mapping.id} is a ${source} identifier, but the ${market} market uses ${allowed} identifiers`,
        );
      ids[market] = mapping.id;
      reviewed[market] = mapping.reviewed;
      evidence[market] = mapping.evidence;
    }
    ingredients.push({
      key: entry.key,
      name: info.name,
      ids,
      reviewed,
      ...(Object.keys(evidence).length ? { evidence } : {}),
    });
  }
  ingredients.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  return {
    version: 1,
    default_market: baseline.default_market,
    generated_by: "scripts/build-ingredient-aliases.ts",
    ingredients,
    not_approved: baseline.not_approved ?? [],
  };
}

/** The registry as it is written, in a stable shape. */
export function serialise(registry: AliasRegistry): string {
  return JSON.stringify(registry, null, 2) + "\n";
}

function main() {
  const registry = buildRegistry();
  fs.writeFileSync(registryPath(), serialise(registry), "utf8");
  console.log(`ingredients: ${registry.ingredients.length}`);
  console.log(`not approved: ${registry.not_approved.length}`);
  console.log(`wrote ${registryPath()}`);
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith("build-ingredient-aliases.ts")) main();

