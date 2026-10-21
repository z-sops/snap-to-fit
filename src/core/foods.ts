import { dishes, recipeSlots } from "./dishes";
import type { Allergen, CuisinePreference, MealSlot } from "./planning-types";
import type { FoodSource } from "./food-sources";
export type { FoodSource } from "./food-sources";
// Food database engine: USDA SR28 reference foods (public domain), popular friendly names,
// recipe-based dishes built from USDA ingredients, serving maths, honest ranges and
// hidden-fat adjustments. Pure TypeScript so it is covered by node tests.

export const nutrientKeys = [
  "calories", "protein", "carbs", "fat", "fibre", "sugar", "satFat", "sodium", "potassium",
  "calcium", "iron", "magnesium", "zinc", "vitaminC", "vitaminD", "vitaminB12", "folate",
  "vitaminA", "cholesterol",
] as const;
export type NutrientKey = (typeof nutrientKeys)[number];
export type Nutrients = Record<NutrientKey, number>;
export const nutrientInfo: Record<NutrientKey, { label: string; unit: string; dv?: number; limit?: boolean }> = {
  calories: { label: "Calories", unit: "kcal" },
  protein: { label: "Protein", unit: "g", dv: 50 },
  carbs: { label: "Carbs", unit: "g", dv: 275 },
  fat: { label: "Fat", unit: "g", dv: 78 },
  fibre: { label: "Fiber", unit: "g", dv: 28 },
  sugar: { label: "Sugars", unit: "g" },
  satFat: { label: "Saturated fat", unit: "g", dv: 20, limit: true },
  sodium: { label: "Sodium", unit: "mg", dv: 2300, limit: true },
  potassium: { label: "Potassium", unit: "mg", dv: 4700 },
  calcium: { label: "Calcium", unit: "mg", dv: 1300 },
  iron: { label: "Iron", unit: "mg", dv: 18 },
  magnesium: { label: "Magnesium", unit: "mg", dv: 420 },
  zinc: { label: "Zinc", unit: "mg", dv: 11 },
  vitaminC: { label: "Vitamin C", unit: "mg", dv: 90 },
  vitaminD: { label: "Vitamin D", unit: "mcg", dv: 20 },
  vitaminB12: { label: "Vitamin B12", unit: "mcg", dv: 2.4 },
  folate: { label: "Folate", unit: "mcg DFE", dv: 400 },
  vitaminA: { label: "Vitamin A", unit: "mcg RAE", dv: 900 },
  cholesterol: { label: "Cholesterol", unit: "mg", dv: 300, limit: true },
};

export interface Serving { label: string; grams: number }
export interface Food {
  id: string;
  name: string;
  detail: string;
  group: string;
  source: FoodSource;
  /** Per 100 g. -1 / missing values are unknown, never zero. */
  per100: Partial<Nutrients>;
  servings: Serving[];
  /** Typical estimate error, as a fraction (0.1 = ±10 %). */
  uncertainty: number;
  brand?: string;
  /** Photo estimates: what the AI saw and how each item was priced. */
  items?: { name: string; grams: number; matched?: string; calories?: number }[];
}

type Row = [number, string, string, number[], [number, string][]];
interface Dataset { groups: Record<string, string>; foods: Row[] }
let cache: { data: Dataset; byId: Map<number, Row>; tokens: string[][] } | null = null;
function dataset() {
  if (!cache) {
    const data = require("../data/usda-foods.json") as Dataset;
    cache = { data, byId: new Map(data.foods.map((r) => [r[0], r])), tokens: data.foods.map((r) => words(r[1])) };
  }
  return cache;
}

function per100(values: number[]): Partial<Nutrients> {
  const out: Partial<Nutrients> = {};
  nutrientKeys.forEach((k, i) => {
    if (values[i] !== undefined && values[i] >= 0) out[k] = values[i];
  });
  return out;
}
const cleanServing = (label: string) => label.replace(/\s+/g, " ").replace(/^\.(\d)/, "0.$1").trim();

function fromRow(r: Row, friendly?: Popular): Food {
  const { data } = dataset();
  const servings: Serving[] = r[4].map(([g, l]) => ({ grams: g, label: cleanServing(l) }));
  if (friendly?.serving) servings.unshift(friendly.serving);
  servings.push({ label: "100 g", grams: 100 }, { label: "1 oz", grams: 28.35 });
  const unique = servings.filter((s, i) => servings.findIndex((x) => x.label === s.label) === i);
  return {
    id: `usda:${r[0]}`,
    name: friendly?.name || r[1],
    detail: friendly ? r[1] : data.groups[r[2]] || "",
    group: data.groups[r[2]] || "",
    source: "usda",
    per100: per100(r[3]),
    servings: unique,
    // Lab-analysed reference foods; restaurant and mixed dishes vary more.
    uncertainty: ["2100", "3600", "2200"].includes(r[2]) ? 0.2 : 0.1,
  };
}

interface Popular { id: number; name: string; serving?: Serving; tags?: string }
/** Friendly names for the foods Americans log most, mapped to USDA reference foods. */
export const popular: Popular[] = [
  { id: 5747, name: "Chicken breast, grilled", serving: { label: "1 breast (6 oz)", grams: 170 }, tags: "chicken" },
  { id: 5064, name: "Chicken breast, roasted", tags: "chicken" },
  { id: 5098, name: "Chicken thigh, roasted (no skin)", tags: "chicken" },
  { id: 20045, name: "White rice, cooked", tags: "rice" },
  { id: 20037, name: "Brown rice, cooked", tags: "rice" },
  { id: 1123, name: "Egg, large", serving: { label: "1 large egg", grams: 50 }, tags: "eggs" },
  { id: 1132, name: "Scrambled eggs", tags: "eggs" },
  { id: 1129, name: "Hard-boiled egg", serving: { label: "1 large egg", grams: 50 }, tags: "eggs" },
  { id: 18075, name: "Whole-wheat bread", tags: "toast" },
  { id: 18069, name: "White bread", tags: "toast" },
  { id: 9040, name: "Banana", serving: { label: "1 medium", grams: 118 } },
  { id: 9003, name: "Apple", serving: { label: "1 medium", grams: 182 } },
  { id: 20038, name: "Oats (dry)", serving: { label: "½ cup dry", grams: 40 }, tags: "oatmeal porridge" },
  { id: 1079, name: "Milk, 2%", tags: "milk" },
  { id: 1077, name: "Milk, whole", tags: "milk" },
  { id: 1256, name: "Greek yogurt, plain nonfat", tags: "yogurt" },
  { id: 16098, name: "Peanut butter", tags: "pb" },
  { id: 9038, name: "Avocado", serving: { label: "½ avocado", grams: 68 } },
  { id: 11091, name: "Broccoli, cooked" },
  { id: 15237, name: "Salmon, cooked", tags: "fish" },
  { id: 23568, name: "Ground beef 85%, cooked patty", tags: "burger beef" },
  { id: 20121, name: "Pasta, cooked", tags: "spaghetti noodles" },
  { id: 11674, name: "Baked potato", serving: { label: "1 medium", grams: 173 } },
  { id: 11508, name: "Sweet potato, baked" },
  { id: 1009, name: "Cheddar cheese", serving: { label: "1 slice", grams: 28 }, tags: "cheese" },
  { id: 4053, name: "Olive oil", tags: "oil" },
  { id: 1001, name: "Butter", serving: { label: "1 tbsp", grams: 14 } },
  { id: 12061, name: "Almonds", serving: { label: "1 oz (23 almonds)", grams: 28 }, tags: "nuts" },
  { id: 14209, name: "Coffee, black", serving: { label: "1 cup (8 fl oz)", grams: 237 } },
  { id: 18363, name: "Corn tortilla", serving: { label: "1 tortilla (6\")", grams: 26 } },
  { id: 18364, name: "Flour tortilla" },
  { id: 16015, name: "Black beans, cooked", tags: "frijoles" },
  { id: 16070, name: "Lentils, cooked", tags: "dal daal" },
  { id: 16357, name: "Chickpeas, cooked", tags: "chana garbanzo" },
  { id: 16126, name: "Tofu, firm" },
  { id: 11457, name: "Spinach, raw" },
  { id: 9316, name: "Strawberries" },
  { id: 9050, name: "Blueberries" },
  { id: 9206, name: "Orange juice" },
  { id: 15121, name: "Tuna, canned in water" },
  { id: 14066, name: "Whey protein powder", serving: { label: "1 scoop", grams: 32 }, tags: "shake protein" },
  { id: 16158, name: "Hummus" },
  { id: 10860, name: "Bacon, cooked", serving: { label: "2 slices", grams: 16 } },
  { id: 11251, name: "Romaine lettuce", tags: "salad" },
  { id: 11529, name: "Tomato", serving: { label: "1 medium", grams: 123 } },
  { id: 20137, name: "Quinoa, cooked" },
  { id: 19296, name: "Honey", serving: { label: "1 tbsp", grams: 21 } },
  { id: 19335, name: "Sugar", serving: { label: "1 tsp", grams: 4.2 } },
  { id: 11935, name: "Ketchup", tags: "catsup" },
  { id: 4025, name: "Mayonnaise", tags: "mayo" },
  { id: 6164, name: "Salsa" },
  { id: 1056, name: "Sour cream" },
  { id: 1015, name: "Cottage cheese, 2%" },
  { id: 1026, name: "Mozzarella" },
  { id: 19095, name: "Vanilla ice cream" },
  { id: 19411, name: "Potato chips", tags: "crisps" },
  { id: 19034, name: "Popcorn, air-popped" },
  { id: 9326, name: "Watermelon" },
  { id: 9176, name: "Mango" },
  { id: 28307, name: "Naan" },
  { id: 28306, name: "Roti / chapati" },
  { id: 21238, name: "French fries (fast food, small)", tags: "fries" },
  { id: 21107, name: "Hamburger (fast food)", tags: "burger" },
  { id: 36050, name: "Cheese enchiladas (restaurant)" },
  { id: 36052, name: "Cheese quesadilla (restaurant)" },
  { id: 21078, name: "Nachos with cheese" },
  { id: 36602, name: "Fried rice (restaurant)" },
  { id: 22975, name: "Chicken nuggets", tags: "nuggets" },
  { id: 14148, name: "Cola (regular soda)", serving: { label: "1 can (12 fl oz)", grams: 368 }, tags: "soda coke pop" },
  { id: 14416, name: "Diet cola", serving: { label: "1 can (12 fl oz)", grams: 355 }, tags: "soda coke pop" },
  { id: 21505, name: "Cheese pizza, thin crust", tags: "pizza" },
  { id: 21275, name: "Pepperoni pizza, pan (12\")", tags: "pizza" },
  { id: 14154, name: "Energy drink", tags: "redbull" },
  { id: 18239, name: "Butter croissant", serving: { label: "1 medium", grams: 57 } },
];

// Recipe dishes: typical home portions built from USDA ingredients (grams per serving).
interface Recipe { id: string; name: string; group: string; serving: string; tags: string; parts: [number, number][]; slots?: MealSlot[] }
const baseRecipes: Recipe[] = [
  { id: "chicken-biryani", name: "Chicken biryani", group: "Indian & Pakistani", serving: "1 plate", tags: "biryani rice", parts: [[20045, 180], [5098, 100], [11282, 30], [4582, 12], [1116, 20], [11530, 15]] },
  { id: "dal", name: "Dal (yellow lentil curry)", group: "Indian & Pakistani", serving: "1 cup", tags: "daal lentil", parts: [[16070, 200], [11282, 15], [11530, 15], [4582, 7]] },
  { id: "chicken-curry", name: "Chicken curry / karahi", group: "Indian & Pakistani", serving: "1 cup", tags: "karahi salan", parts: [[5098, 140], [11530, 50], [11282, 30], [4582, 15], [1116, 10]] },
  { id: "tikka-masala", name: "Chicken tikka masala", group: "Indian & Pakistani", serving: "1 cup", tags: "tikka", parts: [[5064, 120], [11530, 60], [1053, 30], [1001, 10], [11282, 20]] },
  { id: "butter-chicken", name: "Butter chicken", group: "Indian & Pakistani", serving: "1 cup", tags: "makhani", parts: [[5098, 120], [11530, 50], [1053, 40], [1001, 15]] },
  { id: "chicken-tikka", name: "Chicken tikka (grilled)", group: "Indian & Pakistani", serving: "6 pieces", tags: "tikka kebab", parts: [[5064, 150], [1116, 10], [4582, 5]] },
  { id: "seekh-kebab", name: "Seekh kebab", group: "Indian & Pakistani", serving: "2 kebabs", tags: "kabab", parts: [[23570, 100], [11282, 10]] },
  { id: "palak-paneer", name: "Palak paneer", group: "Indian & Pakistani", serving: "1 cup", tags: "saag", parts: [[11458, 150], [1036, 70], [1053, 15], [4582, 8]] },
  { id: "chana-masala", name: "Chana masala", group: "Indian & Pakistani", serving: "1 cup", tags: "chole chickpea", parts: [[16357, 170], [11530, 40], [11282, 25], [4582, 8]] },
  { id: "aloo-gobi", name: "Aloo gobi", group: "Indian & Pakistani", serving: "1 cup", tags: "potato cauliflower", parts: [[11367, 100], [11136, 80], [11282, 20], [4582, 10]] },
  { id: "nihari", name: "Nihari (beef stew)", group: "Indian & Pakistani", serving: "1 cup", tags: "stew", parts: [[23090, 150], [4582, 15], [20081, 10], [11282, 20]] },
  { id: "haleem", name: "Haleem", group: "Indian & Pakistani", serving: "1 cup", tags: "daleem", parts: [[23090, 80], [16070, 80], [20013, 60], [4582, 12]] },
  { id: "samosa", name: "Samosa (potato)", group: "Indian & Pakistani", serving: "1 piece", tags: "snack", parts: [[20081, 30], [11367, 45], [11313, 10], [4582, 15]] },
  { id: "pakora", name: "Pakora", group: "Indian & Pakistani", serving: "5 pieces", tags: "pakoda bhaji", parts: [[16157, 40], [11282, 30], [4582, 20]] },
  { id: "paratha", name: "Paratha", group: "Indian & Pakistani", serving: "1 piece", tags: "parotta", parts: [[28306, 70], [1003, 8]] },
  { id: "raita", name: "Raita", group: "Indian & Pakistani", serving: "1 cup", tags: "yogurt", parts: [[1116, 150], [11205, 50]] },
  { id: "kheer", name: "Kheer (rice pudding)", group: "Indian & Pakistani", serving: "1 cup", tags: "dessert", parts: [[1077, 200], [20045, 40], [19335, 20]] },
  { id: "sweet-lassi", name: "Sweet lassi", group: "Indian & Pakistani", serving: "1 glass", tags: "drink", parts: [[1116, 150], [1077, 70], [19335, 20]] },
  { id: "masala-chai", name: "Masala chai with sugar", group: "Indian & Pakistani", serving: "1 cup", tags: "tea", parts: [[14355, 140], [1077, 100], [19335, 10]] },
  { id: "burrito-bowl", name: "Chicken burrito bowl", group: "Mexican", serving: "1 bowl", tags: "bowl", parts: [[20045, 150], [16015, 120], [5747, 110], [6164, 60], [1025, 30], [1056, 30], [11251, 30]] },
  { id: "street-tacos", name: "Steak street tacos", group: "Mexican", serving: "2 tacos", tags: "carne asada taco", parts: [[18363, 52], [23655, 90], [11282, 15], [11165, 4], [6164, 30]] },
  { id: "chicken-tacos", name: "Chicken tacos", group: "Mexican", serving: "2 tacos", tags: "taco", parts: [[18363, 52], [5747, 90], [6164, 30], [1025, 15], [11251, 15]] },
  { id: "guacamole", name: "Guacamole", group: "Mexican", serving: "¼ cup", tags: "guac avocado", parts: [[9038, 55], [11282, 5], [11529, 5], [9160, 3]] },
  { id: "elote", name: "Elote (Mexican street corn)", group: "Mexican", serving: "1 ear", tags: "corn", parts: [[11168, 100], [4025, 10], [1033, 8], [9160, 3]] },
  { id: "chicken-salad", name: "Grilled chicken salad", group: "American", serving: "1 bowl", tags: "salad", parts: [[11251, 100], [5747, 110], [11529, 60], [11205, 50], [4053, 10]] },
  { id: "pb-sandwich", name: "Peanut butter sandwich", group: "American", serving: "1 sandwich", tags: "pbj", parts: [[18075, 64], [16098, 32]] },
  { id: "overnight-oats", name: "Oatmeal with banana", group: "American", serving: "1 bowl", tags: "oatmeal porridge", parts: [[20038, 40], [1079, 180], [9040, 60]] },
  { id: "latte", name: "Latte (2% milk)", group: "American", serving: "1 grande (16 oz)", tags: "coffee cafe", parts: [[14210, 60], [1079, 300]] },
  { id: "iced-coffee", name: "Iced coffee with milk & sugar", group: "American", serving: "1 medium", tags: "coffee", parts: [[14209, 300], [1079, 60], [19335, 10]] },
  { id: "avocado-toast", name: "Avocado toast", group: "American", serving: "1 slice", tags: "toast avo", parts: [[18075, 32], [9038, 50], [4053, 3]] },
  { id: "avocado-toast-egg", name: "Avocado toast with egg", group: "American", serving: "1 slice", tags: "toast avo egg", parts: [[18075, 32], [9038, 50], [1129, 50]] },
  { id: "berry-smoothie", name: "Berry banana smoothie", group: "American", serving: "1 glass", tags: "smoothie", parts: [[9050, 70], [9316, 70], [9040, 60], [1256, 100], [1079, 120]] },
  { id: "protein-shake", name: "Protein shake with milk", group: "American", serving: "1 shake", tags: "whey shake", parts: [[14066, 32], [1079, 240]] },
];
/** Every dish: the original recipes plus the cuisine library, each tagged with the meals it suits. */
export const recipes: (Recipe & { slots: MealSlot[] })[] = [
  ...baseRecipes.map((r) => ({ ...r, slots: recipeSlots[r.id] || (["lunch", "dinner"] as MealSlot[]) })),
  ...dishes,
];

/** Diet pattern and likely allergens of a dish, read from its USDA ingredients (label check still needed). */
export interface DishTraits { diet: "vegan" | "vegetarian" | "omnivore"; allergens: Allergen[] }
const allergenWords: Record<Allergen, RegExp> = {
  milk: /milk|cheese|yogurt|butter|cream|whey|lassi|kheer|latte|paneer/i,
  egg: /\begg|mayonnaise|pancake|noodles, egg|croissant/i,
  fish: /fish|salmon|tuna|cod|tilapia|haddock/i,
  shellfish: /shrimp|prawn|crab|lobster|crustacean/i,
  wheat: /bread|toast|pasta|spaghetti|macaroni|noodles|tortillas, ready-to-bake or -fry, flour|roll|bun|bagel|muffin|croissant|pretzel|pancake|chapati|roti|naan|soy sauce made from soy and wheat|granola|pizza|oats|wheat/i,
  soy: /soy|tofu|edamame|miso/i,
  peanut: /peanut/i,
  "tree-nut": /almond|walnut|cashew|pistachio|coconut|pecan/i,
  sesame: /sesame|tahini/i,
};
const meatGroups = new Set(["0500", "0700", "1000", "1300", "1500", "1700"]);
const meatWords = /chicken|beef|pork|ham\b|bacon|sausage|fish|tuna|salmon|shrimp|turkey|lamb|chili with meat|frankfurter|bratwurst/i;
const animalWords = /egg|cheese|milk|yogurt|butter|cream|honey|mayonnaise|pancake|croissant|lassi|kheer/i;
const traitsCache = new Map<string, DishTraits>();
export function dishTraits(id: string): DishTraits {
  const hit = traitsCache.get(id);
  if (hit) return hit;
  const r = recipes.find((x) => x.id === id);
  const { byId } = dataset();
  const names = (r?.parts || []).map(([n]) => byId.get(n)).filter(Boolean) as Row[];
  const text = `${r?.name || ""} ${names.map((row) => row[1]).join(" | ")}`;
  const meat = names.some((row) => meatGroups.has(row[2])) || meatWords.test(text);
  const animal = names.some((row) => row[2] === "0100") || animalWords.test(text);
  const out: DishTraits = {
    diet: meat ? "omnivore" : animal ? "vegetarian" : "vegan",
    allergens: (Object.keys(allergenWords) as Allergen[]).filter((a) => allergenWords[a].test(text)),
  };
  traitsCache.set(id, out);
  return out;
}

/** A dish's ingredients with short names and protein per 100 g (for "protein sources"). */
export function dishIngredients(id: string): { name: string; protein: number }[] {
  const r = recipes.find((x) => x.id === id);
  const { byId } = dataset();
  return (r?.parts || []).map(([n]) => byId.get(n)).filter(Boolean).map((row) => ({
    name: shortName(row![1]),
    protein: row![3][1] || 0,
  }));
}
const shortName = (usda: string) => {
  const parts = usda.split(",").map((x) => x.trim()).filter((x) => !/^(mature seeds|raw|cooked|boiled|roasted|enriched|regular|commercially prepared|ready-to-serve|plain)$/i.test(x));
  const head = parts[0].replace(/^(Fish|Crustaceans|Nuts|Beverages|Cereals ready-to-eat|Snacks)$/i, "");
  return (head ? [head, parts[1]] : [parts[1], parts[2]]).filter(Boolean).slice(0, 2).join(", ").replace(/\s*\(.*?\)/g, "");
};

/** Which dish group belongs to a cuisine preference. */
export const cuisineGroups: Record<CuisinePreference, string> = {
  american: "American", british: "British", mexican: "Mexican", "asian-indian": "Indian & Pakistani",
  "asian-chinese": "Chinese", "asian-japanese": "Japanese", "asian-thai": "Thai",
  german: "German", french: "French", brazilian: "Brazilian",
};
/** The user's own cuisine first, then everything else (so other kitchens stay findable). */
export function dishesFor(cuisine: CuisinePreference = "american") {
  const own = cuisineGroups[cuisine];
  return [...recipes.filter((r) => r.group === own), ...recipes.filter((r) => r.group !== own)];
}
/** Popular staples that belong to one kitchen; hidden from other cuisines' quick lists. */
const popularCuisine: Record<number, string> = {
  28307: "Indian & Pakistani", 28306: "Indian & Pakistani", 36050: "Mexican", 36052: "Mexican", 21078: "Mexican",
  6164: "Mexican", 36602: "Chinese",
};


function recipeFood(r: Recipe): Food {
  const { byId } = dataset();
  const total: Partial<Nutrients> = {};
  let grams = 0;
  for (const [id, g] of r.parts) {
    const row = byId.get(id);
    if (!row) throw new Error(`Recipe ${r.id} uses missing USDA food ${id}`);
    grams += g;
    nutrientKeys.forEach((k, i) => {
      const v = row[3][i];
      if (v >= 0) total[k] = (total[k] || 0) + (v * g) / 100;
    });
  }
  const p100: Partial<Nutrients> = {};
  for (const k of nutrientKeys) if (total[k] !== undefined) p100[k] = (total[k]! * 100) / grams;
  return {
    id: `recipe:${r.id}`, name: r.name, detail: r.group, group: r.group,
    source: "recipe", per100: p100,
    servings: [{ label: r.serving, grams: Math.round(grams) }, { label: "100 g", grams: 100 }],
    uncertainty: 0.25,
  };
}

export function foodById(id: string): Food | null {
  if (id.startsWith("recipe:")) {
    const r = recipes.find((x) => `recipe:${x.id}` === id);
    return r ? recipeFood(r) : null;
  }
  const n = Number(id.replace("usda:", ""));
  const row = dataset().byId.get(n);
  return row ? fromRow(row, popular.find((p) => p.id === n)) : null;
}

const synonyms: Record<string, string> = {
  fries: "french fries", soda: "carbonated", coke: "cola", pop: "carbonated", oatmeal: "oats",
  porridge: "oats", yoghurt: "yogurt", veggies: "vegetables", mayo: "mayonnaise", chips: "chips",
  ketchup: "catsup", garbanzo: "chickpeas", chana: "chickpeas", daal: "dal", roti: "chapati",
  burger: "hamburger", steak: "beef", ham: "ham", shake: "protein",
};
const stem = (w: string) => (w.length > 4 && w.endsWith("es") ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w);
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9%]+/g, " ").split(" ").filter(Boolean).map(stem);
const queryWords = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9%]+/g, " ").split(" ").filter(Boolean).flatMap((w) => words(synonyms[w] || w));

/** Ranked search: popular and recipe dishes first, then USDA reference foods. */
export function searchFoods(query: string, limit = 40, cuisine: CuisinePreference = "american"): Food[] {
  const q = queryWords(query);
  const own = cuisineGroups[cuisine];
  if (!q.length)
    return [
      ...dishesFor(cuisine).slice(0, 6).map(recipeFood),
      ...popular.filter((p) => !popularCuisine[p.id] || popularCuisine[p.id] === own).slice(0, 12).map((p) => foodById(`usda:${p.id}`)!),
    ];
  const matchTokens = (t: string[]) => q.every((w) => t.some((x) => x.startsWith(w)));
  const match = (text: string) => matchTokens(words(text));
  const scored: { score: number; food: () => Food }[] = [];
  for (const p of popular)
    if (match(`${p.name} ${p.tags || ""}`)) scored.push({ score: 1000 - p.name.length - (popularCuisine[p.id] && popularCuisine[p.id] !== own ? 150 : 0), food: () => foodById(`usda:${p.id}`)! });
  for (const r of recipes)
    if (match(`${r.name} ${r.tags} ${r.group}`)) scored.push({ score: 900 - r.name.length + (r.group === own ? 80 : 0), food: () => recipeFood(r) });
  const seen = new Set(popular.map((p) => p.id));
  const { data, tokens } = dataset();
  data.foods.forEach((row, i) => {
    if (seen.has(row[0]) || !matchTokens(tokens[i])) return;
    const name = row[1].toLowerCase();
    let score = 500 - row[1].length;
    if (name.startsWith(q[0])) score += 60;
    if (/cooked|roasted|grilled|baked|boiled|prepared/.test(name)) score += 15;
    if (/\braw\b/.test(name) && !/fruit|vegetable/.test(data.groups[row[2]]?.toLowerCase() || "")) score -= 10;
    if (/^[A-Z' ]{4,},/.test(row[1])) score -= 25; // branded rows after generic
    scored.push({ score, food: () => fromRow(row) });
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.food());
}

/** Nutrients for an amount of a food (grams). Unknown values stay undefined. */
export function scale(food: Pick<Food, "per100">, grams: number): Partial<Nutrients> {
  const out: Partial<Nutrients> = {};
  for (const k of nutrientKeys) {
    const v = food.per100[k];
    if (v !== undefined) out[k] = Math.round(((v * grams) / 100) * 10) / 10;
  }
  return out;
}

export type AddedFat = "none" | "tsp" | "tbsp" | "lots";
/** Hidden cooking fat most photo/manual logs miss (oil ≈ 40 kcal per tsp, 120 per tbsp). */
export const addedFat: Record<AddedFat, { label: string; grams: number }> = {
  none: { label: "No added oil", grams: 0 },
  tsp: { label: "A little (1 tsp)", grams: 4.5 },
  tbsp: { label: "Some (1 tbsp)", grams: 13.5 },
  lots: { label: "A lot (2+ tbsp)", grams: 27 },
};
export function withAddedFat(n: Partial<Nutrients>, fat: AddedFat): Partial<Nutrients> {
  const g = addedFat[fat].grams;
  if (!g) return n;
  return {
    ...n,
    calories: Math.round((n.calories || 0) + g * 8.84),
    fat: Math.round(((n.fat || 0) + g) * 10) / 10,
    satFat: Math.round(((n.satFat || 0) + g * 0.14) * 10) / 10,
  };
}

/** Honest range around an estimate, rounded to 10 kcal. */
export function calorieRange(calories: number, uncertainty: number): [number, number] {
  const r = (x: number) => Math.max(0, Math.round(x / 10) * 10);
  return [r(calories * (1 - uncertainty)), r(calories * (1 + uncertainty))];
}

export const foodCredits =
  "Food data: USDA Agricultural Research Service, National Nutrient Database for Standard Reference (SR28 / FoodData Central SR Legacy), public domain. Barcode data: Open Food Facts contributors, ODbL. Recipe dishes are estimates from typical home recipes.";
