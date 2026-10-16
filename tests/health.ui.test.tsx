import React from "react";
import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
vi.mock("expo-router", () => ({ usePathname: () => "/health", router: { push: vi.fn(), navigate: vi.fn(), back: vi.fn(), canGoBack: () => true } }));
vi.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
import Health from "../src/app/health";
import { StoreProvider, useStore } from "../src/services/store";
import { saveState, saveSession, loadState } from "../src/services/storage";
import { emptyState, newProfile } from "../src/core/model";

function Ready() { return useStore().ready ? <Health /> : null; }
beforeEach(async () => {
  vi.spyOn(window, "alert").mockImplementation(() => {});
  await saveSession(null);
  await saveState({ ...emptyState, profile: { ...newProfile, name: "Sam", age: 40, height: 175, weight: 90, targetWeight: 80, consent: true } }, "guest");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test("US users log weight in pounds; it is stored in kg and shown back in lb", async () => {
  render(<StoreProvider><Ready /></StoreProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Log Weight" }));
  fireEvent.change(await screen.findByLabelText("Weight (lb)"), { target: { value: "198.4" } });
  fireEvent.click(screen.getByRole("button", { name: "Save reading" }));
  await waitFor(async () => expect((await loadState()).readings[0]?.value).toBe(90));
  expect((await screen.findAllByText("198.4 lb")).length).toBeGreaterThan(0);
});

test("very high blood pressure shows an urgent notice", async () => {
  render(<StoreProvider><Ready /></StoreProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Log Blood pressure" }));
  fireEvent.change(await screen.findByLabelText("Systolic (mmHg)"), { target: { value: "185" } });
  fireEvent.change(screen.getByLabelText("Diastolic (mmHg)"), { target: { value: "110" } });
  fireEvent.click(screen.getByRole("button", { name: "Save reading" }));
  await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/very high/)));
});
