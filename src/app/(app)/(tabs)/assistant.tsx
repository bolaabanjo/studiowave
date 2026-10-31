import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useAssistants, useOverview } from "@/lib/queries";
import { useWorkspace } from "@/lib/workspace";
import { useTasks } from "@/lib/tasks";
import { Icon } from "@/ui/icons";
import { AgentOrb, IconCircle, LoadError, Page, PageTitle, Skeleton, T, Tag } from "@/ui/kit";
import { assistantStatus } from "@/components/assistant-status";
import { alpha, useColors } from "@/ui/theme";

/**
 * The AI tab: your staff, every employee in the business, one or many, and a
 * way to add another (more staff, for a branch or a second brand, is a paid
 * upgrade). Tapping an employee opens your chat with them (/copilot).
 */
export default function Staff() {
    const colors = useColors();
    const { workspace } = useWorkspace();
    const list = useAssistants();
    const plan = useOverview().data?.plan ?? null;
    const tasks = useTasks();
    const assistants = list.data?.assistants ?? [];
    const sorted = [...assistants].sort((a, b) => Number(b.published && b.active) - Number(a.published && a.active));
    const full = !!plan && assistants.length >= plan.agents;
    const pill = ({ pressed }: { pressed: boolean }) => ({ flexDirection: "row" as const, alignItems: "center" as const, gap: 12, borderRadius: 999, backgroundColor: pressed ? colors.muted : colors.card, paddingVertical: 10, paddingLeft: 10, paddingRight: 20 });
    const chevron = <Icon name="chevron-right:lucide" size={16} color={colors.mutedForeground} />;

    return (
        <Page onRefresh={() => list.refetch()}>
            <PageTitle>Your staff</PageTitle>
            {list.isLoading ? (
                <View style={{ marginTop: 20, gap: 10 }}>{[0, 1].map((index) => <Skeleton key={index} height={76} radius={16} />)}</View>
            ) : !list.data ? (
                <LoadError error={list.error} fallback="Couldn't load your staff." onRetry={() => void list.refetch()} />
            ) : (
                // A pill each: every employee (live ones first), then adding one.
                <View style={{ marginTop: 20, gap: 10 }}>
                    {sorted.map((assistant, index) => {
                        const status = assistantStatus(assistant, colors);
                        return (
                            // Talk to them (the first is the main one: no id, the usual conversation).
                            <Pressable key={assistant.id} onPress={() => router.push({ pathname: "/copilot", params: index === 0 ? {} : { agent: assistant.id } })} accessibilityLabel={`Talk to ${assistant.name}`} style={pill}>
                                <AgentOrb seed={assistant.id} size={44} />
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <T weight="600" lines={1}>{assistant.name}</T>
                                    {/* Online is the normal state, so it goes unsaid; Paused or Not online yet is worth seeing. */}
                                    {status.label !== "Online" ? (
                                        <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 6 }}>
                                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: status.dot }} />
                                            <T size={13} muted>{status.label}</T>
                                        </View>
                                    ) : null}
                                </View>
                                {chevron}
                            </Pressable>
                        );
                    })}
                    {full ? (
                        <Pressable onPress={() => tasks.open("plans")} style={pill}>
                            <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: alpha(colors.foreground, 0.1) }}><Icon name="plus:lucide" size={20} color={colors.foreground} /></View>
                            <T weight="600" style={{ flex: 1 }}>Add staff</T>
                            <Tag tone="violet" label="Upgrade" style={{ alignSelf: "center" }} />
                            {chevron}
                        </Pressable>
                    ) : (
                        // Setup, from the start, for a new employee in this business.
                        <Pressable onPress={() => router.push({ pathname: "/setup", params: { new: "1" } })} style={pill}>
                            <IconCircle name="plus:lucide" tone="emerald" size={44} iconSize={20} />
                            <T weight="600" lines={1} style={{ flex: 1 }}>{assistants.length ? "Add staff" : `Set up ${workspace.organization.name}'s employee`}</T>
                            {chevron}
                        </Pressable>
                    )}
                </View>
            )}
        </Page>
    );
}
