import React from "react";
import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
vi.mock("expo-router", () => ({
  usePathname: () => "/food",
  useLocalSearchParams: () => routeParams.value,
  router: { navigate: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn(), canGoBack: () => false },
}));
const routeParams = vi.hoisted(() => ({ value: {} as Record<string, string> }));
vi.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
vi.mock("../src/services/photos", () => ({
  pickPhoto: vi.fn(async () => ({ uri: "data:image/jpeg;base64,YQ==", data: "YQ==", mimeType: "image/jpeg" })),
}));
vi.mock("../src/services/api", () => ({
  api: vi.fn(async () => ({ name: "Estimated meal", calories: 400, protein: 30, carbs: 40, fat: 13, fibre: 4, uncertainty: "Review portion size." })),
}));
vi.mock("../src/services/barcode", () => ({
  lookupBarcode: vi.fn(async () => ({
    id: "off:012345678905", name: "Crunchy Oat Bar", detail: "Brand · package label", group: "Packaged food", source: "barcode",
    per100: { calories: 450, protein: 10, carbs: 60, fat: 18, fibre: 5, sodium: 300 }, servings: [{ label: "1 bar (40 g)", grams: 40 }], uncertainty: 0.1,
  })),
}));
import Food from "../src/app/food";
import { StoreProvider, useStore } from "../src/services/store";
import { emptyState, newProfile } from "../src/core/model";
import { saveState, saveSession, loadState } from "../src/services/storage";
import { pickPhoto } from "../src/services/photos";
import { api } from "../src/services/api";

function ReadyFood() { return useStore().ready ? <Food /> : null; }
const profile = { ...newProfile, name: "Alex", age: 30, height: 175, weight: 80, targetWeight: 80, consent: true };
beforeEach(async () => {
  vi.clearAllMocks();
  routeParams.value = {};
  vi.stubEnv("EXPO_PUBLIC_API_URL", "https://api.example.test");
  vi.spyOn(window, "alert").mockImplementation(() => {});
  await saveSession(null);
  await saveState({ ...emptyState, profile }, "guest");
});
afterEach(() => { vi.unstubAllEnvs(); cleanup(); vi.restoreAllMocks(); });
const renderFood = async () => {
  render(<StoreProvider><ReadyFood /></StoreProvider>);
  await screen.findByText("Eaten today");
};

test("search the USDA database, pick servings and hidden oil, add to a meal section", async () => {
  await renderFood();
  fireEvent.click(screen.getByRole("button", { name: "Add to Lunch" }));
  fireEvent.change(await screen.findByLabelText("Search foods"), { target: { value: "chicken breast" } });
  fireEvent.click(await screen.findByRole("button", { name: /^Chicken breast, grilled/ }));
  expect((await screen.findAllByText("USDA reference data")).length).toBeGreaterThan(0);
  expect(screen.getByText(/Likely range/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "More servings" }));
  fireEvent.click(screen.getByRole("button", { name: "Some (1 tbsp)" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Add to Lunch" }).at(-1)!);
  await waitFor(async () => expect((await loadState()).meals.length).toBe(1));
  const meal = (await loadState()).meals[0];
  // 1.5 × 170 g grilled breast (151 kcal/100 g) + 13.5 g oil.
  expect(meal.slot).toBe("lunch");
  expect(meal.grams).toBe(255);
  expect(meal.calories).toBe(Math.round(255 * 1.51 + 13.5 * 8.84));
  expect(meal.range![0]).toBeLessThan(meal.calories);
  expect(meal.micros?.sodium).toBeGreaterThan(0);
  expect(meal.source).toBe("database");
  expect(await screen.findByText(/Added Chicken breast, grilled/)).toBeTruthy();
});

test("barcode lookup opens the label result and logs it", async () => {
  await renderFood();
  fireEvent.click(screen.getByRole("button", { name: "Scan barcode" }));
  fireEvent.change(await screen.findByLabelText("Barcode number"), { target: { value: "012345678905" } });
  fireEvent.click(screen.getByRole("button", { name: "Find product" }));
  expect((await screen.findAllByText("Open Food Facts (crowd-contributed)")).length).toBeGreaterThan(0);
  fireEvent.click(screen.getAllByRole("button", { name: /^Add to / }).at(-1)!);
  await waitFor(async () => expect((await loadState()).meals[0]?.source).toBe("barcode"));
  expect((await loadState()).meals[0].calories).toBe(180);
});

test("quick add saves typed label values and the entry can be removed", async () => {
  await renderFood();
  fireEvent.click(screen.getByRole("button", { name: "Quick add calories" }));
  fireEvent.change(await screen.findByLabelText("Meal name"), { target: { value: "Chicken bowl" } });
  fireEvent.change(screen.getByLabelText("Calories (kcal)"), { target: { value: "501.5" } });
  fireEvent.change(screen.getByLabelText("Protein (g)"), { target: { value: "40.5" } });
  fireEvent.click(screen.getByRole("button", { name: "Save meal" }));
  await screen.findByText("Chicken bowl");
  expect((await loadState()).meals[0].calories).toBe(501.5);
  fireEvent.click(screen.getByRole("button", { name: "Remove Chicken bowl" }));
  await waitFor(async () => expect((await loadState()).meals.length).toBe(0));
});

test("a quick add with blank fields leaves those nutrients unknown, not zero", async () => {
  await renderFood();
  fireEvent.click(screen.getByRole("button", { name: "Quick add calories" }));
  fireEvent.change(await screen.findByLabelText("Meal name"), { target: { value: "Black coffee" } });
  fireEvent.change(screen.getByLabelText("Calories (kcal)"), { target: { value: "5" } });
  fireEvent.click(screen.getByRole("button", { name: "Save meal" }));
  await screen.findByText("Black coffee");
  const meal = (await loadState()).meals[0];
  // The fields the user left blank were never known, not measured as zero.
  expect(meal.unknownNutrients).toEqual(expect.arrayContaining(["protein", "carbs", "fat", "fibre"]));
  expect(meal.unknownNutrients).not.toContain("calories");
  // A nutrient no food reported shows as unavailable, not as a confirmed zero.
  fireEvent.click(screen.getByRole("button", { name: "Show vitamins and minerals" }));
  expect((await screen.findAllByText("Not available")).length).toBeGreaterThan(0);
  expect(screen.queryByText("0 mg")).toBeNull();
});

test("camera opens without AI consent, but the photo is never sent for analysis", async () => {
  await renderFood();
  fireEvent.click(screen.getByRole("button", { name: "Take a snap" }));
  await waitFor(() => expect(pickPhoto).toHaveBeenCalledWith(true));
  expect(await screen.findByText(/AI analysis, which is off/)).toBeTruthy();
  expect(api).not.toHaveBeenCalled();
});

test("centre Snap button (snap param) opens the camera straight away", async () => {
  routeParams.value = { snap: "123" };
  render(<StoreProvider><ReadyFood /></StoreProvider>);
  await waitFor(() => expect(pickPhoto).toHaveBeenCalledWith(true));
  expect(pickPhoto).toHaveBeenCalledTimes(1);
});

test("without the online service a consented photo is kept and the user searches instead", async () => {
  vi.stubEnv("EXPO_PUBLIC_API_URL", "");
  await saveState({ ...emptyState, profile: { ...profile, aiConsent: true } });
  await renderFood();
  fireEvent.click(screen.getByRole("button", { name: "Take a snap" }));
  expect(await screen.findByText(/not connected in this test build/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Find what you ate" })).toBeTruthy();
  expect(api).not.toHaveBeenCalled();
});

test("photo estimate shows an AI badge, a range and requires confirming before logging", async () => {
  await saveState({ ...emptyState, profile: { ...profile, aiConsent: true } });
  await renderFood();
  fireEvent.click(screen.getByRole("button", { name: "Choose photo" }));
  expect(await screen.findByText("AI photo estimate")).toBeTruthy();
  expect((await loadState()).meals.length).toBe(0);
  fireEvent.click(screen.getAllByRole("button", { name: /^Add to / }).at(-1)!);
  await waitFor(async () => expect((await loadState()).meals[0]?.source).toBe("photo"));
  const meal = (await loadState()).meals[0];
  expect(meal.range).toEqual([280, 520]);
});

test("a nutrient that is not known is shown as unavailable, not as zero", async () => {
  await saveState({ ...emptyState, profile: { ...profile, aiConsent: true } });
  await renderFood();
  fireEvent.click(screen.getByRole("button", { name: "Choose photo" }));
  await screen.findByText("AI photo estimate");
  fireEvent.click(screen.getByRole("button", { name: "Show all nutrients" }));
  // A photo estimate carries no micronutrients, so they are unknown, not zero.
  expect(await screen.findAllByText("Not available")).not.toHaveLength(0);
});

test("medical review blocks adding until acknowledged, then logs accurately", async () => {
  await saveState({ ...emptyState, profile: { ...profile, aiConsent: true, conditions: ["type2"] } });
  await renderFood();
  expect(screen.getByText("Share this with your doctor. Apply these suggestions as advised by your doctor.")).toBeTruthy();
  expect(screen.getByText(/Protein range/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Choose photo" }));
  await screen.findByText("Check before choosing this meal");
  const add = screen.getAllByRole("button", { name: /^Add to / }).at(-1)!;
  expect(add.getAttribute("aria-disabled") === "true" || add.hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: /I reviewed the concerns/ }));
  fireEvent.click(screen.getAllByRole("button", { name: /^Add to / }).at(-1)!);
  await waitFor(async () => expect((await loadState()).meals.length).toBe(1));
});
