import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { goBack } from "@/lib/navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { useApi } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { useSession } from "@/lib/session";
import { useWorkspace } from "@/lib/workspace";
import { staffInstructions } from "@/lib/setup/staff";
import { DEFAULT_PERSONALITY, PERSONALITY_CHOICES, PersonalityPicker, type Personality } from "@/components/personality";
import { WhatsAppTask } from "@/components/tasks";
import { Icon, type IconName } from "@/ui/icons";
import { AgentOrb, Button, ErrorText, Field, IconButton, KeyboardSafe, Sheet, SheetHeader, Spinner, Switcher, T } from "@/ui/kit";
import { alpha, useColors } from "@/ui/theme";

/** Steps so far: who they are, what they know, WhatsApp. */
const STEPS = 3;
/** What the server reads (cencori lib/embedded/knowledge.ts), up to 8 MB. */
const FILE_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown", "text/csv", "text/html", "application/json"];
const FILE_MAX_BYTES = 8 * 1024 * 1024;

type Source = { id: string; name: string; type: string; url: string | null; status: string; error: string | null };
type Created = { agentId: string; versionId: string };

/**
 * Creating a staff member: who they are (avatar, name, role, personality),
 * then what they know (files, text, links). The avatar is drawn from the id,
 * which is picked here so it doesn't change once they exist; "Continue" on the
 * first step creates them (cencori embedded-agents/studio create_agent, then
 * their personality), and knowledge goes straight onto them.
 */
export default function Setup() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const api = useApi();
    const queryClient = useQueryClient();
    const { workspace } = useWorkspace();
    const project = workspace.project;
    const [step, setStep] = useState(1);
    const [agentId, setAgentId] = useState(() => Crypto.randomUUID());
    const [created, setCreated] = useState<Created | null>(null);
    const [name, setName] = useState("");
    const [role, setRole] = useState("");
    const [personality, setPersonality] = useState<Personality>(DEFAULT_PERSONALITY);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const studio = `/api/projects/${project.id}/embedded-agents/studio`;

    /** Make them (or, coming back to this step, update them), then on to knowledge. */
    const saveWho = async () => {
        setBusy(true);
        setError(null);
        try {
            const instructions = staffInstructions({ name, role, business: project.name });
            const description = role.trim() || null;
            let made = created;
            if (!made) {
                const result = await api<{ agent_id: string; version_id: string }>(studio, { method: "POST", body: { action: "create_agent", agent_id: agentId, name: name.trim(), description, instructions }, fallback: "Couldn't create your staff member." });
                made = { agentId: result.agent_id, versionId: result.version_id };
                // Asking the team to call someone back, and closing a finished chat: what the instructions lean on.
                await api(studio, { method: "POST", body: { action: "save_tools", agent_id: made.agentId, version_id: made.versionId, system_tools: { end_conversation: {}, request_callback: {} } } }).catch(() => undefined);
                setCreated(made);
            } else {
                await api(studio, { method: "POST", body: { action: "save_draft", agent_id: made.agentId, version_id: made.versionId, name: name.trim(), description, instructions }, fallback: "Couldn't save that." });
            }
            await api("/api/studio/employee", { method: "POST", body: { project_id: project.id, agent_id: made.agentId, name: name.trim(), ...personality }, fallback: "Couldn't save their personality." });
            for (const key of ["assistants", "overview"]) void queryClient.invalidateQueries({ queryKey: [key, project.id] });
            // Home reads who's on the staff (and who's live) from the workspace.
            void queryClient.invalidateQueries({ queryKey: ["workspace"] });
            setStep(2);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't create your staff member.");
        } finally {
            setBusy(false);
        }
    };

    const back = () => (step > 1 ? setStep(step - 1) : goBack());
    const finish = () => (created ? router.replace(`/assistant/${created.agentId}`) : goBack());

    /** Leaving knowledge: they go live (tested, then published), so WhatsApp has someone to answer. */
    const goLive = async () => {
        if (!created) return;
        setBusy(true);
        setError(null);
        try {
            await api(studio, { method: "POST", body: { action: "test_version", agent_id: created.agentId, version_id: created.versionId, input: "Hello" }, fallback: `Couldn't get ${name.trim()} ready.`, timeout: 60_000 });
            await api(studio, { method: "POST", body: { action: "publish_version", agent_id: created.agentId, version_id: created.versionId }, fallback: `Couldn't put ${name.trim()} live.` });
            for (const key of ["assistants", "overview"]) void queryClient.invalidateQueries({ queryKey: [key, project.id] });
            // Home reads who's on the staff (and who's live) from the workspace.
            void queryClient.invalidateQueries({ queryKey: ["workspace"] });
            setStep(3);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : `Couldn't put ${name.trim()} live.`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <KeyboardSafe style={{ backgroundColor: colors.background }}>
            <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ marginLeft: -8 }}><IconButton name={step > 1 ? "chevron-left:lucide" : "x:lucide"} label={step > 1 ? "Back" : "Close"} onPress={back} /></View>
                    <T size={13} muted>Step {step} of {STEPS}</T>
                </View>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                    {Array.from({ length: STEPS }, (_, index) => <View key={index} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: index < step ? colors.foreground : colors.muted }} />)}
                </View>
            </View>

            {step === 1 ? (
                <>
                    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
                        <Title>Meet your new staff</Title>
                        <T size={14} leading={22} muted style={{ marginTop: 6 }}>Give them a name and a role. You can change anything later.</T>
                        <View style={{ alignItems: "center", marginTop: 28 }}>
                            <Pressable onPress={created ? undefined : () => setAgentId(Crypto.randomUUID())} accessibilityLabel="Change the avatar" style={{ alignItems: "center" }}>
                                <AgentOrb seed={created?.agentId ?? agentId} size={96} />
                                {!created ? <T size={12} muted style={{ marginTop: 8 }}>Tap to change</T> : null}
                            </Pressable>
                        </View>
                        <Label>Name</Label>
                        <Field value={name} onChangeText={setName} placeholder="e.g. Ada" maxLength={60} autoCapitalize="words" returnKeyType="next" />
                        <Label>Role <T size={13} muted>(optional)</T></Label>
                        <Field value={role} onChangeText={setRole} placeholder="e.g. Receptionist, Sales, Front desk" maxLength={60} autoCapitalize="sentences" />
                        <PersonalityPicker
                            name={name}
                            value={personality}
                            choices={PERSONALITY_CHOICES}
                            onChange={(change, done) => {
                                setPersonality((current) => ({ ...current, ...change }));
                                done?.();
                            }}
                            style={{ marginTop: 28 }}
                        />
                    </ScrollView>
                    <Footer bottom={insets.bottom}>
                        {error ? <ErrorText style={{ marginBottom: 8 }}>{error}</ErrorText> : null}
                        <Button title="Continue" busy={busy} disabled={!name.trim()} onPress={() => void saveWho()} />
                    </Footer>
                </>
            ) : created ? (
                step === 2
                    ? <KnowledgeStep agentId={created.agentId} name={name.trim()} bottom={insets.bottom} busy={busy} error={error} onContinue={() => void goLive()} />
                    : <WhatsAppStep agentId={created.agentId} name={name.trim()} bottom={insets.bottom} onFinish={finish} />
            ) : null}
        </KeyboardSafe>
    );
}

function Title({ children }: { children: ReactNode }) {
    return <T size={28} weight="600" leading={34} style={{ letterSpacing: -0.7 }}>{children}</T>;
}

function Label({ children }: { children: ReactNode }) {
    return <T size={13} weight="600" style={{ marginTop: 20, marginBottom: 8, paddingHorizontal: 4 }}>{children}</T>;
}

function Footer({ children, bottom }: { children: ReactNode; bottom: number }) {
    return <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: bottom + 16 }}>{children}</View>;
}

/** What they know: files, typed or pasted text, and links. Each one is read and live as soon as it's added. */
function KnowledgeStep({ agentId, name, bottom, busy, error: stepError, onContinue }: { agentId: string; name: string; bottom: number; busy: boolean; error: string | null; onContinue: () => void }) {
    const colors = useColors();
    const api = useApi();
    const { token } = useSession();
    const { workspace } = useWorkspace();
    const base = `/api/projects/${workspace.project.id}/embedded-agents/${agentId}/knowledge`;
    const sources = useQuery({
        queryKey: ["knowledge", agentId],
        queryFn: () => api<{ sources: Source[] }>(base, { fallback: "Couldn't load what they know." }),
        // Links and files are read in the background: check back until they're done.
        refetchInterval: (query) => (query.state.data?.sources.some((source) => source.status === "queued" || source.status === "processing") ? 3_000 : false),
    });
    const [sheet, setSheet] = useState<"text" | "link" | null>(null);
    const [uploading, setUploading] = useState(false);
    const [removing, setRemoving] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const upload = async () => {
        setError(null);
        const picked = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: FILE_TYPES });
        if (picked.canceled) return;
        setUploading(true);
        try {
            for (const file of picked.assets) {
                if (file.size && file.size > FILE_MAX_BYTES) throw new Error(`${file.name} is over 8 MB.`);
                const form = new FormData();
                form.append("file", { uri: file.uri, name: file.name, type: file.mimeType ?? "application/octet-stream" } as unknown as Blob);
                const response = await fetch(`${API_URL}${base}`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form, credentials: "omit" });
                const payload = await response.json().catch(() => null) as { error?: string } | null;
                if (!response.ok) throw new Error(payload?.error ?? `Couldn't add ${file.name}.`);
            }
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't add that file.");
        } finally {
            setUploading(false);
            void sources.refetch();
        }
    };
    const remove = async (id: string) => {
        setRemoving(id);
        setError(null);
        try {
            await api(`${base}?source_id=${encodeURIComponent(id)}`, { method: "DELETE", fallback: "Couldn't remove that." });
            await sources.refetch();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't remove that.");
        } finally {
            setRemoving(null);
        }
    };
    const list = sources.data?.sources ?? [];

    return (
        <>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24 }}>
                <Title>What should {name || "they"} know?</Title>
                <T size={14} leading={22} muted style={{ marginTop: 6 }}>Your prices, services, opening hours, policies. Add files, type it in, or add a link. You can add more later.</T>
                <View style={{ marginTop: 24, gap: 10 }}>
                    <AddRow icon="document-text" title="Upload a file" detail="PDF, Word, text or CSV, up to 8 MB" busy={uploading} onPress={() => void upload()} />
                    <AddRow icon="pen" title="Write or paste" detail="A price list, FAQs, anything in your words" onPress={() => setSheet("text")} />
                    <AddRow icon="link" title="Add a link" detail="Your website, a menu page, a Google Doc" onPress={() => setSheet("link")} />
                </View>
                {error ? <ErrorText style={{ marginTop: 12 }}>{error}</ErrorText> : null}
                {list.length ? (
                    <View style={{ marginTop: 28 }}>
                        <T size={13} weight="600" style={{ marginBottom: 8, paddingHorizontal: 4 }}>Added</T>
                        <View style={{ borderRadius: 16, backgroundColor: colors.muted }}>
                            {list.map((source, index) => (
                                <View key={source.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 16, paddingRight: 6, paddingVertical: 12, borderTopWidth: index ? 1 : 0, borderTopColor: alpha(colors.border, 0.4) }}>
                                    <Icon name={source.type === "url" ? "link" : source.type === "inline" ? "pen" : "document-text"} size={18} color={colors.mutedForeground} />
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <T lines={1}>{source.name}</T>
                                        <T size={12} muted lines={1} color={source.status === "failed" ? colors.destructive : undefined}>
                                            {source.status === "failed" ? source.error ?? "Couldn't read it" : source.status === "ready" ? "Ready" : "Reading…"}
                                        </T>
                                    </View>
                                    {removing === source.id ? <View style={{ padding: 10 }}><Spinner /></View> : (
                                        <IconButton name="x:lucide" label={`Remove ${source.name}`} size={36} iconSize={16} color={colors.mutedForeground} onPress={() => void remove(source.id)} />
                                    )}
                                </View>
                            ))}
                        </View>
                    </View>
                ) : null}
            </ScrollView>
            <Footer bottom={bottom}>
                {stepError ? <ErrorText style={{ marginBottom: 8 }}>{stepError}</ErrorText> : null}
                <Button title={list.length ? "Continue" : "Skip for now"} kind={list.length ? "primary" : "muted"} busy={busy} onPress={onContinue} />
            </Footer>
            <TextSheet open={sheet === "text"} onClose={() => setSheet(null)} base={base} onAdded={() => void sources.refetch()} />
            <LinkSheet open={sheet === "link"} onClose={() => setSheet(null)} base={base} onAdded={() => void sources.refetch()} />
        </>
    );
}

/**
 * Where customers reach them: the same connect as everywhere in the app
 * (components/tasks.tsx WhatsAppTask): a number of their own with a code, no
 * Facebook, or the owner's WhatsApp Business app number. Once connected it
 * shows the number, and Done.
 */
function WhatsAppStep({ agentId, name, bottom, onFinish }: { agentId: string; name: string; bottom: number; onFinish: () => void }) {
    const { workspace } = useWorkspace();
    const [connected, setConnected] = useState(0);
    return (
        <>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
                <Title>Give {name || "them"} a WhatsApp number</Title>
                <T size={14} leading={22} muted style={{ marginTop: 6, marginBottom: 24 }}>Customers message this number and {name || "they"} answer, day and night.</T>
                {/* Remounted once connected, so it reads the number back and shows it. */}
                <WhatsAppTask key={connected} agentBase={`/api/projects/${workspace.project.id}/embedded-agents/${agentId}`} agentId={agentId} onDone={() => setConnected((count) => count + 1)} />
            </ScrollView>
            <Footer bottom={bottom}>
                <Button title={connected ? "Done" : "Skip for now"} kind={connected ? "primary" : "muted"} onPress={onFinish} />
            </Footer>
        </>
    );
}

function AddRow({ icon, title, detail, onPress, busy }: { icon: IconName; title: string; detail: string; onPress: () => void; busy?: boolean }) {
    const colors = useColors();
    return (
        <Pressable onPress={onPress} disabled={busy} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 20, borderWidth: 1, borderColor: alpha(colors.border, 0.6), padding: 16, opacity: busy ? 0.6 : pressed ? 0.8 : 1 })}>
            <Icon name={icon} size={22} color={colors.foreground} />
            <View style={{ flex: 1, minWidth: 0 }}>
                <T weight="600">{title}</T>
                <T size={13} muted style={{ marginTop: 2 }}>{detail}</T>
            </View>
            {busy ? <Spinner /> : <Icon name="plus:lucide" size={18} color={colors.mutedForeground} />}
        </Pressable>
    );
}

function TextSheet({ open, onClose, base, onAdded }: { open: boolean; onClose: () => void; base: string; onAdded: () => void }) {
    const api = useApi();
    const [title, setTitle] = useState("");
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await api(base, { method: "POST", body: { name: title.trim() || "About the business", text: text.trim() }, fallback: "Couldn't add that." });
            setTitle("");
            setText("");
            onAdded();
            onClose();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't add that.");
        } finally {
            setBusy(false);
        }
    };
    return (
        <Sheet open={open} onClose={onClose}>
            <SheetHeader title="Write or paste" onClose={onClose} />
            <Field value={title} onChangeText={setTitle} placeholder="Name it, e.g. Price list" style={{ marginTop: 16 }} />
            <Field value={text} onChangeText={setText} multiline placeholder={"Knotless braids, medium: ₦25,000\nOpen Monday to Saturday, 9am to 7pm…"} style={{ marginTop: 8, minHeight: 200, borderRadius: 20, paddingTop: 14, paddingBottom: 14, textAlignVertical: "top" }} />
            {error ? <ErrorText style={{ marginTop: 8 }}>{error}</ErrorText> : null}
            <View style={{ flex: 1, minHeight: 16 }} />
            <Button title="Add it" busy={busy} disabled={!text.trim()} onPress={() => void save()} />
        </Sheet>
    );
}

function LinkSheet({ open, onClose, base, onAdded }: { open: boolean; onClose: () => void; base: string; onAdded: () => void }) {
    const api = useApi();
    const [url, setUrl] = useState("");
    const [kind, setKind] = useState<"single" | "website">("single");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const save = async () => {
        setBusy(true);
        setError(null);
        const address = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
        try {
            // A whole website is read page by page; the first pages come back before this does.
            await api(base, { method: "POST", body: { url: address, kind }, fallback: "Couldn't read that link.", timeout: 60_000 });
            setUrl("");
            onAdded();
            onClose();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't read that link.");
        } finally {
            setBusy(false);
        }
    };
    return (
        <Sheet open={open} onClose={onClose}>
            <SheetHeader title="Add a link" onClose={onClose} />
            <Field value={url} onChangeText={setUrl} keyboardType="url" autoCapitalize="none" autoCorrect={false} placeholder="yourbusiness.com/prices" style={{ marginTop: 16 }} />
            <Switcher value={kind} onChange={setKind} options={[{ id: "single", label: "Just this page" }, { id: "website", label: "The whole website" }]} style={{ marginTop: 12 }} />
            {error ? <ErrorText style={{ marginTop: 8 }}>{error}</ErrorText> : null}
            <View style={{ flex: 1, minHeight: 16 }} />
            <Button title={busy ? (kind === "website" ? "Reading the website…" : "Reading the page…") : "Add it"} busy={busy} disabled={!url.trim()} onPress={() => void save()} />
        </Sheet>
    );
}
