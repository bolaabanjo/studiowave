import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { goBack } from "@/lib/navigation";
import { useClient, useClientNote } from "@/lib/queries";
import { formatMoney } from "@/lib/format";
import { useBusinessTimeZone } from "@/lib/time-zone";
import { clockLabel, dayKey, longDay } from "@/lib/schedule-time";
import { Icon } from "@/ui/icons";
import { Button, Caps, ErrorText, Field, LoadError, PersonAvatar, SheetHeader, Skeleton, T, Tag, useSheetTop } from "@/ui/kit";
import { alpha, useColors } from "@/ui/theme";

const STATUS: Record<string, string> = { done: "came", no_show: "didn't come", cancelled: "cancelled", confirmed: "booked", held: "waiting for deposit" };

/** One client: visits, what's coming up, what they've bought and spent, and your notes, which your employee sees when they write (cencori lib/studio/clients.ts). */
export default function Client() {
    const { phone } = useLocalSearchParams<{ phone: string }>();
    const number = decodeURIComponent(phone ?? "");
    const colors = useColors();
    const top = useSheetTop();
    const timeZone = useBusinessTimeZone() ?? "Africa/Lagos";
    const query = useClient(number);
    const note = useClientNote(number);
    const [draft, setDraft] = useState("");
    const card = query.data?.client;
    const when = (iso: string | null) => (iso ? `${longDay(dayKey(timeZone, new Date(iso)))}, ${clockLabel(timeZone, iso)}` : "No time");
    const notFound = (query.error as { status?: number } | null)?.status === 404;

    const add = () => {
        const text = draft.trim();
        if (!text) return;
        note.mutate({ add: text }, { onSuccess: () => setDraft("") });
    };

    return (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: top, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }}>
            <SheetHeader title="Client" onClose={() => goBack()} />
            {query.isLoading ? (
                <View style={{ marginTop: 16, gap: 12 }}><Skeleton height={64} radius={16} /><Skeleton height={120} radius={16} /></View>
            ) : notFound ? (
                <T muted style={{ marginTop: 16 }}>No history with {number} yet. Once they book, order or chat, it shows here.</T>
            ) : !card ? (
                <LoadError error={query.error} fallback="Couldn't load this client." onRetry={() => void query.refetch()} />
            ) : (
                <>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }}>
                        <PersonAvatar name={card.name ?? card.phone} size={52} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <T size={20} weight="600" lines={1}>{card.name ?? card.phone}</T>
                            <T size={13} muted>{card.phone}{card.first_seen ? ` · since ${new Date(card.first_seen).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}` : ""}</T>
                        </View>
                    </View>

                    <View style={{ flexDirection: "row", gap: 8, marginTop: 20 }}>
                        <Stat label="Visits" value={String(card.visits)} />
                        <Stat label="Spent" value={formatMoney(card.spent.amount, card.spent.currency)} />
                        <Stat label="Missed" value={String(card.no_shows)} />
                    </View>

                    {card.upcoming.length ? (
                        <>
                            <Caps style={{ marginTop: 28, marginBottom: 10 }}>Coming up</Caps>
                            {card.upcoming.map((item) => (
                                <View key={item.id} style={{ borderRadius: 16, backgroundColor: colors.muted, padding: 14, marginBottom: 8 }}>
                                    <T weight="600">{item.service ?? "Appointment"}</T>
                                    <T size={13} muted>{when(item.starts_at)}</T>
                                    <View style={{ flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                                        <Tag round tone={item.status === "held" ? "wait" : "good"} label={item.status === "held" ? "Waiting for deposit" : item.customer_confirmed ? "Confirmed by client" : "Booked"} />
                                        {item.deposit_paid ? <Tag round tone="good" label="Deposit paid" /> : null}
                                    </View>
                                </View>
                            ))}
                        </>
                    ) : null}

                    <Caps style={{ marginTop: 28, marginBottom: 10 }}>Notes</Caps>
                    <T size={13} leading={20} muted style={{ marginBottom: 10 }}>Your employee sees these when {card.name?.split(" ")[0] ?? "they"} writes, and uses them.</T>
                    {card.notes.map((item) => (
                        <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, backgroundColor: colors.muted, paddingLeft: 14, paddingRight: 6, paddingVertical: 8, marginBottom: 6 }}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <T leading={22}>{item.text}</T>
                                <T size={12} muted>{item.by === "employee" ? "Noted by your employee" : "Your note"}</T>
                            </View>
                            <Pressable onPress={() => note.mutate({ remove: item.id })} disabled={note.isPending} accessibilityLabel="Remove the note" hitSlop={8} style={{ padding: 8 }}>
                                <Icon name="x:lucide" size={16} color={colors.mutedForeground} />
                            </Pressable>
                        </View>
                    ))}
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 4 }}>
                        <Field value={draft} onChangeText={setDraft} placeholder="e.g. Prefers medium knotless" style={{ flex: 1 }} onSubmitEditing={add} returnKeyType="done" />
                        <Button height={48} title="Add" disabled={!draft.trim()} busy={note.isPending} onPress={add} />
                    </View>
                    {note.error ? <ErrorText style={{ marginTop: 8 }}>{note.error.message}</ErrorText> : null}

                    {card.recent.length ? (
                        <>
                            <Caps style={{ marginTop: 28, marginBottom: 10 }}>Recent visits</Caps>
                            <View style={{ borderRadius: 16, backgroundColor: colors.muted }}>
                                {card.recent.map((item, index) => (
                                    <View key={`${item.starts_at}-${index}`} style={{ paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: index ? 1 : 0, borderTopColor: alpha(colors.border, 0.4) }}>
                                        <T>{item.service ?? "Appointment"} <T size={13} muted>· {STATUS[item.status] ?? item.status}</T></T>
                                        <T size={13} muted>{when(item.starts_at)}</T>
                                    </View>
                                ))}
                            </View>
                        </>
                    ) : null}

                    {card.orders.length ? (
                        <>
                            <Caps style={{ marginTop: 28, marginBottom: 10 }}>Orders</Caps>
                            <View style={{ borderRadius: 16, backgroundColor: colors.muted }}>
                                {card.orders.map((order, index) => (
                                    <View key={order.id} style={{ flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: index ? 1 : 0, borderTopColor: alpha(colors.border, 0.4) }}>
                                        <T size={14} lines={2} style={{ flex: 1 }}>{order.summary}</T>
                                        <T size={14} weight="600">{formatMoney(order.total, order.currency)}</T>
                                    </View>
                                ))}
                            </View>
                        </>
                    ) : null}

                    {card.chats[0] ? <Button kind="outline" title="Open their chat" onPress={() => { goBack(); router.push(`/conversation/${card.chats[0]}`); }} style={{ marginTop: 28 }} /> : null}
                </>
            )}
        </ScrollView>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    const colors = useColors();
    return (
        <View style={{ flex: 1, borderRadius: 16, backgroundColor: colors.muted, paddingHorizontal: 12, paddingVertical: 12 }}>
            <T size={12} muted>{label}</T>
            <T size={17} weight="600" lines={1} style={{ marginTop: 2 }}>{value}</T>
        </View>
    );
}
