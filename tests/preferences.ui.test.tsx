import React, { useState } from "react";
import { test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
vi.mock("expo-router", () => ({
  Link: ({children, href}: React.PropsWithChildren<{href: string}>) => <a href={href}>{children}</a>,
  usePathname: () => "/move", router: { push: vi.fn() },
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
vi.mock("../src/components/Movement", () => ({ Movement: () => null }));
vi.mock("../src/components/MusicControls", () => ({ MusicControls: () => null }));
import { CuisinePreferences } from "../src/components/CuisinePreferences";
import Move from "../src/app/move";
import { StoreProvider, useStore } from "../src/services/store";
import { saveState, saveSession, loadState } from "../src/services/storage";
import { emptyState, newProfile } from "../src/core/model";
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function Cuisine() {
  const [value, setValue] = useState<Parameters<typeof CuisinePreferences>[0]["value"]>(undefined);
  return <CuisinePreferences value={value} onChange={setValue}/>;
}
test("American default changes via cuisine menu and Asian subchoices without country tabs", () => {
  render(<Cuisine/>);
  fireEvent.click(screen.getByRole("button", {name: /Cuisine: American/}));
  fireEvent.click(screen.getByRole("button", {name: "Asian cuisines"}));
  fireEvent.click(screen.getByRole("radio", {name: "Indian"}));
  expect(screen.getByRole("button", {name: /Cuisine: Indian/})).toBeTruthy();
  expect(screen.queryByText("Pakistan")).toBeNull();
  expect(screen.queryByRole("radio", {name: "Mexican"})).toBeNull();
});
function ReadyMove() { return useStore().ready ? <Move/> : null; }
test("existing profile chooses consecutive days, persists them and keeps old logs", async () => {
  vi.spyOn(window, "alert").mockImplementation(() => {});
  await saveSession(null);
  await saveState({ ...emptyState, profile: { ...newProfile, name: "Alex", age: 30, height: 175, weight: 80, targetWeight: 80, consent: true },
    workouts: [{id: "old", at: "2026-10-01T12:00:00Z", exerciseId: "walk", name: "Walking", sets: 0, reps: 0, weight: 0, minutes: 20}] }, "guest");
  render(<StoreProvider><ReadyMove/></StoreProvider>);
  await screen.findByText("Your workout week");
  for (const day of ["Monday", "Tuesday", "Wednesday"])
    fireEvent.click(screen.getByRole("checkbox", {name: day}));
  fireEvent.click(screen.getByRole("button", {name: "Save my workout week"}));
  await waitFor(async () => expect((await loadState("guest")).profile?.workoutDays).toEqual([1,2,3]));
  expect((await loadState("guest")).workouts[0].id).toBe("old");
  expect(screen.queryByText("Your workout week")).toBeNull();
  expect(screen.queryByRole("button", {name: "Tracker"})).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "More"}));
  expect(screen.getByRole("button", {name: "Tracker"})).toBeTruthy();
  expect(screen.getByRole("button", {name: "Gyms"})).toBeTruthy();
});
