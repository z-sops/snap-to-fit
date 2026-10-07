import type { DietType, Allergen, MealSlot, CuisinePreference } from "./planning-types";
export interface MealIdea {
  name: string;
  proteinSources: string[];
  ingredients: string[];
  allergens: Allergen[];
}
const idea = (
  name: string,
  protein: string[],
  ingredients: string[],
  allergens: Allergen[] = [],
): MealIdea => ({ name, proteinSources: protein, ingredients, allergens });
export const countries = [
  { value: "PK", label: "Pakistan" },
  { value: "IN", label: "India" },
  { value: "BD", label: "Bangladesh" },
  { value: "US", label: "USA" },
  { value: "CA", label: "Canada" },
  { value: "GB", label: "UK" },
  { value: "AE", label: "UAE" },
  { value: "SA", label: "Saudi Arabia" },
  { value: "TR", label: "Türkiye" },
  { value: "OTHER", label: "Other country" },
] as const;
export const dietChoices = [
  { value: "vegan", label: "Vegan" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "omnivore", label: "Non-vegan / mixed" },
] as const;
export const allergenChoices = [
  { value: "milk", label: "Milk / dairy" },
  { value: "egg", label: "Egg" },
  { value: "fish", label: "Fish" },
  { value: "shellfish", label: "Shellfish" },
  { value: "wheat", label: "Wheat" },
  { value: "soy", label: "Soy" },
  { value: "peanut", label: "Peanut" },
  { value: "tree-nut", label: "Tree nuts" },
  { value: "sesame", label: "Sesame" },
] as const;
export function mealIdeasForCuisine(cuisine: CuisinePreference, diet: DietType, slot: MealSlot): MealIdea[] {
  if (["american", "british", "asian-indian"].includes(cuisine))
    return mealIdeas(cuisine === "british" ? "GB" : cuisine === "asian-indian" ? "IN" : "US", diet, slot);
  const mexican = cuisine === "mexican";
  const japanese = cuisine === "asian-japanese";
  const thai = cuisine === "asian-thai";
  const plant: Record<MealSlot, MealIdea[]> = {
    breakfast: mexican ? [idea("Black bean breakfast bowl", ["black beans"], ["black beans", "tomato", "avocado", "corn tortilla"])] :
      [idea("Tofu and vegetable rice bowl", ["tofu"], ["tofu", "rice", "vegetables"], ["soy"])],
    lunch: mexican ? [idea("Bean and vegetable tacos", ["beans"], ["beans", "corn tortillas", "cabbage", "salsa"])] :
      [idea(japanese ? "Edamame rice bowl" : thai ? "Tofu basil rice bowl" : "Tofu vegetable stir-fry with rice", [japanese ? "edamame" : "tofu"], [japanese ? "edamame" : "tofu", "rice", "vegetables"], ["soy"])],
    dinner: mexican ? [idea("Bean and pepper rice bowl", ["beans"], ["beans", "peppers", "rice", "tomato"])] :
      [idea(japanese ? "Tofu and mushroom rice bowl" : thai ? "Tofu coconut vegetable curry with rice" : "Tofu and broccoli rice bowl", ["tofu"], ["tofu", "vegetables", "rice", ...(thai ? ["coconut milk"] : [])], ["soy"])],
    snack: mexican ? [idea("Roasted chickpeas and fruit", ["chickpeas"], ["chickpeas", "fruit"])] :
      [idea("Edamame and fruit", ["edamame"], ["edamame", "fruit"], ["soy"])],
  };
  if (diet === "vegan") return plant[slot];
  const vegetarian: Record<MealSlot, MealIdea[]> = {
    breakfast: [idea(mexican ? "Egg and bean breakfast tacos" : "Egg and vegetable rice bowl", ["eggs"], ["eggs", "vegetables", mexican ? "corn tortillas" : "rice"], ["egg"])],
    lunch: plant.lunch, dinner: plant.dinner, snack: plant.snack,
  };
  if (diet === "vegetarian") return [...vegetarian[slot], ...plant[slot]];
  const mixed: Record<MealSlot, MealIdea[]> = {
    breakfast: vegetarian.breakfast,
    lunch: [idea(mexican ? "Chicken taco bowl" : japanese ? "Chicken rice bowl" : thai ? "Chicken basil rice bowl" : "Chicken vegetable stir-fry with rice", ["chicken"], ["chicken", "rice", "vegetables"])],
    dinner: [idea(mexican ? "Fish tacos with cabbage" : japanese ? "Salmon rice bowl" : thai ? "Chicken coconut vegetable curry with rice" : "Chicken and broccoli with rice", [mexican || japanese ? "fish" : "chicken"], [mexican || japanese ? "fish" : "chicken", mexican ? "corn tortillas" : "rice", "vegetables", ...(thai ? ["coconut milk"] : [])], mexican || japanese ? ["fish"] : [])],
    snack: plant.snack,
  };
  return [...mixed[slot], ...vegetarian[slot], ...plant[slot]];
}
type Cuisine =
  "south-asian" | "north-american" | "british" | "gulf" | "turkish";
export function cuisineFor(country: string): Cuisine | null {
  return (
    ({
      PK: "south-asian",
      IN: "south-asian",
      BD: "south-asian",
      US: "north-american",
      CA: "north-american",
      GB: "british",
      AE: "gulf",
      SA: "gulf",
      TR: "turkish",
    }[country] as Cuisine) || null
  );
}
export function mealIdeas(
  country: string,
  diet: DietType,
  slot: MealSlot,
): MealIdea[] {
  const cuisine = cuisineFor(country);
  if (!cuisine) return [];
  const south = cuisine === "south-asian",
    gulf = cuisine === "gulf",
    turkish = cuisine === "turkish";
  const plant: Record<MealSlot, MealIdea[]> = {
    breakfast: south
      ? [
          idea(
            "Chana chaat with a small roti",
            ["chickpeas"],
            ["chickpeas", "tomato", "onion", "roti"],
            ["wheat"],
          ),
          idea(
            "Besan chilla with vegetables",
            ["chickpea flour"],
            ["besan", "vegetables"],
          ),
          idea("Moong dal chilla", ["mung beans"], ["moong dal", "vegetables"]),
        ]
      : gulf || turkish
        ? [
            idea(
              "Ful medames with salad",
              ["fava beans"],
              ["fava beans", "tomato", "cucumber"],
            ),
            idea(
              "Chickpea and vegetable breakfast bowl",
              ["chickpeas"],
              ["chickpeas", "vegetables"],
            ),
          ]
        : [
            idea(
              "Oats with fortified soy drink",
              ["oats", "soy drink"],
              ["oats", "fortified soy drink", "berries"],
              ["soy"],
            ),
            idea(
              "Tofu scramble with toast",
              ["tofu"],
              ["tofu", "tomato", "wholegrain toast"],
              ["soy", "wheat"],
            ),
          ],
    lunch: south
      ? [
          idea(
            "Daal, rice and kachumber",
            ["lentils"],
            ["daal", "rice", "tomato", "cucumber"],
          ),
          idea(
            "Lobia salan with roti",
            ["beans"],
            ["lobia", "tomato", "roti"],
            ["wheat"],
          ),
          idea(
            "Chana salad and rice",
            ["chickpeas"],
            ["chickpeas", "rice", "vegetables"],
          ),
        ]
      : gulf || turkish
        ? [
            idea(
              "Lentil soup, bulgur and salad",
              ["lentils"],
              ["lentils", "bulgur", "vegetables"],
              ["wheat"],
            ),
            idea(
              "Chickpea stew with rice",
              ["chickpeas"],
              ["chickpeas", "rice", "vegetables"],
            ),
          ]
        : [
            idea(
              "Bean and rice bowl",
              ["beans"],
              ["beans", "rice", "vegetables"],
            ),
            idea(
              "Lentil soup with wholegrain bread",
              ["lentils"],
              ["lentils", "vegetables", "bread"],
              ["wheat"],
            ),
          ],
    dinner: south
      ? [
          idea(
            "Soya chunks with rice and vegetables",
            ["soya chunks"],
            ["soya chunks", "rice", "vegetables"],
            ["soy"],
          ),
          idea(
            "Mixed daal with roti and salad",
            ["lentils"],
            ["lentils", "roti", "salad"],
            ["wheat"],
          ),
          idea(
            "Lobia and rice with vegetables",
            ["beans"],
            ["lobia", "rice", "vegetables"],
          ),
        ]
      : gulf || turkish
        ? [
            idea(
              "Bean stew, rice and vegetables",
              ["beans"],
              ["beans", "rice", "vegetables"],
            ),
            idea(
              "Lentil and roasted vegetable bowl",
              ["lentils"],
              ["lentils", "vegetables", "rice"],
            ),
          ]
        : [
            idea(
              "Tofu stir-fry with rice",
              ["tofu"],
              ["tofu", "rice", "vegetables"],
              ["soy"],
            ),
            idea(
              "Bean chilli with rice",
              ["beans"],
              ["beans", "tomato", "rice"],
            ),
          ],
    snack: [
      idea(
        "Roasted chana and fruit",
        ["chickpeas"],
        ["roasted chickpeas", "fruit"],
      ),
      idea(
        "Bean dip with vegetable sticks",
        ["beans"],
        ["beans", "carrot", "cucumber"],
      ),
    ],
  };
  if (diet === "vegan") return plant[slot];
  const vegetarian: Record<MealSlot, MealIdea[]> = {
    breakfast: [
      idea(
        south ? "Dahi, oats and fruit" : "Yogurt, oats and fruit",
        ["yogurt", "oats"],
        ["plain yogurt", "oats", "fruit"],
        ["milk"],
      ),
    ],
    lunch: [
      idea(
        south
          ? "Paneer, roti and salad"
          : gulf || turkish
            ? "Chickpea salad with yogurt"
            : "Cottage cheese, potatoes and salad",
        south
          ? ["paneer"]
          : gulf || turkish
            ? ["chickpeas", "yogurt"]
            : ["cottage cheese"],
        south
          ? ["paneer", "roti", "salad"]
          : gulf || turkish
            ? ["chickpeas", "yogurt", "salad"]
            : ["cottage cheese", "potatoes", "salad"],
        south ? ["milk", "wheat"] : ["milk"],
      ),
    ],
    dinner: [
      idea(
        south
          ? "Paneer and vegetable rice"
          : "Vegetable and bean bake with cheese",
        south ? ["paneer"] : ["beans", "cheese"],
        south
          ? ["paneer", "rice", "vegetables"]
          : ["beans", "cheese", "vegetables"],
        ["milk"],
      ),
    ],
    snack: [
      idea("Plain yogurt and fruit", ["yogurt"], ["yogurt", "fruit"], ["milk"]),
    ],
  };
  if (diet === "vegetarian") return [...vegetarian[slot], ...plant[slot]];
  const mixed: Record<MealSlot, MealIdea[]> = {
    breakfast: [
      idea(
        south
          ? "Eggs, roti and tomato"
          : gulf || turkish
            ? "Eggs, flatbread and salad"
            : "Eggs, wholegrain toast and tomato",
        ["eggs"],
        south
          ? ["eggs", "roti", "tomato"]
          : gulf || turkish
            ? ["eggs", "flatbread", "salad"]
            : ["eggs", "toast", "tomato"],
        ["egg", "wheat"],
      ),
    ],
    lunch: [
      idea(
        south
          ? "Grilled chicken, roti and kachumber"
          : gulf || turkish
            ? "Grilled chicken, rice and salad"
            : cuisine === "british"
              ? "Chicken, potatoes and vegetables"
              : "Chicken, brown rice and vegetables",
        ["chicken"],
        south
          ? ["chicken", "roti", "salad"]
          : cuisine === "british"
            ? ["chicken", "potatoes", "vegetables"]
            : ["chicken", "rice", "vegetables"],
        south ? ["wheat"] : [],
      ),
    ],
    dinner: [
      idea(
        south
          ? "Fish, rice and vegetables"
          : gulf || turkish
            ? "Baked fish, rice and salad"
            : "Baked fish, potatoes and vegetables",
        ["fish"],
        south || gulf || turkish
          ? ["fish", "rice", "vegetables"]
          : ["fish", "potatoes", "vegetables"],
        ["fish"],
      ),
    ],
    snack: vegetarian.snack,
  };
  return [...mixed[slot], ...vegetarian[slot], ...plant[slot]];
}
