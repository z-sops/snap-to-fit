import React from "react";
import { test, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
const nav = vi.hoisted(() => ({ path: "/", navigate: vi.fn() }));
vi.mock("expo-router", () => ({
  usePathname: () => nav.path,
  router: { navigate: nav.navigate, push: vi.fn(), replace: vi.fn() },
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
import { Screen } from "../src/components/ui";
import { StoreProvider } from "../src/services/store";
import { saveState, saveSession } from "../src/services/storage";
import { emptyState, newProfile } from "../src/core/model";
import { doctorNotice } from "../src/core/safety";

beforeEach(async () => {
  nav.path = "/";
  nav.navigate.mockReset();
  await saveSession(null);
});
afterEach(() => cleanup());

async function renderScreen(profiled: boolean) {
  await saveState(
    profiled ? { ...emptyState, profile: { ...newProfile, name: "Zee" } } : emptyState,
    "guest",
  );
  render(
    <StoreProvider>
      <Screen title="Test screen">
        <span>body</span>
      </Screen>
    </StoreProvider>,
  );
  await screen.findByText("body");
}

test("bottom tabs navigate and Today is selected on home (not Menu)", async () => {
  await renderScreen(true);
  await waitFor(() => expect(screen.getByRole("tab", { name: "Today" })).toBeTruthy());
  expect(screen.getByRole("tab", { name: "Today" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("button", { name: "Menu" }).getAttribute("aria-selected")).toBe("false");
  for (const [label, href] of [["Food", "/food"], ["Move", "/move"], ["Health", "/health"]]) {
    fireEvent.click(screen.getByRole("tab", { name: label }));
    expect(nav.navigate).toHaveBeenLastCalledWith(href);
  }
  // Tapping the current tab is a no-op instead of stacking duplicates.
  nav.navigate.mockClear();
  fireEvent.click(screen.getByRole("tab", { name: "Today" }));
  expect(nav.navigate).not.toHaveBeenCalled();
});

test("slide-out menu lists secondary screens, navigates and closes", async () => {
  await renderScreen(true);
  await waitFor(() => screen.getByRole("tab", { name: "Today" }));
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
  const coach = await screen.findByRole("link", { name: "Coach" });
  expect(screen.getByRole("link", { name: "Meal plan" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Prescribed routine" })).toBeTruthy();
  fireEvent.click(coach);
  expect(nav.navigate).toHaveBeenLastCalledWith("/coach");
  await waitFor(() => expect(screen.queryByRole("link", { name: "Coach" })).toBeNull());
});

test("before a profile exists tabs are hidden and the menu only offers setup routes", async () => {
  nav.path = "/onboarding";
  await renderScreen(false);
  await waitFor(() => screen.getByRole("button", { name: "Open menu" }));
  expect(screen.queryByRole("tab", { name: "Food" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
  expect(await screen.findByRole("link", { name: "Set up my profile" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Food" })).toBeNull();
  expect(screen.getAllByText(doctorNotice).length).toBeGreaterThan(0);
});
