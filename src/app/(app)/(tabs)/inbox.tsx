import { useRef, useState } from "react";
import { Pressable, View, type HostInstance } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useInbox, useMarkRead } from "@/lib/queries";
import { CHANNEL_LABEL, conversationTitle, needsOwnerLabel, shortTime } from "@/lib/format";
import type { InboxChannel, InboxConversation } from "@/lib/types";
import { Icon } from "@/ui/icons";
import { BottomSheet, Button, Caps, ConversationAvatar, EmptyCard, LoadError, Menu, MenuItem, Page, PageTitle, Skeleton, Switcher, T, Tag, measureAnchor } from "@/ui/kit";
import { alpha, palette, useColors } from "@/ui/theme";

type View_ = "all" | "needs" | "unread";
const CHANNELS: Array<InboxChannel | null> = [null, "whatsapp", "website", "link"];

/** Today, Yesterday or Earlier, for the day labels. */
function dayOf(iso: string): "Today" | "Yesterday" | "Earlier" {
    const then = new Date(iso);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (then >= start) return "Today";
    start.setDate(start.getDate() - 1);
    return then >= start ? "Yesterday" : "Earlier";
}

const needsYou = (conversation: InboxConversation) => !!conversation.needs_owner || conversation.owner_active;

/** Every conversation from every channel, newest first (cencori components/studio/views/InboxView.tsx). */
export default function Inbox() {
    const colors = useColors();
    const [view, setView] = useState<View_>("all");
    const [channel, setChannel] = useState<InboxChannel | null>(null);
    const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
    const filterButton = useRef<HostInstance>(null);
    const inbox = useInbox();
    const markRead = useMarkRead();
    const [held, setHeld] = useState<InboxConversation | null>(null);
    const everything = inbox.data?.conversations ?? [];
    const all = channel ? everything.filter((conversation) => conversation.channel === channel) : everything;
    const waiting = all.filter(needsYou);
    const unreadCount = all.filter((conversation) => conversation.unread).length;
    const conversations = view === "needs" ? waiting : view === "unread" ? all.filter((conversation) => conversation.unread) : all;
    const empty = !!inbox.data && conversations.length === 0;
    // "Needs you" first, then the rest by day.
    const groups: Array<{ label: string; items: InboxConversation[] }> = [];
    if (view === "all" && waiting.length) groups.push({ label: "Needs you", items: waiting });
    for (const conversation of view === "all" ? conversations.filter((item) => !needsYou(item)) : conversations) {
        const label = dayOf(conversation.updated_at);
        const group = groups.find((item) => item.label === label);
        if (group) group.items.push(conversation);
        else groups.push({ label, items: [conversation] });
    }
    const count = (id: View_) => {
        const value = id === "needs" ? waiting.length : id === "unread" ? unreadCount : 0;
        return value && view !== id ? ` · ${value > 9 ? "9+" : value}` : "";
    };

    return (
        <Page
            fill={empty}
            onRefresh={() => inbox.refetch()}
            header={
                <>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <PageTitle>Inbox</PageTitle>
                        {/* Where the chats came from: rarely needed, so tucked away. */}
                        <Pressable ref={filterButton} onPress={() => measureAnchor(filterButton.current, "right", setMenu)} accessibilityLabel="Filter by channel" style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.muted }}>
                            <Icon name="tuning:linear" size={20} color={colors.foreground} />
                            {channel ? <View style={{ position: "absolute", right: 6, top: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: palette.emerald500 }} /> : null}
                        </Pressable>
                    </View>
                    <Switcher value={view} onChange={setView} options={[
                        { id: "all", label: "All" },
                        { id: "needs", label: `Needs you${count("needs")}` },
                        { id: "unread", label: `Unread${count("unread")}` },
                    ]} />
                    {channel ? (
                        <Pressable onPress={() => setChannel(null)} style={{ marginTop: 8, alignSelf: "flex-start", height: 32, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, backgroundColor: colors.muted, paddingHorizontal: 12 }}>
                            <T size={13}>{CHANNEL_LABEL[channel]} only</T>
                            <T size={13} muted>✕</T>
                        </Pressable>
                    ) : null}
                </>
            }
        >
            {inbox.isPending ? (
                <View style={{ marginTop: 16, gap: 16 }}>
                    {[0, 1, 2, 3, 4].map((index) => (
                        <View key={index} style={{ flexDirection: "row", gap: 12 }}>
                            <Skeleton width={44} height={44} radius={22} />
                            <View style={{ flex: 1, gap: 8, paddingTop: 4 }}><Skeleton width={128} height={16} /><Skeleton height={14} /></View>
                        </View>
                    ))}
                </View>
            ) : !inbox.data ? (
                <LoadError error={inbox.error} fallback="Couldn't load your chats." onRetry={() => void inbox.refetch()} />
            ) : conversations.length === 0 ? (
                view === "needs" ? <EmptyCard icon="chat-round-check" title="Nothing needs you" description="Your employee is handling every chat." />
                    : view === "unread" ? <EmptyCard icon="chat-round-check" title="All caught up" description="No unread chats." />
                        : <EmptyCard icon="chat-round-dots" title={channel ? `No ${CHANNEL_LABEL[channel]} chats yet` : "No chats yet"} description="When customers message your employee, the conversations show up here." />
            ) : (
                <View style={{ marginTop: 8 }}>
                    {groups.map((group, groupIndex) => (
                        <View key={group.label} style={{ marginTop: groupIndex === 0 ? 12 : 20 }}>
                            <Caps style={{ marginBottom: 4, paddingHorizontal: 4 }}>{group.label}</Caps>
                            <View style={{ marginHorizontal: -16 }}>
                                {group.items.map((conversation, index) => (
                                    <ChatRow key={conversation.id} conversation={conversation} first={index === 0} onHold={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setHeld(conversation); }} />
                                ))}
                            </View>
                        </View>
                    ))}
                </View>
            )}

            <Menu open={!!menu} anchor={menu} onClose={() => setMenu(null)}>
                {CHANNELS.map((item) => (
                    <MenuItem key={item ?? "all"} label={item ? CHANNEL_LABEL[item] : "Every channel"} checked={channel === item} onPress={() => { setChannel(item); setMenu(null); }} />
                ))}
            </Menu>

            {/* Long-press a chat for "Mark as read / unread", the way phones do it. */}
            <BottomSheet open={!!held} onClose={() => setHeld(null)}>
                <T weight="600" lines={1} style={{ paddingHorizontal: 4 }}>{held ? conversationTitle(held) : ""}</T>
                <Button kind="muted" title={held?.unread ? "Mark as read" : "Mark as unread"} onPress={() => { if (held) markRead.mutate({ id: held.id, read: held.unread }); setHeld(null); }} style={{ marginTop: 12, borderRadius: 16 }} />
            </BottomSheet>
        </Page>
    );
}

/** One chat in the list. Lines between chats start where the text does, as phones' chat lists have them. */
function ChatRow({ conversation, first, onHold }: { conversation: InboxConversation; first: boolean; onHold: () => void }) {
    const colors = useColors();
    const flagged = conversation.owner_active || conversation.needs_owner;
    const unreadColor = colors.scheme === "dark" ? palette.emerald400 : palette.emerald600;
    return (
        <Pressable
            onPress={() => router.push(`/conversation/${conversation.id}`)}
            onLongPress={onHold}
            delayLongPress={500}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: pressed ? alpha(colors.muted, 0.6) : "transparent" })}
        >
            {first ? null : <View style={{ position: "absolute", top: 0, left: 68, right: 0, height: 1, backgroundColor: alpha(colors.border, 0.5) }} />}
            <ConversationAvatar conversation={conversation} />
            <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                    <T weight={conversation.unread ? "700" : "500"} lines={1} style={{ flex: 1 }}>{conversationTitle(conversation)}</T>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <T size={12} weight={conversation.unread ? "600" : "500"} color={conversation.unread ? unreadColor : colors.mutedForeground}>{shortTime(conversation.updated_at)}</T>
                        {conversation.unread ? <View accessibilityLabel="Unread" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: unreadColor }} /> : null}
                    </View>
                </View>
                <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {flagged ? <Tag tone="amber" label={conversation.owner_active ? "You're replying" : needsOwnerLabel(conversation.needs_owner!.reason)} /> : null}
                    <T size={13} lines={1} color={conversation.unread ? colors.foreground : colors.mutedForeground} style={{ flex: 1 }}>
                        {conversation.last_from === "owner" ? "You: " : ""}{conversation.last_message ?? "No messages yet"}
                    </T>
                </View>
            </View>
        </Pressable>
    );
}
