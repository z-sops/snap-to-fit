import { foodFromOFF, validBarcode, type OFFProduct } from "../core/barcode";
import type { Food } from "../core/foods";

const fields = "code,product_name,product_name_en,brands,serving_size,serving_quantity,nutriments";

/** Why a barcode lookup did not produce a product. */
export type BarcodeErrorKind = "invalid" | "offline" | "timeout" | "unavailable";

/** A lookup that failed in a way the user can act on. */
export class BarcodeLookupError extends Error {
  kind: BarcodeErrorKind;
  constructor(kind: BarcodeErrorKind) {
    super(`barcode lookup failed: ${kind}`);
    this.name = "BarcodeLookupError";
    this.kind = kind;
  }
}

/**
 * Looks a barcode up on Open Food Facts (free, open data). Only the barcode is
 * sent. Returns null when the product is not in the database.
 */
export async function lookupBarcode(code: string): Promise<Food | null> {
  if (!validBarcode(code)) throw new BarcodeLookupError("invalid");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    let res: Response;
    try {
      res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}`, {
        headers: { "User-Agent": "SnapToFit/0.4 (com.zunitech.snaptofit)" },
        signal: controller.signal,
      });
    } catch (e) {
      const name = (e as Error)?.name;
      // The 12 second timer fired, or the platform reported a timeout.
      if (name === "AbortError" || name === "TimeoutError") throw e;
      // The request never reached the product database, so there is no answer.
      throw new BarcodeLookupError("offline");
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new BarcodeLookupError("unavailable");
    const body = (await res.json()) as { status?: number; product?: OFFProduct };
    if (body.status !== 1 || !body.product) return null;
    return foodFromOFF(code, body.product);
  } catch (e) {
    if (e instanceof BarcodeLookupError) throw e;
    const name = (e as Error)?.name;
    // The 12 second timer fired, or the platform reported a timeout.
    if (name === "AbortError" || name === "TimeoutError") throw new BarcodeLookupError("timeout");
    throw new BarcodeLookupError("offline");
  } finally {
    clearTimeout(timer);
  }
}
