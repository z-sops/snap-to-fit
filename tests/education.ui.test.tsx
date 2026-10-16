import React from "react";
import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
vi.mock("expo-router", () => ({ usePathname: () => "/education", router: { navigate: vi.fn() } }));
vi.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
vi.mock("../src/services/routine-notifications", () => ({ scheduleEducation: vi.fn(async () => []), cancelNotifications: vi.fn() }));
import Education from "../src/app/education";
import { StoreProvider, useStore } from "../src/services/store";
import { saveState, saveSession } from "../src/services/storage";
import { emptyState, newProfile } from "../src/core/model";

function Ready() { return useStore().ready ? <Education /> : null; }
beforeEach(async () => {
  await saveSession(null);
  await saveState({ ...emptyState, profile: { ...newProfile, name: "Alex", age: 22, consent: true } }, "guest");
});
afterEach(cleanup);

test("hub opens a category, an article with a doctor notice and sources, then goes back", async () => {
  render(<StoreProvider><Ready /></StoreProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Supplements: the science" }));
  fireEvent.click(await screen.findByRole("button", { name: "Creatine (monohydrate)" }));
  expect(screen.getByText(/Never all at once/)).toBeTruthy();
  expect(screen.getAllByText(/Talk to your doctor/).length).toBeGreaterThan(0);
  expect(screen.getByRole("link", { name: /ISSN position stand: creatine/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Back to list" }));
  fireEvent.click(await screen.findByRole("button", { name: "Back to Gym Truth" }));
  expect(await screen.findByRole("button", { name: "Dangerous shortcuts" })).toBeTruthy();
});

test("search shows matching topics", async () => {
  render(<StoreProvider><Ready /></StoreProvider>);
  fireEvent.change(await screen.findByLabelText("Search Gym Truth"), { target: { value: "water pills" } });
  expect(await screen.findByRole("button", { name: /Water pills for 'cuts'/ })).toBeTruthy();
});
