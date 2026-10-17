// Country names in the user's language for all ~250 ISO countries (i18n-iso-countries, MIT).
import countries from "i18n-iso-countries";
for (const locale of [
  require("i18n-iso-countries/langs/en.json"),
  require("i18n-iso-countries/langs/es.json"),
  require("i18n-iso-countries/langs/fr.json"),
  require("i18n-iso-countries/langs/de.json"),
  require("i18n-iso-countries/langs/pt.json"),
])
  countries.registerLocale(locale);

export function countryName(code: string | undefined, lang: string): string {
  if (!code || code === "OTHER") return "";
  return countries.getName(code, lang) || countries.getName(code, "en") || code;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const cache: Record<string, { code: string; name: string }[]> = {};
export function countryList(lang: string) {
  if (!cache[lang]) {
    const names = countries.getNames(lang, { select: "official" });
    cache[lang] = Object.keys(names)
      .map((code) => ({ code, name: countries.getName(code, lang) || names[code] }))
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  }
  return cache[lang];
}
/** Matches names in the user's language and in English, ignoring accents ("Mexico" finds "México"). */
export function searchCountries(query: string, lang: string, limit = 30) {
  const q = fold(query.trim());
  if (!q) return [];
  return countryList(lang)
    .filter((c) => fold(c.name).includes(q) || fold(countries.getName(c.code, "en") || "").includes(q) || c.code.toLowerCase() === q)
    .slice(0, limit);
}
