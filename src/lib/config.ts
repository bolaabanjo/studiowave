/** The Studio API the app talks to (production unless EXPO_PUBLIC_API_URL says otherwise). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "https://studio.cencori.com").replace(/\/+$/, "");

/** The main site: customers' chat links (/talk/…), event pages, docs. */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || "https://cencori.com").replace(/\/+$/, "");
