import fs from "node:fs";
import path from "node:path";
import { buildDataset, toBuildInput } from "../../../pipeline/build/build";
import { readManifest, sourceDir } from "../../../pipeline/fetch";

/**
 * Builds the benchmark assets, in the two shapes under test.
 *
 *   B  one file per market: the search index and the nutrient detail
 *      together. Loading a market parses the whole file.
 *   C  a small search index and a keyed detail store, apart. The store is a
 *      pack file: a header with the offset and length of every record, and
 *      the records themselves, one after another.
 *
 * The records are the M2-2 pipeline's own, from the strictly verified
 * sources. Nothing is derived, rounded or dropped here.
 *
 *   node --import tsx research/m2-3a/bench/build-assets.ts
 */
const root = process.cwd();

/** Where the assets go. They are large, so they are not in the repository. */
export function assetsDir(): string {
  return path.join(root, "research", "m2-3a", ".cache");
}

interface BuiltRecord {
  id: string;
  name: string;
  group: string;
  region: "US" | "CA";
  source: "usda" | "cnf";
  per100: Record<string, number>;
  servings: { label: string; grams: number }[];
  nutrients: Record<string, { quality: string; sourceCode: string; observations?: number }>;
}

/** The verified records, from the pipeline's own build. */
export function verifiedRecords(): BuiltRecord[] {
  const manifest = readManifest(root);
  const inputs = manifest.inputs.map((input) => toBuildInput(input, root));
  const cnf = manifest.inputs.find((input) => input.region === "CA");
  const cnfDir = cnf ? sourceDir(root, cnf.id) : undefined;
  if (cnf && !cnfDir) throw new Error("the Canadian source is not in the cache; run npm run data:build first");
  const dataset = buildDataset(inputs, cnfDir, {
    mode: "verified",
    sourceDirs: new Map([[cnf!.id, cnfDir!]]),
  });
  return dataset.foods as unknown as BuiltRecord[];
}

const tokenise = (name: string): string[] =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ")
    .split(" ")
    .filter(Boolean);

/** Writes the assets for both architectures, and reports their sizes. */
export function buildAssets(): { files: { name: string; bytes: number }[]; records: number } {
  const records = verifiedRecords();
  const out = assetsDir();
  fs.mkdirSync(out, { recursive: true });
  const files: { name: string; bytes: number }[] = [];

  for (const market of ["US", "CA"] as const) {
    const own = records.filter((record) => record.region === market);
    const index = {
      version: 1,
      market,
      source: market === "US" ? ("usda" as const) : ("cnf" as const),
      records: own.map((record) => ({
        id: record.id,
        name: record.name,
        tokens: tokenise(record.name),
      })),
    };

    // B: one file per market, index and detail together.
    const bundle = {
      ...index,
      details: Object.fromEntries(
        own.map((record) => [
          record.id,
          {
            id: record.id,
            name: record.name,
            group: record.group,
            per100: record.per100,
            servings: record.servings,
            nutrients: record.nutrients,
          },
        ]),
      ),
    };
    const bundleName = `bundle-${market.toLowerCase()}.json`;
    fs.writeFileSync(path.join(out, bundleName), JSON.stringify(bundle));
    files.push({ name: bundleName, bytes: fs.statSync(path.join(out, bundleName)).size });

    // C: the index, and a keyed detail store.
    const indexName = `index-${market.toLowerCase()}.json`;
    fs.writeFileSync(path.join(out, indexName), JSON.stringify(index));
    files.push({ name: indexName, bytes: fs.statSync(path.join(out, indexName)).size });

    const offsets: Record<string, [number, number]> = {};
    const chunks: Buffer[] = [];
    let at = 0;
    for (const record of own) {
      const text = JSON.stringify({
        id: record.id,
        name: record.name,
        group: record.group,
        per100: record.per100,
        servings: record.servings,
        nutrients: record.nutrients,
      });
      const bytes = Buffer.from(text, "utf8");
      offsets[record.id] = [at, bytes.length];
      chunks.push(bytes);
      at += bytes.length;
    }
    const headerName = `detail-${market.toLowerCase()}.header.json`;
    fs.writeFileSync(
      path.join(out, headerName),
      JSON.stringify({ version: 1, market, source: market === "US" ? "usda" : "cnf", offsets }),
    );
    files.push({ name: headerName, bytes: fs.statSync(path.join(out, headerName)).size });

    const packName = `detail-${market.toLowerCase()}.pack`;
    fs.writeFileSync(path.join(out, packName), Buffer.concat(chunks));
    files.push({ name: packName, bytes: fs.statSync(path.join(out, packName)).size });
  }

  return { files, records: records.length };
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith("build-assets.ts")) {
  const built = buildAssets();
  console.log(`records: ${built.records}`);
  for (const file of built.files) console.log(`${file.name.padEnd(28)} ${file.bytes.toLocaleString()} B`);
}
