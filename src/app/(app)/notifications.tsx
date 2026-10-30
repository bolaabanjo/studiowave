import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInbox } from "@/lib/queries";
import { usePushState } from "@/lib/push";
import { useWorkspace } from "@/lib/workspace";
import { shortTime } from "@/lib/format";
import { Icon } from "@/ui/icons";
import { Button, T } from "@/ui/kit";
import { alpha, palette, useColors } from "@/ui/theme";

/**
 * The bell's sheet (cencori components/studio/StudioNotificationBell.tsx):
 * turning notifications on, first, if they're off; then the chats waiting on
 * the owner. Tapping one opens the chat.
 */
export default function Notifications() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const { workspace } = useWorkspace();
    const push = usePushState(workspace.project.id);
    const waiting = (useInbox().data?.conversations ?? []).filter((conversation) => conversation.needs_owner || conversation.owner_active);
    const darkMode = colors.scheme === "dark";
    const orangeLine = darkMode ? alpha(palette.orange500, 0.2) : palette.orange200;
    return (
        <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 24 }}>
            <View style={{ alignItems: "center" }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: alpha(colors.mutedForeground, 0.3) }} /></View>
            <T weight="600" center style={{ marginTop: 12 }}>Notifications</T>
            <View style={{ marginTop: 16 }}>
                {/* Notifications off on this phone: the way to turn them on comes first. */}
                {push.state === "off" || push.state === "denied" ? (
                    <View style={{ marginBottom: 16, flexDirection: "row", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: alpha(colors.border, 0.6), paddingVertical: 14, paddingLeft: 16, paddingRight: 40 }}>
                        <View style={{ marginTop: 2 }}><Icon name="bell-ring:lucide" size={20} color={colors.foreground} /></View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <T weight="600">Never miss a customer</T>
                            {push.state === "denied" ? (
                                <T size={13} leading={20} muted style={{ marginTop: 4 }}>Notifications are blocked for Studio. Allow them in your phone&apos;s Settings to hear when someone needs you.</T>
                            ) : (
                                <>
                                    <T size={13} leading={20} muted style={{ marginTop: 4 }}>Get a notification when a customer needs you, books or pays.</T>
                                    <Button height={36} size={14} title={push.busy ? "Turning on…" : "Turn on notifications"} disabled={push.busy} onPress={() => void push.turnOn()} style={{ marginTop: 12, alignSelf: "flex-start" }} />
                                </>
                            )}
                            {push.error ? <T size={13} color={colors.destructive} style={{ marginTop: 8 }}>{push.error}</T> : null}
                        </View>
                    </View>
                ) : null}
                {waiting.length === 0 ? (
                    <View style={{ alignItems: "center", borderRadius: 24, backgroundColor: colors.card, paddingHorizontal: 24, paddingVertical: 40 }}>
                        <View style={{ marginBottom: 8 }}><Icon name="chat-round-check" size={36} color={colors.foreground} /></View>
                        <T weight="600">You&apos;re all caught up</T>
                        <T size={14} leading={24} muted center style={{ marginTop: 4 }}>Your assistant is handling every chat.</T>
                    </View>
                ) : (
                    <>
                        <T weight="600" style={{ marginBottom: 8 }}>Needs you</T>
                        <View style={{ overflow: "hidden", borderRadius: 16, borderWidth: 1, borderColor: orangeLine, backgroundColor: darkMode ? alpha(palette.orange500, 0.05) : alpha(palette.orange50, 0.6) }}>
                            {waiting.map((conversation, index) => (
                                <Pressable
                                    key={conversation.id}
                                    onPress={() => { router.back(); router.push(`/conversation/${conversation.id}`); }}
                                    style={({ pressed }) => ({ flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: index ? 1 : 0, borderTopColor: orangeLine, opacity: pressed ? 0.7 : 1 })}
                                >
                                    <View style={{ marginTop: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: palette.orange600 }} />
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                                            <T weight="600" lines={1} style={{ flex: 1 }}>{conversation.name}</T>
                                            <T size={12} muted>{shortTime(conversation.needs_owner?.at ?? conversation.updated_at)}</T>
                                        </View>
                                        <T size={13} leading={20} lines={2} color={alpha(colors.foreground, 0.8)} style={{ marginTop: 2 }}>
                                            {conversation.owner_active ? "You're replying in this chat." : conversation.needs_owner?.reason}
                                        </T>
                                    </View>
                                </Pressable>
                            ))}
                        </View>
                    </>
                )}
            </View>
        </ScrollView>
    );
}
