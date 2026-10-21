import React from "react";
import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
vi.mock("expo-router", () => ({
  Link: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  usePathname: () => "/coach",
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
vi.mock("../src/services/api", () => ({ api: vi.fn(async () => ({ text: "General education." })) }));
import { api } from "../src/services/api";
import Coach from "../src/app/coach";
import { StoreProvider, useStore } from "../src/services/store";
import { saveState, saveSession } from "../src/services/storage";
import { emptyState, newProfile } from "../src/core/model";
import { quickAddMeal } from "../src/core/meals";
const profile = { ...newProfile, name: "Alex", age: 30, height: 175,
  weight: 80, targetWeight: 80, consent: true, country: "US" as const,
  dietType: "vegan" as const, allergyFoods: ["peanut" as const], familiarFoods: "Beans" };
function ReadyCoach() { return useStore().ready ? <Coach /> : null; }
beforeEach(async () => { vi.clearAllMocks(); await saveSession(null); });
afterEach(cleanup);
test("reproductive predictions are refused locally without AI consent or a provider call", async () => {
  await saveState({ ...emptyState, profile }, "guest");
  render(<StoreProvider><ReadyCoach /></StoreProvider>);
  fireEvent.change(await screen.findByPlaceholderText("What can I eat for dinner?"),
    { target: { value: "Calculate my safe days to avoid pregnancy" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await screen.findByText(/cannot determine ovulation/);
  expect(api).not.toHaveBeenCalled();
});
test("consented meal questions pass structured allergies and dietary preferences to the server", async () => {
  await saveState({ ...emptyState, profile: { ...profile, aiConsent: true } }, "guest");
  render(<StoreProvider><ReadyCoach /></StoreProvider>);
  fireEvent.change(await screen.findByPlaceholderText("What can I eat for dinner?"),
    { target: { value: "Suggest dinner" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await screen.findByText("General education.");
  expect(api).toHaveBeenCalledWith("/chat", expect.objectContaining({
    profile: expect.objectContaining({ country: "US", dietType: "vegan",
      allergyFoods: ["peanut"], familiarFoods: "Beans" }),
  }));
});
test("the coach states its consent and sends today's totals", async () => {
  const today = new Date().toISOString();
  await saveState({ ...emptyState, profile: { ...profile, aiConsent: true }, meals: [
    { id: "m1", at: today, name: "Lunch", calories: 600, protein: 30, carbs: 70, fat: 20, fibre: 8, source: "quick" },
  ] }, "guest");
  render(<StoreProvider><ReadyCoach /></StoreProvider>);
  fireEvent.change(await screen.findByPlaceholderText("What can I eat for dinner?"),
    { target: { value: "How am I doing today?" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await screen.findByText("General education.");
  expect(api).toHaveBeenCalledWith("/chat", expect.objectContaining({
    aiConsent: true,
    totals: expect.objectContaining({
      calories: { value: 600, complete: true },
      protein: { value: 30, complete: true },
      carbs: { value: 70, complete: true },
      fat: { value: 20, complete: true },
    }),
  }));
});
test("without AI consent the coach never calls the service", async () => {
  await saveState({ ...emptyState, profile: { ...profile, aiConsent: false } }, "guest");
  render(<StoreProvider><ReadyCoach /></StoreProvider>);
  fireEvent.change(await screen.findByPlaceholderText("What can I eat for dinner?"),
    { target: { value: "Suggest dinner" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await screen.findByText(/Enable optional AI consent in Settings/);
  // Nothing about the user was sent anywhere.
  expect(api).not.toHaveBeenCalled();
});
test("the coach is sent only the totals that were actually reported", async () => {
  const today = new Date().toISOString();
  const meal = {
    ...quickAddMeal({ name: "Sandwich", calories: "500", protein: "", carbs: "", fat: "", fibre: "" }, "lunch"),
    id: "m1",
    at: today,
  };
  await saveState({ ...emptyState, profile: { ...profile, aiConsent: true }, meals: [meal] }, "guest");
  render(<StoreProvider><ReadyCoach /></StoreProvider>);
  fireEvent.change(await screen.findByPlaceholderText("What can I eat for dinner?"),
    { target: { value: "How am I doing today?" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await screen.findByText("General education.");
  const body = (api as unknown as { mock: { calls: [string, Record<string, unknown>][] } }).mock.calls[0][1];
  // The macros were never reported, so they are not sent as fabricated zeros.
  expect(body.totals).toEqual({ calories: { value: 500, complete: true } });
});
test("an unsupported country is told to use the local emergency number", async () => {
  await saveState({ ...emptyState, profile: { ...profile, aiConsent: true, country: "DE" } }, "guest");
  render(<StoreProvider><ReadyCoach /></StoreProvider>);
  // Germany is not one of the three supported markets, so no number is claimed.
  expect(await screen.findByText(/call your local emergency number/)).toBeTruthy();
  expect(screen.queryByText(/call 911/)).toBeNull();
});
