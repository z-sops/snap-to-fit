/**
 * The canonical nutrient vocabulary the pipeline normalises to.
 *
 * The nineteen keys are the app's own, in the app's own order, and the unit
 * of each is the app's unit. The source's own unit is kept in the provenance
 * so nothing is lost in translation.
 */
import { nutrientKeys } from "../../src/core/foods";

export const CANONICAL_NUTRIENT_KEYS: readonly string[] = nutrientKeys;

/** The unit the app stores each nutrient in. */
export const CANONICAL_UNITS: Record<string, "kcal" | "g" | "mg" | "mcg"> = {
  calories: "kcal",
  protein: "g",
  carbs: "g",
  fat: "g",
  fibre: "g",
  sugar: "g",
  satFat: "g",
  sodium: "mg",
  potassium: "mg",
  calcium: "mg",
  iron: "mg",
  magnesium: "mg",
  zinc: "mg",
  vitaminC: "mg",
  vitaminD: "mcg",
  vitaminB12: "mcg",
  folate: "mcg",
  vitaminA: "mcg",
  cholesterol: "mg",
};

/**
 * The INFOODS tag the CNF uses for each app key.
 *
 * Two CNF nutrients are deliberately not mapped: `ENERC_KJ`, because the app
 * stores kilocalories and CNF publishes `ENERC_KCAL` directly, and `VITD_IU`,
 * because the app's vitamin D is in micrograms. Mapping either would put a
 * different quantity in the record.
 */
export const CNF_TAG_BY_APP_KEY: Record<string, string> = {
  calories: "ENERC_KCAL",
  protein: "PROCNT",
  carbs: "CHOCDF",
  fat: "FAT",
  fibre: "FIBTG",
  sugar: "SUGAR",
  satFat: "FASAT",
  sodium: "NA",
  potassium: "K",
  calcium: "CA",
  iron: "FE",
  magnesium: "MG",
  zinc: "ZN",
  vitaminC: "VITC",
  vitaminD: "VITD",
  vitaminB12: "VITB12",
  folate: "FOLDFE",
  vitaminA: "VITA_RAE",
  cholesterol: "CHOLE",
};

/**
 * The `Nutrient_Source_Code` values published in CNF 2026, mapped to the
 * quality of the value they describe.
 *
 * The codes are the authority, not the observation count. Code 0 says only
 * that a value is unchanged from USDA, and codes 81 to 83 name another
 * national dataset, so none of them establishes that a value was laboratory
 * analysed: all four are `inherited`.
 *
 * Code 12 says the value is an *assumed zero*. It is handled separately,
 * because it is a statement about a zero and can contradict the amount
 * printed beside it.
 */
export const CNF_SOURCE_QUALITY: Record<string, "analysed" | "calculated" | "imputed" | "inherited" | "estimated"> = {
  "0": "inherited",
  "1": "calculated",
  "2": "calculated",
  "3": "analysed",
  "4": "calculated",
  "5": "imputed",
  "6": "estimated",
  "7": "analysed",
  "8": "estimated",
  "9": "estimated",
  "10": "estimated",
  "14": "estimated",
  "15": "imputed",
  "16": "calculated",
  "17": "calculated",
  "50": "calculated",
  "51": "calculated",
  "81": "inherited",
  "82": "inherited",
  "83": "inherited",
};

/** The CNF source code that means the value is an assumed zero. */
export const CNF_ASSUMED_ZERO_CODE = "12";
