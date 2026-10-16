import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import {
  activeMainTab,
  allMenuRoutes,
  menuSections,
  normalizePath,
  publicRoutes,
} from "../src/components/navigation";

const routeFiles = readdirSync("src/app")
  .filter((f) => f.endsWith(".tsx") && !f.startsWith("_"))
  .map((f) => (f === "index.tsx" ? "/" : "/" + f.replace(/\.tsx$/, "")));

test("every screen except onboarding is reachable from the profiled menu", () => {
  const menu = new Set<string>(allMenuRoutes());
  const missing = routeFiles.filter((r) => r !== "/onboarding" && !menu.has(r));
  assert.deepEqual(missing, []);
  for (const r of menu) assert.ok(routeFiles.includes(r), `menu links to missing route ${r}`);
});

test("setup menu only offers routes the guard allows without a profile", () => {
  const items = menuSections(false).flatMap((s) => s.items.map((i) => i.href));
  assert.ok(items.length > 0);
  for (const href of items) assert.ok(publicRoutes.includes(href), href);
});

test("home selects Today, not the menu; secondary screens select no main tab", () => {
  assert.equal(activeMainTab("/"), "/");
  assert.equal(activeMainTab("/index"), "/");
  assert.equal(activeMainTab("/food/"), "/food");
  assert.equal(activeMainTab("/health?x=1"), "/health");
  assert.equal(activeMainTab("/gyms"), null);
  assert.equal(activeMainTab("/onboarding"), null);
  assert.equal(normalizePath(""), "/");
});

test("root guard lists every non-public route and keeps the navigator mounted", () => {
  const layout = readFileSync("src/app/_layout.tsx", "utf8");
  assert.ok(!/<Redirect\s+href/.test(layout) && !/import[^;]*\bRedirect\b/.test(layout), "root layout must not swap the Stack for <Redirect>");
  assert.match(layout, /Stack\.Protected guard=\{hasProfile\}/);
  const guarded = [...layout.matchAll(/"([a-z-]+)"/g)].map((m) => "/" + m[1]);
  for (const r of routeFiles) {
    if (r === "/" || publicRoutes.includes(r as never)) continue;
    assert.ok(guarded.includes(r), `${r} is not guarded in _layout.tsx`);
  }
});

test("shared navigation never wraps a Pressable in <Link asChild>", () => {
  // expo-router's Slot rejects style arrays on asChild children; this broke
  // the bottom tabs on device (More worked because it was not a Link).
  const ui = readFileSync("src/components/ui.tsx", "utf8");
  assert.ok(!/asChild/.test(ui));
});
