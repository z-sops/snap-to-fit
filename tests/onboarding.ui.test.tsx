import React from "react";
import { test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("expo-router", () => ({ router: { replace: nav.replace, push: nav.push, back: vi.fn(), canGoBack: () => false }, usePathname: () => "/onboarding" }));
vi.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
vi.mock("../src/services/routine-notifications", () => ({ cancelNotifications: vi.fn(async () => {}) }));
import Onboarding from "../src/app/onboarding";
import { StoreProvider, useStore } from "../src/services/store";
import { saveSession, saveState, loadState } from "../src/services/storage";
import { emptyState } from "../src/core/model";
import { doctorNotice } from "../src/core/safety";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function Ready() { return useStore().ready ? <Onboarding /> : null; }
const cont = () => fireEvent.click(screen.getAllByRole("button", { name: /^(Continue|Skip — none|See my plan)$/ }).at(-1)!);

test("one question per card: welcome → name → … → plan reveal saves an imperial profile", async () => {
  const alerts = vi.spyOn(window, "alert").mockImplementation(() => {});
  await saveSession(null); await saveState(emptyState, "guest");
  render(<StoreProvider><Ready /></StoreProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Get started" }));
  expect(screen.getByText("Step 1 of 15")).toBeTruthy();
  cont(); // empty name blocked
  expect(alerts).toHaveBeenCalledWith("Enter your first name.");
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Zee" } }); cont();
  fireEvent.click(screen.getByRole("radio", { name: "Male" })); cont();
  cont(); // age 30
  expect(screen.getAllByText("5 ft 7 in").length).toBeGreaterThan(0); cont();
  expect(screen.getAllByText("165 lb").length).toBeGreaterThan(0); cont();
  fireEvent.click(screen.getByRole("radio", { name: "Lose fat" })); cont();
  expect(screen.getByText("Step 7 of 16")).toBeTruthy(); cont(); // target defaults below current weight
  cont(); cont(); // activity, training
  cont(); expect(alerts).toHaveBeenLastCalledWith("Choose 3 workout days.");
  for (const d of ["Monday", "Tuesday", "Wednesday"]) fireEvent.click(screen.getByRole("checkbox", { name: d }));
  cont(); cont(); // week, health (none)
  cont(); expect(alerts).toHaveBeenLastCalledWith("Choose Yes or No.");
  fireEvent.click(screen.getByRole("radio", { name: "Yes" }));
  expect(screen.getByText(/never advise on doses/)).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "Zepbound (tirzepatide)" })); cont();
  cont(); cont(); cont(); // injuries skip, diet, cuisine
  fireEvent.click(screen.getByRole("checkbox", { name: /I am 18 or older/ })); cont();
  expect(await screen.findByText("Calorie targets are paused")).toBeTruthy(); // medicine → paused targets
  expect(screen.getAllByText(doctorNotice).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Start my journey" }));
  await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/"));
  const saved = (await loadState("guest")).profile!;
  expect(saved).toMatchObject({ name: "Zee", sex: "male", units: "imperial", glp1: "Zepbound (tirzepatide)", workoutDays: [1, 2, 3] });
  expect(saved.medicines).toContain("GLP-1: Zepbound (tirzepatide)");
  expect(saved.weight).toBe(75); // default accepted unchanged (shown as 165 lb)
  expect(saved.targetWeight).toBeLessThan(saved.weight);
});
