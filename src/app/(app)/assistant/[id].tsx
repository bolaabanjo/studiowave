import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import { useAssistants, useEmployee, useOverview } from "@/lib/queries";
import { assistantStatus } from "@/components/assistant-status";
import { PersonalitySection, RenameSheet } from "@/components/personality";
import { useCopilot } from "@/lib/copilot";
import { Icon } from "@/ui/icons";
import { AgentOrb, BottomSheet, Button, ErrorText, IconButton, LoadError, Skeleton, Spinner, T, Tag } from "@/ui/kit";
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
    const staff = useAssistants().data?.assistants ?? [];
    const row = staff.find((item) => item.id === id) ?? null;
    // The main employee (live first, as the AI tab lists them) is the usual conversation: no ?agent.
    const isMain = [...staff].sort((a, b) => Number(b.published && b.active) - Number(a.published && a.active))[0]?.id === id;
    const [renaming, setRenaming] = useState(false);
    const [deleting, setDeleting] = useState(false);
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
                        <Button kind="outline" title={`Talk to ${profile.data?.name ?? assistant.name}`} onPress={() => router.navigate({ pathname: "/copilot", params: isMain ? {} : { agent: id } })} style={{ marginTop: 24 }} />
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
                        <Pressable onPress={() => setDeleting(true)} style={{ marginTop: 8, alignSelf: "center", paddingVertical: 6 }}>
                            <T size={13} center color={colors.destructive}>Delete {profile.data?.name ?? assistant.name}</T>
                        </Pressable>
                        <RenameSheet key={profile.data?.name ?? assistant.name} agentId={id} name={profile.data?.name ?? assistant.name} open={renaming} onClose={() => setRenaming(false)} />
                        <DeleteSheet agentId={id} name={profile.data?.name ?? assistant.name} open={deleting} onClose={() => setDeleting(false)} />
                    </>
                )}
            </ScrollPage>
        </View>
    );
}

/**
 * Deleting a staff member, for good: they stop answering, their WhatsApp
 * number is let go and your chat with them goes (cencori embedded-agents/studio
 * delete_agent). Orders, bookings and money they took stay.
 */
function DeleteSheet({ agentId, name, open, onClose }: { agentId: string; name: string; open: boolean; onClose: () => void }) {
    const api = useApi();
    const queryClient = useQueryClient();
    const { workspace } = useWorkspace();
    const copilot = useCopilot();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const remove = async () => {
        setBusy(true);
        setError(null);
        try {
            await api(`/api/projects/${workspace.project.id}/embedded-agents/studio`, { method: "POST", body: { action: "delete_agent", agent_id: agentId }, fallback: `Couldn't delete ${name}.` });
            // If you were talking to them, the AI tab goes back to your main employee.
            copilot.chooseEmployee(null);
            for (const key of ["assistants", "overview", "inbox"]) void queryClient.invalidateQueries({ queryKey: [key, workspace.project.id] });
            onClose();
            router.back();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : `Couldn't delete ${name}.`);
            setBusy(false);
        }
    };
    return (
        <BottomSheet open={open} onClose={onClose}>
            <T size={17} weight="600">Delete {name}?</T>
            <T size={14} leading={22} muted style={{ marginTop: 8 }}>{name} stops answering customers right away, their WhatsApp number is disconnected, and your chat with them is gone. Orders, bookings and money they took stay. This can&apos;t be undone.</T>
            {error ? <ErrorText style={{ marginTop: 8 }}>{error}</ErrorText> : null}
            <Pressable onPress={() => void remove()} disabled={busy} accessibilityRole="button" style={({ pressed }) => ({ marginTop: 20, height: 48, borderRadius: 999, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#dc2626", opacity: busy ? 0.6 : pressed ? 0.85 : 1 })}>
                {busy ? <Spinner color="#ffffff" /> : null}
                <T weight="600" color="#ffffff">Delete {name}</T>
            </Pressable>
            <Button kind="outline" title="Keep them" disabled={busy} onPress={onClose} style={{ marginTop: 8 }} />
        </BottomSheet>
    );
}

function ScrollPage({ children }: { children: ReactNode }) {
    const insets = useSafeAreaInsets();
    return <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}>{children}</ScrollView>;
}
