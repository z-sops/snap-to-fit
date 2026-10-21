// Regional presentation for the US, Canada and the United Kingdom.
//
// This is deliberately separate from the translation language (en/es/fr/de/pt):
// the language chooses the words, the region chooses the number format, the
// date format, the spoken voice and the emergency number. A person can read
// the app in English while living in Toronto or London, and a person in the
// US who prefers Spanish still gets US formats.
//
// Formatting here is pure and deterministic: no Intl, no device locale, no
// time zone look-ups. The same value renders identically on every device and
// can be tested without a phone.

export type Region = "US" | "CA" | "GB" | "INTL";

/** Countries that share a target market's formats. */
const byCountry: Record<string, Region> = {
  US: "US", PR: "US", VI: "US", GU: "US", AS: "US", MP: "US",
  CA: "CA",
  GB: "GB", UK: "GB",
};

/** The market a country belongs to. Unknown countries get the international pack. */
export function regionFor(country?: string): Region {
  return byCountry[(country || "").trim().toUpperCase()] || "INTL";
}

/** BCP 47 tag for the region. */
export function regionalLocale(region: Region): string {
  switch (region) {
    case "CA":
      return "en-CA";
    case "GB":
      return "en-GB";
    default:
      // INTL keeps the en-US formatting the app has always used, so no existing
      // user outside the three target markets sees a change.
      return "en-US";
  }
}

/** How a weight is written in this market. */
export type WeightDisplay = "kg" | "lb" | "st";

const pad2 = (n: number) => String(n).padStart(2, "0");
const groupDigits = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function toDate(value: Date | string | number): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Grouped number for the region. All three target markets group with a comma
 * and separate decimals with a dot; the function stays region-aware so a future
 * market can differ without touching the call sites.
 */
export function formatNumber(value: number, region: Region = "US", decimals?: number): string {
  if (!Number.isFinite(value)) return "—";
  const d = decimals ?? (Number.isInteger(value) ? 0 : 1);
  const fixed = Math.abs(value).toFixed(d);
  const [whole, frac] = fixed.split(".");
  const sign = value < 0 ? "-" : "";
  return `${sign}${groupDigits(whole)}${frac ? `.${frac}` : ""}`;
}

/**
 * Calendar date in the region's own order.
 * US 10/21/2026 · Canada 2026-10-21 · UK 21/10/2026.
 */
export function formatDate(value: Date | string | number, region: Region = "US"): string {
  const d = toDate(value);
  if (!d) return "";
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  switch (region) {
    case "CA":
      return `${y}-${pad2(m)}-${pad2(day)}`;
    case "GB":
      return `${pad2(day)}/${pad2(m)}/${y}`;
    default:
      return `${m}/${day}/${y}`;
  }
}

/** Clock time in the region's own convention: 12-hour for North America, 24-hour for the UK. */
export function formatTime(value: Date | string | number, region: Region = "US"): string {
  const d = toDate(value);
  if (!d) return "";
  const h24 = d.getHours();
  const m = d.getMinutes();
  if (region === "GB") return `${pad2(h24)}:${pad2(m)}`;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${pad2(m)} ${h24 < 12 ? "AM" : "PM"}`;
}

/** Short date without the year: US and Canada "Oct 21", UK "21 Oct". */
export function formatDayMonth(value: Date | string | number, region: Region = "US"): string {
  const d = toDate(value);
  if (!d) return "";
  const month = MONTHS[d.getMonth()];
  const day = d.getDate();
  return region === "GB" ? `${day} ${month}` : `${month} ${day}`;
}

/** Short date and time together, in the region's own order. */
export function formatDateTime(value: Date | string | number, region: Region = "US"): string {
  const date = formatDayMonth(value, region);
  const time = formatTime(value, region);
  return date && time ? `${date}, ${time}` : date || time;
}

/** Emergency number for the region. Never used for anything other than emergency wording. */
export function emergencyNumber(region: Region): string {
  return region === "GB" ? "999" : "911";
}

/** Emergency number with the country, so the wording is unambiguous. */
export function emergencyService(region: Region): string {
  switch (region) {
    case "GB":
      return "999 (UK)";
    case "CA":
      return "911 (Canada)";
    case "US":
      return "911 (US)";
    default:
      return "911";
  }
}

/**
 * Voice locales for the region, most specific first. A device may not have a
 * voice for the exact region, so plain English is the last resort.
 */
export function speechLocales(region: Region): string[] {
  const exact = regionalLocale(region);
  return exact === "en-US" ? ["en-US", "en"] : [exact, "en-US", "en"];
}

/** Weight display options offered in each market, most likely first. */
export function weightDisplayOptions(region: Region): WeightDisplay[] {
  switch (region) {
    case "US":
      return ["lb", "kg"];
    case "CA":
      return ["kg", "lb"];
    case "GB":
      // Stone and pounds are both everyday UK weights; kilograms stay available.
      return ["kg", "st", "lb"];
    default:
      return ["kg", "lb"];
  }
}

/**
 * Weight display the market starts with, given the unit system in force.
 * Stone is never a default: it is an opt-in choice for UK users.
 */
export function defaultWeightDisplay(units: "imperial" | "metric"): WeightDisplay {
  return units === "imperial" ? "lb" : "kg";
}
