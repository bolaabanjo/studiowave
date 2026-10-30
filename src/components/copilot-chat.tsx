import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, TextInput, View, type ScrollViewInstance } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { isOpenAction, runAction, useCopilot, type CopilotAction } from "@/lib/copilot";
import { useSession } from "@/lib/session";
import { useTasks, type StudioTask } from "@/lib/tasks";
import { Icon } from "@/ui/icons";
import { Markdown } from "@/ui/markdown";
import { KeyboardSafe, SHEET_TOP, Spinner, T, useKeyboard } from "@/ui/kit";
import { alpha, fonts, palette, useColors } from "@/ui/theme";

/** Room for the tab bar under Copilot's box when it's a tab (the native bar floats over the screen). */
const TAB_BAR_HEIGHT = 56;

const SUGGESTIONS = [
    "We're closed this Sunday",
    "Add a new item to the menu",
    "How many chats did we get today?",
    "Help me connect WhatsApp",
];

/**
 * Copilot (cencori components/studio/StudioCopilot.tsx): a sheet over any
 * screen (with ?ask=…, sent straight away), and its own tab in the tab bar.
 */
export function CopilotChat({ inTab }: { inTab?: boolean }) {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ ask?: string }>();
    const copilot = useCopilot();
    const keyboard = useKeyboard();
    const tasks = useTasks();
    // "For Ada: " is a start for the owner to finish, not a question: it goes in the box.
    const [input, setInput] = useState(params.ask?.endsWith(": ") ? params.ask : "");
    const scroll = useRef<ScrollViewInstance>(null);
    const asked = useRef(false);

    useEffect(() => {
        if (asked.current || !params.ask || params.ask.endsWith(": ")) return;
        asked.current = true;
        copilot.send(params.ask);
    }, [params.ask, copilot]);

    const pending = (() => {
        for (let index = copilot.messages.length - 1; index >= 0; index--) {
            const found = copilot.messages[index].actions?.find(isOpenAction);
            if (found) return { messageId: copilot.messages[index].id, action: found };
        }
        return null;
    })();
    const shown = copilot.messages.filter((message) => !message.hidden);
    const send = (text: string) => {
        copilot.send(text);
        setInput("");
    };

    return (
        <KeyboardSafe style={{ backgroundColor: colors.background }}>
            {inTab ? <View style={{ height: insets.top }} /> : (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: SHEET_TOP }}>
                    <View style={{ width: 36 }} />
                    <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: alpha(colors.mutedForeground, 0.3) }} />
                    <Pressable onPress={() => router.back()} accessibilityLabel="Close" style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: alpha(colors.border, 0.6) }}>
                        <Icon name="x:lucide" size={16} color={colors.foreground} />
                    </Pressable>
                </View>
            )}
            <ScrollView ref={scroll} contentInsetAdjustmentBehavior="never" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
                {shown.length === 0 && !copilot.busy ? (
                    <View style={{ paddingTop: 16 }}>
                        <T size={18} weight="600">Change something</T>
                        <T size={14} leading={24} muted style={{ marginTop: 4 }}>Say it like you&apos;d tell a member of staff.</T>
                        <View style={{ marginTop: 20, gap: 8 }}>
                            {SUGGESTIONS.map((suggestion) => (
                                <Pressable key={suggestion} onPress={() => send(suggestion)} style={({ pressed }) => ({ borderRadius: 16, borderWidth: 1, borderColor: alpha(colors.border, 0.6), paddingHorizontal: 16, paddingVertical: 12, backgroundColor: pressed ? colors.muted : "transparent" })}>
                                    <T size={14}>{suggestion}</T>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                ) : (
                    <View style={{ gap: 12, paddingTop: 16 }}>
                        {shown.map((message) => message.role === "user" ? (
                            <View key={message.id} style={{ maxWidth: "85%", alignSelf: "flex-end", borderRadius: 16, borderBottomRightRadius: 6, backgroundColor: colors.foreground, paddingHorizontal: 16, paddingVertical: 10 }}>
                                <T leading={24} color={colors.background}>{message.content}</T>
                            </View>
                        ) : (
                            <View key={message.id}>
                                {message.content ? <Markdown content={message.content} /> : null}
                                {message.actions?.map((action) => <ActionStep key={action.id} action={action} />)}
                            </View>
                        ))}
                        {copilot.streaming ? <Markdown content={copilot.streaming} /> : null}
                        {copilot.busy && !copilot.streaming ? <Thinking label={copilot.status} /> : null}
                    </View>
                )}
            </ScrollView>
            <View style={{ paddingHorizontal: 16, paddingBottom: keyboard.shown ? 12 : insets.bottom + (inTab ? TAB_BAR_HEIGHT : 0) + 16 }}>
                {copilot.secret ? <SecretCard title={copilot.secret.title} secret={copilot.secret.secret} onDismiss={() => copilot.setSecret(null)} /> : null}
                {pending ? (
                    <ActionConfirm
                        key={pending.action.id}
                        action={pending.action}
                        onUpdate={(patch) => copilot.updateAction(pending.messageId, pending.action.id, patch)}
                        onSecret={(value) => copilot.setSecret({ title: pending.action.title, secret: value })}
                        onTask={(task) => tasks.open(task)}
                    />
                ) : null}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ flex: 1, height: 48, justifyContent: "center", borderRadius: 999, backgroundColor: colors.muted, paddingHorizontal: 16 }}>
                        <TextInput
                            value={input}
                            onChangeText={setInput}
                            onSubmitEditing={() => send(input)}
                            returnKeyType="send"
                            placeholder="What should change?"
                            placeholderTextColor={colors.mutedForeground}
                            accessibilityLabel="What should change?"
                            style={{ fontFamily: fonts["500"], fontSize: 15, color: colors.foreground }}
                        />
                    </View>
                    {copilot.busy ? (
                        <Pressable onPress={copilot.stop} accessibilityLabel="Stop" style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.foreground }}>
                            <Icon name="square:lucide" size={16} color={colors.background} />
                        </Pressable>
                    ) : (
                        <Pressable onPress={() => send(input)} disabled={!input.trim()} accessibilityLabel="Send" style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.foreground, opacity: input.trim() ? 1 : 0.4 }}>
                            <Icon name="arrow-up:lucide" size={20} color={colors.background} />
                        </Pressable>
                    )}
                </View>
            </View>
        </KeyboardSafe>
    );
}

/** The shimmering "Thinking" line while a reply hasn't started. */
function Thinking({ label }: { label: string }) {
    const [pulse] = useState(() => new Animated.Value(1));
    useEffect(() => {
        const loop = Animated.loop(Animated.sequence([
            Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]));
        loop.start();
        return () => loop.stop();
    }, [pulse]);
    return <Animated.View accessibilityRole="text" accessibilityLiveRegion="polite" style={{ paddingVertical: 12, opacity: pulse }}><T muted>{label}</T></Animated.View>;
}

const STEP_LABEL: Record<CopilotAction["state"], string> = {
    pending: "Waiting for your confirmation",
    running: "Working…",
    done: "Done",
    failed: "Failed",
    cancelled: "Cancelled",
    expired: "Not confirmed",
};

/** The action as a step in the conversation: one line, details on demand. */
function ActionStep({ action }: { action: CopilotAction }) {
    const colors = useColors();
    const [open, setOpen] = useState(false);
    const icon = action.state === "done" ? <Icon name="check:lucide" size={14} color={palette.emerald500} />
        : action.state === "failed" ? <Icon name="circle-alert:lucide" size={14} color={colors.destructive} />
            : action.state === "running" ? <Spinner />
                : action.state === "pending" ? <Icon name="clock-3:lucide" size={14} color={colors.mutedForeground} />
                    : <Icon name="circle-slash:lucide" size={14} color={colors.mutedForeground} />;
    const struck = action.state === "cancelled" || action.state === "expired";
    return (
        <View style={{ marginTop: 8 }}>
            <Pressable onPress={() => setOpen((value) => !value)} accessibilityState={{ expanded: open }} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 }}>
                <View style={{ width: 16, height: 16, alignItems: "center", justifyContent: "center" }}>{icon}</View>
                <T size={12} lines={1} color={struck ? colors.mutedForeground : alpha(colors.foreground, 0.9)} style={struck ? { textDecorationLine: "line-through" } : undefined}>{action.title}</T>
                <T size={12} muted>· {STEP_LABEL[action.state]}</T>
            </Pressable>
            {open ? (
                <View style={{ marginLeft: 24, marginTop: 6, gap: 4, borderLeftWidth: 1, borderLeftColor: alpha(colors.border, 0.6), paddingLeft: 12 }}>
                    {action.details.map((row) => (
                        <View key={row.label} style={{ flexDirection: "row", gap: 12 }}>
                            <T size={12} leading={20} muted style={{ width: 110 }}>{row.label}</T>
                            <T size={12} leading={20} style={{ flex: 1 }}>{row.value}</T>
                        </View>
                    ))}
                    {action.result ? <T size={12} color={action.state === "failed" ? colors.destructive : colors.mutedForeground} style={{ paddingTop: 4 }}>{action.result}</T> : null}
                </View>
            ) : null}
        </View>
    );
}

/**
 * The confirmation Copilot is waiting on, docked above the composer: what
 * will change, then Confirm or Cancel (typing a phrase first for destructive
 * changes). Nothing runs until Confirm.
 */
function ActionConfirm({ action, onUpdate, onSecret, onTask }: { action: CopilotAction; onUpdate: (patch: Partial<CopilotAction>) => void; onSecret: (secret: string) => void; onTask: (task: StudioTask) => void }) {
    const colors = useColors();
    const { token } = useSession();
    const [typed, setTyped] = useState("");
    const destructive = action.tier === "destructive";
    const phraseOk = !destructive || !action.confirmPhrase || typed.trim() === action.confirmPhrase;
    const running = action.state === "running";
    const confirm = async () => {
        if (!phraseOk || action.state !== "pending") return;
        // A page to open (the owner signs in there), not a change to run.
        if (action.link) {
            onUpdate({ state: "done", result: action.doneMessage });
            if (action.link.href.startsWith("studio-task:")) onTask(action.link.href.slice("studio-task:".length) as StudioTask);
            else void WebBrowser.openBrowserAsync(action.link.href);
            return;
        }
        onUpdate({ state: "running" });
        const outcome = await runAction(action, token);
        if (outcome.secret) onSecret(outcome.secret);
        onUpdate({ state: outcome.state, result: outcome.result });
    };
    const details = action.details.map((row) => `${row.label}: ${row.value}`).join(" · ");
    return (
        <View style={{ marginBottom: 8, borderRadius: 16, borderWidth: 1, borderColor: destructive ? alpha(colors.destructive, 0.4) : alpha(colors.border, 0.5), backgroundColor: colors.background, paddingHorizontal: 14, paddingVertical: 10, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        {destructive ? <Icon name="triangle-alert:lucide" size={14} color={colors.destructive} /> : null}
                        <T size={13} lines={1} style={{ flexShrink: 1 }}>{action.title}</T>
                    </View>
                    <T size={11} muted lines={1}>{details}</T>
                </View>
                <Pressable onPress={() => onUpdate({ state: "cancelled" })} disabled={running} style={{ height: 28, justifyContent: "center", paddingHorizontal: 12, opacity: running ? 0.4 : 1 }}>
                    <T size={12} muted>Cancel</T>
                </Pressable>
                <Pressable onPress={() => void confirm()} disabled={!phraseOk || running} style={{ height: 28, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 14, backgroundColor: destructive ? colors.destructive : colors.foreground, opacity: !phraseOk || running ? 0.4 : 1 }}>
                    {running ? <Spinner color={destructive ? "#ffffff" : colors.background} /> : null}
                    <T size={12} color={destructive ? "#ffffff" : colors.background}>{running ? "Working…" : action.link ? action.link.label : "Confirm"}</T>
                </Pressable>
            </View>
            {destructive && action.confirmPhrase ? (
                <TextInput
                    value={typed}
                    onChangeText={setTyped}
                    onSubmitEditing={() => void confirm()}
                    editable={!running}
                    placeholder={`Type ${action.confirmPhrase}`}
                    placeholderTextColor={alpha(colors.mutedForeground, 0.7)}
                    accessibilityLabel={`Type ${action.confirmPhrase} to confirm`}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    style={{ marginTop: 8, height: 32, borderRadius: 999, borderWidth: 1, borderColor: alpha(colors.border, 0.6), paddingHorizontal: 12, fontFamily: "Menlo", fontSize: 12, color: colors.foreground }}
                />
            ) : null}
        </View>
    );
}

/** A new API key's secret, shown once above the composer until dismissed. */
function SecretCard({ title, secret, onDismiss }: { title: string; secret: string; onDismiss: () => void }) {
    const colors = useColors();
    const [copied, setCopied] = useState(false);
    return (
        <View style={{ marginBottom: 8, borderRadius: 16, borderWidth: 1, borderColor: alpha(colors.border, 0.5), backgroundColor: colors.background, padding: 14 }}>
            <T size={11} muted>{title}: copy this key now. It won&apos;t be shown again.</T>
            <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <T size={12} lines={1} style={{ flex: 1, fontFamily: "Menlo" }}>{secret}</T>
                <Pressable onPress={() => void Clipboard.setStringAsync(secret).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })} accessibilityLabel="Copy key" style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}>
                    <Icon name={copied ? "check:lucide" : "copy:lucide"} size={14} color={colors.mutedForeground} />
                </Pressable>
                <Pressable onPress={onDismiss} style={{ height: 28, justifyContent: "center", paddingHorizontal: 12 }}><T size={12} muted>I&apos;ve saved it</T></Pressable>
            </View>
        </View>
    );
}
