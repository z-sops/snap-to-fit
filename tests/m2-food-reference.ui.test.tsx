import React from "react";
import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
vi.mock("expo-router", () => ({
  usePathname: () => "/food",
  useLocalSearchParams: () => ({}),
  router: { navigate: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn(), canGoBack: () => false },
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
vi.mock("../src/services/photos", () => ({ pickPhoto: vi.fn() }));
vi.mock("../src/services/api", () => ({ api: vi.fn(async () => ({ name: "Estimated meal", calories: 400, protein: 30, carbs: 40, fat: 13, fibre: 4, uncertainty: "Review portion size." })) }));
import Food from "../src/app/food";
import { StoreProvider, useStore } from "../src/services/store";
import { saveState, saveSession } from "../src/services/storage";
import { emptyState, newProfile, type Meal, type Profile } from "../src/core/model";

function Ready() { return useStore().ready ? <Food /> : null; }

const base: Profile = { ...newProfile, name: "Alex", age: 30, height: 175, weight: 80, targetWeight: 80, consent: true };

/** Opens the food detail sheet for a searched food, with the nutrient list expanded. */
async function openNutrients() {
  fireEvent.click(screen.getByRole("button", { name: "Add to Lunch" }));
  fireEvent.change(await screen.findByLabelText("Search foods"), { target: { value: "chicken breast" } });
  fireEvent.click(await screen.findByRole("button", { name: /^Chicken breast, grilled/ }));
  await screen.findByText("Vitamins & minerals");
  fireEvent.click(screen.getByRole("button", { name: "Show all nutrients" }));
  await screen.findByText("Sodium");
}

/** The nutrient rows that carry a percentage. */
const rowsWithPercent = () =>
  screen.getAllByText(/mg/).filter((node) => /%/.test(node.textContent ?? ""));

beforeEach(async () => {
  vi.clearAllMocks();
  await saveSession(null);
});
afterEach(() => cleanup());

async function renderWith(profile: Profile) {
  await saveState({ ...emptyState, profile }, "guest");
  render(<StoreProvider><Ready /></StoreProvider>);
  await screen.findByText("Eaten today");
}

test("a United States user still sees the same Daily Value percentages", async () => {
  await renderWith({ ...base, country: "US" });
  await openNutrients();
  // The app has always shown a percentage here, and the resolver produces the
  // same number.
  expect(rowsWithPercent().length).toBeGreaterThan(0);
  expect(
    screen.queryByText(/Labelling reference values are not available for your market/),
  ).toBeNull();
});

test("a Canadian user sees no foreign-market percentage", async () => {
  await renderWith({ ...base, country: "CA" });
  await openNutrients();
  // Canada's own values are not approved yet, so no percentage is shown and no
  // United States number is borrowed.
  expect(rowsWithPercent().length).toBe(0);
  expect(
      (await screen.findAllByText(/Labelling reference values are not available for your market/)).length,
    ).toBeGreaterThan(0);
});

test("a British user sees no foreign-market percentage", async () => {
  await renderWith({ ...base, country: "GB" });
  await openNutrients();
  expect(rowsWithPercent().length).toBe(0);
  expect(
      (await screen.findAllByText(/Labelling reference values are not available for your market/)).length,
    ).toBeGreaterThan(0);
});

test("a user in a country with no table sees no percentage either", async () => {
  await renderWith({ ...base, country: "DE" });
  await openNutrients();
  expect(rowsWithPercent().length).toBe(0);
  expect(
      (await screen.findAllByText(/Labelling reference values are not available for your market/)).length,
    ).toBeGreaterThan(0);
});

test("an older profile with no country keeps the percentages it has today", async () => {
  const { country, ...withoutCountry } = base;
  await renderWith(withoutCountry as Profile);
  await openNutrients();
  expect(rowsWithPercent().length).toBeGreaterThan(0);
});

/** A day with one food that reports sodium and one that does not. */
const knownMeal: Meal = {
  id: "a",
  at: new Date().toISOString(),
  name: "Oats",
  calories: 300,
  protein: 10,
  carbs: 50,
  fat: 5,
  fibre: 8,
  source: "database",
  micros: { sodium: 200 },
};
const silentMeal: Meal = {
  id: "b",
  at: new Date().toISOString(),
  name: "Quick add",
  calories: 500,
  protein: 0,
  carbs: 0,
  fat: 0,
  fibre: 0,
  source: "quick",
  unknownNutrients: ["protein", "carbs", "fat", "fibre", "sodium", "satFat", "sugar", "potassium", "calcium", "iron", "magnesium", "zinc", "vitaminC", "vitaminD", "vitaminB12", "folate", "vitaminA", "cholesterol"],
};

/** The nutrient rows of the day summary. */
const dayRows = () => screen.getAllByText(/^[\d.]+\+? ?(?:mg|g|mcg)$/);

/** Waits for the day summary's nutrient list to be on screen. */
async function openDayNutrients() {
  fireEvent.click(screen.getByRole("button", { name: "Show vitamins and minerals" }));
  await waitFor(() => expect(dayRows().length).toBeGreaterThan(0));
}

test("a partly known day total is marked as a lower bound", async () => {
  await saveState({ ...emptyState, profile: { ...base, country: "US" }, meals: [knownMeal, silentMeal] }, "guest");
  render(<StoreProvider><Ready /></StoreProvider>);
  await screen.findByText("Eaten today");
  await openDayNutrients();
  // The sodium total is a lower bound, because one food never reported it.
  expect(dayRows().map((n) => n.textContent)).toContain("200+ mg");
  // And the mark goes after the number, so it cannot be read as exact.
  expect(screen.queryByText("+200 mg")).toBeNull();
});

test("a fully known day total reads exactly as it did before M2-1", async () => {
  await saveState({ ...emptyState, profile: { ...base, country: "US" }, meals: [knownMeal] }, "guest");
  render(<StoreProvider><Ready /></StoreProvider>);
  await screen.findByText("Eaten today");
  await openDayNutrients();
  // Every food reported sodium, so it is an exact figure with no mark.
  expect(dayRows().map((n) => n.textContent)).toContain("200 mg");
  expect(dayRows().map((n) => n.textContent)).not.toContain("200+ mg");
});

test("the United States day summary keeps its previous presentation", async () => {
  await saveState({ ...emptyState, profile: { ...base, country: "US" }, meals: [knownMeal, silentMeal] }, "guest");
  render(<StoreProvider><Ready /></StoreProvider>);
  await screen.findByText("Eaten today");
  await openDayNutrients();
  // The day summary showed amounts and bars before M2-1, not percentage text.
  expect(dayRows().some((node) => /%/.test(node.textContent ?? ""))).toBe(false);
  // The food detail sheet did show a percentage, and still does.
  fireEvent.click(screen.getByRole("button", { name: "Add to Lunch" }));
  fireEvent.change(await screen.findByLabelText("Search foods"), { target: { value: "chicken breast" } });
  fireEvent.click(await screen.findByRole("button", { name: /^Chicken breast, grilled/ }));
  await screen.findByText("Vitamins & minerals");
  fireEvent.click(screen.getByRole("button", { name: "Show all nutrients" }));
  await waitFor(() => expect(screen.getAllByText(/%/).length).toBeGreaterThan(0));
});

test("an unapproved market shows no percentage and no reference bar", async () => {
  await saveState({ ...emptyState, profile: { ...base, country: "CA" }, meals: [knownMeal, silentMeal] }, "guest");
  render(<StoreProvider><Ready /></StoreProvider>);
  await screen.findByText("Eaten today");
  await openDayNutrients();
  expect(dayRows().some((node) => /%/.test(node.textContent ?? ""))).toBe(false);
  // The amount is still shown, and still marked as a lower bound.
  expect(dayRows().map((n) => n.textContent)).toContain("200+ mg");
  expect(
    await screen.findByText(/Labelling reference values are not available for your market/),
  ).toBeTruthy();
});

