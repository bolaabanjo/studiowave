import { Stack } from "expo-router";
import { View } from "react-native";
import { useWorkspaceQuery, WorkspaceProvider } from "@/lib/workspace";
import { usePushRegistration } from "@/lib/push";
import { useSession } from "@/lib/session";
import { Body, Button, LoadError, Loading } from "@/ui/kit";
import { useColors } from "@/ui/theme";

/** Signed in: load the business, then the tabs (and the screens that cover them). */
export default function AppLayout() {
    const colors = useColors();
    const { signOut } = useSession();
    const { query, choose } = useWorkspaceQuery();
    const workspace = query.data?.workspace ?? null;
    usePushRegistration(workspace?.project.id ?? null);

    if (query.isPending) return <Centered><Loading /></Centered>;
    if (query.isError) return <Centered><LoadError error={query.error} onRetry={() => void query.refetch()} /></Centered>;
    if (!workspace) {
        // Signed in, but no business yet: setup isn't in the app yet.
        return (
            <Centered>
                <Body weight="600" size={18}>Set up your business first</Body>
                <View style={{ marginTop: 6, marginBottom: 20 }}>
                    <Body muted>Open studio.cencori.com to set up your assistant. It shows up here when you&apos;re done.</Body>
                </View>
                <Button kind="secondary" title="Try again" onPress={() => void query.refetch()} />
                <View style={{ marginTop: 10 }}><Button kind="secondary" title="Sign out" onPress={() => void signOut()} /></View>
            </Centered>
        );
    }
    return (
        <WorkspaceProvider workspace={workspace} choose={choose}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="conversation/[id]" />
                <Stack.Screen name="profile" options={{ presentation: "modal" }} />
            </Stack>
        </WorkspaceProvider>
    );
}

function Centered({ children }: { children: React.ReactNode }) {
    const colors = useColors();
    return <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: colors.background }}>{children}</View>;
}
