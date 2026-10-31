import { useEffect, useState } from "react";
import { useBusinessTimeZone } from "@/lib/time-zone";
import { Pressable, Share, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { SITE_URL, API_URL } from "@/lib/config";
import { useSession } from "@/lib/session";
import { useEvents, useInbox, useSales } from "@/lib/queries";
import { useWorkspace } from "@/lib/workspace";
import { conversationTitle, eventWhen, formatMoney, needsOwnerLabel, shortTime } from "@/lib/format";
import type { InboxConversation, StudioOverview } from "@/lib/types";
import { useTasks, taskForStep } from "@/lib/tasks";
import { Icon, WhatsAppMark, type IconName } from "@/ui/icons";
import { Card, ConversationAvatar, IconCircle, Row, Section, Spinner, T, Tag } from "@/ui/kit";
import { tone as toneOf, useColors, type Tone } from "@/ui/theme";

/**
 * Home's parts (cencori components/studio/HomeSections.tsx): today's numbers,
 * the chats waiting on the owner, what's up next, the morning brief, quick
 * actions and what's left to set up. Each one hides when it has nothing to
 * say, so a quiet day is a short page.
 */

const needsYou = (conversation: InboxConversation) => !!conversation.needs_owner || conversation.owner_active;

const HIDE_BALANCE = "studio.hide-balance";

/** Everything that's come in through the assistant, with an eye to hide it (as banking apps have). Kept on this phone. */
export function TodayCard({ data }: { data: StudioOverview }) {
    const colors = useColors();
    const [hidden, setHidden] = useState(false);
    useEffect(() => {
        SecureStore.getItemAsync(HIDE_BALANCE).then((value) => setHidden(value === "1")).catch(() => undefined);
    }, []);
    const toggle = () => {
        const next = !hidden;
        setHidden(next);
        void SecureStore.setItemAsync(HIDE_BALANCE, next ? "1" : "0").catch(() => undefined);
    };
    const amount = data.all_time?.earned.amount ?? data.month.earned?.amount ?? 0;
    return (
        <View style={{ marginTop: 20, borderRadius: 16, backgroundColor: colors.card, padding: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <T size={13} muted>All-time balance</T>
                <Pressable onPress={toggle} accessibilityLabel={hidden ? "Show balance" : "Hide balance"} hitSlop={8} style={{ margin: -6, width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
                    <Icon name={hidden ? "eye-closed" : "eye"} size={15} color={colors.mutedForeground} />
                </Pressable>
            </View>
            <T size={34} weight="600" leading={38} style={{ marginTop: 4, letterSpacing: -0.85 }}>{hidden ? "*****" : formatMoney(amount, data.currency)}</T>
        </View>
    );
}

/** Up to three chats waiting on the owner, with why. */
export function NeedsYouSection() {
    const waiting = (useInbox().data?.conversations ?? []).filter(needsYou);
    if (!waiting.length) return null;
    return (
        <Section title="Needs you" action={waiting.length > 3 ? <Pressable onPress={() => router.navigate("/inbox")}><T size={13} muted>See all {waiting.length}</T></Pressable> : undefined}>
            <Card>
                {waiting.slice(0, 3).map((conversation) => (
                    <Row key={conversation.id} onPress={() => router.push(`/conversation/${conversation.id}`)}>
                        <ConversationAvatar conversation={conversation} size={40} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                                <T weight="600" lines={1} style={{ flex: 1 }}>{conversationTitle(conversation)}</T>
                                <T size={12} muted>{shortTime(conversation.updated_at)}</T>
                            </View>
                            <View style={{ marginTop: 2 }}><Tag tone="amber" label={conversation.owner_active ? "You're replying" : needsOwnerLabel(conversation.needs_owner!.reason)} /></View>
                        </View>
                    </Row>
                ))}
            </Card>
        </Section>
    );
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Today's bookings and the next event in the coming two weeks. */
export function UpNextSection() {
    const timeZone = useBusinessTimeZone();
    const colors = useColors();
    const sales = useSales();
    const events = useEvents();
    const now = new Date();
    const bookings = (sales.data?.bookings ?? [])
        .filter((booking) => booking.status === "confirmed" && booking.start && !Number.isNaN(Date.parse(booking.start)) && sameDay(new Date(booking.start), now) && Date.parse(booking.start) > now.getTime() - 2 * 3_600_000)
        .sort((a, b) => Date.parse(a.start!) - Date.parse(b.start!))
        .slice(0, 3);
    const event = (events.data?.events ?? [])
        .filter((summary) => summary.event.status === "live" && Date.parse(summary.event.ends_at ?? summary.event.starts_at) + 6 * 3_600_000 > now.getTime() && Date.parse(summary.event.starts_at) - now.getTime() < 14 * 86_400_000)
        .sort((a, b) => Date.parse(a.event.starts_at) - Date.parse(b.event.starts_at))[0];
    if (!bookings.length && !event) return null;
    const chevron = <Icon name="chevron-right:lucide" size={16} color={colors.mutedForeground} />;
    return (
        <Section title="Up next">
            <Card>
                {bookings.map((booking) => (
                    <Row key={booking.id} onPress={() => router.navigate("/sales")}>
                        <IconCircle name="calendar" tone="sky" />
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <T weight="600" lines={1}>{booking.title}</T>
                            <T size={13} muted>{new Date(booking.start!).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true })}</T>
                        </View>
                        {chevron}
                    </Row>
                ))}
                {event ? (
                    <Row onPress={() => router.push(`/event/${event.event.id}`)}>
                        {event.event.banner_url
                            ? <Image source={{ uri: event.event.banner_url }} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" contentPosition="top" />
                            : <IconCircle name="calendar" tone="violet" />}
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <T weight="600" lines={1}>{event.event.name}</T>
                            <T size={13} muted lines={1}>{eventWhen(event.event.starts_at, timeZone)} · {event.sold} sold</T>
                        </View>
                        {chevron}
                    </Row>
                ) : null}
            </Card>
        </Section>
    );
}

/** The morning brief: yesterday, and what to do about it. */
export function BriefSection({ brief }: { brief: NonNullable<StudioOverview["brief"]> }) {
    const colors = useColors();
    return (
        <Section title="This morning">
            <View style={{ borderRadius: 16, backgroundColor: colors.card, padding: 16 }}>
                <T size={17} weight="600" leading={23}>{brief.headline}</T>
                <View style={{ marginTop: 8, gap: 6 }}>
                    {brief.points.map((point) => (
                        <View key={point} style={{ flexDirection: "row", gap: 8 }}>
                            <View style={{ marginTop: 8, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.mutedForeground }} />
                            <T size={14} leading={20} style={{ flex: 1 }}>{point}</T>
                        </View>
                    ))}
                </View>
                <BriefListen at={brief.at} />
            </View>
        </Section>
    );
}

/** Listen to this morning's brief: the audio is made when tapped (it costs a little each time), then kept for the day. */
function BriefListen({ at }: { at: string }) {
    const colors = useColors();
    const { workspace } = useWorkspace();
    const { token } = useSession();
    const [started, setStarted] = useState(false);
    const player = useAudioPlayer(started ? { uri: `${API_URL}/api/studio/brief/voice?project_id=${workspace.project.id}&at=${encodeURIComponent(at)}`, headers: { Authorization: `Bearer ${token}` } } : null);
    const status = useAudioPlayerStatus(player);
    useEffect(() => {
        if (started) player.play();
    }, [started, player]);
    const failed = started && !status.isLoaded && !status.isBuffering && status.playbackState === "failed";
    const loading = started && !status.playing && (status.isBuffering || !status.isLoaded) && !failed;
    const ended = status.didJustFinish;
    const label = status.playing ? "Pause" : failed ? "Try again" : started && !ended && status.currentTime > 0 ? "Resume" : "Listen";
    const toggle = () => {
        if (!started || failed) { setStarted(true); player.play(); return; }
        if (status.playing) player.pause();
        else {
            if (ended) void player.seekTo(0);
            player.play();
        }
    };
    return (
        <Pressable onPress={toggle} disabled={loading} style={{ marginTop: 12, alignSelf: "flex-start", height: 40, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, backgroundColor: colors.muted, paddingHorizontal: 16, opacity: loading ? 0.7 : 1 }}>
            {loading ? <Spinner color={colors.foreground} /> : <Icon name={status.playing ? "pause:lucide" : "play:lucide"} size={16} color={colors.foreground} fill />}
            <T size={14} weight="600">{label}</T>
        </Pressable>
    );
}

/** Things owners do often, one tap each. */
export function QuickActions({ data }: { data: StudioOverview }) {
    const colors = useColors();
    const tasks = useTasks();
    const { workspace } = useWorkspace();
    const name = data.assistant?.name ?? workspace.organization.name;
    const link = data.share_token ? `${SITE_URL}/talk/${data.share_token}` : null;
    const actions: Array<{ label: string; icon: IconName; tone: Tone; onPress: () => void }> = [
        ...(link ? [
            { label: "Share link", icon: "share" as const, tone: "sky" as const, onPress: () => void Share.share({ title: name, message: link, url: link }).catch(() => undefined) },
            { label: "QR code", icon: "qr-code" as const, tone: "foreground" as const, onPress: () => router.push({ pathname: "/qr", params: { url: link, name } }) },
        ] : []),
        { label: "New event", icon: "calendar-add", tone: "violet", onPress: () => tasks.open("event") },
        { label: "Add products", icon: "box", tone: "orange", onPress: () => tasks.open("products") },
    ];
    return (
        <View style={{ marginTop: 32, flexDirection: "row" }}>
            {actions.map((action) => {
                const look = toneOf(colors, action.tone);
                return (
                    <Pressable key={action.label} onPress={action.onPress} style={({ pressed }) => ({ width: "25%", alignItems: "center", gap: 6, opacity: pressed ? 0.7 : 1 })}>
                        <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: look.background }}>
                            <Icon name={action.icon} size={24} color={look.color} />
                        </View>
                        <T size={12}>{action.label}</T>
                    </Pressable>
                );
            })}
        </View>
    );
}

/** A setup step's icon, by what it's about. */
function stepIcon(step: string): { icon: IconName | "whatsapp"; tone: Tone } {
    const text = step.toLowerCase();
    if (text.includes("whatsapp")) return { icon: "whatsapp", tone: "whatsapp" };
    if (text.includes("knowledge")) return { icon: "notebook", tone: "violet" };
    if (text.includes("alert")) return { icon: "bell", tone: "amber" };
    if (text.includes("payment")) return { icon: "card", tone: "sky" };
    if (text.includes("product")) return { icon: "box", tone: "orange" };
    return { icon: "rocket", tone: "emerald" };
}

/** What's left to set up, each one done in a sheet (or with Copilot). */
export function SetupSection({ steps }: { steps: string[] }) {
    const colors = useColors();
    const tasks = useTasks();
    if (!steps.length) return null;
    return (
        <Section title="Finish setting up" action={<T size={13} muted>{steps.length} left</T>}>
            <Card>
                {steps.map((step) => {
                    const { icon, tone } = stepIcon(step);
                    const look = toneOf(colors, tone);
                    return (
                        <Row key={step} onPress={() => {
                            const task = taskForStep(step);
                            if (task) tasks.open(task);
                            else router.navigate({ pathname: "/copilot", params: { ask: `Help me ${step.charAt(0).toLowerCase()}${step.slice(1)}` } });
                        }}>
                            {icon === "whatsapp"
                                ? <IconCircle tone="whatsapp"><WhatsAppMark size={20} color={look.color} /></IconCircle>
                                : <IconCircle name={icon} tone={tone} />}
                            <T style={{ flex: 1 }}>{step}</T>
                            <Icon name="chevron-right:lucide" size={16} color={colors.mutedForeground} />
                        </Row>
                    );
                })}
            </Card>
        </Section>
    );
}
