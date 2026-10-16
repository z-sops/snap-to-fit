// Open Food Facts product → Snap to Fit Food. Pure parsing so it is unit-tested;
// the network call lives in services/barcode.ts.
import type { Food, Nutrients, Serving } from "./foods";

export interface OFFProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

/** Retail barcodes are 8, 12, 13 or 14 digits (EAN-8, UPC-A, EAN-13, GTIN-14). */
export function validBarcode(code: string) {
  return /^(\d{8}|\d{12,14})$/.test(code.trim());
}

const n = (v: unknown) => {
  const x = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(x) && x >= 0 ? x : undefined;
};

export function foodFromOFF(code: string, p: OFFProduct): Food | null {
  const m = p.nutriments || {};
  const kcal = n(m["energy-kcal_100g"]) ?? (n(m["energy_100g"]) !== undefined ? n(m["energy_100g"])! / 4.184 : undefined);
  const name = (p.product_name_en || p.product_name || "").trim();
  if (!name || kcal === undefined) return null;
  const g = (k: string, factor = 1) => (n(m[k]) !== undefined ? Math.round(n(m[k])! * factor * 10) / 10 : undefined);
  const per100: Partial<Nutrients> = {
    calories: Math.round(kcal), protein: g("proteins_100g"), carbs: g("carbohydrates_100g"), fat: g("fat_100g"),
    fibre: g("fiber_100g"), sugar: g("sugars_100g"), satFat: g("saturated-fat_100g"),
    sodium: g("sodium_100g", 1000), potassium: g("potassium_100g", 1000), calcium: g("calcium_100g", 1000),
    iron: g("iron_100g", 1000), vitaminC: g("vitamin-c_100g", 1000), vitaminD: g("vitamin-d_100g", 1e6),
    cholesterol: g("cholesterol_100g", 1000),
  };
  for (const k of Object.keys(per100) as (keyof Nutrients)[]) if (per100[k] === undefined) delete per100[k];
  const servings: Serving[] = [];
  const sq = n(p.serving_quantity);
  if (sq && sq > 0 && sq < 2000) servings.push({ label: p.serving_size?.trim() || `${sq} g`, grams: sq });
  servings.push({ label: "100 g", grams: 100 }, { label: "1 oz", grams: 28.35 });
  const brand = p.brands?.split(",")[0]?.trim();
  return {
    id: `off:${code}`, name, detail: brand ? `${brand} · package label` : "Package label", group: "Packaged food",
    source: "barcode", per100, servings, uncertainty: 0.1, brand,
  };
}
