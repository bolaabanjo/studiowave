import { useColorScheme } from "react-native";

/**
 * The web Studio's palette (cencori app/globals.css: :root and the dark
 * palette, with .dashboard-theme's borders), so the app and the web are one
 * product. "card" and "divider" are the web's bg-muted/60 and border/60 as
 * they come out on the page's background.
 */
const light = {
    background: "#ffffff",
    foreground: "#000000",
    muted: "#f7f7f7",
    mutedForeground: "#737373",
    // Cards share the grey of the app's pill buttons (muted).
    card: "#f7f7f7",
    /** A row on a card while it's pressed: a step past the card's grey. */
    pressed: "#eeeeee",
    border: "#dedede",
    divider: "#e9e9e9",
    input: "#e5e5e5",
    popover: "#f3f3f1",
    destructive: "#ef4444",
    sidebarAccent: "#f2f2f2",
    scheme: "light" as "light" | "dark",
};

const dark: typeof light = {
    background: "#000000",
    foreground: "#f2f2f2",
    muted: "#1a1a1a",
    mutedForeground: "#8c8c8c",
    card: "#1a1a1a",
    pressed: "#262626",
    border: "#3a3a3a",
    divider: "#292929",
    input: "#1a1a1a",
    popover: "#181818",
    destructive: "#ef4444",
    sidebarAccent: "#151515",
    scheme: "dark",
};

export type Colors = typeof light;

export function useColors(): Colors {
    return useColorScheme() === "dark" ? dark : light;
}

/** Tailwind's colours, for the tints the web uses (bg-sky-400/15 text-sky-500 and so on). */
export const palette = {
    violet400: "#a78bfa", violet500: "#8b5cf6",
    orange50: "#fff7ed", orange200: "#fed7aa", orange400: "#fb923c", orange500: "#f97316", orange600: "#ea580c",
    emerald400: "#34d399", emerald500: "#10b981", emerald600: "#059669", emerald700: "#047857",
    sky400: "#38bdf8", sky500: "#0ea5e9", sky600: "#0284c7",
    pink600: "#db2777",
    amber50: "#fffbeb", amber200: "#fde68a", amber300: "#fcd34d", amber400: "#fbbf24", amber500: "#f59e0b", amber600: "#d97706", amber700: "#b45309", amber900: "#78350f",
    teal600: "#0d9488",
    indigo600: "#4f46e5",
    red500: "#ef4444",
    whatsapp: "#25D366",
} as const;

/** A colour at an opacity: "#rrggbb" → "#rrggbbaa". */
export function alpha(hex: string, opacity: number): string {
    return `${hex}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`;
}

export type Tone = "sky" | "violet" | "orange" | "emerald" | "amber" | "whatsapp" | "foreground";

/** The web's tinted circles: a 15% wash of the colour, with the colour (lighter in dark mode) on it. */
export function tone(colors: Colors, name: Tone): { background: string; color: string } {
    const darkMode = colors.scheme === "dark";
    switch (name) {
        case "sky": return { background: alpha(palette.sky400, 0.15), color: darkMode ? palette.sky400 : palette.sky500 };
        case "violet": return { background: alpha(palette.violet400, 0.15), color: darkMode ? palette.violet400 : palette.violet500 };
        case "orange": return { background: alpha(palette.orange400, 0.15), color: darkMode ? palette.orange400 : palette.orange500 };
        case "emerald": return { background: alpha(palette.emerald400, 0.15), color: darkMode ? palette.emerald400 : palette.emerald500 };
        case "amber": return { background: alpha(palette.amber400, 0.15), color: darkMode ? palette.amber400 : palette.amber500 };
        case "whatsapp": return { background: alpha(palette.whatsapp, 0.15), color: palette.whatsapp };
        case "foreground": return { background: alpha(colors.foreground, 0.1), color: colors.foreground };
    }
}

/** Manrope, as on the web (font-sans), by weight. The web's body text is medium. */
export const fonts = {
    "400": "Manrope_400Regular",
    "500": "Manrope_500Medium",
    "600": "Manrope_600SemiBold",
    "700": "Manrope_700Bold",
} as const;

export type Weight = keyof typeof fonts;
