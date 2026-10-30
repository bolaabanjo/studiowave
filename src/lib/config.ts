/** The Studio API the app talks to (production unless EXPO_PUBLIC_API_URL says otherwise). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "https://studio.cencori.com").replace(/\/+$/, "");
