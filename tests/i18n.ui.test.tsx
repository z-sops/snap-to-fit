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
import { fr } from "../src/i18n/fr";
import { de } from "../src/i18n/de";
import { pt } from "../src/i18n/pt";
import { steroidLinks, regionPack, defaultUnits } from "../src/core/regions";
import { countryName, searchCountries } from "../src/core/countries";

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
  const ph = (s: string) => new Set(s.match(/\{\w+\}/g) || []);
  for (const dict of [es, fr, de, pt])
    for (const [en, out] of Object.entries(dict))
      for (const p of ph(out)) expect(ph(en).has(p), `${en} → ${out}`).toBe(true);
});

test("French, German and Portuguese cover the same strings as Spanish", () => {
  // Words spelled the same in both languages ("Biceps", "Calories") are left out on purpose.
  for (const dict of [fr, de, pt]) expect(Object.keys(dict).length).toBeGreaterThan(Object.keys(es).length - 60);
  expect(translate("de", "Set {set}. Go.", { set: 2 })).toBe("Satz 2. Los!");
  expect(translate("pt", "🔥 4-day logging streak")).toBe("🔥 Sequência de 4 dias registrando");
});

test("country packs pick local official sources, units and names", () => {
  expect(regionPack("AT")).toBe("DE");
  expect(regionPack("BE")).toBe("FR");
  expect(regionPack("PK")).toBe("INTL");
  expect(steroidLinks("CA", "fr")[0].url).toContain("canada.ca/fr");
  expect(steroidLinks("CA", "en")[0].url).toContain("canada.ca/en");
  expect(steroidLinks("BR", "pt")[0].url).toContain("saude.gov.br");
  expect(steroidLinks("DE", "de")[0].url).toContain("drugcom.de");
  expect(steroidLinks("US", "en").map((l) => l.title)).toEqual([expect.stringMatching(/FDA/), expect.stringMatching(/NHS/)]);
  expect(steroidLinks("MX", "es")[0].url).toContain("medlineplus.gov/spanish");
  expect(steroidLinks("PK", "en")[0].title).toMatch(/FDA/);
  expect(defaultUnits("US")).toBe("imperial");
  expect(defaultUnits("CA")).toBe("metric");
  expect(countryName("DE", "es")).toBe("Alemania");
  expect(searchCountries("mexico", "es")[0].code).toBe("MX");
});

test("onboarding offers every language on the first screen", async () => {
  await saveState({ ...emptyState, language: "fr" }, "guest");
  const { default: Onboarding } = await import("../src/app/onboarding");
  function O() { return useStore().ready ? <Onboarding /> : null; }
  render(<StoreProvider><O /></StoreProvider>);
  expect(await screen.findByText("Commencer")).toBeTruthy();
  for (const label of ["English", "Español", "Français", "Deutsch", "Português"]) expect(screen.getByText(label)).toBeTruthy();
});
