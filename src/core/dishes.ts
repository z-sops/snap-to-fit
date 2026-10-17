// Home-style dishes per cuisine, built from USDA SR Legacy ingredients (grams per serving).
// `slots` says which meals a dish suits, so the weekly plan and food search can follow the
// user's cuisine choice instead of mixing every kitchen together.
import type { MealSlot } from "./planning-types";

export interface Dish {
  id: string;
  name: string;
  group: CuisineGroup;
  serving: string;
  tags: string;
  parts: [number, number][];
  slots: MealSlot[];
}
export type CuisineGroup =
  | "American" | "British" | "Mexican" | "Indian & Pakistani" | "Chinese" | "Japanese" | "Thai"
  | "German" | "French" | "Brazilian";

const B: MealSlot[] = ["breakfast"], L: MealSlot[] = ["lunch"], D: MealSlot[] = ["dinner"], S: MealSlot[] = ["snack"];
const LD: MealSlot[] = ["lunch", "dinner"], BS: MealSlot[] = ["breakfast", "snack"], BL: MealSlot[] = ["breakfast", "lunch"];
const d = (group: CuisineGroup, id: string, name: string, serving: string, slots: MealSlot[], parts: [number, number][], tags = ""): Dish =>
  ({ id, name, group, serving, slots, parts, tags });

// USDA ids used below (SR Legacy):
// 23569 beef 85% patty · 23564 beef 90% patty · 13455 top sirloin · 13425 round roast · 23090 chuck stew
// 5064 chicken breast roasted · 5098 thigh · 5103 wing · 7081 turkey breast deli · 7029 ham · 10216 pork loin chop
// 10073 pork shoulder · 22972 pulled pork BBQ · 7064 pork sausage · 7013 bratwurst · 7939 frankfurter · 17225 lamb ground
// 15086 salmon · 15016 cod · 15262 tilapia · 15121 tuna in water · 15271 shrimp · 1132 egg scrambled · 1128 egg fried
// 1129 egg hard-boiled · 10862 bacon · 1009 cheddar · 1025 monterey · 1023 gruyere · 1040 swiss · 1032 parmesan
// 1015 cottage cheese · 1256 greek yogurt · 1116 plain yogurt · 1077 whole milk · 1079 2% milk · 1001 butter · 1179 light sour cream
// 43276 cream cheese spread · 4025 mayonnaise · 4053 olive oil · 43015 caesar dressing · 6931 marinara · 11549 tomato sauce
// 6116 beef gravy · 6178 salsa · 2046 mustard · 11935 ketchup · 16123 soy sauce · 16112 miso · 12118 coconut milk
// 18350 burger bun · 18075 whole-wheat bread · 18070 white toast · 18060 rye bread · 18029 french bread · 18001 bagel
// 18239 croissant · 43109 soft pretzel · 18293 pancakes · 18363 corn tortilla · 18364 flour tortilla · 28306 roti
// 20121 pasta · 20045 white rice · 20037 brown rice · 20453 short-grain rice · 20310 egg noodles · 20115 soba · 20134 rice noodles
// 20038 oats · 8037 granola · 21238 fries · 11357 baked potato · 11367 boiled potato · 11657 mashed potato · 11508 sweet potato
// 16006 baked beans · 16015 black beans · 16043 pinto beans · 16070 lentils · 16126 tofu · 11212 edamame · 16390 peanuts · 12061 almonds
// 11091 broccoli · 11125 carrots · 11313 peas · 11110 cabbage · 11439 sauerkraut · 11162 collards · 11261 mushrooms
// 11251 romaine · 11252 iceberg · 11529 tomato · 11205 cucumber · 11821 red pepper · 11282 onion · 11669 wakame · 9038 avocado
// 9050 blueberries · 9316 strawberries · 9040 banana · 9003 apple · 9266 pineapple · 9226 papaya · 9200 orange
// 19353 maple syrup · 19296 honey · 19335 sugar · 14209 coffee · 36037 chili with beans · 36602 fried rice
export const dishes: Dish[] = [
  // American
  d("American", "cheeseburger", "Cheeseburger", "1 burger", LD, [[18350, 60], [23569, 110], [1009, 20], [11252, 15], [11529, 20], [11935, 15]], "burger"),
  d("American", "turkey-sandwich", "Turkey sandwich on whole wheat", "1 sandwich", L, [[18075, 64], [7081, 90], [11252, 15], [11529, 30], [4025, 10]], "sub deli"),
  d("American", "spaghetti-meat-sauce", "Spaghetti with meat sauce", "1 plate", D, [[20121, 200], [6931, 125], [23564, 85], [1032, 8]], "pasta bolognese"),
  d("American", "mac-and-cheese", "Mac and cheese", "1 bowl", LD, [[20121, 180], [1009, 50], [1077, 60], [1001, 8]], "macaroni"),
  d("American", "chicken-sweet-potato", "Grilled chicken, sweet potato & broccoli", "1 plate", LD, [[5064, 150], [11508, 150], [11091, 90], [4053, 5]], "meal prep"),
  d("American", "steak-potato", "Steak with baked potato", "1 plate", D, [[13455, 170], [11357, 200], [1001, 8], [11091, 80]], "sirloin"),
  d("American", "salmon-rice-bowl", "Salmon, brown rice & avocado bowl", "1 bowl", LD, [[15086, 140], [20037, 180], [11091, 80], [9038, 40]], "salmon bowl"),
  d("American", "pancakes-berries", "Pancakes with maple syrup & berries", "3 pancakes", B, [[18293, 150], [19353, 30], [9050, 70]], "breakfast"),
  d("American", "eggs-bacon-toast", "Scrambled eggs, bacon & toast", "1 plate", B, [[1132, 120], [10862, 16], [18070, 50], [1001, 5]], "breakfast"),
  d("American", "yogurt-parfait", "Greek yogurt parfait", "1 cup", BS, [[1256, 200], [8037, 30], [9050, 70], [19296, 10]], "granola"),
  d("American", "chicken-caesar", "Chicken Caesar salad", "1 bowl", L, [[11251, 120], [5064, 120], [1032, 10], [43015, 30], [18070, 15]], "salad"),
  d("American", "chili-bowl", "Beef chili with beans", "1 bowl", LD, [[36037, 300], [1009, 15]], "chili"),
  d("American", "tuna-sandwich", "Tuna salad sandwich", "1 sandwich", L, [[18075, 64], [15121, 85], [4025, 15], [11252, 10]], "tuna"),
  d("American", "bagel-cream-cheese", "Bagel with cream cheese", "1 bagel", B, [[18001, 105], [43276, 30]], "bagel"),
  d("American", "apple-pb", "Apple with peanut butter", "1 apple + 2 tbsp", S, [[9003, 180], [16097, 32]], "snack"),
  d("American", "cottage-pineapple", "Cottage cheese with pineapple", "1 cup", BS, [[1015, 150], [9266, 80]], "snack"),
  d("American", "hard-boiled-eggs", "Hard-boiled eggs", "2 eggs", S, [[1129, 100]], "snack"),
  d("American", "bbq-pulled-pork", "BBQ pulled pork sandwich", "1 sandwich", LD, [[22972, 150], [18350, 60]], "barbecue"),
  d("American", "chicken-wings", "Roasted chicken wings", "6 wings", D, [[5103, 150]], "wings"),
  // British
  d("British", "full-english", "Full English breakfast", "1 plate", B, [[1128, 50], [10862, 20], [7064, 45], [16006, 130], [11261, 50], [11529, 60], [18070, 30]], "fry up"),
  d("British", "beans-on-toast", "Beans on toast", "1 plate", BL, [[16006, 200], [18070, 60], [1001, 5]], "toast"),
  d("British", "porridge", "Porridge with honey", "1 bowl", B, [[20038, 50], [1079, 250], [19296, 10]], "oats oatmeal"),
  d("British", "fish-and-chips", "Fish and chips with peas", "1 plate", D, [[15016, 160], [21238, 150], [4053, 15], [11313, 80]], "chippy"),
  d("British", "shepherds-pie", "Shepherd’s pie", "1 portion", D, [[17225, 120], [11125, 40], [11313, 40], [11282, 30], [11657, 200], [6116, 40]], "cottage pie lamb"),
  d("British", "jacket-potato-tuna", "Jacket potato with tuna", "1 potato", L, [[11357, 250], [15121, 80], [4025, 10], [1009, 15]], "baked potato"),
  d("British", "sunday-roast", "Roast beef dinner", "1 plate", D, [[13425, 150], [11367, 200], [4053, 8], [11125, 80], [11313, 60], [6116, 60]], "sunday roast"),
  d("British", "ham-cheese-sandwich", "Ham and cheese sandwich", "1 sandwich", L, [[18075, 64], [7029, 60], [1009, 25], [1001, 5]], "sarnie"),
  d("British", "bangers-and-mash", "Bangers and mash", "1 plate", D, [[7064, 120], [11657, 220], [6116, 60], [11313, 60]], "sausage"),
  d("British", "yogurt-berries", "Yogurt with berries", "1 bowl", S, [[1116, 150], [9316, 100]], "snack"),
  // Mexican
  d("Mexican", "huevos-rancheros", "Huevos rancheros", "1 plate", B, [[1128, 100], [18363, 52], [16015, 100], [6178, 60]], "eggs"),
  d("Mexican", "breakfast-burrito", "Breakfast burrito", "1 burrito", B, [[18364, 70], [1132, 100], [16015, 60], [1009, 20], [6178, 30]], "burrito"),
  d("Mexican", "chicken-enchiladas", "Chicken enchiladas", "3 enchiladas", D, [[18363, 78], [5064, 120], [1025, 30], [11549, 100]], "enchilada"),
  d("Mexican", "carne-asada-plate", "Carne asada with rice & beans", "1 plate", D, [[13455, 150], [20045, 150], [16043, 120], [6178, 50]], "steak"),
  d("Mexican", "chicken-quesadilla", "Chicken quesadilla", "1 quesadilla", L, [[18364, 70], [5064, 90], [1025, 40]], "quesadilla"),
  d("Mexican", "fish-tacos", "Fish tacos", "2 tacos", LD, [[18363, 52], [15262, 110], [11110, 40], [1179, 20], [6178, 30]], "taco"),
  d("Mexican", "rice-beans-bowl", "Rice and black bean bowl", "1 bowl", L, [[20045, 150], [16015, 150], [9038, 40], [6178, 50]], "vegetarian"),
  // Indian & Pakistani (complete plates; single curries stay in the search list)
  d("Indian & Pakistani", "daal-chawal", "Daal chawal (lentils & rice)", "1 plate", LD, [[16070, 200], [20045, 150], [4053, 8]], "dal rice"),
  d("Indian & Pakistani", "karahi-roti", "Chicken karahi with roti", "1 plate", LD, [[5098, 150], [11529, 80], [4053, 15], [28306, 80]], "curry"),
  d("Indian & Pakistani", "chana-roti", "Chana with roti", "1 plate", LD, [[16357, 170], [11529, 60], [4053, 10], [28306, 80]], "chole"),
  d("Indian & Pakistani", "egg-paratha", "Egg with paratha", "1 plate", B, [[28306, 70], [1001, 8], [1128, 50]], "anda paratha"),
  d("Indian & Pakistani", "chicken-rice-plate", "Chicken tikka with rice & salad", "1 plate", LD, [[5064, 140], [20045, 150], [11205, 50], [11529, 50], [1116, 60]], "tikka"),
  d("Indian & Pakistani", "yogurt-fruit", "Dahi with fruit", "1 bowl", S, [[1116, 150], [9040, 80]], "yogurt"),
  // Chinese
  d("Chinese", "chicken-stir-fry", "Chicken stir-fry with rice", "1 plate", LD, [[5064, 120], [11091, 90], [11821, 50], [16123, 15], [4053, 8], [20045, 180]], "stir fry"),
  d("Chinese", "beef-broccoli", "Beef and broccoli with rice", "1 plate", D, [[13455, 120], [11091, 120], [16123, 15], [4053, 8], [20045, 180]], "beef"),
  d("Chinese", "egg-fried-rice", "Egg fried rice", "1 plate", L, [[36602, 300]], "fried rice"),
  d("Chinese", "chicken-chow-mein", "Chicken chow mein", "1 plate", LD, [[5064, 100], [20310, 200], [11110, 60], [16123, 15], [4053, 10]], "noodles"),
  d("Chinese", "shrimp-vegetables", "Shrimp with vegetables and rice", "1 plate", D, [[15271, 120], [11821, 60], [11091, 60], [4053, 8], [16123, 10], [20045, 180]], "prawn"),
  d("Chinese", "tofu-stir-fry", "Tofu stir-fry with rice", "1 plate", LD, [[16126, 150], [11091, 80], [11821, 50], [16123, 15], [4053, 8], [20045, 180]], "vegan"),
  d("Chinese", "chicken-congee", "Chicken rice porridge (congee)", "1 bowl", B, [[20045, 200], [5064, 60]], "congee jook"),
  // Japanese
  d("Japanese", "salmon-teriyaki", "Salmon teriyaki bowl", "1 bowl", D, [[15086, 140], [20453, 180], [16123, 15], [19335, 6], [11212, 60]], "teriyaki"),
  d("Japanese", "chicken-teriyaki", "Chicken teriyaki with rice", "1 plate", LD, [[5098, 150], [20453, 180], [16123, 15], [19335, 8], [11091, 60]], "teriyaki"),
  d("Japanese", "japanese-breakfast", "Rice, miso soup & salmon", "1 set", B, [[20453, 150], [16112, 18], [16126, 60], [11669, 5], [15086, 70]], "miso"),
  d("Japanese", "soba-bowl", "Soba noodles with chicken", "1 bowl", L, [[20115, 200], [5064, 80], [16123, 10], [11212, 50]], "noodles"),
  d("Japanese", "salmon-poke", "Salmon poke bowl", "1 bowl", L, [[15086, 120], [20453, 160], [9038, 40], [11205, 50], [16123, 10], [11212, 40]], "poke"),
  d("Japanese", "edamame-snack", "Edamame", "1 cup", S, [[11212, 150]], "snack"),
  // Thai
  d("Thai", "pad-thai", "Chicken pad thai", "1 plate", LD, [[20134, 220], [5064, 100], [1132, 50], [16390, 15], [4053, 10], [19335, 8]], "noodles"),
  d("Thai", "green-curry", "Thai green curry with rice", "1 plate", D, [[5064, 120], [12118, 120], [11821, 50], [20045, 180]], "curry"),
  d("Thai", "basil-chicken", "Basil chicken with rice & fried egg", "1 plate", LD, [[5098, 130], [4053, 10], [16123, 10], [20045, 180], [1128, 50]], "kra pao"),
  d("Thai", "tofu-curry", "Tofu vegetable curry with rice", "1 plate", D, [[16126, 150], [12118, 100], [11821, 60], [20045, 180]], "vegan"),
  d("Thai", "chicken-larb", "Thai chicken salad (larb)", "1 bowl", L, [[5064, 130], [11251, 60], [11205, 50], [11282, 20]], "salad"),
  d("Thai", "pineapple-snack", "Fresh pineapple", "1 cup", S, [[9266, 165]], "fruit"),
  // German
  d("German", "bratwurst-sauerkraut", "Bratwurst with sauerkraut & roll", "1 plate", LD, [[7013, 100], [11439, 100], [18350, 50], [2046, 10]], "wurst"),
  d("German", "pork-potatoes-cabbage", "Pork loin with potatoes & cabbage", "1 plate", D, [[10216, 150], [11367, 200], [11110, 100], [1001, 8]], "schwein"),
  d("German", "muesli", "Müsli with yogurt & apple", "1 bowl", B, [[20038, 50], [1116, 150], [9003, 80], [12061, 10]], "muesli"),
  d("German", "abendbrot", "Rye bread with ham & cheese", "2 slices", ["breakfast", "dinner"], [[18060, 64], [7029, 50], [1040, 25], [11205, 30]], "abendbrot brot"),
  d("German", "lentil-stew", "Lentil stew with sausage", "1 bowl", LD, [[16070, 200], [11125, 50], [11367, 100], [7939, 50]], "linseneintopf eintopf"),
  d("German", "pretzel-snack", "Soft pretzel", "1 pretzel", S, [[43109, 90]], "brezel"),
  d("German", "quark-berries", "Quark with berries", "1 bowl", S, [[1015, 200], [9316, 80]], "quark"),
  // French
  d("French", "croissant-cafe", "Croissant and café au lait", "1 set", B, [[18239, 60], [1077, 200], [14209, 100]], "petit dejeuner"),
  d("French", "omelette-salad", "Cheese omelette with salad", "1 plate", L, [[1132, 150], [1023, 20], [11251, 60], [4053, 5]], "omelette"),
  d("French", "croque-monsieur", "Croque monsieur", "1 sandwich", L, [[18070, 60], [7029, 50], [1023, 40], [1001, 8]], "croque"),
  d("French", "steak-frites", "Steak frites", "1 plate", D, [[13455, 160], [21238, 150], [11251, 40]], "steak"),
  d("French", "poulet-roti", "Roast chicken with potatoes & greens", "1 plate", D, [[5098, 150], [11367, 150], [11091, 100], [1001, 8]], "poulet"),
  d("French", "salade-nicoise", "Salade niçoise", "1 bowl", L, [[15121, 80], [1129, 50], [11367, 100], [11251, 60], [11529, 60], [4053, 10]], "nicoise"),
  d("French", "jambon-beurre", "Ham and butter baguette", "1 sandwich", L, [[18029, 100], [7029, 60], [1001, 10]], "sandwich"),
  d("French", "yaourt-fruits", "Plain yogurt with strawberries", "1 bowl", S, [[1116, 125], [9316, 100]], "yaourt"),
  // Brazilian
  d("Brazilian", "arroz-feijao-frango", "Rice, beans and grilled chicken", "1 plate", LD, [[20045, 150], [16015, 130], [5064, 120], [4053, 5]], "arroz feijao frango"),
  d("Brazilian", "feijoada", "Feijoada with rice & greens", "1 plate", D, [[16015, 180], [7064, 40], [10073, 50], [20045, 150], [11162, 60], [9200, 60]], "feijoada"),
  d("Brazilian", "pao-com-ovo", "Bread with egg and coffee with milk", "1 set", B, [[18029, 50], [1128, 50], [14209, 150], [1077, 50]], "pao ovo cafe"),
  d("Brazilian", "fruit-bowl", "Fruit bowl with yogurt & granola", "1 bowl", BS, [[9040, 80], [9226, 100], [1116, 120], [8037, 20]], "fruta"),
  d("Brazilian", "steak-rice-beans", "Steak with rice and beans", "1 plate", D, [[13455, 150], [20045, 150], [16015, 100]], "bife"),
  d("Brazilian", "moqueca", "Fish moqueca with rice", "1 plate", D, [[15262, 150], [12118, 60], [11529, 60], [11821, 40], [11282, 30], [20045, 150]], "moqueca peixe"),
  d("Brazilian", "frango-salada", "Grilled chicken with salad and rice", "1 plate", L, [[5064, 150], [11251, 80], [11529, 80], [4053, 8], [20045, 100]], "frango"),
];

/** Meal slots for the original recipe list (foods.ts) so it can join the plan. */
export const recipeSlots: Record<string, MealSlot[]> = {
  "chicken-biryani": LD, dal: LD, "chicken-curry": LD, "tikka-masala": D, "butter-chicken": D, "chicken-tikka": LD,
  "seekh-kebab": LD, "palak-paneer": LD, "chana-masala": LD, "aloo-gobi": LD, nihari: D, haleem: LD, samosa: S, pakora: S,
  paratha: B, raita: S, kheer: S, "sweet-lassi": S, "masala-chai": BS,
  "burrito-bowl": LD, "street-tacos": LD, "chicken-tacos": LD, guacamole: S, elote: S,
  "chicken-salad": L, "pb-sandwich": BL, "overnight-oats": B, latte: BS, "iced-coffee": S, "avocado-toast": B,
  "avocado-toast-egg": B, "berry-smoothie": BS, "protein-shake": S,
};
