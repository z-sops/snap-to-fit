// Public website links (privacy, terms, support, account deletion). EXPO_PUBLIC_SITE_URL is the
// website root; explicit privacy/terms URLs override it.
const site = (process.env.EXPO_PUBLIC_SITE_URL || "").replace(/\/$/, "");
export const links = {
  privacy: process.env.EXPO_PUBLIC_PRIVACY_URL || (site ? `${site}/privacy` : ""),
  terms: process.env.EXPO_PUBLIC_TERMS_URL || (site ? `${site}/terms` : ""),
  support: site ? `${site}/support` : "",
  deleteAccount: site ? `${site}/delete-account` : "",
};
