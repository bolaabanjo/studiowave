import { useEffect, useRef, useState, type ReactNode } from "react";
import { deviceTimeZone } from "@/lib/time-zone";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, TextInput, View, type ScrollViewInstance } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import Svg, { Path } from "react-native-svg";
import { useApi } from "@/lib/api";
import { SITE_URL } from "@/lib/config";
import { deviceStore } from "@/lib/device-store";
import { pickPhotos } from "@/lib/photos";
import { useWorkspace } from "@/lib/workspace";
import { BUSINESS_KINDS, setupInstructions, setupKnowledge, setupQuestions, type AnswerKey, type BusinessKind } from "@/lib/setup/setup";
import { HEARD_ABOUT_OPTIONS, type HeardAboutSource } from "@/lib/setup/heard-about";
import { Icon } from "@/ui/icons";
import { Button, IconButton, Spinner, T } from "@/ui/kit";
import { alpha, fonts, palette, useColors } from "@/ui/theme";

type Answers = Partial<Record<AnswerKey, string>>;
type Built = { agentId: string; publicKey: string; previewToken: string; shareToken: string | null };
/** The build's steps, in order. A failed build keeps the ones that finished so "Try again" carries on from there. */
type BuildStep = "knowledge" | "tools" | "alerts" | "tested" | "published";
type HalfBuilt = { agentId: string; versionId: string; done: BuildStep[] };
type Saved = { step: number; kind: BusinessKind | null; answers: Answers; asked: number; built: Built | null; partial?: HalfBuilt | null };

const storeKey = (projectId: string) => `studio-setup-${projectId}`;
const shareUrl = (token: string) => `${SITE_URL}/talk/${token}`;

function Progress({ step }: { step: number }) {
    const colors = useColors();
    return (
        <View accessibilityLabel={`Step ${step} of 5`} style={{ flexDirection: "row", gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => <View key={n} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: n <= step ? colors.foreground : colors.muted }} />)}
        </View>
    );
}

function Title({ children, size = 24, top = 24 }: { children: ReactNode; size?: number; top?: number }) {
    return <T size={size} weight="600" leading={Math.round(size * 1.25)} style={{ marginTop: top, letterSpacing: -size * 0.025 }}>{children}</T>;
}

function Pill({ label, onPress, chosen, muted, disabled, icon }: { label: string; onPress: () => void; chosen?: boolean; muted?: boolean; disabled?: boolean; icon?: ReactNode }) {
    const colors = useColors();
    return (
        <Pressable onPress={onPress} disabled={disabled} accessibilityState={{ selected: !!chosen }} style={{ height: 36, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, borderColor: chosen ? colors.foreground : alpha(colors.border, 0.6), backgroundColor: chosen ? colors.foreground : "transparent", paddingHorizontal: 16, opacity: disabled ? 0.6 : 1 }}>
            {icon}
            <T size={14} color={chosen ? colors.background : muted ? colors.mutedForeground : colors.foreground}>{label}</T>
        </Pressable>
    );
}

/**
 * Studio setup (cencori app/studio-app/setup/page.tsx), five steps: what kind
 * of business, a few questions (then the assistant is built and goes live),
 * how they heard, where it works, and done. Progress is kept on this phone,
 * so leaving (to connect WhatsApp, say) picks up where it stopped.
 */
export default function Setup() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const api = useApi();
    const queryClient = useQueryClient();
    const params = useLocalSearchParams<{ new?: string }>();
    const { workspace } = useWorkspace();
    const { project, organization, user, agents } = workspace;
    const [state, setState] = useState<Saved>({ step: 1, kind: null, answers: { name: organization.name }, asked: 0, built: null });
    const [loaded, setLoaded] = useState(false);
    const [draft, setDraft] = useState("");
    const [askHeard, setAskHeard] = useState(false);
    const [heard, setHeard] = useState<HeardAboutSource | null>(null);
    const [heardDetail, setHeardDetail] = useState("");
    const [building, setBuilding] = useState<string[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [reading, setReading] = useState<"reading" | "read" | null>(null);
    const scroll = useRef<ScrollViewInstance>(null);

    useEffect(() => {
        api<{ answered?: boolean }>("/api/me/heard-about").then((body) => setAskHeard(body?.answered === false)).catch(() => undefined);
    }, [api]);

    // Pick up where they left off.
    useEffect(() => {
        void (async () => {
            // "Add assistant" (?new=1): a new one from the start, whatever was saved.
            if (params.new === "1") {
                deviceStore.remove(storeKey(project.id));
                setLoaded(true);
                return;
            }
            const saved = await deviceStore.get<Saved>(storeKey(project.id));
            if (saved) setState(saved);
            setLoaded(true);
            if (saved?.partial || saved?.built) return;
            // Started on another device, or this one's progress is gone: carry on with the assistant setup already made, never a second one.
            const unfinished = agents.find((agent) => !agent.published);
            if (!unfinished) return;
            api<{ version_id: string }>(`/api/projects/${project.id}/embedded-agents/studio`, { method: "POST", body: { action: "new_version", agent_id: unfinished.id } })
                .then(({ version_id }) => setState((current) => (current.partial || current.built ? current : { ...current, partial: { agentId: unfinished.id, versionId: version_id, done: [] } })))
                .catch(() => undefined);
        })();
        // Once per business: the assistants list doesn't change while setup runs.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project.id]);
    useEffect(() => {
        if (loaded) void deviceStore.set(storeKey(project.id), state);
    }, [loaded, project.id, state]);

    // "Take a photo": the menu or price list read from up to four pictures, into the answer box to check.
    const readPhotos = async () => {
        setError(null);
        try {
            const images = await pickPhotos({ max: 4 });
            if (!images) return;
            setReading("reading");
            const { text } = await api<{ text: string }>("/api/studio/menu-photo", { method: "POST", body: { project_id: project.id, images: images.map(({ data, mime_type }) => ({ data, mime_type })) } });
            setDraft((current) => (current.trim() ? `${current.trim()}\n\n${text}` : text));
            setReading("read");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't read the photo. Type your list instead.");
            setReading(null);
        }
    };

    const kind = state.kind;
    const questions = kind ? setupQuestions(kind) : [];
    const current = questions[state.asked];

    const answer = (value: string | null) => {
        if (!current) return;
        const text = value?.trim() ?? "";
        if (!text && !current.optional) return;
        setDraft("");
        setReading(null);
        const answers = { ...state.answers, [current.key]: text };
        const asked = state.asked + 1;
        setState((s) => ({ ...s, answers, asked }));
        if (asked >= questions.length && kind) void build(kind, answers);
    };

    // Build the assistant the same way Copilot does, as the signed-in owner. A
    // build that failed part way left an assistant behind (state.partial): "Try
    // again" reuses it and skips the steps that already finished.
    const build = async (businessKind: BusinessKind, answers: Answers) => {
        setError(null);
        const done: string[] = [];
        const tick = (label: string) => {
            done.push(label);
            setBuilding([...done]);
        };
        setBuilding([]);
        const studio = `/api/projects/${project.id}/embedded-agents/studio`;
        let partial = state.partial ?? null;
        const finished = (step: BuildStep) => partial?.done.includes(step) ?? false;
        const mark = (step: BuildStep) => {
            if (!partial) return;
            partial = { ...partial, done: [...partial.done, step] };
            const next = partial;
            setState((s) => ({ ...s, partial: next }));
        };
        let stage = "creating your employee";
        try {
            const description = BUSINESS_KINDS.find((item) => item.id === businessKind)?.name ?? "";
            if (!partial) {
                const created = await api<{ agent_id: string; version_id: string }>(studio, { method: "POST", body: { action: "create_agent", name: answers.name?.trim() || organization.name, description, instructions: setupInstructions(businessKind, answers, deviceTimeZone()), ...(businessKind === "restaurant" ? { template: "restaurant" } : {}) } });
                partial = { agentId: created.agent_id, versionId: created.version_id, done: [] };
                const next = partial;
                setState((s) => ({ ...s, partial: next }));
            } else if (!finished("published")) {
                // They may have gone back and changed an answer since: the draft takes the latest, and needs testing again.
                await api(studio, { method: "POST", body: { action: "save_draft", agent_id: partial.agentId, version_id: partial.versionId, name: answers.name?.trim() || organization.name, description, instructions: setupInstructions(businessKind, answers, deviceTimeZone()) } });
                partial = { ...partial, done: partial.done.filter((step) => step !== "tested") };
                const next = partial;
                setState((s) => ({ ...s, partial: next }));
            }
            const { agentId, versionId } = partial;
            tick("Created your employee");
            const knowledge = setupKnowledge(businessKind, answers);
            const agentBase = `/api/projects/${project.id}/embedded-agents/${agentId}`;
            if (knowledge) {
                stage = businessKind === "restaurant" ? "adding your menu" : "adding your prices";
                if (!finished("knowledge")) {
                    await api(`${agentBase}/knowledge`, { method: "POST", body: knowledge });
                    mark("knowledge");
                }
                tick(businessKind === "restaurant" ? "Added your menu" : "Added your prices");
            }
            stage = "setting up what it can do";
            if (!finished("tools")) {
                await api(studio, { method: "POST", body: { action: "save_tools", agent_id: agentId, version_id: versionId, system_tools: { end_conversation: {}, request_callback: {} } } });
                mark("tools");
            }
            if (!finished("alerts")) {
                if (user.email) await api(`${agentBase}/alerts`, { method: "PUT", body: { emails: [user.email], ...(deviceTimeZone() ? { time_zone: deviceTimeZone() } : {}) } }).catch(() => undefined);
                mark("alerts");
            }
            tick("Set it to tell you when someone needs you");
            stage = "testing it";
            if (!finished("tested")) {
                await api(studio, { method: "POST", body: { action: "test_version", agent_id: agentId, version_id: versionId, input: "Hello" } });
                mark("tested");
            }
            stage = "making it live";
            if (!finished("published")) {
                await api(studio, { method: "POST", body: { action: "publish_version", agent_id: agentId, version_id: versionId } });
                mark("published");
            }
            tick("Tested it and made it live");
            stage = "making your link";
            const widget = await api<{ widget: { public_key: string }; preview_token: string; share_token: string | null }>(`${agentBase}/widget`, { method: "PUT", body: {} });
            tick("Made your link");
            void queryClient.invalidateQueries();
            setState((s) => ({ ...s, step: askHeard ? 3 : 4, partial: null, built: { agentId, publicKey: widget.widget.public_key, previewToken: widget.preview_token, shareToken: widget.share_token } }));
            setBuilding(null);
        } catch (cause) {
            // The half-built assistant is gone (deleted in the console, say): the next try starts over.
            if (cause instanceof Error && /not found/i.test(cause.message)) setState((s) => ({ ...s, partial: null }));
            const reason = cause instanceof Error && cause.message ? ` ${cause.message.replace(/\.?$/, ".")}` : "";
            setError(`We couldn't finish setting up your employee (stopped at ${stage}).${reason} Try again, and if it keeps happening, email support@cencori.com.`);
            setBuilding(null);
        }
    };

    // Meta's own signup in the phone's browser, back to the app to finish (cencori app/api/studio/whatsapp); Kapso's otherwise.
    const connectWhatsApp = async () => {
        if (!state.built) return;
        setBusy(true);
        setError(null);
        try {
            const agentBase = `/api/projects/${project.id}/embedded-agents/${state.built.agentId}`;
            const { signup } = await api<{ signup: unknown }>(`${agentBase}/whatsapp`);
            if (signup) {
                const { url } = await api<{ url: string }>("/api/studio/whatsapp/start", { method: "POST", body: { project_id: project.id, agent_id: state.built.agentId, coexistence: true } });
                const result = await WebBrowser.openAuthSessionAsync(url, "cencori-studio://whatsapp");
                if (result.type !== "success") return;
                const back = new URL(result.url).searchParams;
                if (back.get("outcome") !== "handoff") throw new Error(back.get("message") || "WhatsApp didn't finish connecting. You can try again, or do it later.");
                await api("/api/studio/whatsapp/finish", { method: "POST", body: { handoff: back.get("handoff") } });
                setState((s) => ({ ...s, step: 5 }));
                return;
            }
            const { url } = await api<{ url: string }>(`${agentBase}/whatsapp`, { method: "POST", body: { action: "kapso_link", return_path: "/setup" } });
            await WebBrowser.openBrowserAsync(url);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't start connecting WhatsApp.");
        } finally {
            setBusy(false);
        }
    };

    const shareLink = () => {
        if (!state.built?.shareToken) return;
        const url = shareUrl(state.built.shareToken);
        void Share.share({ title: state.answers.name ?? organization.name, message: url, url }).catch(() => undefined);
    };
    const openQr = () => {
        if (state.built?.shareToken) router.push({ pathname: "/qr", params: { url: shareUrl(state.built.shareToken), name: state.answers.name || organization.name } });
    };
    const finish = () => {
        deviceStore.remove(storeKey(project.id));
        router.back();
    };

    const back = state.step > 1 && state.step < 3 && !building ? () => setState((s) => ({ ...s, step: s.step - 1, asked: 0 })) : null;
    const errorBox = (message: string) => <View style={{ marginTop: 16, borderRadius: 16, backgroundColor: alpha(colors.destructive, 0.1), paddingHorizontal: 16, paddingVertical: 12 }}><T size={13} leading={20} color={colors.destructive}>{message}</T></View>;
    const header = (
        <>
            <View style={{ height: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                {back
                    ? <View style={{ marginLeft: -8 }}><IconButton name="chevron-left:lucide" label="Back" onPress={back} /></View>
                    : <Pressable onPress={() => router.back()}><T weight="600" style={{ letterSpacing: -0.4 }}>Cencori Studio</T></Pressable>}
                <T size={13} muted>Step {state.step} of 5</T>
            </View>
            <View style={{ marginTop: 12 }}><Progress step={state.step} /></View>
            {error && !(state.step === 2 && (current?.key === "list" || state.asked >= questions.length)) ? errorBox(error) : null}
        </>
    );
    const big = (title: string, onPress: () => void, disabled?: boolean) => <Button height={52} size={16} title={title} onPress={onPress} disabled={disabled} />;

    if (!loaded) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}><Spinner /></View>;

    // The questions are a chat: the answer box sits on the keyboard and everything above it scrolls.
    if (state.step === 2 && kind) {
        return (
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
                <ScrollView ref={scroll} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 20, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
                    {header}
                    <Title>Tell it about your business</Title>
                    <T size={14} muted style={{ marginTop: 4 }}>Answer like you&apos;d brief a new member of staff.</T>
                    <View style={{ marginTop: 20, gap: 12 }}>
                        {questions.slice(0, state.asked + 1).map((question, index) => (
                            <View key={question.key} style={{ gap: 12 }}>
                                <View style={{ maxWidth: "85%", alignSelf: "flex-start", borderRadius: 16, borderBottomLeftRadius: 6, backgroundColor: colors.muted, paddingHorizontal: 16, paddingVertical: 10 }}>
                                    <T leading={24}>{question.ask(state.answers)}</T>
                                </View>
                                {index < state.asked ? (
                                    <View style={{ maxWidth: "85%", alignSelf: "flex-end", borderRadius: 16, borderBottomRightRadius: 6, backgroundColor: colors.foreground, paddingHorizontal: 16, paddingVertical: 10 }}>
                                        <T leading={24} color={state.answers[question.key] ? colors.background : alpha(colors.background, 0.7)}>{state.answers[question.key] || "Skipped"}</T>
                                    </View>
                                ) : null}
                            </View>
                        ))}
                        {building ? (
                            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: alpha(colors.border, 0.6), paddingHorizontal: 16, paddingVertical: 14 }}>
                                <T weight="600">Setting up your employee…</T>
                                <View style={{ marginTop: 8, gap: 6 }}>
                                    {building.map((line) => <View key={line} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Icon name="check:lucide" size={16} color={palette.emerald600} /><T size={14}>{line}</T></View>)}
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Spinner /><T size={14} muted>Working…</T></View>
                                </View>
                            </View>
                        ) : null}
                        {!building && state.asked >= questions.length && error ? (
                            <View style={{ gap: 8 }}>
                                {errorBox(error)}
                                <Button kind="outline" height={44} size={14} title="Try again" onPress={() => void build(kind, state.answers)} />
                            </View>
                        ) : null}
                    </View>
                </ScrollView>
                {current && !building ? (
                    <View style={{ borderTopWidth: 1, borderTopColor: alpha(colors.border, 0.6), backgroundColor: colors.background, paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 12 }}>
                        {current.key === "list" && reading ? (
                            <View style={{ marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
                                {reading === "reading" ? <><Spinner /><T size={13} muted>Reading your photo…</T></> : <><Icon name="check:lucide" size={16} color={palette.emerald600} /><T size={13} leading={20} style={{ flex: 1 }}>Here&apos;s what I read. Fix anything that&apos;s off, then send.</T></>}
                            </View>
                        ) : null}
                        {current.key === "list" && error ? <T size={13} leading={20} color={colors.destructive} style={{ marginBottom: 8 }}>{error}</T> : null}
                        {current.choices || current.optional || current.key === "list" ? (
                            <View style={{ marginBottom: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                {current.key === "list" ? <Pill label="Take a photo" disabled={reading === "reading"} onPress={() => void readPhotos()} icon={<Icon name="camera:lucide" size={16} color={colors.foreground} />} /> : null}
                                {current.choices?.map((choice) => <Pill key={choice} label={choice} onPress={() => answer(choice)} />)}
                                {current.optional ? <Pill label="Skip" muted onPress={() => answer(null)} /> : null}
                            </View>
                        ) : null}
                        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                            <View style={{ flex: 1, minHeight: 48, justifyContent: "center", borderRadius: 24, backgroundColor: colors.muted, paddingHorizontal: 16, paddingVertical: 8 }}>
                                <TextInput
                                    value={draft}
                                    onChangeText={setDraft}
                                    multiline={!!current.long}
                                    autoFocus={!current.long}
                                    onSubmitEditing={current.long ? undefined : () => answer(draft)}
                                    placeholder={current.placeholder}
                                    placeholderTextColor={colors.mutedForeground}
                                    accessibilityLabel={current.ask(state.answers)}
                                    style={{ maxHeight: 160, minHeight: current.long ? (reading === "read" ? 160 : 72) : undefined, fontFamily: fonts["500"], fontSize: 15, lineHeight: 22, color: colors.foreground, textAlignVertical: "top" }}
                                />
                            </View>
                            <Pressable onPress={() => answer(draft)} disabled={!draft.trim()} accessibilityLabel="Send" style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.foreground, opacity: draft.trim() ? 1 : 0.4 }}>
                                <Icon name="arrow-up:lucide" size={20} color={colors.background} />
                            </Pressable>
                        </View>
                    </View>
                ) : null}
            </KeyboardAvoidingView>
        );
    }

    return (
        <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
            {header}
            {state.step === 1 ? (
                <>
                    <Title size={28} top={32}>What kind of business do you run?</Title>
                    <T leading={24} muted style={{ marginTop: 8 }}>Your employee starts with what businesses like yours need. You can change anything later.</T>
                    <View style={{ marginTop: 24, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                        {BUSINESS_KINDS.map((item) => {
                            const chosen = state.kind === item.id;
                            return (
                                <Pressable key={item.id} onPress={() => setState((s) => ({ ...s, kind: item.id }))} accessibilityState={{ selected: chosen }} style={{ width: "48%", flexGrow: 1, minHeight: 96, borderRadius: 16, borderWidth: chosen ? 2 : 1, borderColor: chosen ? colors.foreground : alpha(colors.border, 0.6), padding: chosen ? 13 : 14 }}>
                                    <T weight="600">{item.name}</T>
                                    <T size={12} leading={16} muted style={{ marginTop: 4 }}>{item.hint}</T>
                                </Pressable>
                            );
                        })}
                    </View>
                    <View style={{ flex: 1, minHeight: 32 }} />
                    {big("Continue", () => setState((s) => ({ ...s, step: 2, asked: 0 })), !state.kind)}
                </>
            ) : null}

            {state.step === 3 && state.built ? (
                <>
                    <Title>How did you hear about Cencori Studio?</Title>
                    <T size={14} leading={20} muted style={{ marginTop: 4 }}>Your employee is ready. One quick question before you put it to work.</T>
                    <View style={{ marginTop: 20, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {HEARD_ABOUT_OPTIONS.map((option) => <Pill key={option.id} label={option.label} chosen={heard === option.id} onPress={() => setHeard(option.id)} />)}
                    </View>
                    {heard === "other" || heard === "event" || heard === "friend" ? (
                        <TextInput value={heardDetail} onChangeText={setHeardDetail} maxLength={200} placeholder={heard === "other" ? "Where?" : heard === "event" ? "Which event or community?" : "Who? (optional)"} placeholderTextColor={colors.mutedForeground} style={{ marginTop: 12, height: 48, borderRadius: 16, backgroundColor: colors.muted, paddingHorizontal: 16, fontFamily: fonts["500"], fontSize: 15, color: colors.foreground }} />
                    ) : null}
                    <View style={{ flex: 1, minHeight: 24 }} />
                    {big("Continue", () => {
                        if (heard) void api("/api/me/heard-about", { method: "POST", body: { source: heard, detail: heardDetail.trim() || null, surface: "studio_setup" } }).catch(() => undefined);
                        setState((s) => ({ ...s, step: 4 }));
                    }, !heard)}
                    <Pressable onPress={() => setState((s) => ({ ...s, step: 4 }))} style={{ height: 40, marginTop: 8, justifyContent: "center" }}><T size={14} muted center>Skip</T></Pressable>
                </>
            ) : null}

            {state.step === 4 && state.built ? (
                <>
                    <Title>Where should customers find it?</Title>
                    <T size={14} leading={20} muted style={{ marginTop: 4 }}>Your link works right away. Connect WhatsApp now or later.</T>
                    <View style={{ marginTop: 20, overflow: "hidden", borderRadius: 16, borderWidth: 1, borderColor: alpha(colors.border, 0.6) }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 }}>
                            <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.scheme === "dark" ? alpha(palette.emerald500, 0.15) : "#ecfdf5" }}><Icon name="link-2:lucide" size={20} color={colors.scheme === "dark" ? "#6ee7b7" : palette.emerald700} /></View>
                            <View style={{ flex: 1, minWidth: 0 }}><T weight="600">Your link</T><T size={13} muted lines={1}>For Instagram, a QR code or a table card</T></View>
                            {state.built.shareToken
                                ? <Button kind="outline" height={36} size={14} title="QR code" icon={<Icon name="qr-code:lucide" size={16} color={colors.foreground} />} onPress={openQr} />
                                : <T size={13} weight="600" color={colors.scheme === "dark" ? palette.emerald400 : palette.emerald700}>Ready</T>}
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: alpha(colors.border, 0.6), paddingHorizontal: 16, paddingVertical: 14 }}>
                            <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.muted }}>
                                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.foreground} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.6-5.4A8.4 8.4 0 1 1 21 11.5z" /></Svg>
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}><T weight="600">WhatsApp</T><T size={13} muted>The WhatsApp Business number you already use</T></View>
                            <Button height={36} size={14} title={busy ? "…" : "Connect"} disabled={busy} onPress={() => void connectWhatsApp()} />
                        </View>
                    </View>
                    <T size={12} leading={20} muted style={{ marginTop: 12, paddingHorizontal: 4 }}>Facebook will ask you to log in, confirm your business and approve the connection in the WhatsApp Business app. About two minutes.</T>
                    <View style={{ flex: 1, minHeight: 24 }} />
                    {big("Continue", () => setState((s) => ({ ...s, step: 5 })))}
                    <Pressable onPress={() => setState((s) => ({ ...s, step: 5 }))} style={{ height: 40, marginTop: 8, justifyContent: "center" }}><T size={14} muted center>I&apos;ll do this later</T></Pressable>
                </>
            ) : null}

            {state.step === 5 ? (
                <>
                    <View style={{ marginTop: 40, alignItems: "center" }}>
                        <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: colors.scheme === "dark" ? alpha(palette.emerald500, 0.15) : "#ecfdf5" }}><Icon name="check:lucide" size={32} color={colors.scheme === "dark" ? "#6ee7b7" : palette.emerald700} /></View>
                        <T size={26} weight="600" style={{ marginTop: 16, letterSpacing: -0.65 }}>You&apos;re live</T>
                        <T leading={24} muted center style={{ marginTop: 8, maxWidth: 320 }}>Customers can chat with {state.answers.name || organization.name} now. Put your link where they&apos;ll see it.</T>
                    </View>
                    {state.built?.shareToken ? (
                        <View style={{ marginTop: 24, borderRadius: 16, borderWidth: 1, borderColor: alpha(colors.border, 0.6), paddingHorizontal: 16, paddingVertical: 14 }}>
                            <T size={13} muted>Your link</T>
                            <T size={14} weight="600" lines={1} style={{ marginTop: 2 }}>{shareUrl(state.built.shareToken).replace(/^https?:\/\//, "")}</T>
                            <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
                                <Button kind="outline" height={36} size={14} title="Share link" onPress={shareLink} />
                                <Button kind="outline" height={36} size={14} title="QR code" icon={<Icon name="qr-code:lucide" size={16} color={colors.foreground} />} onPress={openQr} />
                            </View>
                        </View>
                    ) : null}
                    <View style={{ flex: 1, minHeight: 24 }} />
                    {big("Go to Home", finish)}
                </>
            ) : null}
        </ScrollView>
    );
}
