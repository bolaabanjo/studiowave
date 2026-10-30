import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, useFonts } from "@expo-google-fonts/manrope";
import { SessionProvider, useSession } from "@/lib/session";
import { loadThemeChoice } from "@/lib/theme-choice";
import * as SystemUI from "expo-system-ui";
import { useColors } from "@/ui/theme";

void loadThemeChoice();

export default function RootLayout() {
    // Manrope, as on the web; nothing shows until it's in, so no text jumps.
    const [fontsLoaded, fontError] = useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold });
    // The window under every screen takes the theme's background, never the system's white:
    // whatever shows for a moment between screens is what iOS 26's glass picks its colour from.
    const background = useColors().background;
    useEffect(() => {
        void SystemUI.setBackgroundColorAsync(background);
    }, [background]);
    const [client] = useState(() => new QueryClient({
        defaultOptions: {
            queries: { staleTime: 20_000, gcTime: 60 * 60_000, retry: 1 },
        },
    }));
    if (!fontsLoaded && !fontError) return null;
    return (
        <SafeAreaProvider>
            <QueryClientProvider client={client}>
                <SessionProvider>
                    <StatusBar style="auto" />
                    <Gate />
                </SessionProvider>
            </QueryClientProvider>
        </SafeAreaProvider>
    );
}

/** Sign-in until there's a session; the app after. */
function Gate() {
    const { ready, token } = useSession();
    if (!ready) return null;
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Protected guard={!token}>
                <Stack.Screen name="sign-in" />
            </Stack.Protected>
            <Stack.Protected guard={!!token}>
                <Stack.Screen name="(app)" />
            </Stack.Protected>
        </Stack>
    );
}
