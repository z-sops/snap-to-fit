import * as Speech from "expo-speech";
import { activeLanguage, translateActive, voiceLocale } from "../i18n";
import { speechLocales, type Region } from "../core/locale";

/** Spoken workout cues using the phone's built-in voice (free, offline). */
/** `text` is an English key; {placeholders} are filled from `vars` after translation. */

/** Voice identifiers we already looked up, per locale. */
const voiceCache = new Map<string, string | undefined>();
/** Increases with every new utterance, so a late reply for an old cue is ignored. */
let utterance = 0;

/**
 * The device voice for a locale, when the phone has one. Android cannot list
 * its voices, and a phone may have no voice for the exact region, so a missing
 * voice is normal: the locale alone is then enough.
 */
async function deviceVoice(locale: string): Promise<string | undefined> {
  if (voiceCache.has(locale)) return voiceCache.get(locale);
  let identifier: string | undefined;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const wanted = locale.toLowerCase();
    identifier =
      voices.find((v) => (v.language || "").toLowerCase() === wanted)?.identifier ??
      voices.find((v) => (v.language || "").toLowerCase().startsWith(wanted))?.identifier;
  } catch {
    identifier = undefined;
  }
  voiceCache.set(locale, identifier);
  return identifier;
}

/**
 * Forget the cached voice list, so the next cue looks the device up again.
 * Used after the user installs a new voice pack or changes their phone voice.
 */
export function refreshVoices() {
  voiceCache.clear();
}

/**
 * Locales to try, most specific first. English follows the user's market, so a
 * Canadian, British and American phone each get their own accent. Other
 * languages keep the voice they have always had.
 */
export function localesFor(region: Region): string[] {
  const lang = activeLanguage();
  if (lang !== "en") {
    const exact = voiceLocale[lang];
    return [exact, exact.split("-")[0]].filter((v, i, a) => a.indexOf(v) === i);
  }
  return speechLocales(region);
}

async function speak(text: string, region: Region, attempt: number) {
  const locales = localesFor(region);
  const locale = locales[attempt];
  if (!locale) return;
  const token = ++utterance;
  try {
    const voice = await deviceVoice(locale);
    if (token !== utterance) return; // a newer cue took over
    void Speech.stop();
    Speech.speak(text, {
      language: locale,
      ...(voice ? { voice } : {}),
      rate: 1.0,
      pitch: 1.0,
      onError: () => {
        // The exact voice may be missing on this phone: fall back to the next locale.
        if (token === utterance && attempt < locales.length - 1)
          void speak(text, region, attempt + 1);
      },
    });
  } catch {
    if (token === utterance && attempt < locales.length - 1)
      void speak(text, region, attempt + 1);
  }
}

/**
 * Speak a cue out loud. This is output only: the app never listens to the
 * microphone and never records anything.
 */
export function say(
  text: string,
  enabled = true,
  vars?: Record<string, string | number>,
  region: Region = "US",
) {
  if (!enabled) return;
  const spoken = translateActive(text, vars);
  if (!spoken) return;
  void speak(spoken, region, 0);
}

export function quiet() {
  utterance++; // cancel anything still waiting to be spoken
  try {
    void Speech.stop();
  } catch {
    /* ignore */
  }
}
