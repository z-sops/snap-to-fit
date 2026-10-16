// Profiles always store metric (kg, cm). These helpers convert for display and
// input so US users can work in pounds and feet/inches.
export type Units = "imperial" | "metric";

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

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

export function formatWeight(kg: number, units: Units) {
  return units === "imperial" ? `${Math.round(kgToLb(kg))} lb` : `${Math.round(kg * 10) / 10} kg`;
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
export function weightOptions(units: Units) {
  if (units === "metric")
    return range(30, 350).map((kg) => ({ value: kg, label: `${kg} kg` }));
  return range(67, 771).map((lb) => ({ value: lb, label: `${lb} lb` }));
}
export function heightToCm(value: number, units: Units) {
  return units === "metric" ? value : Math.round(value * CM_PER_IN * 10) / 10;
}
export function cmToHeightValue(cm: number, units: Units) {
  return units === "metric" ? Math.round(cm) : Math.round(cm / CM_PER_IN);
}
export function weightToKg(value: number, units: Units) {
  return units === "metric" ? value : lbToKg(value);
}
export function kgToWeightValue(kg: number, units: Units) {
  return units === "metric" ? Math.round(kg) : Math.round(kgToLb(kg));
}

function range(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
