import * as Speech from "expo-speech";

/** Spoken workout cues using the phone's built-in voice (free, offline). */
export function say(text: string, enabled = true) {
  if (!enabled) return;
  try {
    void Speech.stop();
    Speech.speak(text, { language: "en-US", rate: 1.0, pitch: 1.0 });
  } catch {
    // Voice is optional; the screen shows every cue as text too.
  }
}
export function quiet() {
  try { void Speech.stop(); } catch { /* ignore */ }
}
