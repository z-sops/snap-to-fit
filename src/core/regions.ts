// Country → "region pack". Every country can be chosen; packs decide which official health
// sources, units and date formats a country gets, so adding a country never needs new screens.
export type Pack = "US" | "GB" | "CA" | "DE" | "FR" | "BR" | "INTL";
type Lang = "en" | "es" | "fr" | "de" | "pt";

const packOf: Record<string, Pack> = {
  US: "US", PR: "US",
  GB: "GB",
  CA: "CA",
  DE: "DE", AT: "DE", CH: "DE", LI: "DE",
  FR: "FR", BE: "FR", LU: "FR", MC: "FR",
  BR: "BR", PT: "BR",
};
export const regionPack = (country?: string): Pack => packOf[(country || "").toUpperCase()] || "INTL";

/** Countries with a full local setup, shown first in the picker. */
export const suggestedCountries = ["US", "CA", "GB", "DE", "FR", "BR", "MX", "AT", "CH", "BE", "PT", "ES"];

/** Only a few countries use pounds and feet day to day. */
export const defaultUnits = (country?: string): "imperial" | "metric" =>
  ["US", "PR", "LR", "MM"].includes((country || "").toUpperCase()) ? "imperial" : "metric";

export interface HealthLink { title: string; url: string }
const L = {
  fda: { title: "Read FDA steroid & bodybuilding-product warnings (US)", url: "https://www.fda.gov/consumers/consumer-updates/caution-bodybuilding-products-can-be-risky" },
  nhs: { title: "Read NHS anabolic-steroid information (UK)", url: "https://www.nhs.uk/conditions/anabolic-steroid-misuse/" },
  hcEn: { title: "Health Canada: bodybuilding products and anabolic steroids", url: "https://www.canada.ca/en/health-canada/topics/buying-using-drug-health-products-safely/safe-use-bodybuilding-products.html" },
  hcFr: { title: "Santé Canada : produits de musculation et stéroïdes anabolisants", url: "https://www.canada.ca/fr/sante-canada/sujets/achat-et-utilisation-securitaire-produits-sante/utilisation-sans-danger-produits-musculation.html" },
  drugcom: { title: "BIÖG (drugcom.de): Anabole Steroide – Risiken (Deutschland)", url: "https://www.drugcom.de/drogenlexikon/buchstabe-a/anabole-steroide/" },
  afld: { title: "AFLD : compléments alimentaires et risques de dopage (France)", url: "https://www.afld.fr/la-lutte-antidopage/education-et-prevention/les-complements-alimentaires/" },
  bvs: { title: "Ministério da Saúde (BVS): anabolizantes (Brasil)", url: "https://bvsms.saude.gov.br/anabolizantes/" },
  medlineEs: { title: "MedlinePlus en español (NIH, EE. UU.): esteroides anabólicos", url: "https://medlineplus.gov/spanish/anabolicsteroids.html" },
} satisfies Record<string, HealthLink>;

/**
 * Official steroid-risk pages: the user's own country first, then a source in their language.
 * Government or national-agency pages only.
 */
export function steroidLinks(country?: string, lang: Lang = "en"): HealthLink[] {
  const byLang: Record<Lang, HealthLink[]> = {
    en: [L.fda, L.nhs], es: [L.medlineEs, L.fda], fr: [L.hcFr, L.afld], de: [L.drugcom], pt: [L.bvs],
  };
  const local: Record<Pack, HealthLink[]> = {
    US: lang === "es" ? [L.medlineEs, L.fda] : [L.fda, L.nhs],
    GB: [L.nhs, L.fda],
    CA: lang === "fr" ? [L.hcFr] : [L.hcEn],
    DE: [L.drugcom],
    FR: [L.afld, L.hcFr],
    BR: [L.bvs],
    INTL: [],
  };
  const out = [...local[regionPack(country)], ...byLang[lang]];
  return out.filter((l, i) => out.findIndex((x) => x.url === l.url) === i).slice(0, 3);
}
