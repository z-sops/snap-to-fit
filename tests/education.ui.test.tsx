import React from "react";
import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
const params = vi.hoisted(() => ({ value: {} as Record<string, string> }));
vi.mock("expo-router", () => ({ usePathname: () => "/education", useLocalSearchParams: () => params.value, router: { navigate: vi.fn() } }));
vi.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
vi.mock("../src/services/routine-notifications", () => ({ scheduleEducation: vi.fn(async () => []), cancelNotifications: vi.fn() }));
import Education from "../src/app/education";
import { StoreProvider, useStore } from "../src/services/store";
import { saveState, saveSession } from "../src/services/storage";
import { emptyState, newProfile } from "../src/core/model";

function Ready() { return useStore().ready ? <Education /> : null; }
beforeEach(async () => {
  params.value = {};
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

test("50+ profile with a heart stent and slip disc sees For you guides; topic links open directly", async () => {
  await saveState({ ...emptyState, profile: { ...newProfile, name: "Sam", age: 61, sex: "male", conditions: ["heart"], limits: ["lower-back"], consent: true } }, "guest");
  render(<StoreProvider><Ready /></StoreProvider>);
  expect(await screen.findByText("For you")).toBeTruthy();
  expect(screen.getByRole("button", { name: /Muscle loss after 50/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /Heart stent/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /Slip disc/ })).toBeTruthy();
  cleanup();
  params.value = { topic: "protein-urine" };
  render(<StoreProvider><Ready /></StoreProvider>);
  expect(await screen.findByText(/Healthy kidneys keep protein in the blood/)).toBeTruthy();
});

test("steroid info links offer FDA and NHS, FDA first for US and NHS first for UK", async () => {
  const { steroidLinks } = await import("../src/components/EducationReminders");
  expect(steroidLinks("US").map((l) => l.title)).toEqual([expect.stringMatching(/FDA/), expect.stringMatching(/NHS/)]);
  expect(steroidLinks("GB")[0].title).toMatch(/NHS/);
  render(<StoreProvider><Ready /></StoreProvider>);
  expect(await screen.findByRole("button", { name: /Read FDA/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /Read NHS/ })).toBeTruthy();
});
