import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useAssistants } from "@/lib/queries";
import type { StudioAssistantRow } from "@/lib/types";
import { CopilotChat } from "@/components/copilot-chat";
import { Icon } from "@/ui/icons";
import { AgentOrb, IconButton, IconCircle, Skeleton, T } from "@/ui/kit";
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

/** Who you're talking to: a back arrow, then the main employee's orb and name. */
function EmployeeHeader({ loading, main, more }: { loading: boolean; main: StudioAssistantRow | null; more: number }) {
    const colors = useColors();
    const row = { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: alpha(colors.border, 0.4) };
    // Not wired yet: a place for going back once the tab has somewhere to go back to.
    const back = <View style={{ marginLeft: -8 }}><IconButton name="chevron-left:lucide" label="Back" onPress={() => undefined} /></View>;
    if (loading) return <View style={row}>{back}<Skeleton width={32} height={32} radius={16} /><Skeleton width={140} height={18} /></View>;
    if (!main) {
        // No employee yet: the chat below helps set one up, and so does setup.
        return (
            <View style={row}>
                {back}
                <Pressable onPress={() => router.push("/setup")} style={({ pressed }) => [{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 999 }, pressed && { opacity: 0.7 }]}>
                    <IconCircle name="plus:lucide" tone="emerald" size={32} iconSize={16} />
                    <View style={{ flex: 1 }}>
                        <T weight="600">Your employee</T>
                        <T size={13} muted>Not set up yet</T>
                    </View>
                    <Icon name="chevron-right:lucide" size={16} color={colors.mutedForeground} />
                </Pressable>
            </View>
        );
    }
    return (
        <View style={row}>
            {back}
            <Pressable
                onPress={() => router.push(more > 0 ? "/staff" : `/assistant/${main.id}`)}
                accessibilityLabel={more > 0 ? `${main.name} and your staff` : `${main.name}'s profile`}
                style={({ pressed }) => [{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 }, pressed && { opacity: 0.7 }]}
            >
                <AgentOrb seed={main.id} size={32} />
                <T size={17} weight="600" lines={1} style={{ flex: 1 }}>{main.name}</T>
                <Icon name="chevron-right:lucide" size={16} color={colors.mutedForeground} />
            </Pressable>
        </View>
    );
}
