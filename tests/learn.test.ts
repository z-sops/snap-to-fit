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
