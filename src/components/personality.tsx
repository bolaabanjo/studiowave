import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useSaveEmployee, type EmployeeProfile } from "@/lib/queries";
import { Icon } from "@/ui/icons";
import { Button, ErrorText, Field, Sheet, SheetHeader, Spinner, T } from "@/ui/kit";
import { alpha, palette, useColors } from "@/ui/theme";

/** The choices, as cencori app/api/studio/employee offers them: for a new employee, before there's one to ask. */
export const PERSONALITY_CHOICES: EmployeeProfile["choices"] = {
    tones: [
        { id: "warm", label: "Warm", description: "Kind and upbeat" },
        { id: "professional", label: "Professional", description: "Polite and precise" },
        { id: "playful", label: "Playful", description: "Light and witty" },
        { id: "direct", label: "Straight to the point", description: "Short and clear" },
    ],
    languages: [
        { id: "customer", label: "The customer's language" },
        { id: "english", label: "English" },
        { id: "pidgin", label: "Pidgin" },
        { id: "yoruba", label: "Yoruba" },
        { id: "igbo", label: "Igbo" },
        { id: "hausa", label: "Hausa" },
        { id: "french", label: "French" },
    ],
};

export type Personality = Pick<EmployeeProfile, "tone" | "style" | "language" | "emoji">;
export const DEFAULT_PERSONALITY: Personality = { tone: "warm", style: "", language: "customer", emoji: false };

/**
 * An employee's personality on its profile (cencori lib/studio/persona.ts):
 * its tone, how it talks, the language it speaks and emoji. Each change saves
 * at once and reaches the next customer message, no publishing.
 */
export function PersonalitySection({ agentId, profile }: { agentId: string; profile: EmployeeProfile }) {
    const save = useSaveEmployee(agentId);
    return (
        <PersonalityPicker
            name={profile.name}
            value={profile}
            choices={profile.choices}
            saving={save.isPending ? save.variables : null}
            error={save.error?.message ?? null}
            onChange={(change, done) => save.mutate(change, { onSuccess: done })}
            style={{ marginTop: 24 }}
        />
    );
}

/**
 * The personality controls themselves. `onChange` gets each change (and a
 * callback for when it's kept, so a sheet can close): saved straight away on a
 * profile, held in the form while a new employee is being made.
 */
export function PersonalityPicker({ name, value, choices, onChange, saving = null, error = null, style }: {
    name: string;
    value: Personality;
    choices: EmployeeProfile["choices"];
    onChange: (change: Partial<Personality>, done?: () => void) => void;
    saving?: Partial<Personality> | null;
    error?: string | null;
    style?: object;
}) {
    const [editing, setEditing] = useState<"style" | "language" | null>(null);
    const language = choices.languages.find((option) => option.id === value.language)?.label ?? "The customer's language";
    const who = name.trim() || "your employee";

    return (
        <View style={style}>
            <View style={{ marginBottom: 8, paddingHorizontal: 4 }}>
                <T weight="600">Personality</T>
                <T size={13} muted style={{ marginTop: 2 }}>How {who} comes across, to customers and to you.</T>
            </View>
            <Card>
                {choices.tones.map((tone) => {
                    const chosen = (saving?.tone ?? value.tone) === tone.id;
                    return (
                        <Row key={tone.id} label={tone.label} detail={tone.description} onPress={chosen ? undefined : () => onChange({ tone: tone.id })}
                            right={saving?.tone === tone.id ? <Spinner /> : chosen ? <Icon name="check:lucide" size={16} color={palette.emerald600} /> : <View />} />
                    );
                })}
            </Card>
            <Card style={{ marginTop: 10 }}>
                <Row label="How they talk" detail={value.style || "In your words, e.g. “uses Pidgin when customers do”"} onPress={() => setEditing("style")} />
                <Row label="Speaks" detail={language} onPress={() => setEditing("language")} />
                <Row label="Emoji" detail={value.emoji ? "Now and then" : "None"} right={<Toggle on={saving?.emoji ?? value.emoji} busy={saving?.emoji !== undefined} onChange={(emoji) => onChange({ emoji })} />} />
            </Card>
            {error && !editing ? <ErrorText style={{ marginTop: 8, paddingHorizontal: 4 }}>{error}</ErrorText> : null}

            <TalkSheet name={who} style={value.style} busy={saving?.style !== undefined} error={error} open={editing === "style"} onClose={() => setEditing(null)} onSave={(text) => onChange({ style: text }, () => setEditing(null))} />
            <Sheet open={editing === "language"} onClose={() => setEditing(null)}>
                <SheetHeader title="Speaks" onClose={() => setEditing(null)} description={`The language ${who} answers customers in.`} />
                <Card style={{ marginTop: 16 }}>
                    {choices.languages.map((option) => (
                        <Row key={option.id} label={option.label}
                            onPress={() => onChange({ language: option.id }, () => setEditing(null))}
                            right={saving?.language === option.id ? <Spinner /> : value.language === option.id ? <Icon name="check:lucide" size={16} color={palette.emerald600} /> : <View />} />
                    ))}
                </Card>
                {error ? <ErrorText style={{ marginTop: 8 }}>{error}</ErrorText> : null}
            </Sheet>
        </View>
    );
}

/** "How they talk", in the owner's own words. */
function TalkSheet({ name, style, busy, error, open, onClose, onSave }: { name: string; style: string; busy: boolean; error: string | null; open: boolean; onClose: () => void; onSave: (text: string) => void }) {
    const [text, setText] = useState(style);
    return (
        <Sheet open={open} onClose={onClose}>
            <SheetHeader title="How they talk" onClose={onClose} description={`Anything about how ${name} speaks: words they use, how they greet people, what they never say.`} />
            <Field value={text} onChangeText={setText} multiline maxLength={500} autoFocus placeholder="Uses Pidgin when customers do. Calls regulars by name. Never says 'unfortunately'." style={{ marginTop: 16, minHeight: 120, borderRadius: 20, paddingTop: 14, paddingBottom: 14, textAlignVertical: "top" }} />
            <T size={12} muted style={{ marginTop: 6, textAlign: "right" }}>{text.length}/500</T>
            {error ? <ErrorText style={{ marginTop: 4 }}>{error}</ErrorText> : null}
            <Button title="Save" busy={busy} disabled={text.trim() === style} onPress={() => onSave(text.trim())} style={{ marginTop: 12 }} />
        </Sheet>
    );
}

/** Renaming an employee: the new name goes to customers on their next message. */
export function RenameSheet({ agentId, name, open, onClose }: { agentId: string; name: string; open: boolean; onClose: () => void }) {
    const save = useSaveEmployee(agentId);
    const [text, setText] = useState(name);
    const next = text.replace(/\s+/g, " ").trim();
    return (
        <Sheet open={open} onClose={onClose}>
            <SheetHeader title="Rename" onClose={onClose} description="Customers meet them by this name, and so do you." />
            <Field value={text} onChangeText={setText} autoFocus maxLength={60} placeholder="e.g. Ada" returnKeyType="done" onSubmitEditing={() => next && next !== name && save.mutate({ name: next }, { onSuccess: onClose })} style={{ marginTop: 16 }} />
            {save.error ? <ErrorText style={{ marginTop: 8 }}>{save.error.message}</ErrorText> : null}
            <Button title="Save" busy={save.isPending} disabled={!next || next === name} onPress={() => save.mutate({ name: next }, { onSuccess: onClose })} style={{ marginTop: 12 }} />
        </Sheet>
    );
}

function Card({ children, style }: { children: ReactNode[] | ReactNode; style?: object }) {
    const colors = useColors();
    const items = (Array.isArray(children) ? children : [children]).filter(Boolean);
    return (
        <View style={[{ overflow: "hidden", borderRadius: 16, backgroundColor: colors.card }, style]}>
            {items.map((child, index) => <View key={index} style={index ? { borderTopWidth: 1, borderTopColor: alpha(colors.border, 0.4) } : undefined}>{child}</View>)}
        </View>
    );
}

function Row({ label, detail, right, onPress }: { label: string; detail?: string; right?: ReactNode; onPress?: () => void }) {
    const colors = useColors();
    const inner = (
        <>
            <View style={{ flex: 1, minWidth: 0 }}>
                <T lines={1}>{label}</T>
                {detail ? <T size={13} muted lines={2}>{detail}</T> : null}
            </View>
            {right ?? (onPress ? <Icon name="chevron-right:lucide" size={16} color={colors.mutedForeground} /> : null)}
        </>
    );
    const style = { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, paddingHorizontal: 16, paddingVertical: 14 };
    return onPress ? <Pressable onPress={onPress} style={({ pressed }) => [style, pressed && { backgroundColor: colors.muted }]}>{inner}</Pressable> : <View style={style}>{inner}</View>;
}

function Toggle({ on, busy, onChange }: { on: boolean; busy: boolean; onChange: (on: boolean) => void }) {
    const colors = useColors();
    return (
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} disabled={busy} onPress={() => onChange(!on)} hitSlop={8}
            style={{ width: 48, height: 28, borderRadius: 14, padding: 2, justifyContent: "center", backgroundColor: on ? palette.emerald600 : alpha(colors.mutedForeground, 0.3), opacity: busy ? 0.6 : 1 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#ffffff", transform: [{ translateX: on ? 20 : 0 }], shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }} />
        </Pressable>
    );
}
