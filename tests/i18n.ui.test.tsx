import React from "react";
import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
vi.mock("expo-router", () => ({ usePathname: () => "/numbers", router: { push: vi.fn(), navigate: vi.fn(), back: vi.fn(), canGoBack: () => true } }));
vi.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
import Numbers from "../src/app/numbers";
import { StoreProvider, useStore } from "../src/services/store";
import { saveState, saveSession } from "../src/services/storage";
import { emptyState, newProfile } from "../src/core/model";
import { translate } from "../src/i18n";
import { es } from "../src/i18n/es";

function Ready() { return useStore().ready ? <Numbers /> : null; }
const profile = { ...newProfile, name: "Ana", age: 34, height: 165, weight: 80, targetWeight: 68, consent: true };
beforeEach(async () => { await saveSession(null); });
afterEach(() => cleanup());

test("Spanish users see translated screens, safety notice and core labels", async () => {
  await saveState({ ...emptyState, language: "es", profile }, "guest");
  render(<StoreProvider><Ready /></StoreProvider>);
  expect(await screen.findByText("Mis números")).toBeTruthy();
  expect(screen.getByText("TMB: calorías en reposo total")).toBeTruthy();
  expect(screen.getByText(/Comparte esto con tu médico/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Actualizar mi peso" })).toBeTruthy();
});

test("English stays the default", async () => {
  await saveState({ ...emptyState, language: "en", profile }, "guest");
  render(<StoreProvider><Ready /></StoreProvider>);
  expect(await screen.findByText("My numbers")).toBeTruthy();
});

test("generated text matches placeholder keys and every key keeps its placeholders", () => {
  expect(translate("es", "🔥 5-day logging streak")).toBe("🔥 Racha de 5 días registrando");
  expect(translate("es", "Hi, {name} 👋", { name: "Ana" })).toBe("Hola, Ana 👋");
  expect(translate("es", "Something new")).toBe("Something new");
  for (const [en, sp] of Object.entries(es)) {
    const ph = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join();
    expect(ph(sp), en).toBe(ph(en));
  }
});
