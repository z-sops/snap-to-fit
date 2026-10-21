// Hybrid photo estimate: the AI names the foods and portions; calories come from USDA
// reference data wherever an item matches, and from the AI estimate only as a fallback.
import { nutrientKeys, scale, searchFoods, type Food, type Nutrients } from "./foods";

export interface PhotoItem { name: string; grams: number }
export interface PhotoResult {
  name: string; calories: number; protein: number; carbs: number; fat: number; fibre: number;
  uncertainty: string; items?: PhotoItem[]; cookingFat?: "none" | "tsp" | "tbsp" | "lots";
}

export function photoFood(r: PhotoResult): Food {
  const items = (r.items || []).filter((i) => i.name && i.grams > 0).slice(0, 12);
  const priced = items.map((i) => {
    const match = searchFoods(i.name, 1)[0];
    return { item: i, match, n: match ? scale(match, i.grams) : null };
  });
  const allMatched = priced.length > 0 && priced.every((p) => p.n?.calories !== undefined);
  let per100: Partial<Nutrients>;
  if (allMatched) {
    per100 = {};
    for (const p of priced)
      for (const k of nutrientKeys) if (p.n![k] !== undefined) per100[k] = Math.round(((per100[k] || 0) + p.n![k]!) * 10) / 10;
  } else {
    per100 = { calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat, fibre: r.fibre };
  }
  return {
    id: "photo",
    name: r.name,
    detail: allMatched ? "AI found the foods · calories from USDA lab data" : "Estimated from your photo",
    group: "Photo",
    // An AI photo estimate is its own kind of evidence, not USDA lab data.
    source: "photo",
    per100,
    servings: [{ label: "Whole meal as photographed", grams: 100 }],
    uncertainty: allMatched ? 0.2 : 0.3,
    items: priced.map((p) => ({ name: p.item.name, grams: p.item.grams, matched: p.match?.name, calories: p.n?.calories !== undefined ? Math.round(p.n.calories) : undefined })),
  };
}
