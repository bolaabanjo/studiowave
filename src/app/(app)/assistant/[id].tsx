import { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { WebView } from "react-native-webview";
import { useApi } from "@/lib/api";
import { SITE_URL } from "@/lib/config";
import { useAssistants, useOverview, useSetAssistantActive } from "@/lib/queries";
import { useWorkspace } from "@/lib/workspace";
import { useTasks } from "@/lib/tasks";
import type { StudioAssistantSummary } from "@/lib/types";
import { assistantStatus } from "@/components/assistant-status";
import { Icon } from "@/ui/icons";
import { Button, ErrorText, IconButton, LoadError, Sheet, SheetHeader, Skeleton, Spinner, T, Tag } from "@/ui/kit";
import { alpha, palette, useColors } from "@/ui/theme";

/** What each ability is called for an owner. */
const ABILITIES: Record<string, string> = {
    take_payments: "Send payment links",
    sell_products: "Take orders",
    request_callback: "Ask you to call customers back",
    transfer_to_human: "Hand customers over to you",
};

function abilities(assistant: StudioAssistantSummary): string[] {
    const list: string[] = ["Answer questions"];
    if (assistant.template === "restaurant") list.push(assistant.connected_apps.some((app) => /calendar/i.test(app.app)) ? "Take table bookings" : "Take table bookings (needs Google Calendar)");
    for (const tool of assistant.system_tools) if (ABILITIES[tool]) list.push(ABILITIES[tool]);
    for (const app of assistant.connected_apps) if (!/calendar/i.test(app.app)) list.push(`Use ${app.app}`);
    if (assistant.owner_alerts?.emails.length) list.push("Tell you when someone needs you");
    return list;
}

function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: ReactNode[] | ReactNode }) {
    const colors = useColors();
    const items = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean);
    return (
        <View style={{ marginTop: 24 }}>
            <View style={{ marginBottom: 8, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 4 }}>
                <T weight="600">{title}</T>
                {action ? <Pressable onPress={onAction} hitSlop={8}><T size={13} muted>{action}</T></Pressable> : null}
            </View>
            <View style={{ overflow: "hidden", borderRadius: 16, backgroundColor: colors.card }}>
                {items.map((child, index) => <View key={index} style={index ? { borderTopWidth: 1, borderTopColor: alpha(colors.border, 0.4) } : undefined}>{child}</View>)}
            </View>
        </View>
    );
}

function Line({ label, detail, right, onPress }: { label: string; detail?: string | null; right?: ReactNode; onPress?: () => void }) {
    const colors = useColors();
    const inner = (
        <>
            <View style={{ flex: 1, minWidth: 0 }}>
                <T lines={1}>{label}</T>
                {detail ? <T size={13} muted lines={1}>{detail}</T> : null}
            </View>
            {right ?? (onPress ? <Icon name="chevron-right:lucide" size={16} color={colors.mutedForeground} /> : null)}
        </>
    );
    const style = { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, paddingHorizontal: 16, paddingVertical: 14 };
    return onPress ? <Pressable onPress={onPress} style={({ pressed }) => [style, pressed && { backgroundColor: colors.muted }]}>{inner}</Pressable> : <View style={style}>{inner}</View>;
}

/** One assistant: try it, switch it on or off, where it answers, what it knows and can do (cencori components/studio/views/AssistantDetailView.tsx). */
export default function AssistantDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const api = useApi();
    const queryClient = useQueryClient();
    const tasks = useTasks();
    const { workspace } = useWorkspace();
    const overview = useOverview(id);
    const row = useAssistants().data?.assistants.find((item) => item.id === id) ?? null;
    const setActive = useSetAssistantActive();
    const [tryOpen, setTryOpen] = useState(false);
    const [removing, setRemoving] = useState<string | null>(null);
    const assistant = overview.data?.assistant ?? null;
    const linkUrl = overview.data?.share_token ? `${SITE_URL}/talk/${overview.data.share_token}` : null;
    const status = row ? assistantStatus(row, colors) : null;
    const ask = (message: string) => router.push({ pathname: "/copilot", params: { ask: message } });
    const check = <Icon name="check:lucide" size={16} color={palette.emerald600} />;

    const removeKnowledge = async (sourceId: string) => {
        setRemoving(sourceId);
        try {
            await api(`/api/projects/${workspace.project.id}/embedded-agents/${id}/knowledge?source_id=${encodeURIComponent(sourceId)}`, { method: "DELETE" });
            await queryClient.invalidateQueries({ queryKey: ["overview", workspace.project.id] });
        } catch {
            // It stays listed; tapping again tries again.
        } finally {
            setRemoving(null);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16 }}>
                <View style={{ height: 40, justifyContent: "center", marginLeft: -8 }}><IconButton name="chevron-left:lucide" label="Back to Assistants" onPress={() => router.back()} /></View>
            </View>
            <ScrollPage>
                {overview.isLoading ? (
                    <View style={{ marginTop: 12, gap: 12 }}><Skeleton width={192} height={32} /><Skeleton height={48} radius={24} />{[0, 1, 2].map((index) => <Skeleton key={index} height={112} radius={16} />)}</View>
                ) : !assistant ? (
                    <LoadError error={overview.error} fallback="Couldn't load this assistant." onRetry={() => void overview.refetch()} />
                ) : (
                    <>
                        <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <T size={26} weight="600" leading={32} lines={1} style={{ flexShrink: 1, letterSpacing: -0.65 }}>{assistant.name}</T>
                            {status ? <Tag tone={status.tone} label={status.label} /> : null}
                        </View>

                        <View style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Button title="Try it" onPress={() => setTryOpen(true)} grow />
                            {row?.published ? (
                                <Pressable
                                    accessibilityRole="switch"
                                    accessibilityState={{ checked: row.active }}
                                    disabled={setActive.isPending}
                                    onPress={() => setActive.mutate({ agentId: id, active: !row.active })}
                                    style={{ height: 48, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 999, borderWidth: 1, borderColor: alpha(colors.border, 0.6), paddingLeft: 16, paddingRight: 6, opacity: setActive.isPending ? 0.6 : 1 }}
                                >
                                    <T>{row.active ? "Live" : "Paused"}</T>
                                    <View style={{ width: 48, height: 28, borderRadius: 14, padding: 2, justifyContent: "center", backgroundColor: row.active ? palette.emerald600 : alpha(colors.mutedForeground, 0.3) }}>
                                        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#ffffff", transform: [{ translateX: row.active ? 20 : 0 }], shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }} />
                                    </View>
                                </Pressable>
                            ) : (
                                <Button kind="outline" title="Go live" onPress={() => tasks.open("golive", { agentId: id })} />
                            )}
                        </View>
                        {setActive.error ? <ErrorText style={{ marginTop: 8 }}>{setActive.error.message}</ErrorText> : null}

                        <Section title="Where it answers">
                            <Line
                                label="WhatsApp"
                                detail={assistant.whatsapp ? assistant.whatsapp.number ?? "Connected" : null}
                                onPress={assistant.whatsapp ? undefined : () => tasks.open("whatsapp", { agentId: id })}
                                right={assistant.whatsapp ? check : <T size={13}>Connect</T>}
                            />
                            <Line
                                label="Your link"
                                detail={linkUrl ? linkUrl.replace(/^https?:\/\//, "") : "Ready once it's live"}
                                onPress={linkUrl ? () => router.push({ pathname: "/qr", params: { url: linkUrl, name: assistant.name } }) : undefined}
                                right={linkUrl ? <Icon name="qr-code:lucide" size={16} color={colors.mutedForeground} /> : <View />}
                            />
                            <Line
                                label="Your website"
                                detail={assistant.website_chat?.on ? assistant.website_chat.sites.map((site) => site.replace(/^https?:\/\//, "")).join(", ") || "On" : "Off"}
                                onPress={() => ask(`Help me put ${assistant.name} on my website`)}
                            />
                        </Section>

                        <Section title="What it knows" action="Add" onAction={() => tasks.open("knowledge", { agentId: id })}>
                            {assistant.knowledge.length === 0 && !assistant.products?.count ? (
                                <Line label="Nothing yet" detail="Add your menu, prices or hours." />
                            ) : [
                                ...assistant.knowledge.map((doc) => (
                                    <Line
                                        key={doc.id ?? doc.name}
                                        label={doc.name}
                                        detail={doc.status === "ready" ? null : "Reading…"}
                                        right={doc.id ? (
                                            <Pressable onPress={() => void removeKnowledge(doc.id!)} disabled={removing !== null} accessibilityLabel={`Remove ${doc.name}`} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center", opacity: removing !== null ? 0.5 : 1 }}>
                                                {removing === doc.id ? <Spinner /> : <Icon name="x:lucide" size={16} color={colors.mutedForeground} />}
                                            </Pressable>
                                        ) : <View />}
                                    />
                                )),
                                assistant.products?.count ? <Line key="products" label={`${assistant.products.count} products`} detail={assistant.products.orders_to_fulfil ? `${assistant.products.orders_to_fulfil} orders to send` : null} /> : null,
                            ]}
                        </Section>

                        <Section title="What it can do" action="Change" onAction={() => ask(`I want to change what ${assistant.name} can do`)}>
                            {abilities(assistant).map((ability) => <Line key={ability} label={ability} right={check} />)}
                        </Section>

                        <Section title="This week">
                            <Line label="Chats" right={<T weight="600">{String(row?.chats_this_week ?? 0)}</T>} />
                        </Section>

                        <Button kind="outline" title="Change something with Copilot" onPress={() => ask(`For ${assistant.name}: `)} style={{ marginTop: 24 }} />
                        <TrySheet agentId={id} name={assistant.name} open={tryOpen} onClose={() => setTryOpen(false)} />
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

/** A preview chat with the assistant: nothing said here counts as a real chat. */
function TrySheet({ agentId, name, open, onClose }: { agentId: string; name: string; open: boolean; onClose: () => void }) {
    const api = useApi();
    const projectId = useWorkspace().workspace.project.id;
    const [frame, setFrame] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (!open || frame) return;
        (async () => {
            const base = `/api/projects/${projectId}/embedded-agents/${agentId}/widget`;
            type Widget = { widget: { public_key: string } | null; preview_token: string | null; error?: string };
            let body = await api<Widget>(base);
            // No chat widget yet: make one (it starts switched off for websites).
            if (!body.widget) body = await api<Widget>(base, { method: "PUT", body: {} });
            if (!body.widget || !body.preview_token) throw new Error(body.error ?? "Couldn't open a preview.");
            setFrame(`${SITE_URL}/api/widget/frame/${body.widget.public_key}?mode=bare&preview=${encodeURIComponent(body.preview_token)}`);
        })().catch((cause) => setError(cause instanceof Error ? cause.message : "Couldn't open a preview."));
    }, [open, frame, api, projectId, agentId]);
    return (
        <Sheet open={open} onClose={() => { setError(null); onClose(); }} scroll={false}>
            <SheetHeader title="Try it" onClose={() => { setError(null); onClose(); }} description="A preview. It doesn't count as a chat." />
            <View style={{ flex: 1, marginTop: 12, marginHorizontal: -8 }}>
                {frame ? <WebView source={{ uri: frame }} style={{ flex: 1, backgroundColor: "transparent" }} accessibilityLabel={`Try ${name}`} /> : error ? <ErrorText style={{ paddingHorizontal: 8 }}>{error}</ErrorText> : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Spinner /></View>}
            </View>
        </Sheet>
    );
}
