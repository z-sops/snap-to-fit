// Builds src/data/exercises.json from yuhonas/free-exercise-db (public domain / Unlicense).
// Usage: node scripts/build-exercises.mjs <path to dist/exercises.json>
import fs from "node:fs";
const src = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const out = src.map((e) => [
  e.id, e.name, e.category, e.level, e.equipment || "other", e.force || "", e.mechanic || "",
  e.primaryMuscles, e.secondaryMuscles, e.instructions, e.images.length,
]);
fs.writeFileSync("src/data/exercises.json", JSON.stringify({ v: 1, source: "free-exercise-db (Unlicense, public domain)", exercises: out }));
console.log(`${out.length} exercises, ${(fs.statSync("src/data/exercises.json").size / 1e6).toFixed(2)} MB`);
