import { foodFromOFF, validBarcode, type OFFProduct } from "../core/barcode";
import type { Food } from "../core/foods";

const fields = "code,product_name,product_name_en,brands,serving_size,serving_quantity,nutriments";

/** Looks a barcode up on Open Food Facts (free, open data). Only the barcode is sent. */
export async function lookupBarcode(code: string): Promise<Food | null> {
  if (!validBarcode(code)) throw new Error("That does not look like a product barcode.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}`, {
      headers: { "User-Agent": "SnapToFit/0.4 (com.zunitech.snaptofit)" },
      signal: controller.signal,
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("The product database is busy. Try again or search by name.");
    const body = (await res.json()) as { status?: number; product?: OFFProduct };
    if (body.status !== 1 || !body.product) return null;
    return foodFromOFF(code, body.product);
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("No connection to the product database. Search by name instead.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
