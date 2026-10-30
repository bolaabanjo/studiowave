import { useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConversation, useConversationAction } from "@/lib/queries";
import { CHANNEL_LABEL, conversationTitle, needsOwnerLabel, shortTime } from "@/lib/format";
import type { InboxMessage } from "@/lib/types";
import { Body, Button, LoadError, Loading } from "@/ui/kit";
import { useColors } from "@/ui/theme";

/** One chat: every message, and the owner stepping in, replying, and handing it back. */
export default function Conversation() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const conversation = useConversation(id);
    const act = useConversationAction(id);
    const [text, setText] = useState("");
    const [error, setError] = useState<string | null>(null);
    const markedRead = useRef(false);

    const data = conversation.data;
    // Opening it reads it.
    useEffect(() => {
        if (data?.conversation.unread && !markedRead.current) {
            markedRead.current = true;
            act.mutate({ action: "mark_read" });
        }
    }, [data?.conversation.unread, act]);

    const run = (input: Parameters<typeof act.mutate>[0], done?: () => void) => {
        setError(null);
        act.mutate(input, { onSuccess: done, onError: (cause) => setError(cause instanceof Error ? cause.message : "That didn't work. Try again.") });
    };

    const messages = [...(data?.messages ?? [])].reverse();
    const stepped = !!data?.conversation.owner_active;

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
                <Pressable onPress={() => router.back()} hitSlop={12} style={{ paddingRight: 8 }}>
                    <Text style={{ color: colors.foreground, fontSize: 28, lineHeight: 30 }}>‹</Text>
                </Pressable>
                <View style={{ flex: 1 }}>
                    <Body weight="600" lines={1}>{data ? conversationTitle(data.conversation) : ""}</Body>
                    <Body muted size={12} lines={1}>
                        {data ? [CHANNEL_LABEL[data.conversation.channel], data.conversation.number, stepped ? "You're replying" : "Assistant is replying"].filter(Boolean).join(" · ") : ""}
                    </Body>
                </View>
                {data ? (
                    <Button small kind="secondary" title={stepped ? "Hand back" : "Step in"} busy={act.isPending && (act.variables?.action === "step_in" || act.variables?.action === "hand_back")} onPress={() => run({ action: stepped ? "hand_back" : "step_in" })} />
                ) : null}
            </View>

            {conversation.isPending ? <Loading /> : !data ? <View style={{ padding: 16 }}><LoadError error={conversation.error} onRetry={() => void conversation.refetch()} /></View> : (
                <>
                    {data.conversation.needs_owner && data.conversation.open ? (
                        <View style={{ margin: 12, marginBottom: 0, padding: 12, borderRadius: 14, backgroundColor: colors.warningBackground }}>
                            <Body weight="600" size={14}>{needsOwnerLabel(data.conversation.needs_owner.reason)}</Body>
                            <Body size={13}>{data.conversation.needs_owner.reason}</Body>
                        </View>
                    ) : null}
                    <FlatList
                        inverted
                        data={messages}
                        keyExtractor={(message) => message.id}
                        contentContainerStyle={{ padding: 12, gap: 6 }}
                        renderItem={({ item }) => <Bubble message={item} />}
                    />
                </>
            )}

            {data ? (
                <View style={[styles.composer, { paddingBottom: insets.bottom + 8, borderTopColor: colors.border }]}>
                    {data.reply.possible ? (
                        <>
                            <TextInput
                                value={text}
                                onChangeText={setText}
                                placeholder={stepped ? "Reply as you" : "Reply as you (pauses the assistant)"}
                                placeholderTextColor={colors.mutedForeground}
                                multiline
                                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground }]}
                            />
                            <Button small title="Send" disabled={!text.trim()} busy={act.isPending && act.variables?.action === "reply"} onPress={() => run({ action: "reply", text: text.trim() }, () => setText(""))} />
                        </>
                    ) : (
                        <Body muted size={13}>
                            {data.reply.reason === "window" ? "WhatsApp only lets you reply within 24 hours of their last message." : "You can't reply to this chat from here."}
                        </Body>
                    )}
                </View>
            ) : null}
            {error ? <Text style={{ color: colors.danger, fontSize: 13, paddingHorizontal: 16, paddingBottom: insets.bottom + 8 }}>{error}</Text> : null}
        </KeyboardAvoidingView>
    );
}

function Bubble({ message }: { message: InboxMessage }) {
    const colors = useColors();
    const mine = message.from !== "customer";
    const owner = message.from === "owner";
    return (
        <View style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%" }}>
            <View style={{ borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: owner ? colors.accent : colors.muted }}>
                <Text style={{ color: owner ? colors.onAccent : colors.foreground, fontSize: 15, lineHeight: 21 }}>{message.text}</Text>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2, alignSelf: mine ? "flex-end" : "flex-start" }}>
                {`${message.from === "assistant" ? "Assistant · " : owner ? "You · " : ""}${shortTime(message.at)}`}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
    composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
    input: { flex: 1, minHeight: 40, maxHeight: 120, borderRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontSize: 15 },
});
