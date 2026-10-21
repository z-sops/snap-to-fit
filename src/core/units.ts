// Profiles always store metric (kg, cm). These helpers convert for display and
// input so US users can work in pounds and feet/inches, Canadian users can pick
// either, and UK users can work in stone and pounds.
//
// Every conversion is a pure function of the canonical kilogram value, so
// switching units never rewrites stored data.
import type { Region, WeightDisplay } from "./locale";
import {
  emergencyNumber,
  emergencyService,
  formatDate,
  formatNumber,
  formatTime,
  regionFor,
  speechLocales,
} from "./locale";
import { defaultUnits } from "./regions";

export type Units = "imperial" | "metric";

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
/** One stone is exactly 14 pounds. */
export const LB_PER_STONE = 14;
export const KG_PER_STONE = KG_PER_LB * LB_PER_STONE;

export function kgToLb(kg: number) {
  return kg / KG_PER_LB;
}
export function lbToKg(lb: number) {
  return Math.round(lb * KG_PER_LB * 10) / 10;
}
export function cmToFtIn(cm: number) {
  const totalIn = Math.round(cm / CM_PER_IN);
  return { ft: Math.floor(totalIn / 12), inch: totalIn % 12 };
}
export function ftInToCm(ft: number, inch: number) {
  return Math.round((ft * 12 + inch) * CM_PER_IN * 10) / 10;
}

export function kgToStone(kg: number) {
  return kg / KG_PER_STONE;
}
export function stoneToKg(stone: number) {
  return stone * KG_PER_STONE;
}
export function lbToStone(lb: number) {
  return lb / LB_PER_STONE;
}
export function stoneToLb(stone: number) {
  return stone * LB_PER_STONE;
}

/** UK style "11 st 2 lb". Rounding that reaches 14 lb rolls over into the next stone. */
export function stoneParts(kg: number) {
  const totalLb = kgToLb(kg);
  let stone = Math.floor(totalLb / LB_PER_STONE);
  let pounds = Math.round(totalLb - stone * LB_PER_STONE);
  if (pounds >= LB_PER_STONE) {
    stone += 1;
    pounds -= LB_PER_STONE;
  }
  return { stone, pounds };
}

/** The weight display a profile actually uses, falling back to the unit system. */
export function weightDisplayFor(profile: { units?: Units; weightDisplay?: WeightDisplay }): WeightDisplay {
  const d = profile.weightDisplay;
  if (d === "kg" || d === "lb" || d === "st") return d;
  return (profile.units || "imperial") === "imperial" ? "lb" : "kg";
}

/** Label for the weight display, used in wheel headers and placeholders. */
export function weightUnitLabel(display: WeightDisplay) {
  return display === "kg" ? "kg" : display === "lb" ? "lb" : "st";
}

/** Everything the UI needs to present a profile for its market, in one place. */
export interface Presentation {
  region: Region;
  units: Units;
  weightDisplay: WeightDisplay;
  dateFormat: string;
  timeFormat: string;
  numberFormat: string;
  emergencyNumber: string;
  emergencyService: string;
  speechLocales: string[];
}

/**
 * The market presentation for a profile. The region comes from the country the
 * user chose; the units and weight display come from the user's own choice and
 * always win over the market default.
 */
export function presentationFor(profile: {
  country?: string;
  units?: Units;
  weightDisplay?: WeightDisplay;
}): Presentation {
  const region = regionFor(profile.country);
  const units = profile.units ?? defaultUnits(profile.country);
  const weightDisplay = weightDisplayFor(profile);
  // A fixed local instant, so the previews are the same on every device.
  const sample = new Date(2026, 9, 21, 13, 5);
  return {
    region,
    units,
    weightDisplay,
    dateFormat: formatDate(sample, region),
    timeFormat: formatTime(sample, region),
    numberFormat: formatNumber(1234567.5, region),
    emergencyNumber: emergencyNumber(region),
    emergencyService: emergencyService(region),
    speechLocales: speechLocales(region),
  };
}

export function formatWeight(kg: number, units: Units, display?: WeightDisplay) {
  const d = display ?? weightDisplayFor({ units });
  if (d === "kg") return `${Math.round(kg * 10) / 10} kg`;
  if (d === "st") {
    const { stone, pounds } = stoneParts(kg);
    return pounds ? `${stone} st ${pounds} lb` : `${stone} st`;
  }
  return `${Math.round(kgToLb(kg))} lb`;
}

export function formatHeight(cm: number, units: Units) {
  if (units === "metric") return `${Math.round(cm)} cm`;
  const { ft, inch } = cmToFtIn(cm);
  return `${ft} ft ${inch} in`;
}

/** Wheel options for height. Imperial values are total inches (4 ft 0 in – 7 ft 6 in). */
export function heightOptions(units: Units) {
  if (units === "metric")
    return range(120, 230).map((cm) => ({ value: cm, label: `${cm} cm` }));
  return range(48, 90).map((inches) => ({
    value: inches,
    label: `${Math.floor(inches / 12)} ft ${inches % 12} in`,
  }));
}
/** Wheel options for weight: whole pounds (67–771 lb) or kilograms (30–350 kg). */
export function weightOptions(units: Units, display?: WeightDisplay) {
  const d = display ?? weightDisplayFor({ units });
  if (d === "kg")
    return range(30, 350).map((kg) => ({ value: kg, label: `${kg} kg` }));
  if (d === "st")
    // Stone is a way of writing pounds, so the wheel works in whole pounds and
    // labels each step the way the UK writes it.
    return range(67, 771).map((lb) => {
      const stone = Math.floor(lb / LB_PER_STONE);
      const pounds = lb % LB_PER_STONE;
      return { value: lb, label: pounds ? `${stone} st ${pounds} lb` : `${stone} st` };
    });
  return range(67, 771).map((lb) => ({ value: lb, label: `${lb} lb` }));
}
export function heightToCm(value: number, units: Units) {
  return units === "metric" ? value : Math.round(value * CM_PER_IN * 10) / 10;
}
export function cmToHeightValue(cm: number, units: Units) {
  return units === "metric" ? Math.round(cm) : Math.round(cm / CM_PER_IN);
}
export function weightToKg(value: number, units: Units, display?: WeightDisplay) {
  const d = display ?? weightDisplayFor({ units });
  if (d === "kg") return value;
  // Stone is written in pounds, so both imperial displays take pounds.
  return lbToKg(value);
}
export function kgToWeightValue(kg: number, units: Units, display?: WeightDisplay) {
  const d = display ?? weightDisplayFor({ units });
  if (d === "kg") return Math.round(kg);
  return Math.round(kgToLb(kg));
}

function range(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
