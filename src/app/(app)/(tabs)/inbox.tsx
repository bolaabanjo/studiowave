import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useInbox } from "@/lib/queries";
import { CHANNEL_LABEL, conversationTitle, initials, needsOwnerLabel, shortTime } from "@/lib/format";
import type { InboxChannel } from "@/lib/types";
import { Avatar, Body, Card, Empty, LoadError, Loading, Page, Segmented } from "@/ui/kit";
import { useColors } from "@/ui/theme";

type Filter = "all" | InboxChannel;

/** Every chat the assistant is having, newest first; the ones that need you say so. */
export default function Inbox() {
    const colors = useColors();
    const inbox = useInbox();
    const [filter, setFilter] = useState<Filter>("all");
    const conversations = (inbox.data?.conversations ?? []).filter((conversation) => filter === "all" || conversation.channel === filter);

    return (
        <Page title="Inbox" refreshing={inbox.isRefetching} onRefresh={() => void inbox.refetch()}>
            <Segmented<Filter> value={filter} onChange={setFilter} options={[{ id: "all", label: "All" }, { id: "whatsapp", label: "WhatsApp" }, { id: "website", label: "Website" }, { id: "link", label: "Link" }]} />
            <View style={{ marginTop: 16, gap: 8 }}>
                {inbox.isPending ? <Loading /> : inbox.isError && !inbox.data ? <LoadError error={inbox.error} onRetry={() => void inbox.refetch()} /> : conversations.length === 0 ? (
                    <Empty title="No chats yet" body="When customers message your assistant, the chats show up here." />
                ) : conversations.map((conversation) => (
                    <Card key={conversation.id} onPress={() => router.push(`/conversation/${conversation.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <Avatar text={initials(conversationTitle(conversation))} />
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <View style={{ flex: 1 }}><Body weight={conversation.unread ? "700" : "600"} lines={1}>{conversationTitle(conversation)}</Body></View>
                                <Body muted size={12}>{shortTime(conversation.updated_at)}</Body>
                            </View>
                            <Body muted size={13} lines={1}>
                                {conversation.needs_owner && conversation.open
                                    ? `${needsOwnerLabel(conversation.needs_owner.reason)} · ${CHANNEL_LABEL[conversation.channel]}`
                                    : `${conversation.last_from === "owner" ? "You: " : ""}${conversation.last_message ?? CHANNEL_LABEL[conversation.channel]}`}
                            </Body>
                        </View>
                        {conversation.unread ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.foreground }} /> : null}
                    </Card>
                ))}
            </View>
        </Page>
    );
}
