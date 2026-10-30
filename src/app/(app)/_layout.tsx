import { Stack } from "expo-router";
import { View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { SITE_URL } from "@/lib/config";
import { CopilotProvider } from "@/lib/copilot";
import { useWorkspaceQuery, WorkspaceProvider } from "@/lib/workspace";
import { usePushRegistration } from "@/lib/push";
import { useSession } from "@/lib/session";
import { Button, LoadError, Spinner, T } from "@/ui/kit";
import { useColors } from "@/ui/theme";

/** Signed in: load the business, then the tabs, and the screens and sheets over them. */
export default function AppLayout() {
    const colors = useColors();
    const { signOut } = useSession();
    const { query, choose } = useWorkspaceQuery();
    const workspace = query.data?.workspace ?? null;
    usePushRegistration(workspace?.project.id ?? null);

    if (query.isPending) return <Centered><Spinner /></Centered>;
    if (query.isError) return <Centered><LoadError error={query.error} fallback="Couldn't load your business." onRetry={() => void query.refetch()} /></Centered>;
    if (!workspace) {
        // Signed in, but no business yet: setup is next. It lives on the main site for now, as on the web.
        return (
            <Centered>
                <View style={{ alignItems: "center" }}>
                    <T size={24} weight="600" center style={{ letterSpacing: -0.6 }}>Let&apos;s set up your business</T>
                    <T size={14} leading={24} muted center style={{ marginTop: 8, maxWidth: 320 }}>Tell us what you do and your assistant will be ready to answer customers in a few minutes.</T>
                    <Button title="Get started" onPress={() => void WebBrowser.openBrowserAsync(`${SITE_URL}/onboarding?for=business`).then(() => query.refetch())} style={{ marginTop: 24 }} />
                    <Button kind="outline" title="Sign out" onPress={() => void signOut()} style={{ marginTop: 8 }} />
                </View>
            </Centered>
        );
    }
    // Sheets are iOS's standard card (a page sheet; full screen on Android). Form sheets with set
    // heights didn't lay their content out: blank, or the content over the header.
    const sheet = { presentation: "modal" as const, contentStyle: { backgroundColor: colors.background } };
    return (
        <WorkspaceProvider workspace={workspace} choose={choose}>
            <CopilotProvider workspace={workspace}>
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="conversation/[id]" />
                    <Stack.Screen name="assistant/[id]" />
                    <Stack.Screen name="event/[id]" />
                    <Stack.Screen name="setup" options={{ presentation: "fullScreenModal" }} />
                    <Stack.Screen name="profile" options={sheet} />
                    <Stack.Screen name="notifications" options={sheet} />
                    <Stack.Screen name="qr" options={sheet} />
                    <Stack.Screen name="copilot" options={sheet} />
                    <Stack.Screen name="task/[task]" options={sheet} />
                </Stack>
            </CopilotProvider>
        </WorkspaceProvider>
    );
}

function Centered({ children }: { children: React.ReactNode }) {
    const colors = useColors();
    return <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: colors.background }}>{children}</View>;
}
