import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
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

/** Push works here: a real phone, an EAS project, and not Expo Go. */
function pushPossible(): boolean {
    return Device.isDevice && !!projectId() && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

/** Ask (if asked to), then send this phone's token to Studio. Whether it's on. */
async function register(api: ReturnType<typeof useApi>, studioProjectId: string, ask: boolean): Promise<boolean> {
    if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", { name: "Studio", importance: AndroidImportance.HIGH });
    }
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (ask && current.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
    if (!granted) return false;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
    await api("/api/studio/push", { method: "POST", body: { project_id: studioProjectId, expo_token: token } });
    return true;
}

/** For Settings → Notifications: on, off (can turn on), blocked, or not possible in this build. */
export function usePushState(studioProjectId: string) {
    const api = useApi();
    const [state, setState] = useState<"on" | "off" | "denied" | "unsupported">(pushPossible() ? "off" : "unsupported");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (!pushPossible()) return;
        Notifications.getPermissionsAsync().then((current) => setState(current.granted ? "on" : current.canAskAgain ? "off" : "denied")).catch(() => undefined);
    }, []);
    const turnOn = useCallback(async () => {
        setBusy(true);
        setError(null);
        try {
            const on = await register(api, studioProjectId, true);
            const current = await Notifications.getPermissionsAsync();
            setState(on ? "on" : current.canAskAgain ? "off" : "denied");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't turn notifications on.");
        } finally {
            setBusy(false);
        }
    }, [api, studioProjectId]);
    return { state, busy, error, turnOn };
}

export function usePushRegistration(studioProjectId: string | null) {
    const api = useApi();

    useEffect(() => {
        if (!studioProjectId || !pushPossible()) return;
        register(api, studioProjectId, true).catch(() => undefined);
    }, [studioProjectId, api]);

    // Tapping a notification opens what it's about.
    useEffect(() => {
        const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
            router.push(screenFor(response.notification.request.content.data?.url) as never);
        });
        return () => subscription.remove();
    }, []);
}
