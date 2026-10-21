import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { lookupBarcode, BarcodeLookupError } from "../src/services/barcode";
import {
  loggedSourceDescriptions,
  loggedSourceOf,
  sourceDescriptions,
} from "../src/core/food-sources";
import { photoFood } from "../src/core/photo-estimate";
import { scale, type Food } from "../src/core/foods";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Replaces the network with a scripted answer. */
function stubFetch(handler: (url: string, init: { signal?: AbortSignal }) => Promise<unknown>) {
  globalThis.fetch = (async (input: unknown, init: { signal?: AbortSignal }) =>
    handler(typeof input === "string" ? input : String((input as { url?: string })?.url), init)) as typeof fetch;
}

const kindOf = async (code: string) => {
  try {
    await lookupBarcode(code);
    return "resolved";
  } catch (e) {
    return e instanceof BarcodeLookupError ? e.kind : `unexpected: ${(e as Error).message}`;
  }
};

test("every food source says where its numbers come from", () => {
  assert.equal(sourceDescriptions.usda.label, "USDA reference data");
  assert.match(sourceDescriptions.usda.detail, /Lab-analysed/);
  assert.equal(sourceDescriptions.recipe.label, "Recipe estimate");
  assert.match(sourceDescriptions.recipe.detail, /estimate/i);
  assert.equal(sourceDescriptions.barcode.label, "Open Food Facts (crowd-contributed)");
  assert.match(sourceDescriptions.barcode.detail, /Open Food Facts/);
  assert.match(sourceDescriptions.barcode.detail, /ODbL/);
  assert.equal(sourceDescriptions.photo.label, "AI photo estimate");
  assert.match(sourceDescriptions.photo.detail, /guess/i);
  assert.equal(loggedSourceDescriptions.manual.label, "Manual entry");
  // No two sources share a description.
  const details = Object.values(sourceDescriptions).map((d) => d.detail);
  assert.equal(new Set(details).size, details.length);
});

test("a logged meal keeps the source it really came from", () => {
  assert.equal(loggedSourceOf({ source: "database", foodId: "usda:5747" }), "usda");
  assert.equal(loggedSourceOf({ source: "database", foodId: "recipe:dal" }), "recipe");
  assert.equal(loggedSourceOf({ source: "barcode", foodId: "off:012345678905" }), "barcode");
  assert.equal(loggedSourceOf({ source: "photo" }), "photo");
  assert.equal(loggedSourceOf({ source: "quick" }), "manual");
  assert.equal(loggedSourceOf({ source: "manual" }), "manual");
  // An entry saved before the food reference was kept.
  assert.equal(loggedSourceOf({ source: "database" }), "usda");
  assert.equal(loggedSourceOf({}), "manual");
});

test("an AI photo estimate is not passed off as USDA data", () => {
  const food = photoFood({
    name: "Chicken and rice",
    calories: 500,
    protein: 30,
    carbs: 50,
    fat: 20,
    fibre: 5,
    uncertainty: "Portion size is a guess.",
    items: [{ name: "chicken breast", grams: 150 }],
  });
  assert.equal(food.source, "photo");
  assert.equal(sourceDescriptions[food.source].label, "AI photo estimate");
});

test("a nutrient the source does not know stays unknown, not zero", () => {
  const partial: Food = {
    id: "test:1",
    name: "Partial food",
    detail: "",
    group: "",
    source: "usda",
    // Fat is simply not known for this entry.
    per100: { calories: 100, protein: 10 },
    servings: [{ label: "100 g", grams: 100 }],
    uncertainty: 0.1,
  };
  const scaled = scale(partial, 100);
  assert.equal(scaled.protein, 10);
  assert.equal(scaled.fat, undefined);
  assert.notEqual(scaled.fat, 0);
  // A genuine zero stays a zero.
  const zeroed: Food = { ...partial, per100: { calories: 100, protein: 10, fat: 0 } };
  assert.equal(scale(zeroed, 100).fat, 0);
});

test("a barcode that is not a barcode is refused before any request", async () => {
  assert.equal(await kindOf("12"), "invalid");
  assert.equal(await kindOf("abcdefgh"), "invalid");
});

test("a product that is not in the database comes back empty, not an error", async () => {
  stubFetch(async () => new Response("", { status: 404 }));
  assert.equal(await lookupBarcode("012345678905"), null);
  stubFetch(async () => new Response(JSON.stringify({ status: 0 }), { status: 200 }));
  assert.equal(await lookupBarcode("012345678905"), null);
});

test("a busy product database is reported as a problem the user can retry", async () => {
  stubFetch(async () => new Response("busy", { status: 503 }));
  assert.equal(await kindOf("012345678905"), "unavailable");
});

test("no connection is reported as offline, not as a raw platform error", async () => {
  stubFetch(async () => {
    throw new TypeError("Network request failed");
  });
  assert.equal(await kindOf("012345678905"), "offline");
});

test("a cancelled lookup is reported as a timeout", async () => {
  stubFetch(async () => {
    const error = new Error("aborted");
    error.name = "AbortError";
    throw error;
  });
  assert.equal(await kindOf("012345678905"), "timeout");
});

test("the lookup gives up after twelve seconds", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal: AbortSignal | undefined;
  stubFetch(async (_url, init) => {
    signal = init.signal;
    return new Promise((_resolve, reject) => {
      init.signal!.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    });
  });
  const pending = kindOf("012345678905");
  t.mock.timers.tick(11999);
  assert.equal(signal?.aborted, false, "the request must not be cancelled early");
  t.mock.timers.tick(1);
  assert.equal(signal?.aborted, true, "the request must be cancelled at twelve seconds");
  assert.equal(await pending, "timeout");
});

test("a product in the database is returned with its own source", async () => {
  stubFetch(async () =>
    new Response(
      JSON.stringify({
        status: 1,
        product: {
          product_name: "Crunchy Oat Bar",
          brands: "Test Brand",
          serving_size: "40 g",
          serving_quantity: "40",
          nutriments: { "energy-kcal_100g": 450, proteins_100g: 10, carbohydrates_100g: 60, fat_100g: 18 },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
  const food = await lookupBarcode("012345678905");
  assert.ok(food);
  assert.equal(food.source, "barcode");
  assert.equal(food.id, "off:012345678905");
  assert.equal(sourceDescriptions[food.source].label, "Open Food Facts (crowd-contributed)");
});
