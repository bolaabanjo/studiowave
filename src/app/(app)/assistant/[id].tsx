import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAssistants, useEmployee, useOverview } from "@/lib/queries";
import { assistantStatus } from "@/components/assistant-status";
import { PersonalitySection, RenameSheet } from "@/components/personality";
import { useCopilot } from "@/lib/copilot";
import { Icon } from "@/ui/icons";
import { AgentOrb, Button, IconButton, LoadError, Skeleton, T, Tag } from "@/ui/kit";
import { useColors } from "@/ui/theme";

/**
 * An employee's profile: who they are, their name and personality, both
 * editable and live at once. Everything else is a conversation with them, on
 * the AI tab.
 */
export default function AssistantDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const overview = useOverview(id);
    const row = useAssistants().data?.assistants.find((item) => item.id === id) ?? null;
    const [renaming, setRenaming] = useState(false);
    const copilot = useCopilot();
    const [clearing, setClearing] = useState<"ask" | "busy" | "done" | null>(null);
    const profile = useEmployee(id);
    const assistant = overview.data?.assistant ?? null;
    const status = row ? assistantStatus(row, colors) : null;


    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16 }}>
                <View style={{ height: 40, justifyContent: "center", marginLeft: -8 }}><IconButton name="chevron-left:lucide" label="Back" onPress={() => router.back()} /></View>
            </View>
            <ScrollPage>
                {overview.isLoading ? (
                    <View style={{ marginTop: 12, gap: 12 }}><Skeleton width={192} height={32} /><Skeleton height={48} radius={24} />{[0, 1, 2].map((index) => <Skeleton key={index} height={112} radius={16} />)}</View>
                ) : !assistant ? (
                    <LoadError error={overview.error} fallback="Couldn't load this employee." onRetry={() => void overview.refetch()} />
                ) : (
                    <>
                        {/* Who they are: the orb, the name (tap to rename) and how they're doing. */}
                        <View style={{ marginTop: 4, alignItems: "center" }}>
                            <AgentOrb seed={id} size={88} />
                            <Pressable onPress={() => setRenaming(true)} accessibilityLabel={`Rename ${profile.data?.name ?? assistant.name}`} style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "100%" }}>
                                <T size={26} weight="600" leading={32} lines={1} style={{ flexShrink: 1, letterSpacing: -0.65 }}>{profile.data?.name ?? assistant.name}</T>
                                <Icon name="pen" size={18} color={colors.mutedForeground} />
                            </Pressable>
                            {status ? <Tag tone={status.tone} label={status.label} style={{ marginTop: 8, alignSelf: "center" }} /> : null}
                        </View>


                        {profile.data ? <PersonalitySection agentId={id} profile={profile.data} /> : profile.isLoading ? <Skeleton height={260} radius={16} style={{ marginTop: 24 }} /> : null}

                        {/* Anything else is a conversation with them, on the AI tab. */}
                        <Button kind="outline" title={`Talk to ${profile.data?.name ?? assistant.name}`} onPress={() => router.navigate("/assistant")} style={{ marginTop: 24 }} />
                        {/* One conversation that never resets; this starts it over. What they tell customers stays. */}
                        <Pressable
                            disabled={clearing === "busy" || clearing === "done"}
                            onPress={() => {
                                if (clearing !== "ask") return setClearing("ask");
                                setClearing("busy");
                                void copilot.clear().then(() => setClearing("done"), () => setClearing(null));
                            }}
                            style={{ marginTop: 16, alignSelf: "center", paddingVertical: 6 }}
                        >
                            <T size={13} center color={clearing === "ask" ? colors.destructive : colors.mutedForeground}>
                                {clearing === "ask" ? "Tap again to clear your chat. What they tell customers stays."
                                    : clearing === "busy" ? "Clearing…"
                                        : clearing === "done" ? "Chat cleared"
                                            : "Clear chat"}
                            </T>
                        </Pressable>
                        <RenameSheet key={profile.data?.name ?? assistant.name} agentId={id} name={profile.data?.name ?? assistant.name} open={renaming} onClose={() => setRenaming(false)} />
                    </>
                )}
            </ScrollPage>
        </View>
    );
}

function ScrollPage({ children }: { children: ReactNode }) {
    const insets = useSafeAreaInsets();
    return <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}>{children}</ScrollView>;
}
