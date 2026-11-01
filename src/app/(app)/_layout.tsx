import { useEffect, useRef } from "react";
import { Stack, router } from "expo-router";
import { View } from "react-native";
import { CopilotProvider } from "@/lib/copilot";
import { BusinessOnboarding } from "@/components/business-onboarding";
import { useWorkspaceQuery, WorkspaceProvider } from "@/lib/workspace";
import { usePushRegistration } from "@/lib/push";
import { useAdoptTimeZone } from "@/lib/time-zone";
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
    // A business just created here: once it's loaded, straight on to its first staff member.
    const startStaff = useRef(false);
    useEffect(() => {
        if (!workspace || !startStaff.current) return;
        startStaff.current = false;
        router.push("/setup");
    }, [workspace]);
    useAdoptTimeZone(workspace?.project.id ?? null);

    if (query.isPending) return <Centered><Spinner /></Centered>;
    if (query.isError) return <Centered><LoadError error={query.error} fallback="Couldn't load your business." onRetry={() => void query.refetch()} /></Centered>;
    if (!workspace) {
        // Signed in, but no business yet: create it here, then the first staff member.
        return (
            <BusinessOnboarding
                onClose={() => void signOut()}
                closeLabel="Sign out"
                onCreated={async (organizationId) => {
                    startStaff.current = true;
                    await choose(organizationId);
                }}
            />
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
                    <Stack.Screen name="copilot" />
                    <Stack.Screen name="event/[id]" />
                    <Stack.Screen name="schedule/index" />
                    <Stack.Screen name="schedule/settings" />
                    <Stack.Screen name="client/[phone]" options={sheet} />
                    <Stack.Screen name="setup" options={{ presentation: "fullScreenModal" }} />
                    <Stack.Screen name="new-business" options={{ presentation: "fullScreenModal" }} />
                    <Stack.Screen name="business-profile" options={{ presentation: "fullScreenModal" }} />
                    <Stack.Screen name="account" options={{ presentation: "fullScreenModal" }} />
                    <Stack.Screen name="profile" options={sheet} />
                    <Stack.Screen name="notifications" options={sheet} />
                    {/* Half height, sized to the code and its buttons: content-sized sheets work when the screen's root isn't flex: 1 (that measured to nothing, the blank sheets). */}
                    <Stack.Screen name="qr" options={{ presentation: "formSheet", sheetAllowedDetents: "fitToContents", sheetGrabberVisible: false, sheetCornerRadius: 24, contentStyle: { backgroundColor: colors.background } }} />
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
