import { useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useConversation, useConversationAction, useMarkRead } from "@/lib/queries";
import { useWorkspace } from "@/lib/workspace";
import { CHANNEL_LABEL, conversationTitle } from "@/lib/format";
import type { InboxMessage } from "@/lib/types";
import { Icon } from "@/ui/icons";
import { Markdown } from "@/ui/markdown";
import { Button, ConversationAvatar, ErrorText, IconButton, LoadError, Skeleton, T } from "@/ui/kit";
import { alpha, fonts, palette, useColors } from "@/ui/theme";

function dayLabel(iso: string): string {
    const date = new Date(iso);
    const yesterday = new Date(Date.now() - 86_400_000);
    if (date.toDateString() === new Date().toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** One conversation: the customer on the left, the assistant on the right (cencori components/studio/views/ConversationView.tsx). */
export default function Conversation() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const { workspace } = useWorkspace();
    const query = useConversation(id);
    const act = useConversationAction(id);
    const markRead = useMarkRead();
    const [draft, setDraft] = useState("");
    const conversation = query.data?.conversation;
    const messages = query.data?.messages ?? [];
    const reply = query.data?.reply;
    const darkMode = colors.scheme === "dark";

    // Opening the chat read it: the list and the tab badge catch up.
    const read = useRef(false);
    useEffect(() => {
        if (!conversation || read.current) return;
        read.current = true;
        if (conversation.unread) markRead.mutate({ id, read: true });
        else void queryClient.invalidateQueries({ queryKey: ["inbox", workspace.project.id] });
    }, [conversation, id, markRead, queryClient, workspace.project.id]);

    const keepUnread = () => markRead.mutate({ id, read: false }, { onSuccess: () => router.back() });
    const send = () => {
        const text = draft.trim();
        if (!text || act.isPending) return;
        act.mutate({ action: "reply", text }, { onSuccess: () => setDraft("") });
    };
    const border = alpha(colors.border, 0.6);
    // Newest at the bottom: the list is drawn upside down.
    const items = [...messages].reverse();

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: border, paddingHorizontal: 12, paddingBottom: 12, paddingTop: insets.top + 12 }}>
                <IconButton name="chevron-left:lucide" label="Back to Inbox" onPress={() => router.back()} />
                {conversation ? (
                    <>
                        <ConversationAvatar conversation={conversation} size={40} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <T size={16} weight="600" lines={1}>{conversationTitle(conversation)}</T>
                            <T size={12} muted lines={1}>{CHANNEL_LABEL[conversation.channel]}{conversation.number && conversation.number !== conversation.name ? ` · ${conversation.number}` : ""}</T>
                        </View>
                        <IconButton name="mail-warning:lucide" label="Mark as unread" color={colors.mutedForeground} disabled={markRead.isPending} onPress={keepUnread} />
                    </>
                ) : (
                    <View style={{ flex: 1, gap: 6 }}><Skeleton width={128} height={16} /><Skeleton width={96} height={12} /></View>
                )}
            </View>

            {conversation && (conversation.owner_active || conversation.needs_owner) ? (
                <View style={{ backgroundColor: darkMode ? alpha(palette.orange500, 0.1) : palette.orange50, paddingHorizontal: 16, paddingVertical: 10 }}>
                    <T size={13} leading={20} color={darkMode ? "#fdba74" : "#9a3412"}>
                        {conversation.owner_active ? "You're replying. Your employee is paused in this chat." : <><T size={13} weight="600" color={darkMode ? "#fed7aa" : "#7c2d12"}>Needs you:</T> {conversation.needs_owner!.reason}</>}
                    </T>
                </View>
            ) : null}

            {query.isLoading ? (
                <View style={{ flex: 1, padding: 16, gap: 12 }}>
                    <Skeleton width="75%" height={48} radius={16} />
                    <Skeleton width="80%" height={80} radius={16} style={{ alignSelf: "flex-end" }} />
                </View>
            ) : !query.data ? (
                <View style={{ flex: 1, padding: 16 }}><LoadError error={query.error} fallback="Couldn't load this chat." onRetry={() => void query.refetch()} style={{ marginTop: 0 }} /></View>
            ) : messages.length === 0 ? (
                <View style={{ flex: 1, padding: 16 }}><T size={14} muted>No messages yet.</T></View>
            ) : (
                <FlatList
                    inverted
                    data={items}
                    keyExtractor={(message) => message.id}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, gap: 10 }}
                    renderItem={({ item, index }) => <Bubble message={item} newDay={index === items.length - 1 || dayLabel(items[index + 1].at) !== dayLabel(item.at)} />}
                />
            )}

            <View style={{ borderTopWidth: 1, borderTopColor: border, backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 16 }}>
                {act.error ? <ErrorText style={{ marginBottom: 8 }}>{act.error.message}</ErrorText> : null}
                {!conversation || !reply ? null : reply.reason === "website" ? (
                    <T size={13} leading={20} muted>Your employee is handling this chat. Replying yourself works on WhatsApp, website and link chats.</T>
                ) : conversation.owner_active ? (
                    <>
                        {reply.possible ? (
                            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                                <View style={{ flex: 1, minHeight: 48, justifyContent: "center", borderRadius: 24, backgroundColor: colors.muted, paddingHorizontal: 16, paddingVertical: 8 }}>
                                    <TextInput
                                        value={draft}
                                        onChangeText={setDraft}
                                        multiline
                                        placeholder={`Message ${conversation.name}…`}
                                        placeholderTextColor={colors.mutedForeground}
                                        accessibilityLabel={`Message ${conversation.name}`}
                                        style={{ maxHeight: 128, fontFamily: fonts["500"], fontSize: 15, lineHeight: 22, color: colors.foreground, paddingVertical: 4 }}
                                    />
                                </View>
                                <Pressable onPress={send} disabled={!draft.trim() || act.isPending} accessibilityLabel="Send" style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.foreground, opacity: !draft.trim() || act.isPending ? 0.4 : 1 }}>
                                    <Icon name="arrow-up:lucide" size={20} color={colors.background} />
                                </Pressable>
                            </View>
                        ) : (
                            <T size={13} leading={20} muted>WhatsApp only lets businesses reply within 24 hours of the customer&apos;s last message. Call them, or wait for them to message again.</T>
                        )}
                        {reply.possible && conversation.channel !== "whatsapp" ? <T size={12} leading={16} muted style={{ marginTop: 8 }}>They&apos;ll see your messages while the chat is open on their screen.</T> : null}
                        <Button kind="outline" height={44} size={14} title="Hand back to your employee" disabled={act.isPending} onPress={() => act.mutate({ action: "hand_back" })} style={{ marginTop: 8 }} />
                    </>
                ) : (
                    <>
                        <T size={13} leading={20} muted style={{ marginBottom: 10 }}>
                            {conversation.needs_owner ? "Your employee is waiting for you." : "Your employee is handling this chat."} Step in to reply yourself; it pauses here until you hand back, or 30 minutes after your last message.
                        </T>
                        <Button title="Step in and reply" disabled={act.isPending} onPress={() => act.mutate({ action: "step_in" })} />
                    </>
                )}
            </View>
        </KeyboardAvoidingView>
    );
}

/** A message: the customer's on the left; yours and the assistant's on the right, with who and when under them. */
function Bubble({ message, newDay }: { message: InboxMessage; newDay: boolean }) {
    const colors = useColors();
    const darkMode = colors.scheme === "dark";
    const day = newDay ? <T size={12} muted center style={{ marginVertical: 8 }}>{dayLabel(message.at)}</T> : null;
    if (message.from === "customer") {
        return (
            <View>
                {day}
                <View style={{ maxWidth: "82%", alignSelf: "flex-start", borderRadius: 16, borderBottomLeftRadius: 6, backgroundColor: colors.muted, paddingHorizontal: 14, paddingVertical: 10 }}>
                    <T leading={24}>{message.text}</T>
                </View>
            </View>
        );
    }
    const owner = message.from === "owner";
    return (
        <View>
            {day}
            <View style={{ maxWidth: "85%", alignSelf: "flex-end" }}>
                <View style={{ borderRadius: 16, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: owner ? colors.foreground : darkMode ? alpha(palette.violet500, 0.15) : "#f5f3ff" }}>
                    {owner ? <T leading={24} color={colors.background}>{message.text}</T> : <Markdown content={message.text} />}
                </View>
                <T size={11} muted style={{ marginRight: 4, marginTop: 4, textAlign: "right" }}>{owner ? "You" : "Your employee"} · {clock(message.at)}</T>
            </View>
        </View>
    );
}
