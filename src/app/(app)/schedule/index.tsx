import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { goBack } from "@/lib/navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppointmentAction, useBookAppointment, useSchedule } from "@/lib/queries";
import { formatMoney } from "@/lib/format";
import { clockLabel, dayKey, dayLabel, localStamp, longDay, nextDays, shortMinutes } from "@/lib/schedule-time";
import type { Appointment, ScheduleView } from "@/lib/types";
import { WhenPicker } from "@/components/when-picker";
import { Icon } from "@/ui/icons";
import { Button, EmptyCard, ErrorText, Field, IconButton, LoadError, PageTitle, Sheet, SheetHeader, Skeleton, T, Tag, type TagTone } from "@/ui/kit";
import { alpha, useColors } from "@/ui/theme";

const DAYS = 14;

function status(appointment: Appointment): { label: string; tone: TagTone } {
    if (appointment.status === "held") return appointment.deposit?.claimed ? { label: "Check your bank for the deposit", tone: "wait" } : { label: "Waiting for deposit", tone: "wait" };
    if (appointment.status === "done") return { label: "Came", tone: "off" };
    if (appointment.status === "no_show") return { label: "Didn't come", tone: "off" };
    if (appointment.status === "cancelled") return { label: "Cancelled", tone: "off" };
    if (appointment.starts_at && Date.parse(appointment.starts_at) < Date.now()) return { label: "Did they come?", tone: "wait" };
    return { label: appointment.customer_confirmed ? "Confirmed by client" : "Booked", tone: "good" };
}

/** The appointment book: a day at a time, what's booked, and booking someone in (cencori lib/studio/schedule.ts). */
export default function Schedule() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const query = useSchedule(null, DAYS);
    const act = useAppointmentAction();
    const data = query.data;
    const timeZone = data?.time_zone ?? "Africa/Lagos";
    const days = useMemo(() => nextDays(timeZone, DAYS), [timeZone]);
    const [picked, setPicked] = useState<string | null>(null);
    const day = picked ?? days[0];
    const [booking, setBooking] = useState(false);
    const [moving, setMoving] = useState<Appointment | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const byDay = useMemo(() => {
        const map = new Map<string, Appointment[]>();
        for (const appointment of data?.appointments ?? []) {
            if (!appointment.starts_at) continue;
            const key = dayKey(timeZone, new Date(appointment.starts_at));
            map.set(key, [...(map.get(key) ?? []), appointment]);
        }
        return map;
    }, [data, timeZone]);
    const live = (list: Appointment[] | undefined) => (list ?? []).filter((item) => item.status === "confirmed" || item.status === "held");
    const today = byDay.get(day) ?? [];
    const ordered = [...live(today), ...today.filter((item) => item.status !== "confirmed" && item.status !== "held")];

    const change = (appointment: Appointment, action: "done" | "no_show" | "cancelled") => {
        setNotice(null);
        act.mutate({ id: appointment.id, action }, { onSuccess: (result) => setNotice(action === "cancelled" ? told(result.told, "cancellation") : null) });
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: insets.top + 12 }}>
                <View style={{ marginLeft: -8 }}><IconButton name="chevron-left:lucide" label="Back" onPress={() => goBack()} /></View>
                <View style={{ marginRight: -8 }}><IconButton name="tuning:linear" label="Services and hours" onPress={() => router.push("/schedule/settings")} /></View>
            </View>
            <View style={{ paddingHorizontal: 16 }}><PageTitle>Schedule</PageTitle></View>

            {query.isLoading ? (
                <View style={{ padding: 16, gap: 12 }}>{[0, 1, 2].map((index) => <Skeleton key={index} height={88} radius={16} />)}</View>
            ) : !data ? (
                <View style={{ padding: 16 }}><LoadError error={query.error} fallback="Couldn't load your schedule." onRetry={() => void query.refetch()} /></View>
            ) : !data.set_up ? (
                <View style={{ padding: 16 }}>
                    <EmptyCard icon="calendar" title="Set up your appointment book" description="Add your services, how long each takes, and your opening hours. Your employee then books customers into free times itself, takes deposits and sends reminders.">
                        <Button height={44} size={14} title="Add your services" onPress={() => router.push("/schedule/settings")} style={{ marginTop: 16 }} />
                    </EmptyCard>
                </View>
            ) : (
                <>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }} style={{ flexGrow: 0 }}>
                        {days.map((key) => {
                            const label = dayLabel(timeZone, key);
                            const count = live(byDay.get(key)).length;
                            const on = key === day;
                            return (
                                <Pressable key={key} onPress={() => setPicked(key)} style={{ width: 56, paddingVertical: 10, borderRadius: 18, alignItems: "center", backgroundColor: on ? colors.foreground : colors.muted }}>
                                    <T size={12} color={on ? colors.background : colors.mutedForeground}>{label.top}</T>
                                    <T size={18} weight="600" color={on ? colors.background : colors.foreground}>{label.bottom}</T>
                                    <View style={{ height: 6, marginTop: 4, flexDirection: "row", gap: 3 }}>
                                        {Array.from({ length: Math.min(count, 3) }, (_, index) => <View key={index} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: on ? colors.background : colors.foreground }} />)}
                                    </View>
                                </Pressable>
                            );
                        })}
                    </ScrollView>

                    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 96 }}>
                        <T size={13} muted style={{ marginTop: 4 }}>{longDay(day)} · {live(today).length ? `${live(today).length} booked` : "Nothing booked"}</T>
                        {act.error ? <ErrorText style={{ marginTop: 8 }}>{act.error.message}</ErrorText> : null}
                        {notice ? <T size={13} leading={20} muted style={{ marginTop: 8 }}>{notice}</T> : null}
                        <View style={{ marginTop: 12, gap: 10 }}>
                            {ordered.map((appointment) => (
                                <AppointmentCard key={appointment.id} appointment={appointment} timeZone={timeZone} busy={act.isPending} onChange={change} onMove={() => setMoving(appointment)} />
                            ))}
                        </View>
                        {data.reminder_template === "rejected" && data.settings.reminders ? (
                            <T size={12} leading={18} muted style={{ marginTop: 16 }}>WhatsApp didn&apos;t approve the reminder message, so reminders only reach clients who wrote in the last 24 hours.</T>
                        ) : null}
                    </ScrollView>

                    <View style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 16 }}>
                        <Button title="Book someone in" icon={<Icon name="plus:lucide" size={18} color={colors.background} />} onPress={() => setBooking(true)} />
                    </View>
                </>
            )}

            {data ? <BookSheet open={booking} onClose={() => setBooking(false)} schedule={data} day={day} /> : null}
            {data && moving ? <MoveSheet appointment={moving} timeZone={timeZone} onClose={() => setMoving(null)} onMoved={(result) => setNotice(told(result, "new time"))} /> : null}
        </View>
    );
}

function hasStarted(appointment: Appointment): boolean {
    return !!appointment.starts_at && Date.parse(appointment.starts_at) < Date.now();
}

function told(result: "sent" | "template" | "unreachable" | null, what: string): string | null {
    if (result === "sent" || result === "template") return `They've been told about the ${what} in their chat.`;
    if (result === "unreachable") return `Couldn't reach them on WhatsApp (it's been over 24 hours since they wrote). Let them know about the ${what} yourself.`;
    return null;
}

function AppointmentCard({ appointment, timeZone, busy, onChange, onMove }: { appointment: Appointment; timeZone: string; busy: boolean; onChange: (appointment: Appointment, action: "done" | "no_show" | "cancelled") => void; onMove: () => void }) {
    const colors = useColors();
    const tag = status(appointment);
    const open = appointment.status === "confirmed" || appointment.status === "held";
    const past = hasStarted(appointment);
    const minutes = appointment.starts_at && appointment.ends_at ? Math.round((Date.parse(appointment.ends_at) - Date.parse(appointment.starts_at)) / 60_000) : null;
    const reminded = appointment.reminders.two_hours && !appointment.reminders.two_hours.startsWith("skipped") ? "Reminded today" : appointment.reminders.day_before && !appointment.reminders.day_before.startsWith("skipped") ? "Reminded yesterday" : null;
    return (
        <View style={{ borderRadius: 18, backgroundColor: colors.muted, padding: 14, opacity: open ? 1 : 0.6 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ width: 60 }}>
                    <T weight="600">{appointment.starts_at ? clockLabel(timeZone, appointment.starts_at) : "--"}</T>
                    {minutes ? <T size={12} muted>{shortMinutes(minutes)}</T> : null}
                </View>
                <Pressable style={{ flex: 1, minWidth: 0 }} disabled={!appointment.customer_phone} onPress={() => router.push(`/client/${encodeURIComponent(appointment.customer_phone!)}`)}>
                    <T weight="600" lines={1}>{appointment.customer_name ?? "Client"}</T>
                    <T size={13} muted lines={1}>{appointment.service ?? appointment.title}{appointment.price ? ` · ${formatMoney(appointment.price, appointment.currency)}` : ""}</T>
                    {appointment.note ? <T size={13} muted lines={2} style={{ marginTop: 2 }}>{appointment.note}</T> : null}
                    <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        <Tag round tone={tag.tone} label={tag.label} />
                        {appointment.deposit?.paid ? <Tag round tone="good" label={`Deposit paid · ${formatMoney(appointment.deposit.amount, appointment.deposit.currency)}`} /> : null}
                        {reminded && open ? <Tag round tone="neutral" label={reminded} /> : null}
                    </View>
                </Pressable>
            </View>
            {open ? (
                <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    {past ? (
                        <>
                            <Small title="They came" strong disabled={busy} onPress={() => onChange(appointment, "done")} />
                            <Small title="Didn't come" disabled={busy} onPress={() => onChange(appointment, "no_show")} />
                        </>
                    ) : (
                        <>
                            <Small title="Move" disabled={busy} onPress={onMove} />
                            <Small title="Cancel" disabled={busy} onPress={() => onChange(appointment, "cancelled")} />
                        </>
                    )}
                    {appointment.conversation_id ? (
                        <Pressable onPress={() => router.push(`/conversation/${appointment.conversation_id}`)} accessibilityLabel="Open the chat" style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: alpha(colors.border, 0.6) }}>
                            <Icon name="message-circle:lucide" size={16} color={colors.foreground} />
                        </Pressable>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}

function Small({ title, onPress, disabled, strong }: { title: string; onPress: () => void; disabled?: boolean; strong?: boolean }) {
    return <Button kind={strong ? "primary" : "outline"} height={32} size={13} title={title} onPress={onPress} disabled={disabled} style={{ paddingHorizontal: 12 }} />;
}

/** A sensible first time for a day: its opening time, or the next half hour today. */
function firstTime(schedule: ScheduleView, day: string): Date {
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    const open = schedule.settings.hours[weekday]?.open ?? "10:00";
    const guess = new Date(`${day}T${open}:00Z`);
    // Shift from UTC to the business's clock: the difference between what UTC and the zone read at that moment.
    const offset = Date.parse(`${localStamp(schedule.time_zone, guess)}:00Z`) - guess.getTime();
    const start = new Date(guess.getTime() - offset);
    const soon = Math.ceil((Date.now() + 30 * 60_000) / 1_800_000) * 1_800_000;
    return start.getTime() < soon ? new Date(soon) : start;
}

function BookSheet({ open, onClose, schedule, day }: { open: boolean; onClose: () => void; schedule: ScheduleView; day: string }) {
    const colors = useColors();
    const book = useBookAppointment();
    const [service, setService] = useState<string | null>(null);
    const [when, setWhen] = useState<Date | null>(null);
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [note, setNote] = useState("");
    const chosen = schedule.settings.services.find((item) => item.id === service) ?? schedule.settings.services[0];
    const start = when ?? firstTime(schedule, day);
    const close = () => {
        setWhen(null);
        setName("");
        setPhone("");
        setNote("");
        book.reset();
        onClose();
    };
    const submit = () => {
        if (!chosen || !name.trim()) return;
        book.mutate({ service: chosen.id, start: localStamp(schedule.time_zone, start), name: name.trim(), ...(phone.trim() ? { phone: phone.trim() } : {}), ...(note.trim() ? { note: note.trim() } : {}) }, { onSuccess: close });
    };
    return (
        <Sheet open={open} onClose={close}>
            <SheetHeader title="Book someone in" onClose={close} description="A walk-in or someone who called. No deposit is asked for." />
            <T size={13} weight="600" style={{ marginTop: 20, marginBottom: 8 }}>Service</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {schedule.settings.services.map((item) => {
                    const on = item.id === chosen?.id;
                    return (
                        <Pressable key={item.id} onPress={() => setService(item.id)} style={{ paddingHorizontal: 14, height: 36, borderRadius: 18, justifyContent: "center", backgroundColor: on ? colors.foreground : colors.muted }}>
                            <T size={14} color={on ? colors.background : colors.foreground}>{item.name} · {shortMinutes(item.minutes)}</T>
                        </Pressable>
                    );
                })}
            </View>
            <T size={13} weight="600" style={{ marginTop: 20, marginBottom: 8 }}>When</T>
            <WhenPicker value={start} onChange={setWhen} timeZone={schedule.time_zone} />
            <T size={13} weight="600" style={{ marginTop: 20, marginBottom: 8 }}>Who</T>
            <Field value={name} onChangeText={setName} placeholder="Their name" autoCapitalize="words" />
            <Field value={phone} onChangeText={setPhone} placeholder="Their WhatsApp number (for reminders)" keyboardType="phone-pad" style={{ marginTop: 8 }} />
            <Field value={note} onChangeText={setNote} placeholder="Note (optional)" style={{ marginTop: 8 }} />
            {book.error ? <ErrorText style={{ marginTop: 12 }}>{book.error.message}</ErrorText> : null}
            <View style={{ flex: 1, minHeight: 24 }} />
            <Button title="Book" busy={book.isPending} disabled={!chosen || !name.trim()} onPress={submit} />
        </Sheet>
    );
}

function MoveSheet({ appointment, timeZone, onClose, onMoved }: { appointment: Appointment; timeZone: string; onClose: () => void; onMoved: (told: "sent" | "template" | "unreachable" | null) => void }) {
    const act = useAppointmentAction();
    const [when, setWhen] = useState(() => new Date(appointment.starts_at ?? Date.now()));
    const move = () => act.mutate({ id: appointment.id, action: "move", start: localStamp(timeZone, when) }, {
        onSuccess: (result) => {
            onMoved(result.told);
            onClose();
        },
    });
    return (
        <Sheet open onClose={onClose}>
            <SheetHeader title={`Move ${appointment.customer_name ?? "this appointment"}`} onClose={onClose} description={`${appointment.service ?? "Appointment"}, now ${appointment.starts_at ? `${longDay(dayKey(timeZone, new Date(appointment.starts_at)))} at ${clockLabel(timeZone, appointment.starts_at)}` : "not set"}. They're told in their chat.`} />
            <View style={{ marginTop: 20 }}><WhenPicker value={when} onChange={setWhen} timeZone={timeZone} /></View>
            {act.error ? <ErrorText style={{ marginTop: 12 }}>{act.error.message}</ErrorText> : null}
            <View style={{ flex: 1, minHeight: 24 }} />
            <Button title="Move it" busy={act.isPending} onPress={move} />
        </Sheet>
    );
}
