// Builds src/data/usda-foods.json from USDA SR28 (public domain) ABBREV.txt + FOOD_DES.txt.
// Usage: node scripts/build-foods.mjs <dir containing ABBREV.txt and FOOD_DES.txt>
// Source: USDA ARS Nutrient Data Laboratory, National Nutrient Database for Standard
// Reference, Release 28 (also published in FoodData Central as "SR Legacy").
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
if (!dir) throw new Error("Pass the SR28 data directory.");
const read = (f) =>
  fs.readFileSync(path.join(dir, f), "latin1").split(/\r?\n/).filter(Boolean)
    .map((l) => l.split("^").map((v) => v.replace(/^~|~$/g, "")));

const groups = {
  "0100": "Dairy & eggs", "0200": "Spices & herbs", "0300": "Baby foods", "0400": "Fats & oils",
  "0500": "Poultry", "0600": "Soups & sauces", "0700": "Sausages & deli", "0800": "Breakfast cereals",
  "0900": "Fruits", "1000": "Pork", "1100": "Vegetables", "1200": "Nuts & seeds", "1300": "Beef",
  "1400": "Drinks", "1500": "Fish & seafood", "1600": "Beans & lentils", "1700": "Lamb & game",
  "1800": "Baked goods", "1900": "Sweets", "2000": "Grains & pasta", "2100": "Fast food",
  "2200": "Meals & entrees", "2500": "Snacks", "3500": "Native American foods", "3600": "Restaurant foods",
};
const skipGroups = new Set(["0300", "3500"]); // baby foods; traditional foods rarely searched

const des = new Map(read("FOOD_DES.txt").map((r) => [r[0], { name: r[2], group: r[1] }]));
// ABBREV columns (SR28 doc p.44): 3 kcal,4 protein,5 fat,7 carb,8 fiber,9 sugar,10 Ca,11 Fe,
// 12 Mg,14 K,15 Na,16 Zn,20 vitC,29 folate DFE,31 B12,33 vitA RAE,41 vitD mcg,44 satFat,47 chol,
// 48 gmwt1,49 desc1,50 gmwt2,51 desc2
const cols = [3, 4, 7, 5, 8, 9, 44, 15, 14, 10, 11, 12, 16, 20, 41, 31, 29, 33, 47];
const num = (v) => (v === "" ? -1 : Math.round(Number(v) * 10) / 10);

const out = { v: 1, source: "USDA SR28 (FoodData Central SR Legacy), public domain", groups, foods: [] };
for (const r of read("ABBREV.txt")) {
  const d = des.get(r[0]);
  if (!d || skipGroups.has(d.group)) continue;
  const values = cols.map((c) => num(r[c]));
  if (values[0] < 0) continue;
  const serv = [];
  if (r[48]) serv.push([Number(r[48]), r[49]]);
  if (r[50]) serv.push([Number(r[50]), r[51]]);
  out.foods.push([Number(r[0]), d.name, d.group, values, serv]);
}
const target = path.resolve("src/data/usda-foods.json");
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(out));
console.log(`${out.foods.length} foods → ${target} (${(fs.statSync(target).size / 1e6).toFixed(2)} MB)`);
