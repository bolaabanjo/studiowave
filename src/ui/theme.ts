import { useColorScheme } from "react-native";

// Studio's look: black and white, soft greys, round everything (as on the web).
const light = {
    background: "#ffffff",
    foreground: "#0a0a0a",
    muted: "#f4f4f5",
    mutedForeground: "#71717a",
    border: "#e4e4e7",
    accent: "#0a0a0a",
    onAccent: "#ffffff",
    warning: "#92400e",
    warningBackground: "#fffbeb",
    danger: "#dc2626",
    dangerBackground: "#fef2f2",
    whatsapp: "#25D366",
};

const dark: typeof light = {
    background: "#000000",
    foreground: "#fafafa",
    muted: "#18181b",
    mutedForeground: "#a1a1aa",
    border: "#27272a",
    accent: "#fafafa",
    onAccent: "#0a0a0a",
    warning: "#fde68a",
    warningBackground: "#422006",
    danger: "#f87171",
    dangerBackground: "#450a0a",
    whatsapp: "#25D366",
};

export type Colors = typeof light;

export function useColors(): Colors {
    return useColorScheme() === "dark" ? dark : light;
}
