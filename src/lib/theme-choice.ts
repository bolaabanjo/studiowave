import { useEffect, useState } from "react";
import { Appearance } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Light, dark, or the phone's setting (System, the default), as the web
 * Studio's Theme setting. Kept on this phone and applied app-wide.
 */
export type ThemeChoice = "light" | "dark" | "system";

const KEY = "studio.theme";
let current: ThemeChoice = "system";
const listeners = new Set<(choice: ThemeChoice) => void>();

function apply(choice: ThemeChoice) {
    current = choice;
    Appearance.setColorScheme(choice === "system" ? "unspecified" : choice);
    for (const listener of listeners) listener(choice);
}

/** At start-up: the choice made before, if any. */
export async function loadThemeChoice(): Promise<void> {
    const saved = await SecureStore.getItemAsync(KEY).catch(() => null);
    if (saved === "light" || saved === "dark") apply(saved);
}

export function useThemeChoice(): [ThemeChoice, (choice: ThemeChoice) => void] {
    const [choice, setChoice] = useState(current);
    useEffect(() => {
        listeners.add(setChoice);
        return () => void listeners.delete(setChoice);
    }, []);
    return [choice, (next) => {
        apply(next);
        void SecureStore.setItemAsync(KEY, next).catch(() => undefined);
    }];
}
