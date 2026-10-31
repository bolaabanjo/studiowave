import { useEffect, useState } from "react";
import { useBusinessTimeZone, zoneCity } from "@/lib/time-zone";
import { Platform, Pressable, Share, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useApi } from "@/lib/api";
import { SITE_URL } from "@/lib/config";
import { pickPhotos } from "@/lib/photos";
import { useWorkspace } from "@/lib/workspace";
import { Icon, type IconName } from "@/ui/icons";
import { Button, ErrorText, Spinner, Switcher, T, siteImage } from "@/ui/kit";
import { alpha, fonts, palette, useColors } from "@/ui/theme";

/**
 * The task sheets' bodies (cencori components/studio/StudioTasks.tsx), one
 * per thing an owner sets up. Each calls onDone when it's finished; the
 * sheet closes and everything reloads.
 */

export function Primary({ title, busy, disabled, onPress, danger }: { title: string; busy?: boolean; disabled?: boolean; onPress: () => void; danger?: boolean }) {
    const colors = useColors();
    return (
        <Pressable onPress={onPress} disabled={busy || disabled} style={{ marginTop: 20, height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 999, backgroundColor: danger ? colors.destructive : colors.foreground, opacity: busy || disabled ? (danger ? 0.4 : 0.5) : 1 }}>
            {busy ? <Spinner color={danger ? "#ffffff" : colors.background} /> : null}
            <T weight="600" color={danger ? "#ffffff" : colors.background}>{title}</T>
        </Pressable>
    );
}

function ErrorLine({ error }: { error: string | null }) {
    return error ? <ErrorText style={{ marginTop: 12 }}>{error}</ErrorText> : null;
}

/** The sheets' fields (rounded-2xl bg-muted px-4 text-[15px]). */
function Input({ round, mono, style, ...props }: React.ComponentProps<typeof TextInput> & { round?: boolean; mono?: boolean }) {
    const colors = useColors();
    return (
        <TextInput
            placeholderTextColor={colors.mutedForeground}
            {...props}
            style={[{ borderRadius: round ? 999 : 16, backgroundColor: colors.muted, paddingHorizontal: round ? 20 : 16, fontFamily: mono ? "Menlo" : fonts["500"], fontSize: mono ? 14 : 15, color: colors.foreground }, props.multiline ? { minHeight: 180, paddingTop: 12, paddingBottom: 12, lineHeight: 24, textAlignVertical: "top" } : { height: 48 }, style]}
        />
    );
}

function Loading() {
    return <View style={{ marginTop: 20, alignItems: "center" }}><Spinner /></View>;
}

/** What the assistant should know: typed or pasted, read from a photo, or a website. */
export function KnowledgeTask({ agentBase, onDone }: { agentBase: string; onDone: () => void }) {
    const colors = useColors();
    const api = useApi();
    const projectId = useWorkspace().workspace.project.id;
    const [mode, setMode] = useState<"text" | "website">("text");
    const [name, setName] = useState("");
    const [text, setText] = useState("");
    const [url, setUrl] = useState("");
    const [busy, setBusy] = useState<"saving" | "reading" | null>(null);
    const [error, setError] = useState<string | null>(null);

    const readPhotos = async () => {
        setError(null);
        try {
            const images = await pickPhotos({ max: 4 });
            if (!images) return;
            setBusy("reading");
            const { text: read } = await api<{ text: string }>("/api/studio/menu-photo", { method: "POST", body: { project_id: projectId, images: images.map(({ data, mime_type }) => ({ data, mime_type })) } });
            setText((current) => (current.trim() ? `${current.trim()}\n\n${read}` : read));
            if (!name.trim()) setName("Menu");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't read that photo.");
        } finally {
            setBusy(null);
        }
    };
    const save = async () => {
        setBusy("saving");
        setError(null);
        try {
            if (mode === "website") await api(`${agentBase}/knowledge`, { method: "POST", body: { url: url.trim(), kind: "website" } });
            else await api(`${agentBase}/knowledge`, { method: "POST", body: { name: name.trim() || "About the business", text: text.trim() } });
            onDone();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't add that.");
            setBusy(null);
        }
    };
    return (
        <>
            <Switcher value={mode} onChange={setMode} options={[{ id: "text", label: "Type or photo" }, { id: "website", label: "Your website" }]} />
            {mode === "text" ? (
                <>
                    <Input value={name} onChangeText={setName} placeholder="Name it, e.g. Menu" style={{ marginTop: 16 }} />
                    <Input value={text} onChangeText={setText} multiline placeholder="Jollof rice ₦6,500…" style={{ marginTop: 8 }} />
                    <Pressable onPress={() => void readPhotos()} disabled={busy !== null} style={{ marginTop: 8, alignSelf: "flex-start", height: 40, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, borderColor: alpha(colors.border, 0.6), paddingHorizontal: 16, opacity: busy !== null ? 0.6 : 1 }}>
                        {busy === "reading" ? <Spinner /> : <Icon name="camera:lucide" size={16} color={colors.foreground} />}
                        <T size={14}>{busy === "reading" ? "Reading your photo…" : "Take a photo instead"}</T>
                    </Pressable>
                </>
            ) : (
                <Input value={url} onChangeText={setUrl} keyboardType="url" autoCapitalize="none" autoCorrect={false} placeholder="yourbusiness.com" style={{ marginTop: 16 }} />
            )}
            <ErrorLine error={error} />
            <Primary title="Add it" busy={busy === "saving"} disabled={mode === "text" ? !text.trim() : !url.trim()} onPress={() => void save()} />
        </>
    );
}

type WhatsAppState = { channel: { display_phone_number?: string | null } | null; signup: { app_id: string } | null; kapso: boolean };

/**
 * Connect WhatsApp: Meta's own signup in the phone's browser, coming back to
 * the app to finish (cencori app/api/studio/whatsapp/start, finish), or Kapso's.
 * Either way the owner chooses: keep their WhatsApp Business app number
 * (shared), or give the employee a number of its own (a new SIM that isn't on
 * WhatsApp, answered from Studio).
 */
export function WhatsAppTask({ agentBase, agentId, onDone }: { agentBase: string; agentId: string; onDone: () => void }) {
    const api = useApi();
    const projectId = useWorkspace().workspace.project.id;
    const [state, setState] = useState<WhatsAppState | null>(null);
    const [keepApp, setKeepApp] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const load = () => api<WhatsAppState>(`${agentBase}/whatsapp`).then(setState).catch((cause) => setError(cause instanceof Error ? cause.message : "Couldn't load it."));
    useEffect(() => { void load(); }, [agentBase]); // eslint-disable-line react-hooks/exhaustive-deps

    const withMeta = async () => {
        setBusy(true);
        setError(null);
        try {
            const { url } = await api<{ url: string }>("/api/studio/whatsapp/start", { method: "POST", body: { project_id: projectId, agent_id: agentId, coexistence: keepApp } });
            const result = await WebBrowser.openAuthSessionAsync(url, "cencori-studio://whatsapp");
            if (result.type !== "success") return;
            const params = new URL(result.url).searchParams;
            if (params.get("outcome") !== "handoff") throw new Error(params.get("message") || "WhatsApp didn't finish connecting. Try again.");
            await api("/api/studio/whatsapp/finish", { method: "POST", body: { handoff: params.get("handoff") } });
            onDone();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't connect WhatsApp.");
        } finally {
            setBusy(false);
        }
    };
    const withKapso = async () => {
        setBusy(true);
        setError(null);
        try {
            const { url } = await api<{ url: string }>(`${agentBase}/whatsapp`, { method: "POST", body: { action: "kapso_link", return_path: "/", own_number: !keepApp } });
            await WebBrowser.openBrowserAsync(url);
            await load();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't start connecting WhatsApp.");
        } finally {
            setBusy(false);
        }
    };

    if (!state) return error ? <ErrorLine error={error} /> : <Loading />;
    if (state.channel) {
        return (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name="check:lucide" size={16} color={palette.emerald600} />
                <T leading={24}>Connected{state.channel.display_phone_number ? `: ${state.channel.display_phone_number}` : ""}</T>
            </View>
        );
    }
    const choice = (
        <ToggleRow
            title="Keep the WhatsApp Business app"
            detail={keepApp
                ? "Same number. You can still reply from your phone."
                : "Off: your employee gets its own number. Use a new SIM that has never been on WhatsApp; you'll reply to customers from Studio, not the WhatsApp app."}
            on={keepApp}
            onPress={() => setKeepApp((value) => !value)}
        />
    );
    if (!state.signup) {
        return (
            <>
                {choice}
                <ErrorLine error={error} />
                <Primary title={keepApp ? "Connect WhatsApp" : "Connect its own number"} busy={busy} disabled={!state.kapso} onPress={() => void withKapso()} />
            </>
        );
    }
    return (
        <>
            {choice}
            <ErrorLine error={error} />
            <Primary title={keepApp ? "Connect WhatsApp" : "Connect its own number"} busy={busy} onPress={() => void withMeta()} />
            {state.kapso ? <Pressable disabled={busy} onPress={() => void withKapso()} style={{ marginTop: 16 }}><T size={13} muted center>Other way to connect</T></Pressable> : null}
        </>
    );
}

function ToggleRow({ title, detail, on, onPress }: { title: string; detail: string; on: boolean; onPress: () => void }) {
    const colors = useColors();
    return (
        <Pressable onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: on }} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, backgroundColor: colors.muted, paddingHorizontal: 16, paddingVertical: 14 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
                <T>{title}</T>
                <T size={13} leading={20} muted>{detail}</T>
            </View>
            <View style={{ width: 48, height: 28, borderRadius: 14, padding: 2, justifyContent: "center", backgroundColor: on ? palette.emerald600 : alpha(colors.mutedForeground, 0.3) }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#ffffff", transform: [{ translateX: on ? 20 : 0 }] }} />
            </View>
        </Pressable>
    );
}

/** Test the latest version and make it what customers talk to. */
export function GoLiveTask({ agentId, agentBase, onDone }: { agentId: string; agentBase: string; onDone: () => void }) {
    const api = useApi();
    const projectId = useWorkspace().workspace.project.id;
    const [steps, setSteps] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const studio = `/api/projects/${projectId}/embedded-agents/studio`;
    const goLive = async () => {
        setBusy(true);
        setError(null);
        setSteps([]);
        try {
            const { version_id } = await api<{ version_id: string }>(studio, { method: "POST", body: { action: "new_version", agent_id: agentId } });
            await api(studio, { method: "POST", body: { action: "test_version", agent_id: agentId, version_id, input: "Hello" } });
            setSteps((current) => [...current, "Tested it"]);
            await api(studio, { method: "POST", body: { action: "publish_version", agent_id: agentId, version_id } });
            setSteps((current) => [...current, "Made it live"]);
            await api(`${agentBase}/widget`, { method: "PUT", body: {} }).catch(() => undefined);
            setSteps((current) => [...current, "Your link is ready"]);
            setTimeout(onDone, 700);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't make it live. Try again.");
            setBusy(false);
        }
    };
    return (
        <>
            {steps.length ? (
                <View style={{ marginTop: 16, gap: 6 }}>
                    {steps.map((step) => <View key={step} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Icon name="check:lucide" size={16} color={palette.emerald600} /><T size={14}>{step}</T></View>)}
                </View>
            ) : null}
            <ErrorLine error={error} />
            <Primary title="Go live" busy={busy} onPress={() => void goLive()} />
        </>
    );
}

type WidgetState = { enabled: boolean; allowed_origins: string[]; public_key: string } | null;

/** The chat bubble on the owner's own website: their address, then the code to paste (or send to whoever built the site). */
export function WebsiteTask({ agentBase }: { agentBase: string }) {
    const colors = useColors();
    const api = useApi();
    const { workspace } = useWorkspace();
    const [widget, setWidget] = useState<WidgetState | undefined>(undefined);
    const [site, setSite] = useState("");
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        api<{ widget: WidgetState }>(`${agentBase}/widget`)
            .then((body) => {
                setWidget(body.widget ?? null);
                setSite(body.widget?.allowed_origins[0]?.replace(/^https?:\/\//, "") ?? "");
            })
            .catch((cause) => setError(cause instanceof Error ? cause.message : "Couldn't load it."));
    }, [agentBase, api]);
    const save = async (body: Record<string, unknown>) => {
        setBusy(true);
        setError(null);
        try {
            const result = await api<{ widget: WidgetState }>(`${agentBase}/widget`, { method: "PUT", body });
            setWidget(result.widget);
            setSite("");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "That didn't work.");
        } finally {
            setBusy(false);
        }
    };
    if (widget === undefined) return error ? <ErrorLine error={error} /> : <Loading />;
    if (!widget?.enabled) {
        const known = widget?.allowed_origins ?? [];
        return (
            <>
                <T leading={24} muted>Your website&apos;s address.</T>
                <Input value={site} onChangeText={setSite} keyboardType="url" autoCapitalize="none" autoCorrect={false} placeholder="yourbusiness.com" style={{ marginTop: 16 }} />
                <ErrorLine error={error} />
                <Primary title="Turn on" busy={busy} disabled={!site.trim()} onPress={() => void save({ allowed_origins: [...new Set([...known, site.trim()])], enabled: true })} />
            </>
        );
    }
    const snippet = `<script src="${SITE_URL}/widget.js" data-key="${widget.public_key}" async></script>`;
    const forDeveloper = `Please add this to every page of our website, just before </body>. It adds the chat bubble for our assistant.\n\n${snippet}`;
    const copy = async () => {
        await Clipboard.setStringAsync(snippet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <>
            <T leading={24} muted>On for {widget.allowed_origins.map((origin) => origin.replace(/^https?:\/\//, "")).join(", ")}. Paste this on your site, before &lt;/body&gt;.</T>
            <View style={{ marginTop: 16, borderRadius: 16, backgroundColor: colors.muted, paddingHorizontal: 16, paddingVertical: 12 }}>
                <T size={12} leading={20} style={{ fontFamily: "Menlo" }}>{snippet}</T>
            </View>
            <View style={{ marginTop: 12, flexDirection: "row", gap: 10 }}>
                <Button kind="outline" grow title={copied ? "Copied" : "Copy code"} icon={copied ? <Icon name="check:lucide" size={16} color={colors.foreground} /> : undefined} onPress={() => void copy()} />
                <Button grow title="Send to developer" onPress={() => void Share.share({ title: `${workspace.agents[0]?.name ?? "Our"} chat for the website`, message: forDeveloper }).catch(() => undefined)} />
            </View>
            <ErrorLine error={error} />
            <Pressable disabled={busy} onPress={() => void save({ enabled: false })} style={{ marginTop: 16 }}><T size={13} muted center>Turn off</T></Pressable>
        </>
    );
}

/** Who gets emailed about bookings, callbacks and payments. */
export function AlertsTask({ agentBase, email, onDone }: { agentBase: string; email: string | null; onDone: () => void }) {
    const api = useApi();
    const [emails, setEmails] = useState(email ?? "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await api(`${agentBase}/alerts`, { method: "PUT", body: { emails: emails.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean) } });
            onDone();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't save that.");
            setBusy(false);
        }
    };
    return (
        <>
            <Input value={emails} onChangeText={setEmails} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="you@business.com" style={{ marginTop: 16 }} />
            <ErrorLine error={error} />
            <Primary title="Save" busy={busy} disabled={!emails.trim()} onPress={() => void save()} />
        </>
    );
}

const PROVIDER_LOGOS: Record<string, string> = { paystack: "/payments/paystack.svg", flutterwave: "/payments/flutterwave.png", stripe: "/payments/stripe.png" };
const PROVIDER_LOGO_INSET: Record<string, number> = { paystack: 6, flutterwave: 6 };
const KNOWN_PROVIDERS = [{ id: "paystack", name: "Paystack" }, { id: "flutterwave", name: "Flutterwave" }, { id: "stripe", name: "Stripe" }];
const PROVIDER_PAYS_WITH: Record<string, string> = { paystack: "Cards, transfer, USSD", flutterwave: "Cards, transfer, mobile money", stripe: "Cards from anywhere" };

/** A payment provider account, by its secret key, so the assistant can send payment links. */
export function PaymentsTask({ onDone }: { onDone: () => void }) {
    const colors = useColors();
    const api = useApi();
    const projectId = useWorkspace().workspace.project.id;
    const [providers, setProviders] = useState<Array<{ id: string; name: string; key_help: string; key_placeholder: string; available: boolean }>>([]);
    const [provider, setProvider] = useState("paystack");
    const [key, setKey] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        api<{ providers: typeof providers }>(`/api/projects/${projectId}/payments`).then((body) => setProviders(body.providers.filter((item) => item.available))).catch(() => undefined);
    }, [projectId, api]);
    const chosen = providers.find((item) => item.id === provider);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await api(`/api/projects/${projectId}/payments`, { method: "PUT", body: { provider, secret_key: key.trim() } });
            onDone();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't connect that.");
            setBusy(false);
        }
    };
    return (
        <View style={{ flex: 1 }}>
            <View style={{ marginTop: 8, overflow: "hidden", borderRadius: 16, backgroundColor: colors.muted }}>
                {(providers.length ? providers : KNOWN_PROVIDERS).map((item, index) => {
                    const on = provider === item.id;
                    return (
                        <Pressable key={item.id} onPress={() => setProvider(item.id)} accessibilityState={{ selected: on }} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: index ? 1 : 0, borderTopColor: alpha(colors.border, 0.6) }}>
                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#ffffff", padding: PROVIDER_LOGO_INSET[item.id] ?? 0, overflow: "hidden" }}>
                                {PROVIDER_LOGOS[item.id] ? <Image source={{ uri: siteImage(PROVIDER_LOGOS[item.id]) }} style={{ flex: 1 }} contentFit="contain" /> : null}
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <T weight="600">{item.name}</T>
                                <T size={13} muted lines={1}>{PROVIDER_PAYS_WITH[item.id] ?? ""}</T>
                            </View>
                            <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center", borderColor: on ? colors.foreground : alpha(colors.mutedForeground, 0.4) }}>
                                {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.foreground }} /> : null}
                            </View>
                        </Pressable>
                    );
                })}
            </View>
            <Input round mono value={key} onChangeText={setKey} autoCapitalize="none" autoCorrect={false} spellCheck={false} placeholder={chosen?.key_placeholder || "Secret key"} accessibilityLabel="Secret key" style={{ marginTop: 12 }} />
            <ErrorLine error={error} />
            <View style={{ flex: 1 }} />
            <Primary title="Connect" busy={busy} disabled={!key.trim()} onPress={() => void save()} />
        </View>
    );
}

interface BusinessPlanOption { id: string; name: string; price_ngn: number; conversations: number; agents: number; extras?: string[] }

/** Starter, Growth or Business: a 30-day pass, paid through Bachs in the browser, back to the app after. */
export function PlansTask({ onDone }: { onDone: () => void }) {
    const colors = useColors();
    const api = useApi();
    const organizationId = useWorkspace().workspace.organization.id;
    const [data, setData] = useState<{ plan: { id: string } | null; active: boolean; plans: BusinessPlanOption[] } | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        api<NonNullable<typeof data>>(`/api/billing/business?orgId=${organizationId}`).then(setData).catch((cause) => setError(cause instanceof Error ? cause.message : "Couldn't load the plans."));
    }, [organizationId, api]);
    const choose = async (plan: string) => {
        setBusy(plan);
        setError(null);
        try {
            const { url } = await api<{ url: string }>("/api/billing/business", { method: "POST", body: { orgId: organizationId, action: "checkout", plan } });
            await WebBrowser.openBrowserAsync(url);
            // The plan switches on when Bachs tells Studio, moments after paying.
            onDone();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't open checkout.");
        } finally {
            setBusy(null);
        }
    };
    const naira = (amount: number) => `₦${amount.toLocaleString("en-NG")}`;
    return (
        <>
            <T leading={24} muted>30 days each. Card, transfer or USSD.</T>
            {!data && !error ? <Loading /> : null}
            <View style={{ marginTop: 16, gap: 10 }}>
                {data?.plans.map((option) => {
                    const current = data.active && data.plan?.id === option.id;
                    return (
                        <View key={option.id} style={{ borderRadius: 16, borderWidth: 1, borderColor: current ? colors.foreground : alpha(colors.border, 0.6), paddingHorizontal: 16, paddingVertical: 14 }}>
                            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                                <T weight="600" style={{ flexShrink: 1 }}>{option.name} <T size={12} weight="400" muted>{naira(Math.round((option.price_ngn / option.conversations) * 100) / 100)} a chat</T></T>
                                <T weight="600">{naira(option.price_ngn)}<T size={12} weight="400" muted> / 30 days</T></T>
                            </View>
                            <T size={13} leading={20} muted style={{ marginTop: 4 }}>
                                {option.conversations.toLocaleString("en-NG")} chats · {option.agents} {option.agents === 1 ? "employee" : "staff"}{option.extras?.length ? ` · ${option.extras.join(" · ")}` : ""}
                            </T>
                            <Button kind={current ? "outline" : "primary"} height={40} size={14} title={current ? "Pay for another 30 days" : `Choose ${option.name}`} busy={busy === option.id} disabled={busy !== null} onPress={() => void choose(option.id)} style={{ marginTop: 12 }} />
                        </View>
                    );
                })}
            </View>
            <ErrorLine error={error} />
        </>
    );
}

type TierDraft = { id?: string; name: string; price: string; capacity: string };
type EventForm = { name: string; starts_at: string; venue: string; description: string; banner_url: string | null; tiers: Array<{ id: string; name: string; price: number; capacity: number | null }>; sold: Record<string, number> };

const TIER_TONES = [palette.violet400, palette.orange400, palette.emerald400, palette.sky400, "#f472b6", palette.amber400];

/** A ticket type's icon: a star for the premium ones, a sale tag for the cheap ones, a plain ticket otherwise (TicketTierIcon). */
export function TicketTierIcon({ name, index, size = 18 }: { name: string; index: number; size?: number }) {
    const colors = useColors();
    const icon: IconName = /\b(v+ip|table|premium|gold|platinum|exec|backstage)\b/i.test(name) ? "ticket-star"
        : /\b(early|bird|promo|discount|sale|student|group)\b/i.test(name) ? "ticket-sale" : "ticket";
    const color = index === 0 ? colors.mutedForeground : TIER_TONES[(index - 1) % TIER_TONES.length];
    return (
        <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: index === 0 ? alpha(colors.foreground, 0.1) : alpha(color, 0.15) }}>
            <Icon name={icon} size={size} color={color} />
        </View>
    );
}

/**
 * A party, a show, a dinner: what, when, where, and the tickets. New, or
 * (with eventId) the same form filled in to change it; ticket types that have
 * sold can't be removed, and moving the date or place emails everyone who has
 * a ticket.
 */
export function EventTask({ eventId, onDone }: { eventId: string | null; onDone: () => void }) {
    // Times are shown and picked on the business's clock: the form waits for it.
    const timeZone = useBusinessTimeZone();
    const colors = useColors();
    const api = useApi();
    const projectId = useWorkspace().workspace.project.id;
    const [loaded, setLoaded] = useState<EventForm | null>(null);
    const [name, setName] = useState("");
    const [startsAt, setStartsAt] = useState<Date | null>(null);
    const [picking, setPicking] = useState<"date" | "time" | null>(null);
    // Now (a new event can't start before it), and a week from now on the hour, where the picker starts.
    const [today] = useState(() => new Date());
    const suggested = new Date(Math.ceil(today.getTime() / 3_600_000) * 3_600_000 + 7 * 86_400_000);
    const [venue, setVenue] = useState("");
    const [description, setDescription] = useState("");
    const [tiers, setTiers] = useState<TierDraft[]>([{ name: "Regular", price: "", capacity: "" }]);
    const [busy, setBusy] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [banner, setBanner] = useState<{ preview: string; upload: { data: string; mime_type: string } | null } | null>(null);
    const [bannerRemoved, setBannerRemoved] = useState(false);
    // A new event that saved but whose banner didn't: Save then retries only the banner.
    const [createdId, setCreatedId] = useState<string | null>(null);
    const setTier = (index: number, patch: Partial<TierDraft>) => setTiers((current) => current.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));

    useEffect(() => {
        if (!eventId) return;
        api<{ event: { event: Omit<EventForm, "sold">; by_tier: Array<{ id: string; sold: number }> } }>(`/api/studio/events?project_id=${projectId}&event_id=${eventId}`)
            .then(({ event }) => {
                setLoaded({ ...event.event, sold: Object.fromEntries(event.by_tier.map((tier) => [tier.id, tier.sold])) });
                setName(event.event.name);
                setStartsAt(new Date(event.event.starts_at));
                setVenue(event.event.venue);
                setDescription(event.event.description);
                if (event.event.banner_url) setBanner({ preview: event.event.banner_url, upload: null });
                setTiers(event.event.tiers.map((tier) => ({ id: tier.id, name: tier.name, price: String(tier.price), capacity: tier.capacity === null ? "" : String(tier.capacity) })));
            })
            .catch((cause) => setError(cause instanceof Error ? cause.message : "Couldn't load the event."));
    }, [eventId, projectId, api]);

    const pickBanner = async () => {
        setError(null);
        try {
            // Big enough for a flyer's small print, small enough to load on a phone.
            const [picked] = (await pickPhotos({ maxSide: 1600, quality: 0.88 })) ?? [];
            if (picked) setBanner({ preview: picked.uri, upload: { data: picked.data, mime_type: picked.mime_type } });
        } catch {
            setError("Couldn't read that picture. Try another.");
        }
    };

    const save = async () => {
        if (!startsAt) return;
        setBusy(true);
        setError(null);
        const fields = {
            name,
            venue,
            description,
            starts_at: startsAt.toISOString(),
            tiers: tiers.map((tier) => ({ ...(tier.id ? { id: tier.id } : {}), name: tier.name, price: Number(tier.price.replace(/[^\d.]/g, "") || 0), capacity: tier.capacity.trim() ? Number(tier.capacity.replace(/\D/g, "")) : null })),
        };
        try {
            const saveBanner = async (id: string) => {
                if (banner?.upload) await api("/api/studio/events/banner", { method: "POST", body: { project_id: projectId, event_id: id, ...banner.upload } });
                else if (bannerRemoved && !banner) await api("/api/studio/events/banner", { method: "DELETE", body: { project_id: projectId, event_id: id } });
            };
            if (eventId) {
                await api("/api/studio/events", { method: "POST", body: { project_id: projectId, action: "update", event_id: eventId, ...fields } });
                await saveBanner(eventId);
                onDone();
            } else {
                const id = createdId ?? (await api<{ event: { id: string } }>("/api/studio/events", { method: "POST", body: { project_id: projectId, action: "create", ...fields } })).event.id;
                try {
                    await saveBanner(id);
                } catch (cause) {
                    // Said, not swallowed: the event was there without its banner and nothing told the owner.
                    setCreatedId(id);
                    setError(`Your event is saved, but its banner didn't upload: ${cause instanceof Error ? cause.message : "try again"} Tap Save to try again.`);
                    setBusy(false);
                    return;
                }
                onDone();
                router.push(`/event/${id}`);
            }
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't save the event.");
            setBusy(false);
        }
    };
    const cancel = async () => {
        if (!eventId) return;
        if (!cancelling) {
            setCancelling(true);
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await api("/api/studio/events", { method: "POST", body: { project_id: projectId, action: "update", event_id: eventId, status: "cancelled" } });
            onDone();
            router.navigate({ pathname: "/sales", params: { view: "events" } });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't cancel it.");
            setBusy(false);
        }
    };

    if ((eventId && !loaded) || !timeZone) return error ? <ErrorLine error={error} /> : <Loading />;
    const soldOf = (tier: TierDraft) => (tier.id ? loaded?.sold[tier.id] ?? 0 : 0);
    const anySold = Object.values(loaded?.sold ?? {}).some((count) => count > 0);
    const line = alpha(colors.border, 0.6);
    // Shown and picked on the business's clock, whatever zone the phone is in.
    const when = startsAt ? { date: startsAt.toLocaleDateString("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short", year: "numeric" }), time: startsAt.toLocaleTimeString("en-GB", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }) } : null;
    const chip = (label: string, onPress: () => void) => (
        <Pressable onPress={onPress} style={{ flex: 1, height: 48, borderRadius: 999, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}>
            <T color={when ? colors.foreground : colors.mutedForeground}>{label}</T>
        </Pressable>
    );

    return (
        <>
            {banner ? (
                <View style={{ marginBottom: 12 }}>
                    <Image source={{ uri: banner.preview }} style={{ width: "100%", height: 224, borderRadius: 16 }} contentFit="cover" contentPosition="top" />
                    <View style={{ position: "absolute", right: 8, bottom: 8, flexDirection: "row", gap: 6 }}>
                        {[["Change", () => void pickBanner()], ["Remove", () => { setBanner(null); setBannerRemoved(true); }]].map(([label, press]) => (
                            <Pressable key={label as string} onPress={press as () => void} style={{ height: 32, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 12, justifyContent: "center" }}>
                                <T size={13} weight="600" color="#ffffff">{label as string}</T>
                            </Pressable>
                        ))}
                    </View>
                </View>
            ) : (
                <Pressable onPress={() => void pickBanner()} style={{ marginBottom: 12, height: 112, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
                    <Icon name="camera:lucide" size={20} color={colors.mutedForeground} />
                    <T size={13} muted style={{ marginTop: 6 }}>Add your banner or flyer</T>
                </Pressable>
            )}
            <Input round value={name} onChangeText={setName} placeholder="Name (Rooftop Party)" />
            <View style={{ marginTop: 10 }}>
                <T size={12} muted style={{ marginBottom: 4, paddingLeft: 20 }}>Starts ({zoneCity(timeZone)} time)</T>
                <View style={{ flexDirection: "row", gap: 8 }}>
                    {chip(when?.date ?? "Date", () => setPicking("date"))}
                    {chip(when?.time ?? "Time", () => setPicking("time"))}
                </View>
                {picking ? (
                    <DateTimePicker
                        value={startsAt ?? suggested}
                        mode={picking}
                        timeZoneName={timeZone}
                        display={Platform.OS === "ios" ? (picking === "date" ? "inline" : "spinner") : "default"}
                        minimumDate={eventId ? undefined : today}
                        onChange={(event, value) => {
                            if (Platform.OS !== "ios") setPicking(null);
                            if (event.type === "set" && value) setStartsAt(value);
                        }}
                    />
                ) : null}
                {picking && Platform.OS === "ios" ? <Pressable onPress={() => setPicking(null)} style={{ alignSelf: "flex-end", paddingVertical: 8, paddingHorizontal: 12 }}><T size={14} weight="600">Done</T></Pressable> : null}
            </View>
            <Input round value={venue} onChangeText={setVenue} placeholder="Where" style={{ marginTop: 10 }} />
            <Input multiline value={description} onChangeText={setDescription} placeholder="About it (optional)" style={{ marginTop: 10, minHeight: 112 }} />
            <T size={13} muted style={{ marginTop: 16 }}>Tickets</T>
            <View style={{ marginTop: 8, gap: 8 }}>
                {tiers.map((tier, index) => (
                    <View key={tier.id ?? index}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            {/* One pill: the type, its price and how many, split by thin lines. */}
                            <View style={{ flex: 1, height: 44, flexDirection: "row", overflow: "hidden", borderRadius: 999, backgroundColor: colors.muted }}>
                                <View style={{ flex: 1.4, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 6 }}>
                                    <TicketTierIcon name={tier.name} index={index} />
                                    <TextInput value={tier.name} onChangeText={(value) => setTier(index, { name: value })} placeholder="Type" placeholderTextColor={colors.mutedForeground} style={{ flex: 1, paddingRight: 12, fontFamily: fonts["500"], fontSize: 15, color: colors.foreground }} />
                                </View>
                                <TextInput value={tier.price} onChangeText={(value) => setTier(index, { price: value })} keyboardType="number-pad" placeholder="₦ price" accessibilityLabel="Price" placeholderTextColor={colors.mutedForeground} style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: line, paddingHorizontal: 8, textAlign: "center", fontFamily: fonts["500"], fontSize: 15, color: colors.foreground }} />
                                <TextInput value={tier.capacity} onChangeText={(value) => setTier(index, { capacity: value })} keyboardType="number-pad" placeholder="How many" accessibilityLabel="How many" placeholderTextColor={colors.mutedForeground} style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: line, paddingHorizontal: 8, textAlign: "center", fontFamily: fonts["500"], fontSize: 15, color: colors.foreground }} />
                            </View>
                            {tiers.length > 1 && soldOf(tier) === 0 ? <Pressable accessibilityLabel="Remove" onPress={() => setTiers((current) => current.filter((_, i) => i !== index))}><Icon name="x:lucide" size={16} color={colors.mutedForeground} /></Pressable> : null}
                        </View>
                        {soldOf(tier) > 0 ? <T size={12} muted style={{ marginTop: 4, paddingLeft: 4 }}>{soldOf(tier)} sold</T> : null}
                    </View>
                ))}
            </View>
            {tiers.length < 8 ? <Pressable onPress={() => setTiers((current) => [...current, { name: current.length === 1 ? "VIP" : "", price: "", capacity: "" }])} style={{ marginTop: 8, alignSelf: "flex-start" }}><T size={13} weight="600">+ Another type</T></Pressable> : null}
            {eventId && anySold ? <T size={12} leading={20} muted style={{ marginTop: 12 }}>Ticket holders get an email if the date, time or place changes. New prices are for new sales only.</T> : null}
            <ErrorLine error={error} />
            <Primary title={eventId || createdId ? "Save" : "Make the event"} busy={busy && !cancelling} disabled={!name.trim() || !startsAt || tiers.some((tier) => !tier.name.trim())} onPress={() => void save()} />
            {eventId ? (
                <Pressable disabled={busy} onPress={() => void cancel()} style={{ marginTop: 16 }}>
                    <T size={13} center color={colors.destructive}>{cancelling ? (anySold ? "Tap again to cancel. Ticket holders get an email." : "Tap again to cancel the event") : "Cancel event"}</T>
                </Pressable>
            ) : null}
        </>
    );
}

/** The ⋯ menu for another business: rename it, or delete it and everything in it. */
export function BusinessTask({ target, onDone }: { target: { id: string; name: string; isBusiness: boolean }; onDone: () => void }) {
    const colors = useColors();
    const api = useApi();
    const [view, setView] = useState<"menu" | "rename" | "delete">("menu");
    const [name, setName] = useState(target.name);
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const run = async (method: "PATCH" | "DELETE", body: Record<string, unknown>) => {
        setBusy(true);
        setError(null);
        try {
            await api("/api/studio/business", { method, body: { organization_id: target.id, ...body } });
            onDone();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "That didn't work.");
            setBusy(false);
        }
    };
    if (view === "menu") {
        return (
            <View style={{ marginTop: 8, overflow: "hidden", borderRadius: 16, backgroundColor: colors.card }}>
                <Pressable onPress={() => setView("rename")} style={{ minHeight: 52, justifyContent: "center", paddingHorizontal: 16 }}><T>Rename</T></Pressable>
                <View style={{ borderTopWidth: 1, borderTopColor: alpha(colors.border, 0.4) }}>
                    {target.isBusiness
                        ? <Pressable onPress={() => setView("delete")} style={{ minHeight: 52, justifyContent: "center", paddingHorizontal: 16 }}><T color={colors.destructive}>Delete business</T></Pressable>
                        // A developer organization holds API keys, logs and console projects: not deleted from a phone menu.
                        : <T size={13} leading={20} muted style={{ paddingHorizontal: 16, paddingVertical: 14 }}>This is a developer organization. Delete it from the console.</T>}
                </View>
            </View>
        );
    }
    if (view === "rename") {
        const ready = !!name.trim() && name.trim() !== target.name;
        return (
            <>
                <Input value={name} onChangeText={setName} maxLength={48} autoFocus placeholder="Arcie Lounge" onSubmitEditing={() => { if (ready) void run("PATCH", { name: name.trim() }); }} style={{ marginTop: 16 }} />
                <ErrorLine error={error} />
                <Primary title="Save" busy={busy} disabled={!ready} onPress={() => void run("PATCH", { name: name.trim() })} />
            </>
        );
    }
    return (
        <>
            <T leading={24} muted>Deletes <T weight="600">{target.name}</T> and everything in it. This can&apos;t be undone.</T>
            <T size={13} muted style={{ marginTop: 16 }}>Type the name to confirm.</T>
            <Input value={confirm} onChangeText={setConfirm} autoCapitalize="none" autoCorrect={false} spellCheck={false} placeholder={target.name} style={{ marginTop: 8 }} />
            <ErrorLine error={error} />
            <Primary danger title="Delete business" busy={busy} disabled={confirm.trim() !== target.name} onPress={() => void run("DELETE", { confirm: confirm.trim() })} />
        </>
    );
}

/** Another business, set up like signing up: its own free trial, then setup starts there. */
export function NewBusinessTask() {
    const api = useApi();
    const { choose } = useWorkspace();
    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const create = async () => {
        setBusy(true);
        setError(null);
        try {
            const created = await api<{ organization_id: string }>("/api/studio/business", { method: "POST", body: { name: name.trim() } });
            await choose(created.organization_id);
            router.dismissAll();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't create the business.");
            setBusy(false);
        }
    };
    return (
        <>
            <Input value={name} onChangeText={setName} maxLength={48} autoFocus placeholder="What's it called?" onSubmitEditing={() => { if (name.trim()) void create(); }} style={{ marginTop: 16 }} />
            <ErrorLine error={error} />
            <Primary title="Create business" busy={busy} disabled={!name.trim()} onPress={() => void create()} />
        </>
    );
}

/** Not in Studio yet. */
export function LaterTask({ onDone }: { onDone: () => void }) {
    return (
        <>
            <T leading={24} muted>Not in Studio yet. Coming soon.</T>
            <Primary title="OK" onPress={onDone} />
        </>
    );
}
