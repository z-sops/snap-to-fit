// Lightweight i18n: English source strings are the keys; other languages map them.
// Missing translations fall back to English, so nothing ever renders blank.
import { useEffect } from "react";
import { getLocales } from "expo-localization";
import { useOptionalStore } from "../services/store";
import { es } from "./es";
import { fr } from "./fr";
import { de } from "./de";
import { pt } from "./pt";

export type Lang = "en" | "es" | "fr" | "de" | "pt";
/** Each language is shown in its own name, never a flag: Spanish isn't only Spain, French isn't only France. */
export const languages: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "fr", label: "Français" },
  { id: "de", label: "Deutsch" },
  { id: "pt", label: "Português" },
];
export const isLang = (v: unknown): v is Lang => languages.some((l) => l.id === v);
const dictionaries: Record<Lang, Record<string, string>> = { en: {}, es, fr, de, pt };

export function deviceLanguage(): Lang {
  try {
    const code = getLocales()[0]?.languageCode;
    return isLang(code) ? code : "en";
  } catch {
    return "en";
  }
}

/** Two-letter region from the phone (US, CA, DE, BR…), or "" when unknown. */
export function deviceRegion(): string {
  try {
    return (getLocales()[0]?.regionCode || "").toUpperCase();
  } catch {
    return "";
  }
}

/** Speech voice for each language. */
export const voiceLocale: Record<Lang, string> = { en: "en-US", es: "es-US", fr: "fr-FR", de: "de-DE", pt: "pt-BR" };

type Pattern = { re: RegExp; names: string[]; out: string };
const patternCache: Partial<Record<Lang, Pattern[]>> = {};
/** Keys with {placeholders} also match generated text, e.g. "🔥 {n}-day logging streak". */
function patterns(lang: Lang): Pattern[] {
  if (!patternCache[lang]) {
    patternCache[lang] = Object.entries(dictionaries[lang])
      .filter(([k]) => /\{\w+\}/.test(k) && k.replace(/\{\w+\}/g, "").replace(/[^A-Za-z]/g, "").length >= 4)
      .map(([k, out]) => {
        const names: string[] = [];
        const body = k.split(/(\{\w+\})/).map((part) => {
          const m = /^\{(\w+)\}$/.exec(part);
          if (!m) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          names.push(m[1]);
          return "(.+?)";
        });
        return { re: new RegExp(`^${body.join("")}$`, "s"), names, out };
      });
  }
  return patternCache[lang]!;
}
function lookup(lang: Lang, text: string) {
  const dict = dictionaries[lang];
  if (text in dict) return dict[text];
  if (lang === "en") return text;
  const core = text.trim();
  if (core !== text && core in dict) return text.replace(core, dict[core]);
  for (const p of patterns(lang)) {
    const m = p.re.exec(text);
    if (m) return p.names.reduce((out, name, i) => out.split(`{${name}}`).join(m[i + 1]), p.out);
  }
  return text;
}

export function translate(lang: Lang, text: string, vars?: Record<string, string | number>) {
  let out = lookup(lang, text);
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

/** Language last rendered, for messages shown outside React (alerts). */
const active: { lang: Lang } = { lang: "en" };
export const translateActive = (text: string, vars?: Record<string, string | number>) => translate(active.lang, text, vars);
export const activeLanguage = () => active.lang;

export type T = (text: string | undefined, vars?: Record<string, string | number>) => string;
/** Current language: the user's choice, else the phone's language. */
export function useLang(): Lang {
  const store = useOptionalStore();
  const lang = store?.state.language || deviceLanguage();
  useEffect(() => {
    active.lang = lang;
  }, [lang]);
  return lang;
}
export function useT(): T {
  const lang = useLang();
  return (text, vars) => (text ? translate(lang, text, vars) : "");
}
