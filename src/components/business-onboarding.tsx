import { useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useApi } from "@/lib/api";
import { clockToDate, dateToClock, hourLabel } from "@/lib/schedule-time";
import { Icon } from "@/ui/icons";
import { BottomSheet, Button, ErrorText, Field, IconButton, KeyboardSafe, T } from "@/ui/kit";
import { alpha, palette, useColors } from "@/ui/theme";

/** As cencori lib/studio/business-profile.ts keeps them. */
export const CATEGORIES = [
    "Restaurant & food", "Fashion & clothing", "Beauty, hair & salon", "Health & wellness", "Medical & clinic",
    "Shopping & retail", "Grocery store", "Electronics & gadgets", "Events & entertainment", "Hotel & short-let",
    "Real estate", "Education", "Travel & transport", "Professional services", "Repairs & home services",
    "Automotive", "Fitness & gym", "Photography & media", "Other business",
];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Monday first, as people read a week. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const SETS_MAX = 3;

export type HoursMode = "selected" | "always" | "appointments";
export type HoursSet = { open: string; close: string };
export const HOURS_MODES = [["selected", "Open for selected hours"], ["always", "Always open"], ["appointments", "Appointments only"]] as const;
export const DESCRIPTION_LIMIT = 512;
/** Monday to Friday 9am to 6pm: where a new business's hours start. */
export const defaultDays = (): HoursSet[][] => [0, 1, 2, 3, 4, 5, 6].map((day) => (day >= 1 && day <= 5 ? [{ open: "09:00", close: "18:00" }] : []));
type Step = "name" | "category" | "hours" | "days" | "where" | "about";

/**
 * Creating a business, the way WhatsApp Business sets up a profile: its name,
 * what kind of business (up to three), when it's open, where it is and its
 * website, and a description. The last two can be skipped. What's given here
 * is what its staff are told about it (cencori POST /api/studio/business with
 * the profile). `onCreated` gets the new business's organization.
 */
export function BusinessOnboarding({ onCreated, onClose, closeLabel = "Close" }: { onCreated: (organizationId: string) => Promise<void> | void; onClose?: () => void; closeLabel?: string }) {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const api = useApi();
    const [step, setStep] = useState<Step>("name");
    const [name, setName] = useState("");
    const [categories, setCategories] = useState<string[]>([]);
    const [mode, setMode] = useState<HoursMode>("selected");
    const [days, setDays] = useState<HoursSet[][]>(defaultDays);
    const [address, setAddress] = useState("");
    const [noLocation, setNoLocation] = useState(false);
    const [website, setWebsite] = useState("");
    const [description, setDescription] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // "Select hours" is only a step when they open at set hours.
    const order: Step[] = ["name", "category", "hours", ...(mode === "selected" ? ["days" as const] : []), "where", "about"];
    const index = order.indexOf(step);
    const next = () => setStep(order[index + 1]);
    const back = () => (index > 0 ? setStep(order[index - 1]) : onClose?.());

    const create = async () => {
        setBusy(true);
        setError(null);
        try {
            const profile = { categories, hours: { mode, days }, address: noLocation ? null : address.trim() || null, no_location: noLocation, website: website.trim() || null, description: description.trim() || null };
            const created = await api<{ organization_id: string }>("/api/studio/business", { method: "POST", body: { name: name.trim(), profile }, fallback: "Couldn't create the business." });
            await onCreated(created.organization_id);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't create the business.");
            setBusy(false);
        }
    };
    const last = index === order.length - 1;
    const canGo = step === "name" ? !!name.trim() : step === "category" ? categories.length > 0 : true;
    const skippable = step === "where" || step === "about";

    return (
        <KeyboardSafe style={{ backgroundColor: colors.background }}>
            <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16 }}>
                <View style={{ height: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    {index > 0 || onClose ? (
                        <View style={{ marginLeft: -8 }}><IconButton name={index > 0 ? "chevron-left:lucide" : "x:lucide"} label={index > 0 ? "Back" : closeLabel} onPress={back} /></View>
                    ) : <View />}
                    {skippable ? <Pressable onPress={last ? () => void create() : next} disabled={busy} hitSlop={8}><T size={14} muted>Skip</T></Pressable> : null}
                </View>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.muted, marginTop: 8, overflow: "hidden" }}>
                    <View style={{ width: `${((index + 1) / order.length) * 100}%`, height: 4, borderRadius: 2, backgroundColor: colors.foreground }} />
                </View>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
                {step === "name" ? (
                    <>
                        <Heading title="Create your business" detail="Your staff introduce themselves as working here, and customers see this name." />
                        <Field value={name} onChangeText={setName} placeholder="Business name" maxLength={48} autoFocus autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => name.trim() && next()} style={{ marginTop: 28 }} />
                    </>
                ) : step === "category" ? (
                    <>
                        <Heading title="What kind of business?" detail="Choose up to 3. Your staff start with what businesses like yours need." />
                        <CategoryChips value={categories} onChange={setCategories} style={{ marginTop: 24, justifyContent: "center" }} />
                    </>
                ) : step === "hours" ? (
                    <>
                        <Heading title="When are you open?" detail="Your staff tell customers when you open and close each day." />
                        <HoursModePicker value={mode} onChange={setMode} style={{ marginTop: 24 }} />
                    </>
                ) : step === "days" ? (
                    <>
                        <Heading title="Select hours" detail="Turn on the days you open." />
                        <DaysEditor days={days} onChange={setDays} />
                    </>
                ) : step === "where" ? (
                    <>
                        <Heading title="Where can customers find you?" detail="Where your business is, or where you operate." />
                        <LocationFields address={address} onAddress={setAddress} noLocation={noLocation} onNoLocation={setNoLocation} website={website} onWebsite={setWebsite} style={{ marginTop: 28 }} />
                    </>
                ) : (
                    <>
                        <Heading title="Describe your business" detail="What you do and why customers should choose you. Your staff use it too." />
                        <Field value={description} onChangeText={(value) => setDescription(value.slice(0, DESCRIPTION_LIMIT))} multiline placeholder="We do knotless braids, wigs and lashes in Lekki. Walk-ins welcome, booking preferred."
                            style={{ marginTop: 28, minHeight: 160, borderRadius: 20, paddingTop: 14, paddingBottom: 14, textAlignVertical: "top" }} />
                        <T size={12} muted style={{ marginTop: 6, textAlign: "right" }}>{description.length} / {DESCRIPTION_LIMIT}</T>
                    </>
                )}
            </ScrollView>

            <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 16 }}>
                {error ? <ErrorText style={{ marginBottom: 8 }}>{error}</ErrorText> : null}
                <Button title={last ? "Create business" : "Next"} busy={busy} disabled={!canGo} onPress={last ? () => void create() : next} />
            </View>
        </KeyboardSafe>
    );
}

/** Up to three categories, as chips. */
export function CategoryChips({ value, onChange, style }: { value: string[]; onChange: (value: string[]) => void; style?: object }) {
    const colors = useColors();
    return (
        <View style={[{ flexDirection: "row", flexWrap: "wrap", gap: 8 }, style]}>
            {CATEGORIES.map((category) => {
                const on = value.includes(category);
                const full = !on && value.length >= 3;
                return (
                    <Pressable key={category} disabled={full} onPress={() => onChange(on ? value.filter((item) => item !== category) : [...value, category])}
                        style={{ height: 40, paddingHorizontal: 16, borderRadius: 20, justifyContent: "center", backgroundColor: on ? colors.foreground : colors.muted, opacity: full ? 0.4 : 1 }}>
                        <T size={14} weight={on ? "600" : "500"} color={on ? colors.background : colors.foreground}>{category}</T>
                    </Pressable>
                );
            })}
        </View>
    );
}

/** Selected hours, always open, or appointments only. */
export function HoursModePicker({ value, onChange, style }: { value: HoursMode; onChange: (value: HoursMode) => void; style?: object }) {
    const colors = useColors();
    return (
        <View style={[{ gap: 8 }, style]}>
            {HOURS_MODES.map(([id, label]) => (
                <Pressable key={id} onPress={() => onChange(id)} accessibilityRole="radio" accessibilityState={{ checked: value === id }}
                    style={{ flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 999, paddingHorizontal: 18, height: 52, backgroundColor: colors.muted }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: value === id ? colors.foreground : colors.mutedForeground, alignItems: "center", justifyContent: "center" }}>
                        {value === id ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.foreground }} /> : null}
                    </View>
                    <T>{label}</T>
                </Pressable>
            ))}
        </View>
    );
}

/** The address (or that there's no physical location) and the website. */
export function LocationFields({ address, onAddress, noLocation, onNoLocation, website, onWebsite, style }: {
    address: string; onAddress: (value: string) => void; noLocation: boolean; onNoLocation: (value: boolean) => void; website: string; onWebsite: (value: string) => void; style?: object;
}) {
    const colors = useColors();
    return (
        <View style={style}>
            <Field value={address} onChangeText={onAddress} editable={!noLocation} placeholder="Address or area, e.g. 12 Admiralty Way, Lekki" style={{ opacity: noLocation ? 0.4 : 1 }} />
            <Pressable onPress={() => onNoLocation(!noLocation)} accessibilityRole="checkbox" accessibilityState={{ checked: noLocation }} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14, paddingHorizontal: 4 }}>
                <View style={{ width: 22, height: 22, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: noLocation ? colors.foreground : "transparent", borderWidth: noLocation ? 0 : 1.5, borderColor: colors.mutedForeground }}>
                    {noLocation ? <Icon name="check:lucide" size={14} color={colors.background} /> : null}
                </View>
                <T size={14}>My business doesn&apos;t have a physical location</T>
            </Pressable>
            <Field value={website} onChangeText={onWebsite} placeholder="Website (optional)" keyboardType="url" autoCapitalize="none" autoCorrect={false} style={{ marginTop: 20 }} />
        </View>
    );
}

function Heading({ title, detail }: { title: string; detail: string }) {
    return (
        <View style={{ alignItems: "center" }}>
            <T size={30} weight="600" leading={36} center style={{ letterSpacing: -0.75 }}>{title}</T>
            <T size={15} leading={22} muted center style={{ marginTop: 10, maxWidth: 320 }}>{detail}</T>
        </View>
    );
}

/** Each day: on or closed, and its openings ("09:00 to 18:00"), up to three a day. */
export function DaysEditor({ days, onChange }: { days: HoursSet[][]; onChange: (days: HoursSet[][]) => void }) {
    const colors = useColors();
    const [picking, setPicking] = useState<{ day: number; set: number; edge: "open" | "close" } | null>(null);
    const setDay = (day: number, sets: HoursSet[]) => onChange(days.map((current, index) => (index === day ? sets : current)));
    const pickedValue = picking ? days[picking.day]?.[picking.set]?.[picking.edge] ?? "09:00" : "09:00";
    const pick = (value: string) => {
        if (!picking) return;
        setDay(picking.day, days[picking.day].map((set, index) => (index === picking.set ? { ...set, [picking.edge]: value } : set)));
    };

    return (
        <View style={{ marginTop: 20 }}>
            {WEEK.map((day, row) => {
                const sets = days[day];
                const open = sets.length > 0;
                return (
                    <View key={day} style={{ paddingVertical: 14, borderTopWidth: row ? 1 : 0, borderTopColor: alpha(colors.border, 0.4) }}>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <View style={{ flex: 1 }}>
                                <T weight="600">{DAY_NAMES[day]}</T>
                                {!open ? <T size={13} muted>Closed</T> : null}
                            </View>
                            <Toggle on={open} onChange={(on) => setDay(day, on ? [{ open: "09:00", close: "18:00" }] : [])} />
                        </View>
                        {sets.map((set, index) => (
                            <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
                                <ClockButton label="Open" value={set.open} onPress={() => setPicking({ day, set: index, edge: "open" })} />
                                <T muted>to</T>
                                <ClockButton label="Close" value={set.close} onPress={() => setPicking({ day, set: index, edge: "close" })} />
                                {index > 0 ? <IconButton name="x:lucide" label="Remove these hours" size={36} iconSize={16} color={colors.mutedForeground} onPress={() => setDay(day, sets.filter((_, at) => at !== index))} /> : null}
                            </View>
                        ))}
                        {open && sets.length < SETS_MAX ? (
                            <Pressable onPress={() => setDay(day, [...sets, laterSet(sets.at(-1)!)])} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, alignSelf: "flex-start", paddingVertical: 4 }}>
                                <Icon name="plus:lucide" size={14} color={palette.emerald600} />
                                <T size={14} color={palette.emerald600}>Add a set of hours</T>
                            </Pressable>
                        ) : null}
                    </View>
                );
            })}
            {Platform.OS === "ios" ? (
                <BottomSheet open={!!picking} onClose={() => setPicking(null)}>
                    <T size={17} weight="600">{picking ? `${DAY_NAMES[picking.day]}: ${picking.edge === "open" ? "opens" : "closes"}` : ""}</T>
                    <DateTimePicker value={clockToDate(pickedValue)} mode="time" display="spinner" timeZoneName="UTC" minuteInterval={15} onChange={(_, date) => date && pick(dateToClock(date))} />
                    <Button title="Done" onPress={() => setPicking(null)} />
                </BottomSheet>
            ) : picking ? (
                <DateTimePicker value={clockToDate(pickedValue)} mode="time" timeZoneName="UTC" minuteInterval={15} onChange={(event, date) => {
                    setPicking(null);
                    if (event.type === "set" && date) pick(dateToClock(date));
                }} />
            ) : null}
        </View>
    );
}

/** The next opening after one: from its close, for three hours (not past 23:45). */
function laterSet(previous: HoursSet): HoursSet {
    const [hours, minutes] = previous.close.split(":").map(Number);
    const start = Math.min(hours * 60 + minutes, 22 * 60 + 45);
    const end = Math.min(start + 180, 23 * 60 + 45);
    const clock = (total: number) => `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    return { open: clock(start), close: clock(end) };
}

function ClockButton({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
    const colors = useColors();
    return (
        <Pressable onPress={onPress} accessibilityLabel={`${label} ${hourLabel(value)}`} style={{ flex: 1, height: 48, borderRadius: 16, paddingHorizontal: 14, justifyContent: "center", backgroundColor: colors.muted }}>
            <T size={11} muted>{label}</T>
            <T>{hourLabel(value)}</T>
        </Pressable>
    );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }): ReactNode {
    const colors = useColors();
    return (
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} onPress={() => onChange(!on)} hitSlop={8}
            style={{ width: 48, height: 28, borderRadius: 14, padding: 2, justifyContent: "center", backgroundColor: on ? palette.emerald600 : alpha(colors.mutedForeground, 0.3) }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#ffffff", transform: [{ translateX: on ? 20 : 0 }] }} />
        </Pressable>
    );
}
