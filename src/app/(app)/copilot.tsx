import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { goBack } from "@/lib/navigation";
import { useAssistants } from "@/lib/queries";
import { useCopilot } from "@/lib/copilot";
import type { StudioAssistantRow } from "@/lib/types";
import { CopilotChat } from "@/components/copilot-chat";
import { AgentOrb, IconButton, IconCircle, Skeleton, T } from "@/ui/kit";
import { alpha, useColors } from "@/ui/theme";

/**
 * Talking to one employee: opened from your staff on the AI tab (?agent=…, or
 * none for the main one), and from links with ?ask=…. With you it sees and
 * runs the business; with customers it only does front-desk work. Back goes
 * to your staff; the employee's orb and name open their profile.
 */
export default function EmployeeChat() {
    const { agent } = useLocalSearchParams<{ agent?: string }>();
    const list = useAssistants();
    const copilot = useCopilot();
    const { chooseEmployee } = copilot;
    // Switch to this employee before the chat mounts, so a ?ask goes to them, not whoever was last.
    const [ready, setReady] = useState(false);
    useEffect(() => {
        chooseEmployee(agent ?? null);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one frame, once per employee: the switch has to land first
        setReady(true);
    }, [agent, chooseEmployee]);
    const staff = [...(list.data?.assistants ?? [])].sort((a, b) => Number(b.published && b.active) - Number(a.published && a.active));
    // Who the conversation is with: the server confirms it (until it keeps one thread per employee, that's the main one).
    const main = staff.find((assistant) => assistant.id === copilot.employeeId) ?? staff[0] ?? null;
    if (!ready) return null;
    return <CopilotChat name={main?.name ?? null} header={<EmployeeHeader loading={list.isLoading} main={main} />} />;
}

/** Who you're talking to: a back arrow to your staff, then the employee's orb and name. */
function EmployeeHeader({ loading, main }: { loading: boolean; main: StudioAssistantRow | null }) {
    const colors = useColors();
    const row = { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: alpha(colors.border, 0.4) };
    const back = <View style={{ marginLeft: -8 }}><IconButton name="chevron-left:lucide" label="Your staff" onPress={() => (router.canGoBack() ? goBack() : router.navigate("/assistant"))} /></View>;
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
                </Pressable>
            </View>
        );
    }
    return (
        <View style={row}>
            {back}
            <Pressable
                onPress={() => router.push(`/assistant/${main.id}`)}
                accessibilityLabel={`${main.name}'s profile`}
                style={({ pressed }) => [{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 }, pressed && { opacity: 0.7 }]}
            >
                <AgentOrb seed={main.id} size={32} />
                <T size={17} weight="600" lines={1} style={{ flex: 1 }}>{main.name}</T>
            </Pressable>
        </View>
    );
}
