import React from "react";
import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
vi.mock("expo-router", () => ({ usePathname: () => "/medicines", router: { push: vi.fn(), navigate: vi.fn(), back: vi.fn(), canGoBack: () => true } }));
vi.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
vi.mock("../src/services/reminders", () => ({ scheduleReminder: vi.fn(async () => "rem-1"), cancelReminder: vi.fn() }));
import Glp1 from "../src/app/medicines";
import { StoreProvider, useStore } from "../src/services/store";
import { saveState, saveSession, loadState } from "../src/services/storage";
import { emptyState, newProfile } from "../src/core/model";

function Ready() { return useStore().ready ? <Glp1 /> : null; }
beforeEach(async () => {
  vi.spyOn(window, "alert").mockImplementation(() => {});
  await saveSession(null);
  await saveState({ ...emptyState, profile: { ...newProfile, name: "Sam", age: 45, height: 165, weight: 100, targetWeight: 80, consent: true, glp1: "Zepbound (tirzepatide)" } }, "guest");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test("set up GLP-1 from the prescription, log a shot with site rotation, and check in side effects", async () => {
  render(<StoreProvider><Ready /></StoreProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Add my GLP-1 medicine" }));
  fireEvent.change(await screen.findByLabelText("Prescribed dose (include units)"), { target: { value: "2.5 mg" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(async () => expect((await loadState()).medicines[0]?.name).toBe("Zepbound (tirzepatide)"));
  expect((await loadState()).medicines[0].frequency).toBe("weekly");
  fireEvent.click(await screen.findByRole("button", { name: "Log my shot" }));
  expect(await screen.findByText("Where did you inject?")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(async () => expect((await loadState()).doses[0]?.site).toBe("abdomen-left"));
  fireEvent.click(screen.getByRole("button", { name: /How are you feeling/ }));
  const severe = await screen.findAllByRole("button", { name: "Severe" });
  fireEvent.click(severe[4]); // stomach pain
  expect(await screen.findByText(/can be a sign of pancreatitis/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Save check-in" }));
  await waitFor(async () => expect((await loadState()).glp1Checkins?.[0].effects["stomach-pain"]).toBe(3));
  expect(screen.getByText(/Call your doctor right away if you have/)).toBeTruthy();
});
