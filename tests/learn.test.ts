import { test } from "node:test";
import assert from "node:assert/strict";
import { articles, categories, articlesIn, searchArticles } from "../src/core/learn";

const text = (a: (typeof articles)[number]) =>
  [a.title, a.summary, a.caution || "", ...a.sections.map((s) => `${s.heading} ${s.body}`)].join(" ");

test("every category has topics, ids are unique and every topic cites a source", () => {
  for (const c of categories) assert.ok(articlesIn(c.id).length > 0);
  assert.equal(new Set(articles.map((a) => a.id)).size, articles.length);
  for (const a of articles) {
    assert.ok(a.sources.length > 0);
    for (const s of a.sources) assert.match(s.url, /^https:\/\//);
  }
});

test("no supplement or drug brand names appear in the content", () => {
  const brands = /\b(C4|Lasix|Optimum|Muscletech|Serious Mass|Mutant|Dymatize|Cellucor|Ghost|BSN|MyProtein|Ensure|Hydroxycut|Xtend|Gold Standard)\b/i;
  for (const a of articles) assert.doesNotMatch(text(a), brands);
});

test("dangerous shortcuts are marked avoid and never give dosing", () => {
  for (const a of articlesIn("danger").filter((x) => x.id !== "quality")) {
    assert.equal(a.verdict, "avoid");
    assert.doesNotMatch(text(a), /\b\d+\s?(mg|ml|mcg|iu)\b/i);
  }
});

test("creatine explains split loading, warns against a single 20 g dose and covers water and kidneys", () => {
  const c = articles.find((a) => a.id === "creatine")!;
  const t = text(c);
  assert.match(t, /four 5 g servings/);
  assert.match(t, /20 g in one go/);
  assert.match(t, /Water/);
  assert.match(c.caution ?? "", /kidney/);
});

test("search finds topics by body text", () => {
  assert.ok(searchArticles("tea-coloured").map((a) => a.id).includes("rhabdo"));
  assert.equal(searchArticles("").length, articles.length);
});

import { topicsFor } from "../src/core/learn";
import { newProfile, validateProfile } from "../src/core/model";
import { exerciseRestricted } from "../src/core/safety";

test("50+ and condition topics match the profile", () => {
  const ids = (p: Parameters<typeof topicsFor>[0]) => topicsFor(p).map((a) => a.id);
  assert.deepEqual(ids({ age: 25, conditions: [], limits: [] }), []);
  const older = ids({ age: 62, sex: "male", conditions: ["heart", "kidney"], limits: ["lower-back", "neck", "knee-replacement"] });
  for (const id of ["muscle-loss-50", "start-50", "heart-stent", "kidney-exercise", "protein-urine", "slip-disc", "cervical", "knee-replacement", "prostate"])
    assert.ok(older.includes(id), id);
  assert.ok(!ids({ age: 55, sex: "female", conditions: [], limits: [] }).includes("prostate"));
});

test("muscle-loss topic explains what and why, with the kidney exception for protein", () => {
  const a = articles.find((x) => x.id === "muscle-loss-50")!;
  const t = text(a);
  assert.match(t, /3–8% per decade/);
  assert.match(t, /Why it happens/);
  assert.match(t, /kidney disease who are not on dialysis/);
});

test("emergency red flags are present for heart, back, neck and kidney-urine topics", () => {
  assert.match(text(articles.find((a) => a.id === "heart-stent")!), /call your local emergency number \(911 in the US and Canada, 999 in the UK\)/);
  assert.match(text(articles.find((a) => a.id === "slip-disc")!), /bladder or bowel/);
  assert.match(text(articles.find((a) => a.id === "cervical")!), /clumsy hands/);
  assert.match(text(articles.find((a) => a.id === "protein-urine")!), /foamy/);
});

test("movement limits validate and pause exercise intensity", () => {
  const p = { ...newProfile, name: "A", age: 60, height: 175, weight: 80, targetWeight: 80, consent: true, limits: ["lower-back" as const] };
  validateProfile(p);
  assert.equal(exerciseRestricted(p), true);
  assert.throws(() => validateProfile({ ...p, limits: ["spleen" as never] }));
});
