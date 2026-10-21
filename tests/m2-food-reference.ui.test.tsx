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
import { emptyState, newProfile, type Profile } from "../src/core/model";

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

