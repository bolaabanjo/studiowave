import { useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider, useSession } from "@/lib/session";

export default function RootLayout() {
    const [client] = useState(() => new QueryClient({
        defaultOptions: {
            queries: { staleTime: 20_000, gcTime: 60 * 60_000, retry: 1 },
        },
    }));
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
