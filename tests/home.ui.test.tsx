import React from "react";
import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
vi.mock("expo-router", () => ({
  usePathname: () => "/",
  router: { navigate: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn(), canGoBack: () => true },
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
vi.mock("../src/services/photos", () => ({ pickPhoto: vi.fn() }));
import Home from "../src/app/index";
import { StoreProvider, useStore } from "../src/services/store";
import { saveState, saveSession } from "../src/services/storage";
import { emptyState, newProfile } from "../src/core/model";
import { quickAddMeal } from "../src/core/meals";

function Ready() { return useStore().ready ? <Home /> : null; }

const profile = { ...newProfile, name: "Ana", age: 34, height: 165, weight: 70, targetWeight: 65, consent: true };
const at = new Date().toISOString();

beforeEach(async () => {
  vi.clearAllMocks();
  await saveSession(null);
});
afterEach(() => cleanup());

test("a quick add with no macros shows them as not available, not as zero", async () => {
  const meal = { ...quickAddMeal({ name: "Sandwich", calories: "500", protein: "", carbs: "", fat: "", fibre: "" }, "lunch"), id: "m1", at };
  await saveState({ ...emptyState, profile, meals: [meal] }, "guest");
  render(<StoreProvider><Ready /></StoreProvider>);
  // The calories that were typed are shown.
  expect((await screen.findAllByText("500 kcal")).length).toBeGreaterThan(0);
  // The macros that were never reported are not shown as zero grams.
  expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  expect(screen.queryByText("0g")).toBeNull();
  // The meal row says the same thing.
  expect(screen.getAllByText(/P —/).length).toBeGreaterThan(0);
});

test("a day that reported its macros shows the numbers", async () => {
  const meal = {
    id: "m1",
    at,
    name: "Oats",
    calories: 500,
    protein: 30,
    carbs: 60,
    fat: 15,
    fibre: 8,
    source: "database" as const,
  };
  await saveState({ ...emptyState, profile, meals: [meal] }, "guest");
  render(<StoreProvider><Ready /></StoreProvider>);
  expect((await screen.findAllByText("500 kcal")).length).toBeGreaterThan(0);
  expect(screen.getByText("30g")).toBeTruthy();
  expect(screen.getByText("60g")).toBeTruthy();
  expect(screen.getByText("15g")).toBeTruthy();
});
