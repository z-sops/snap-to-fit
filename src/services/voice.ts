import * as Speech from "expo-speech";
import { activeLanguage, translateActive, voiceLocale } from "../i18n";

/** Spoken workout cues using the phone's built-in voice (free, offline). */
/** `text` is an English key; {placeholders} are filled from `vars` after translation. */
export function say(text: string, enabled = true, vars?: Record<string, string | number>) {
  if (!enabled) return;
  try {
    void Speech.stop();
    Speech.speak(translateActive(text, vars), { language: voiceLocale[activeLanguage()], rate: 1.0, pitch: 1.0 });
  } catch {
    // Voice is optional; the screen shows every cue as text too.
  }
}
export function quiet() {
  try { void Speech.stop(); } catch { /* ignore */ }
}
