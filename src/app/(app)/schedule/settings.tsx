import { useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { goBack } from "@/lib/navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSaveSchedule, useSchedule } from "@/lib/queries";
import { formatMoney } from "@/lib/format";
import { clockToDate, dateToClock, hourLabel, shortMinutes } from "@/lib/schedule-time";
import type { ScheduleService, ScheduleSettings, ScheduleView } from "@/lib/types";
import { ToggleRow } from "@/components/tasks";
import { Icon } from "@/ui/icons";
import { Button, Caps, ErrorText, Field, IconButton, LoadError, PageTitle, Sheet, SheetHeader, Skeleton, Switcher, T } from "@/ui/kit";
import { alpha, useColors } from "@/ui/theme";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Monday first, as people read a week. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const LENGTHS = [15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480];
const HOLDS = [{ id: "15", label: "15 min" }, { id: "30", label: "30 min" }, { id: "60", label: "1 hour" }, { id: "120", label: "2 hours" }] as const;

const amount = (text: string): number | null => {
    const value = Number(text.replace(/[^\d.]/g, ""));
    return text.trim() && Number.isFinite(value) ? value : null;
};

/** Services, opening hours, chairs, deposits and reminders: what the employee books with (cencori lib/studio/schedule-slots.ts). */
export default function ScheduleSettingsScreen() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const query = useSchedule(null, 1);
    const header = (
        <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 12 }}>
            <View style={{ marginLeft: -8 }}><IconButton name="chevron-left:lucide" label="Back" onPress={() => goBack()} /></View>
            <PageTitle>Services and hours</PageTitle>
        </View>
    );
    if (query.data) return <Form schedule={query.data} header={header} />;
    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {header}
            {query.isLoading
                ? <View style={{ padding: 16, gap: 12 }}>{[0, 1, 2].map((index) => <Skeleton key={index} height={64} radius={16} />)}</View>
                : <View style={{ padding: 16 }}><LoadError error={query.error} fallback="Couldn't load your schedule." onRetry={() => void query.refetch()} /></View>}
        </View>
    );
}

function Form({ schedule: data, header }: { schedule: ScheduleView; header: ReactNode }) {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const save = useSaveSchedule();
    const [draft, setDraft] = useState<ScheduleSettings>(data.settings);
    const [editing, setEditing] = useState<ScheduleService | "new" | null>(null);
    const [clock, setClock] = useState<{ day: number; edge: "open" | "close" } | null>(null);
    const [depositText, setDepositText] = useState(() => (data.settings.deposit.kind === "fixed" ? String(data.settings.deposit.amount) : data.settings.deposit.kind === "percent" ? String(data.settings.deposit.percent) : ""));
    const currency = data.currency;
    const set = (change: Partial<ScheduleSettings>) => setDraft((current) => ({ ...current, ...change }));

    const submit = () => {
        const value = amount(depositText);
        const deposit = draft.deposit.kind === "fixed" && value ? { kind: "fixed" as const, amount: value } : draft.deposit.kind === "percent" && value ? { kind: "percent" as const, percent: Math.min(100, value) } : { kind: "none" as const };
        save.mutate({ ...draft, deposit }, { onSuccess: () => goBack() });
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {header}
                    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }} keyboardShouldPersistTaps="handled">
                        <Caps style={{ marginTop: 20, marginBottom: 10 }}>Services</Caps>
                        <View style={{ gap: 8 }}>
                            {draft.services.map((service) => (
                                <Pressable key={service.id} onPress={() => setEditing(service)} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, backgroundColor: colors.muted, paddingHorizontal: 16, paddingVertical: 14 }}>
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <T weight="600" lines={1}>{service.name}</T>
                                        <T size={13} muted>{shortMinutes(service.minutes)}{service.price !== null ? ` · ${formatMoney(service.price, currency)}` : ""}{typeof service.deposit === "number" ? ` · deposit ${formatMoney(service.deposit, currency)}` : ""}</T>
                                    </View>
                                    <Icon name="chevron-right:lucide" size={18} color={colors.mutedForeground} />
                                </Pressable>
                            ))}
                            <Button kind="outline" height={44} size={14} title="Add a service" icon={<Icon name="plus:lucide" size={16} color={colors.foreground} />} onPress={() => setEditing("new")} />
                        </View>

                        <Caps style={{ marginTop: 32, marginBottom: 10 }}>Opening hours</Caps>
                        <View style={{ borderRadius: 16, backgroundColor: colors.muted }}>
                            {WEEK.map((weekday, index) => {
                                const hours = draft.hours[weekday];
                                return (
                                    <View key={weekday} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, height: 52, borderTopWidth: index ? 1 : 0, borderTopColor: alpha(colors.border, 0.4) }}>
                                        <Pressable onPress={() => set({ hours: draft.hours.map((day, i) => (i === weekday ? (day ? null : { open: "09:00", close: "18:00" }) : day)) })} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
                                            <View style={{ width: 20, height: 20, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: hours ? colors.foreground : "transparent", borderWidth: hours ? 0 : 1.5, borderColor: colors.mutedForeground }}>
                                                {hours ? <Icon name="check:lucide" size={14} color={colors.background} /> : null}
                                            </View>
                                            <T muted={!hours}>{DAY_NAMES[weekday]}</T>
                                        </Pressable>
                                        {hours ? (
                                            <>
                                                <ClockPill label={hourLabel(hours.open)} active={clock?.day === weekday && clock.edge === "open"} onPress={() => setClock({ day: weekday, edge: "open" })} />
                                                <T muted>to</T>
                                                <ClockPill label={hourLabel(hours.close)} active={clock?.day === weekday && clock.edge === "close"} onPress={() => setClock({ day: weekday, edge: "close" })} />
                                            </>
                                        ) : <T size={13} muted>Closed</T>}
                                    </View>
                                );
                            })}
                        </View>
                        {clock && draft.hours[clock.day] ? (
                            <View>
                                <DateTimePicker
                                    value={clockToDate(draft.hours[clock.day]![clock.edge])}
                                    mode="time"
                                    timeZoneName="UTC"
                                    minuteInterval={15}
                                    display={Platform.OS === "ios" ? "spinner" : "default"}
                                    onChange={(event, picked) => {
                                        if (Platform.OS !== "ios") setClock(null);
                                        if (event.type !== "set" || !picked) return;
                                        set({ hours: draft.hours.map((day, i) => (i === clock.day && day ? { ...day, [clock.edge]: dateToClock(picked) } : day)) });
                                    }}
                                />
                                {Platform.OS === "ios" ? <Button kind="muted" height={40} size={14} title="Done" onPress={() => setClock(null)} /> : null}
                            </View>
                        ) : null}

                        <Caps style={{ marginTop: 32, marginBottom: 10 }}>Clients at the same time</Caps>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, backgroundColor: colors.muted, paddingHorizontal: 16, paddingVertical: 12 }}>
                            <T style={{ flex: 1 }} leading={20}>How many chairs, stylists or rooms you have</T>
                            <IconButton name="minus:lucide" label="Fewer" kind="outline" size={36} iconSize={16} disabled={draft.chairs <= 1} onPress={() => set({ chairs: Math.max(1, draft.chairs - 1) })} />
                            <T size={17} weight="600" style={{ minWidth: 24, textAlign: "center" }}>{draft.chairs}</T>
                            <IconButton name="plus:lucide" label="More" kind="outline" size={36} iconSize={16} onPress={() => set({ chairs: Math.min(50, draft.chairs + 1) })} />
                        </View>

                        <Caps style={{ marginTop: 32, marginBottom: 10 }}>Deposit</Caps>
                        <Switcher value={draft.deposit.kind} onChange={(kind) => set({ deposit: kind === "fixed" ? { kind, amount: amount(depositText) ?? 0 } : kind === "percent" ? { kind, percent: amount(depositText) ?? 0 } : { kind: "none" } })} options={[{ id: "none", label: "None" }, { id: "fixed", label: "Fixed amount" }, { id: "percent", label: "% of price" }]} />
                        {draft.deposit.kind !== "none" ? (
                            <>
                                <Field value={depositText} onChangeText={setDepositText} keyboardType="decimal-pad" placeholder={draft.deposit.kind === "fixed" ? "e.g. 5000" : "e.g. 30"} style={{ marginTop: 10 }} />
                                <T size={13} leading={20} muted style={{ marginTop: 10 }}>The time is held while they pay. If the deposit doesn&apos;t come within:</T>
                                <Switcher value={String(draft.hold_minutes) as (typeof HOLDS)[number]["id"]} onChange={(id) => set({ hold_minutes: Number(id) })} options={[...HOLDS]} style={{ marginTop: 8 }} />
                                <T size={13} leading={20} muted style={{ marginTop: 8 }}>…the time is freed for someone else.{data.takes_deposits ? "" : " Add a bank account or payment provider in Money first, or bookings go through without a deposit."}</T>
                            </>
                        ) : null}

                        <Caps style={{ marginTop: 32, marginBottom: 10 }}>Reminders</Caps>
                        <ToggleRow
                            title="WhatsApp reminders"
                            detail="The day before and two hours before. Clients reply 1 to confirm or 2 for another time, and your employee handles it."
                            on={draft.reminders}
                            onPress={() => set({ reminders: !draft.reminders })}
                        />
                        {draft.reminders && data.reminder_template === "pending" ? <T size={12} leading={18} muted style={{ marginTop: 8 }}>WhatsApp is approving the reminder message; that usually takes a few minutes.</T> : null}
                    </ScrollView>
                    <View style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 16 }}>
                        {save.error ? <ErrorText style={{ marginBottom: 8 }}>{save.error.message}</ErrorText> : null}
                        <Button title="Save" busy={save.isPending} disabled={!draft.services.length} onPress={submit} />
                    </View>
            {editing ? (
                <ServiceSheet
                    service={editing === "new" ? null : editing}
                    currency={currency}
                    onClose={() => setEditing(null)}
                    onSave={(service) => {
                        set({ services: editing === "new" ? [...draft.services, service] : draft.services.map((item) => (item.id === service.id ? service : item)) });
                        setEditing(null);
                    }}
                    onRemove={editing === "new" ? undefined : () => {
                        set({ services: draft.services.filter((item) => item.id !== editing.id) });
                        setEditing(null);
                    }}
                />
            ) : null}
        </View>
    );
}

function ClockPill({ label, onPress, active }: { label: string; onPress: () => void; active: boolean }) {
    const colors = useColors();
    return (
        <Pressable onPress={onPress} style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: "center", backgroundColor: colors.background, borderWidth: 1, borderColor: active ? colors.foreground : alpha(colors.border, 0.6) }}>
            <T size={14}>{label}</T>
        </Pressable>
    );
}

function ServiceSheet({ service, currency, onClose, onSave, onRemove }: { service: ScheduleService | null; currency: string; onClose: () => void; onSave: (service: ScheduleService) => void; onRemove?: () => void }) {
    const colors = useColors();
    const [name, setName] = useState(service?.name ?? "");
    const [minutes, setMinutes] = useState(service?.minutes ?? 60);
    const [price, setPrice] = useState(service?.price !== null && service?.price !== undefined ? String(service.price) : "");
    const [deposit, setDeposit] = useState(typeof service?.deposit === "number" ? String(service.deposit) : "");
    const symbol = currency === "NGN" ? "₦" : currency;
    const done = () => {
        const own = amount(deposit);
        onSave({ id: service?.id ?? `s_${Math.random().toString(36).slice(2, 10)}`, name: name.trim(), minutes, price: amount(price), ...(own !== null ? { deposit: own } : {}) });
    };
    return (
        <Sheet open onClose={onClose}>
            <SheetHeader title={service ? "Edit service" : "Add a service"} onClose={onClose} />
            <Field value={name} onChangeText={setName} placeholder="Name, e.g. Knotless braids" autoCapitalize="sentences" style={{ marginTop: 20 }} />
            <T size={13} weight="600" style={{ marginTop: 20, marginBottom: 8 }}>How long it takes</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {LENGTHS.map((length) => {
                    const on = length === minutes;
                    return (
                        <Pressable key={length} onPress={() => setMinutes(length)} style={{ paddingHorizontal: 14, height: 36, borderRadius: 18, justifyContent: "center", backgroundColor: on ? colors.foreground : colors.muted }}>
                            <T size={14} color={on ? colors.background : colors.foreground}>{shortMinutes(length)}</T>
                        </Pressable>
                    );
                })}
            </View>
            <T size={13} weight="600" style={{ marginTop: 20, marginBottom: 8 }}>Price ({symbol})</T>
            <Field value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="e.g. 25000" />
            <T size={13} weight="600" style={{ marginTop: 20, marginBottom: 8 }}>Its own deposit ({symbol}, optional)</T>
            <Field value={deposit} onChangeText={setDeposit} keyboardType="decimal-pad" placeholder="Leave empty for your usual deposit" />
            <View style={{ flex: 1, minHeight: 24 }} />
            <Button title={service ? "Done" : "Add"} disabled={name.trim().length < 2} onPress={done} />
            {onRemove ? <Button kind="outline" title="Remove this service" onPress={onRemove} style={{ marginTop: 8 }} /> : null}
        </Sheet>
    );
}
