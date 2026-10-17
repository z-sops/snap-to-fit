import React from "react";
import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
vi.mock("expo-router", () => ({ usePathname: () => "/move", router: { push: vi.fn(), navigate: vi.fn(), back: vi.fn(), canGoBack: () => true } }));
vi.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
vi.mock("../src/components/MusicControls", () => ({ MusicControls: () => null }));
import * as Speech from "expo-speech";
import Move from "../src/app/move";
import { StoreProvider, useStore } from "../src/services/store";
import { saveState, saveSession, loadState } from "../src/services/storage";
import { emptyState, newProfile, localDay } from "../src/core/model";

function Ready() { return useStore().ready ? <Move /> : null; }
beforeEach(async () => {
  vi.spyOn(window, "alert").mockImplementation(() => {});
  await saveSession(null);
  const today = new Date().getDay();
  await saveState({ ...emptyState, profile: { ...newProfile, name: "Alex", age: 30, height: 175, weight: 80, targetWeight: 80, consent: true, days: 1, workoutDays: [today] } }, "guest");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test("guided workout speaks cues, counts sets with rest, and saves the session", async () => {
  render(<StoreProvider><Ready /></StoreProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Start workout" }));
  expect(await screen.findByText("Exercise 1 of 5")).toBeTruthy();
  await waitFor(() => expect(Speech.speak).toHaveBeenCalledWith(expect.stringMatching(/^Let's go\./), expect.anything()));
  fireEvent.click(screen.getByRole("button", { name: /^Done · set 1 of 2/ }));
  expect(await screen.findByLabelText("Rest 60 seconds")).toBeTruthy();
  expect(Speech.speak).toHaveBeenCalledWith("Nice. Rest 60 seconds.", expect.anything());
  fireEvent.click(screen.getByRole("button", { name: "Skip rest" }));
  fireEvent.click(screen.getByRole("button", { name: /^Done · set 2 of 2/ }));
  for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole("button", { name: "Skip this exercise" }));
  expect(await screen.findByText("Workout complete!")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Save workout" }));
  await waitFor(async () => expect((await loadState()).workouts.length).toBe(1));
  const w = (await loadState()).workouts[0];
  expect(w.sets).toBe(2);
  expect(localDay(w.at)).toBe(localDay());
});

test("voice coach can be switched off and is remembered", async () => {
  render(<StoreProvider><Ready /></StoreProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "🔊 Voice coach on" }));
  await waitFor(async () => expect((await loadState()).voiceCues).toBe(false));
});

test("insulin users confirm a low-glucose checklist before a workout starts", async () => {
  const today = new Date().getDay();
  const { library } = await import("../src/core/exercise-library");
  await saveState({ ...emptyState, myWorkout: [library()[0].id], profile: { ...newProfile, name: "Alex", age: 30, height: 175, weight: 80, targetWeight: 80, consent: true, insulin: true, days: 1, workoutDays: [today] } }, "guest");
  render(<StoreProvider><Ready /></StoreProvider>);
  expect(await screen.findByText("Insulin safety")).toBeTruthy();
  fireEvent.click(await screen.findByRole("button", { name: "Start my workout" }));
  expect(await screen.findByText("Before you start")).toBeTruthy();
  const start = () => screen.getAllByRole("button", { name: "Start workout" }).at(-1)!;
  expect(start().hasAttribute("disabled") || start().getAttribute("aria-disabled") === "true").toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: /I checked my glucose/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /fast-acting sugar/ }));
  fireEvent.click(start());
  expect(await screen.findByText("Exercise 1 of 1")).toBeTruthy();
});
