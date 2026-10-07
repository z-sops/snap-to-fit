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
  fireEvent.click(screen.getByText("Send message"));
  await screen.findByText(/cannot determine ovulation/);
  expect(api).not.toHaveBeenCalled();
});
test("consented meal questions pass structured allergies and dietary preferences to the server", async () => {
  await saveState({ ...emptyState, profile: { ...profile, aiConsent: true } }, "guest");
  render(<StoreProvider><ReadyCoach /></StoreProvider>);
  fireEvent.change(await screen.findByPlaceholderText("What can I eat for dinner?"),
    { target: { value: "Suggest dinner" } });
  fireEvent.click(screen.getByText("Send message"));
  await screen.findByText("General education.");
  expect(api).toHaveBeenCalledWith("/chat", expect.objectContaining({
    profile: expect.objectContaining({ country: "US", dietType: "vegan",
      allergyFoods: ["peanut"], familiarFoods: "Beans" }),
  }));
});
