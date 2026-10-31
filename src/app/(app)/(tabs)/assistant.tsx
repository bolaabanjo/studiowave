import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useAssistants } from "@/lib/queries";
import type { StudioAssistantRow } from "@/lib/types";
import { CopilotChat } from "@/components/copilot-chat";
import { assistantStatus } from "@/components/assistant-status";
import { Icon } from "@/ui/icons";
import { AgentOrb, IconCircle, Skeleton, T } from "@/ui/kit";
import { alpha, useColors } from "@/ui/theme";

/**
 * The AI tab: your employee. You talk to it here (what was Copilot) and it
 * serves your customers on your link and WhatsApp (what was the assistant):
 * one employee, two sides. With you it sees and runs the business; with
 * customers it only does front-desk work. Its header opens its profile, or
 * your staff when there's more than one.
 */
export default function Employee() {
    const list = useAssistants();
    const staff = [...(list.data?.assistants ?? [])].sort((a, b) => Number(b.published && b.active) - Number(a.published && a.active));
    const main = staff[0] ?? null;
    return <CopilotChat inTab name={main?.name ?? null} header={<EmployeeHeader loading={list.isLoading} main={main} more={staff.length - 1} />} />;
}

/** Who you're talking to: the main employee's orb, name and how it's doing with customers. */
function EmployeeHeader({ loading, main, more }: { loading: boolean; main: StudioAssistantRow | null; more: number }) {
    const colors = useColors();
    const row = { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: alpha(colors.border, 0.4) };
    if (loading) return <View style={row}><Skeleton width={44} height={44} radius={22} /><Skeleton width={140} height={18} /></View>;
    if (!main) {
        // No employee yet: the chat below helps set one up, and so does setup.
        return (
            <Pressable onPress={() => router.push("/setup")} style={({ pressed }) => [row, pressed && { backgroundColor: colors.muted }]}>
                <IconCircle name="plus:lucide" tone="emerald" size={44} iconSize={20} />
                <View style={{ flex: 1 }}>
                    <T weight="600">Your employee</T>
                    <T size={13} muted>Not set up yet</T>
                </View>
                <Icon name="chevron-right:lucide" size={16} color={colors.mutedForeground} />
            </Pressable>
        );
    }
    const status = assistantStatus(main, colors);
    return (
        <Pressable
            onPress={() => router.push(more > 0 ? "/staff" : `/assistant/${main.id}`)}
            accessibilityLabel={more > 0 ? `${main.name} and your staff` : `${main.name}'s profile`}
            style={({ pressed }) => [row, pressed && { backgroundColor: colors.muted }]}
        >
            <AgentOrb seed={main.id} size={44} />
            <View style={{ flex: 1, minWidth: 0 }}>
                <T size={17} weight="600" lines={1}>{main.name}</T>
                <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: status.dot }} />
                    <T size={13} muted lines={1}>{status.label === "Live" ? "Serving customers" : status.label}{more > 0 ? ` · +${more} staff` : ""}</T>
                </View>
            </View>
            <Icon name="chevron-right:lucide" size={16} color={colors.mutedForeground} />
        </Pressable>
    );
}
