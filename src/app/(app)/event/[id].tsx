import { useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Share, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useApi } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { useEvent } from "@/lib/queries";
import { useWorkspace } from "@/lib/workspace";
import { useTasks } from "@/lib/tasks";
import { eventWhen, formatMoney } from "@/lib/format";
import type { StudioGuest } from "@/lib/types";
import { Icon } from "@/ui/icons";
import { Button, Caps, ErrorText, IconButton, LoadError, Sheet, SheetHeader, Skeleton, Spinner, T, Tag } from "@/ui/kit";
import { alpha, palette, useColors } from "@/ui/theme";

/** Guests shown at a time on an event's page. */
const GUESTS_PER_PAGE = 10;

/** ₦2,465,000 → ₦2.47m, so the number fits a third of the card. */
function shortMoney(amount: number, currency: string): string {
    if (currency !== "NGN") return formatMoney(amount, currency);
    if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}m`;
    if (amount >= 10_000) return `₦${Math.round(amount / 1_000)}k`;
    return formatMoney(amount, currency);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return <View style={{ marginTop: 36 }}><Caps style={{ marginBottom: 12 }}>{title}</Caps>{children}</View>;
}

/** One event: how it's selling, the link to share, the guest list, and check-in at the door (cencori components/studio/views/EventsView.tsx). */
export default function Event() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const api = useApi();
    const queryClient = useQueryClient();
    const tasks = useTasks();
    const projectId = useWorkspace().workspace.project.id;
    const query = useEvent(id);
    const [checking, setChecking] = useState(false);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const summary = query.data?.event;
    const guests = query.data?.guests ?? [];
    const card = colors.card;
    const line = colors.divider;

    const setStatus = async (status: "live" | "closed") => {
        setBusy(true);
        setError(null);
        try {
            await api("/api/studio/events", { method: "POST", body: { project_id: projectId, action: "update", event_id: id, status } });
            await Promise.all([queryClient.invalidateQueries({ queryKey: ["event", projectId, id] }), queryClient.invalidateQueries({ queryKey: ["events", projectId] })]);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't change it.");
        } finally {
            setBusy(false);
        }
    };

    const shown = search.trim() ? guests.filter((guest) => `${guest.buyer_name} ${guest.code} ${guest.buyer_phone ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())) : guests;
    const pages = Math.max(1, Math.ceil(shown.length / GUESTS_PER_PAGE));
    const current = Math.min(page, pages - 1);

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Back and Edit stay put while the page scrolls under them. */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: insets.top + 20, paddingBottom: 8 }}>
                <View style={{ marginLeft: -8 }}><IconButton name="chevron-left:lucide" label="Back to Events" onPress={() => router.back()} /></View>
                {summary ? <Button kind="outline" height={36} size={13} title="Edit" onPress={() => tasks.open("event", { eventId: id })} /> : null}
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
                {query.isLoading ? (
                    <View style={{ marginTop: 12, gap: 12 }}><Skeleton width={192} height={32} /><Skeleton height={112} radius={16} /><Skeleton height={160} radius={16} /></View>
                ) : !summary ? (
                    <LoadError error={query.error} fallback="Couldn't load this event." onRetry={() => void query.refetch()} />
                ) : (
                    <>
                        {summary.event.banner_url ? <Image source={{ uri: summary.event.banner_url }} style={{ marginTop: 8, width: "100%", height: 288, borderRadius: 16 }} contentFit="cover" contentPosition="top" /> : null}
                        <T size={26} weight="600" leading={32} style={{ marginTop: 16, letterSpacing: -0.65 }}>{summary.event.name}</T>
                        <View style={{ marginTop: 16, gap: 10 }}>
                            {summary.event.venue ? <View style={{ flexDirection: "row", gap: 12 }}><View style={{ marginTop: 2 }}><Icon name="map-point:linear" size={20} color={colors.mutedForeground} /></View><T leading={24} style={{ flex: 1 }}>{summary.event.venue}</T></View> : null}
                            <View style={{ flexDirection: "row", gap: 12 }}><View style={{ marginTop: 2 }}><Icon name="calendar:linear" size={20} color={colors.mutedForeground} /></View><T leading={24}>{eventWhen(summary.event.starts_at)}</T></View>
                        </View>

                        <View style={{ marginTop: 24, flexDirection: "row", overflow: "hidden", borderRadius: 16, backgroundColor: card }}>
                            {[
                                { label: "Sold", value: String(summary.sold), of: summary.capacity ? `/ ${summary.capacity}` : null },
                                { label: "Earned", value: shortMoney(summary.earned, summary.event.currency), of: null },
                                { label: "Checked in", value: String(summary.checked_in), of: summary.sold ? `/ ${summary.sold}` : null },
                            ].map((stat, index) => (
                                <View key={stat.label} style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 14, borderLeftWidth: index ? 1 : 0, borderLeftColor: line }}>
                                    <T size={12} muted>{stat.label}</T>
                                    <T size={20} weight="600" leading={22} lines={1} style={{ marginTop: 4, letterSpacing: -0.5 }}>{stat.value}{stat.of ? <T size={13} weight="400" muted> {stat.of}</T> : null}</T>
                                </View>
                            ))}
                        </View>

                        <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
                            <Button grow title="Check in" onPress={() => setChecking(true)} />
                            <Button grow kind="outline" title="Share link" icon={<Icon name="share-2:lucide" size={16} color={colors.foreground} />} onPress={() => { const url = `${API_URL}/e/${summary.event.slug}`; void Share.share({ title: summary.event.name, message: url, url }).catch(() => undefined); }} />
                        </View>

                        <Section title="Tickets">
                            <View style={{ overflow: "hidden", borderRadius: 16, backgroundColor: card }}>
                                {summary.by_tier.map((tier, index) => (
                                    <View key={tier.id} style={{ paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: index ? 1 : 0, borderTopColor: line }}>
                                        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                                            <T lines={1} style={{ flex: 1 }}>{tier.name} <T muted>· {tier.price ? formatMoney(tier.price, summary.event.currency) : "Free"}</T></T>
                                            <T weight="600">{tier.sold}{tier.capacity ? <T weight="400" muted> / {tier.capacity}</T> : null}</T>
                                        </View>
                                        {tier.capacity ? (
                                            <View style={{ marginTop: 10, height: 4, overflow: "hidden", borderRadius: 2, backgroundColor: alpha(colors.foreground, 0.1) }}>
                                                <View style={{ height: "100%", borderRadius: 2, backgroundColor: colors.foreground, width: `${Math.min(100, Math.round((tier.sold / tier.capacity) * 100))}%` }} />
                                            </View>
                                        ) : null}
                                    </View>
                                ))}
                            </View>
                        </Section>

                        <Section title={`Guests · ${guests.length}`}>
                            {guests.length > 0 ? (
                                <>
                                    <TextInput value={search} onChangeText={(value) => { setSearch(value); setPage(0); }} placeholder="Find a name, phone or code" placeholderTextColor={colors.mutedForeground} style={{ height: 48, borderRadius: 999, backgroundColor: card, paddingHorizontal: 20, fontFamily: "Manrope_500Medium", fontSize: 15, color: colors.foreground }} />
                                    {shown.length > 0 ? (
                                        <>
                                            <View style={{ marginTop: 8, overflow: "hidden", borderRadius: 16, backgroundColor: card }}>
                                                {shown.slice(current * GUESTS_PER_PAGE, (current + 1) * GUESTS_PER_PAGE).map((guest, index) => <GuestRow key={guest.id} first={index === 0} guest={guest} tier={summary.event.tiers.find((tier) => tier.id === guest.tier_id)?.name ?? ""} />)}
                                            </View>
                                            {pages > 1 ? (
                                                <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                                    <Button kind="outline" height={36} size={13} title="Previous" disabled={current === 0} onPress={() => setPage(current - 1)} icon={<Icon name="chevron-left:lucide" size={16} color={colors.foreground} />} />
                                                    <T size={13} muted>{current + 1} of {pages}</T>
                                                    <Button kind="outline" height={36} size={13} title="Next" disabled={current >= pages - 1} onPress={() => setPage(current + 1)} />
                                                </View>
                                            ) : null}
                                        </>
                                    ) : <T size={14} muted style={{ marginTop: 12 }}>No one by that name, phone or code.</T>}
                                </>
                            ) : <T size={14} muted>Share the link and tickets show up here as they sell.</T>}
                        </Section>

                        {error ? <ErrorText style={{ marginTop: 12 }}>{error}</ErrorText> : null}
                        <Pressable disabled={busy} onPress={() => void setStatus(summary.event.status === "live" ? "closed" : "live")} style={{ marginTop: 24, opacity: busy ? 0.5 : 1 }}>
                            <T size={13} muted center>{summary.event.status === "live" ? "Stop selling tickets" : "Sell tickets again"}</T>
                        </Pressable>
                        <CheckInSheet open={checking} onClose={() => setChecking(false)} eventId={id} onCheckedIn={() => void query.refetch()} />
                    </>
                )}
            </ScrollView>
        </View>
    );
}

function GuestRow({ guest, tier, first }: { guest: StudioGuest; tier: string; first: boolean }) {
    const colors = useColors();
    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: colors.divider }}>
            <View style={{ flex: 1, minWidth: 0 }}>
                <T lines={1}>{guest.buyer_name || "Guest"}</T>
                <T size={13} muted lines={1}>{tier} · {guest.code}{guest.buyer_phone ? ` · ${guest.buyer_phone}` : ""}</T>
            </View>
            <Tag tone={guest.checked_in_at ? "good" : "off"} label={guest.checked_in_at ? "In" : "Not yet"} style={{ alignSelf: "center" }} />
        </View>
    );
}

type CheckInResult =
    | { ok: true; ticket: { buyer_name: string; code: string }; tier: string }
    | { ok: false; reason: "not_found" | "not_paid" | "already"; ticket?: { buyer_name: string; code: string; checked_in_at: string | null }; tier?: string };

/** The door: scan a ticket's QR with the camera, or type the code printed under it. */
function CheckInSheet({ open, onClose, eventId, onCheckedIn }: { open: boolean; onClose: () => void; eventId: string; onCheckedIn: () => void }) {
    const colors = useColors();
    const api = useApi();
    const projectId = useWorkspace().workspace.project.id;
    const [permission, requestPermission] = useCameraPermissions();
    const [scanning, setScanning] = useState(false);
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<CheckInResult | null>(null);
    const last = useRef<{ value: string; at: number } | null>(null);

    const submit = async (value: string) => {
        if (!value.trim()) return;
        setBusy(true);
        try {
            const body = await api<CheckInResult>("/api/studio/events", { method: "POST", body: { project_id: projectId, action: "checkin", event_id: eventId, code: value } }).catch(() => ({ ok: false, reason: "not_found" }) as CheckInResult);
            setResult(body);
            void Haptics.notificationAsync(body.ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
            if (body.ok) onCheckedIn();
            setCode("");
        } finally {
            setBusy(false);
        }
    };
    const startScanning = async () => {
        const granted = permission?.granted || (await requestPermission()).granted;
        if (granted) setScanning(true);
    };
    const close = () => {
        setScanning(false);
        setResult(null);
        onClose();
    };

    const tone = !result ? null : result.ok ? palette.emerald600 : result.reason === "already" ? palette.amber500 : colors.destructive;
    const message = !result ? null
        : result.ok ? { title: "Checked in", body: `${result.ticket.buyer_name || "Guest"} · ${result.tier}` }
            : result.reason === "already" ? { title: "Already used", body: `${result.ticket?.buyer_name || "Guest"} · in at ${result.ticket?.checked_in_at ? new Date(result.ticket.checked_in_at).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" }) : ""}` }
                : result.reason === "not_paid" ? { title: "Not paid", body: "This ticket hasn't been paid for." }
                    : { title: "Not a ticket for this event", body: "Check the code and try again." };

    return (
        <Sheet open={open} onClose={close}>
            <SheetHeader title="Check in" onClose={close} />
            {message && tone ? (
                <View style={{ marginTop: 8, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: tone }}>
                    <T size={17} weight="600" color="#ffffff">{message.title}</T>
                    <T size={14} color="rgba(255,255,255,0.9)" style={{ marginTop: 2 }}>{message.body}</T>
                </View>
            ) : null}
            {scanning ? (
                <View style={{ marginTop: 12, aspectRatio: 1, width: "100%", overflow: "hidden", borderRadius: 16, backgroundColor: "#000000" }}>
                    <CameraView
                        style={{ flex: 1 }}
                        facing="back"
                        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                        onBarcodeScanned={({ data }) => {
                            // The same code held in front of the camera is read once every few seconds, not every frame.
                            if (busy || (last.current?.value === data && Date.now() - last.current.at < 4000)) return;
                            last.current = { value: data, at: Date.now() };
                            void submit(data);
                        }}
                    />
                </View>
            ) : (
                <Button title="Scan tickets" onPress={() => void startScanning()} style={{ marginTop: 12 }} />
            )}
            {permission && !permission.granted && !permission.canAskAgain ? <T size={13} muted style={{ marginTop: 8 }}>Allow Studio to use the camera in your phone&apos;s Settings to scan tickets.</T> : null}
            <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
                <TextInput value={code} onChangeText={(value) => setCode(value.toUpperCase())} onSubmitEditing={() => void submit(code)} autoCapitalize="characters" autoCorrect={false} placeholder="Ticket code" placeholderTextColor={colors.mutedForeground} style={{ flex: 1, height: 48, borderRadius: 999, backgroundColor: colors.muted, paddingHorizontal: 20, fontFamily: "Menlo", fontSize: 16, letterSpacing: 2, color: colors.foreground }} />
                <Pressable disabled={busy || !code.trim()} onPress={() => void submit(code)} style={{ height: 48, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, borderWidth: 1, borderColor: alpha(colors.border, 0.6), paddingHorizontal: 20, opacity: busy || !code.trim() ? 0.5 : 1 }}>
                    {busy ? <Spinner /> : null}
                    <T weight="600">Check</T>
                </Pressable>
            </View>
        </Sheet>
    );
}
