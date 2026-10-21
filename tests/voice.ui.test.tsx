import React from "react";
import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import * as Speech from "expo-speech";
import { say, quiet, localesFor, refreshVoices } from "../src/services/voice";
import { useT } from "../src/i18n";
import { StoreProvider, useStore } from "../src/services/store";
import { saveState, saveSession } from "../src/services/storage";
import { emptyState, newProfile } from "../src/core/model";

type SpeakOptions = { language?: string; voice?: string; onError?: () => void };
const options = (call: number): SpeakOptions =>
  (Speech.speak as unknown as { mock: { calls: SpeakOptions[][] } }).mock.calls[call][1];
const spoken = () => (Speech.speak as unknown as { mock: { calls: [string, SpeakOptions][] } }).mock.calls;

function Ready() {
  const store = useStore();
  const tr = useT();
  if (!store.ready) return null;
  return <span>{tr("ready")}</span>;
}

beforeEach(async () => {
  refreshVoices();
  vi.mocked(Speech.speak).mockClear();
  vi.mocked(Speech.stop).mockClear();
  vi.mocked(Speech.getAvailableVoicesAsync).mockResolvedValue([]);
  await saveSession(null);
});
afterEach(() => { cleanup(); });

test("English cues use the voice of the market the user chose", async () => {
  say("Set {set}. Go.", true, { set: 2 }, "US");
  await vi.waitFor(() => expect(Speech.speak).toHaveBeenCalledTimes(1));
  expect(options(0).language).toBe("en-US");

  vi.mocked(Speech.speak).mockClear();
  say("Set {set}. Go.", true, { set: 2 }, "CA");
  await vi.waitFor(() => expect(Speech.speak).toHaveBeenCalledTimes(1));
  expect(options(0).language).toBe("en-CA");

  vi.mocked(Speech.speak).mockClear();
  say("Set {set}. Go.", true, { set: 2 }, "GB");
  await vi.waitFor(() => expect(Speech.speak).toHaveBeenCalledTimes(1));
  expect(options(0).language).toBe("en-GB");
});

test("nothing is spoken when the cues are switched off", async () => {
  say("Set {set}. Go.", false, { set: 2 }, "US");
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(Speech.speak).not.toHaveBeenCalled();
});

test("the phone's own voice for the region is used when it has one", async () => {
  vi.mocked(Speech.getAvailableVoicesAsync).mockResolvedValue([
    { identifier: "com.apple.voice.en-GB.Daniel", name: "Daniel", quality: "Default", language: "en-GB" },
  ] as unknown as Awaited<ReturnType<typeof Speech.getAvailableVoicesAsync>>);
  say("Set {set}. Go.", true, { set: 2 }, "GB");
  await vi.waitFor(() => expect(Speech.speak).toHaveBeenCalledTimes(1));
  expect(options(0)).toMatchObject({ language: "en-GB", voice: "com.apple.voice.en-GB.Daniel" });
});

test("a missing voice falls back to a locale the phone can read", async () => {
  say("Set {set}. Go.", true, { set: 2 }, "GB");
  await vi.waitFor(() => expect(Speech.speak).toHaveBeenCalledTimes(1));
  expect(options(0).language).toBe("en-GB");
  // The phone reports that this voice is not available.
  options(0).onError?.();
  await vi.waitFor(() => expect(Speech.speak).toHaveBeenCalledTimes(2));
  expect(options(1).language).toBe("en-US");
});

test("the fallback stops after the last locale", async () => {
  say("Set {set}. Go.", true, { set: 2 }, "GB");
  await vi.waitFor(() => expect(Speech.speak).toHaveBeenCalledTimes(1));
  options(0).onError?.();
  await vi.waitFor(() => expect(Speech.speak).toHaveBeenCalledTimes(2));
  options(1).onError?.();
  await vi.waitFor(() => expect(Speech.speak).toHaveBeenCalledTimes(3));
  options(2).onError?.();
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(Speech.speak).toHaveBeenCalledTimes(3);
});

test("a cue that is stopped is not spoken afterwards", async () => {
  say("Set {set}. Go.", true, { set: 2 }, "US");
  quiet();
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(Speech.speak).not.toHaveBeenCalled();
});

test("the app language and the market are separate choices", async () => {
  await saveState(
    { ...emptyState, language: "es", profile: { ...newProfile, name: "Ana", age: 34, height: 165, weight: 80, targetWeight: 70, consent: true, country: "GB" } },
    "guest",
  );
  render(<StoreProvider><Ready /></StoreProvider>);
  await screen.findByText("ready");
  // Spanish UI in a UK market: the Spanish voice is used, not the UK one.
  say("Set {set}. Go.", true, { set: 2 }, "GB");
  await vi.waitFor(() => expect(Speech.speak).toHaveBeenCalledTimes(1));
  expect(options(0).language).toBe("es-US");
  expect(localesFor("GB")[0]).toBe("es-US");
  expect(spoken()[0][0]).toBe("Serie 2. ¡Ya!");
});
