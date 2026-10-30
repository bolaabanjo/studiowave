import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/lib/session";
import { useWorkspace } from "@/lib/workspace";
import { Body, Button, Card, Label } from "@/ui/kit";
import { useColors } from "@/ui/theme";

/** You, your businesses (switch between them), and signing out. */
export default function Profile() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const { workspace, choose } = useWorkspace();
    const { signOut } = useSession();
    const [switching, setSwitching] = useState<string | null>(null);

    return (
        <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Body weight="700" size={22}>{workspace.user.fullName ?? "You"}</Body>
                <Pressable onPress={() => router.back()} hitSlop={12}><Body weight="600">Done</Body></Pressable>
            </View>
            {workspace.user.email ? <Body muted size={14}>{workspace.user.email}</Body> : null}

            <Label>Your businesses</Label>
            <Card style={{ padding: 0 }}>
                {workspace.organizations.map((organization, index) => {
                    const current = organization.id === workspace.organization.id;
                    return (
                        <Pressable
                            key={organization.id}
                            disabled={current || !!switching}
                            onPress={async () => {
                                setSwitching(organization.id);
                                await choose(organization.id);
                                router.back();
                            }}
                            style={({ pressed }) => ({ flexDirection: "row", justifyContent: "space-between", padding: 16, borderTopWidth: index ? 1 : 0, borderTopColor: colors.border, opacity: pressed ? 0.6 : 1 })}
                        >
                            <Body weight={current ? "600" : "400"}>{organization.name}</Body>
                            <Body muted size={14}>{current ? "Showing" : switching === organization.id ? "Switching…" : ""}</Body>
                        </Pressable>
                    );
                })}
            </Card>

            <View style={{ marginTop: 32 }}>
                <Button kind="danger" title="Sign out" onPress={() => void signOut()} />
            </View>
        </ScrollView>
    );
}
