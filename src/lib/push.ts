import { useEffect } from "react";
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useApi } from "@/lib/api";

/**
 * Studio's alerts on the phone ("Tolu needs you", the 8am brief): the app's
 * Expo push token goes to /api/studio/push, and tapping one opens where it
 * points ("/inbox/…" from the server, mapped to the app's own screens).
 *
 * Needs a development or store build with an EAS project: Expo Go can't
 * receive them on Android, and the token needs the EAS project id.
 */

Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

function projectId(): string | undefined {
    return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/** The server's Studio path → the app's screen. */
export function screenFor(url: unknown): string {
    if (typeof url !== "string") return "/";
    const conversation = url.match(/^\/inbox\/([^/?#]+)/);
    if (conversation) return `/conversation/${conversation[1]}`;
    if (url.startsWith("/inbox")) return "/inbox";
    if (url.startsWith("/sales")) return "/sales";
    if (url.startsWith("/money")) return "/money";
    return "/";
}

export function usePushRegistration(studioProjectId: string | null) {
    const api = useApi();

    useEffect(() => {
        if (!studioProjectId || !Device.isDevice || !projectId() || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;
        let cancelled = false;
        (async () => {
            if (Platform.OS === "android") {
                await Notifications.setNotificationChannelAsync("default", { name: "Studio", importance: Notifications.AndroidImportance.HIGH });
            }
            const current = await Notifications.getPermissionsAsync();
            const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
            if (!granted || cancelled) return;
            const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
            if (!cancelled) await api("/api/studio/push", { method: "POST", body: { project_id: studioProjectId, expo_token: token } });
        })().catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [studioProjectId, api]);

    // Tapping a notification opens what it's about.
    useEffect(() => {
        const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
            router.push(screenFor(response.notification.request.content.data?.url) as never);
        });
        return () => subscription.remove();
    }, []);
}
