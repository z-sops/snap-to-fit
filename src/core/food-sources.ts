// Where a food entry's numbers come from, and how much to trust them.
//
// One place, so the search list, the detail sheet and the meal log all say the
// same thing. The labels are deliberately plain about their limits: a lab
// reference food, a crowd-contributed packaged product, a home recipe estimate
// and an AI photo estimate are not the same kind of evidence.

export type FoodSource = "usda" | "recipe" | "barcode" | "photo";
/** A logged meal also has a source the user created by hand. */
export type LoggedSource = FoodSource | "manual";

export interface SourceDescription {
  /** Short badge label. */
  label: string;
  /** One line saying where the numbers come from and how far to trust them. */
  detail: string;
  /** How the numbers should be read. */
  certainty: "measured" | "crowd" | "estimated" | "manual";
}

export const sourceDescriptions: Record<FoodSource, SourceDescription> = {
  usda: {
    label: "USDA reference data",
    detail:
      "Lab-analysed USDA FoodData Central reference food. The most reliable numbers in the app, but still a generic food rather than your own brand.",
    certainty: "measured",
  },
  recipe: {
    label: "Recipe estimate",
    detail:
      "Built from USDA ingredients using a typical home portion. An estimate of a usual serving, not a measured dish.",
    certainty: "estimated",
  },
  barcode: {
    label: "Open Food Facts (crowd-contributed)",
    detail:
      "Packaged product data contributed by the public to Open Food Facts under the ODbL. Branded data can be out of date or simply wrong — always check the package label.",
    certainty: "crowd",
  },
  photo: {
    label: "AI photo estimate",
    detail:
      "Estimated from your photo. Portions, hidden oils and sauces are guesses, so the calorie range is deliberately wide.",
    certainty: "estimated",
  },
};

export const loggedSourceDescriptions: Record<LoggedSource, SourceDescription> = {
  ...sourceDescriptions,
  manual: {
    label: "Manual entry",
    detail:
      "You entered these numbers yourself. Nothing was looked up, so check them against the package label or menu.",
    certainty: "manual",
  },
};

/**
 * The source of a logged meal. The food reference tells us the exact source,
 * so a home recipe stays a recipe instead of becoming a generic database row.
 * Older entries without a reference are treated as manual or database entries.
 */
export function loggedSourceOf(meal: { source?: string; foodId?: string }): LoggedSource {
  const id = meal.foodId || "";
  if (id.startsWith("usda:")) return "usda";
  if (id.startsWith("recipe:")) return "recipe";
  if (id.startsWith("off:")) return "barcode";
  if (meal.source === "photo") return "photo";
  if (meal.source === "barcode") return "barcode";
  if (meal.source === "database") return "usda";
  return "manual";
}

/** The Open Food Facts attribution shown wherever branded product data appears. */
export const openFoodFactsCredit =
  "Product data © Open Food Facts contributors (ODbL). Always check the package label.";

/** The bundled food catalogue: USDA reference data only. */
export const foodCatalogCredit =
  "Nutrition data: USDA FoodData Central (SR Legacy). Dishes are estimates from typical recipes.";
