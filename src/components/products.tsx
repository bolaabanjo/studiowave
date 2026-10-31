import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as WebBrowser from "expo-web-browser";
import { useApi } from "@/lib/api";
import { useOverview } from "@/lib/queries";
import { pickPhotos } from "@/lib/photos";
import { useWorkspace } from "@/lib/workspace";
import { importCatalogCsv, type CatalogProduct } from "@/lib/catalog/format";
import { applyMerge, mergeProducts, productLinks, type IncomingProduct, type MergeChoices, type MergeRow } from "@/lib/catalog/merge";
import { xlsxToCsv } from "@/lib/catalog/xlsx";
import { Primary } from "@/components/tasks";
import { Icon, WhatsAppMark, type IconName } from "@/ui/icons";
import { Caps, ErrorText, IconCircle, Spinner, T, siteImage } from "@/ui/kit";
import { alpha, fonts, palette, useColors, type Tone } from "@/ui/theme";

/**
 * Add products from wherever they are (cencori components/studio/StudioProducts.tsx):
 * store exports (Shopify, Bumpa; CSV or Excel), screenshots (a WhatsApp
 * catalog, Instagram), a pasted list, or an online store. All of it, and
 * what's already saved, becomes one list; the same product from two places
 * is one product. The owner sees what changes, settles anything unclear, and saves.
 */

const PICTURES_PER_CALL = 6;
const STORE_LOGOS: Record<string, string> = { woocommerce: "/stores/woocommerce.svg", shopify: "/stores/shopify.svg", square: "/stores/square.svg" };

function SheetLabel({ children, action, first }: { children: ReactNode; action?: string; first?: boolean }) {
    return (
        <View style={{ marginTop: first ? 4 : 24, marginBottom: 10, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 4 }}>
            <Caps>{children}</Caps>
            {action ? <T size={13} muted>{action}</T> : null}
        </View>
    );
}

type Source = { label: string; count: number };

const naira = (amount: number, currency: string) => (currency === "NGN" ? `₦${amount.toLocaleString("en-NG")}` : `${currency} ${amount.toLocaleString("en-NG")}`);

/** "products_export_1.csv" → "Shopify export"; else the file's name without its extension. */
function fileLabel(name: string): string {
    if (/products_export/i.test(name)) return "Shopify export";
    if (/bumpa/i.test(name)) return "Bumpa export";
    return name.replace(/\.[^.]+$/, "").slice(0, 40) || "Spreadsheet";
}

function Choice({ label, chosen, onPress }: { label: ReactNode; chosen: boolean; onPress: () => void }) {
    const colors = useColors();
    return (
        <Pressable onPress={onPress} style={{ borderRadius: 999, borderWidth: 1, borderColor: chosen ? colors.foreground : alpha(colors.border, 0.6), backgroundColor: chosen ? colors.foreground : "transparent", paddingHorizontal: 12, paddingVertical: 6 }}>
            <T size={13} color={chosen ? colors.background : colors.foreground}>{label}</T>
        </Pressable>
    );
}

export function ProductsTask({ onDone }: { onDone: () => void }) {
    const colors = useColors();
    const api = useApi();
    const { workspace } = useWorkspace();
    const projectId = workspace.project.id;
    const assistant = useOverview().data?.assistant ?? null;
    const [catalog, setCatalog] = useState<{ products: CatalogProduct[]; currency: string } | null>(null);
    const [incoming, setIncoming] = useState<IncomingProduct[]>([]);
    const [sources, setSources] = useState<Source[]>([]);
    const [step, setStep] = useState<"add" | "review" | "saved">("add");
    const [reading, setReading] = useState<string | null>(null);
    const [pasting, setPasting] = useState(false);
    const [pasted, setPasted] = useState("");
    const [choices, setChoices] = useState<MergeChoices>({});
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState<{ added: number; updated: number; dropped: number; total: number } | null>(null);
    const [turningOn, setTurningOn] = useState(false);
    /** Stores brought in this time, by provider → the source label their products carry. */
    const [fromStores, setFromStores] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api<{ catalog: { products: CatalogProduct[]; currency: string } | null }>(`/api/projects/${projectId}/catalog`)
            .then((body) => setCatalog(body.catalog ?? { products: [], currency: "NGN" }))
            .catch((cause) => setError(cause instanceof Error ? cause.message : "Couldn't load your products."));
    }, [projectId, api]);

    const add = (label: string, products: Array<Omit<IncomingProduct, "source">>) => {
        setIncoming((current) => [...current, ...products.map((product) => ({ ...product, source: label }))]);
        setSources((current) => {
            const found = current.find((source) => source.label === label);
            return found ? current.map((source) => (source === found ? { ...source, count: source.count + products.length } : source)) : [...current, { label, count: products.length }];
        });
    };

    const readFiles = async () => {
        setError(null);
        const picked = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: ["text/csv", "text/comma-separated-values", "text/tab-separated-values", "text/plain", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] });
        if (picked.canceled) return;
        for (const asset of picked.assets) {
            try {
                setReading(`Reading ${asset.name}`);
                const file = new File(asset.uri);
                const text = /\.xlsx$/i.test(asset.name) ? await xlsxToCsv((await file.bytes()).buffer as ArrayBuffer) : await file.text();
                const imported = importCatalogCsv(text);
                if (!imported.ok) throw new Error(`${asset.name}: ${imported.message}`);
                add(fileLabel(asset.name), imported.products);
            } catch (cause) {
                setError(cause instanceof Error ? cause.message : `Couldn't read ${asset.name}.`);
            }
        }
        setReading(null);
    };

    const readPictures = async () => {
        setError(null);
        let all: Awaited<ReturnType<typeof pickPhotos>>;
        try {
            all = await pickPhotos({ max: 30 });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't read the pictures.");
            return;
        }
        if (!all) return;
        let done = 0;
        try {
            for (let index = 0; index < all.length; index += PICTURES_PER_CALL) {
                const batch = all.slice(index, index + PICTURES_PER_CALL);
                setReading(`Reading ${Math.min(done + batch.length, all.length)} of ${all.length} pictures`);
                const { products } = await api<{ products: Array<Omit<IncomingProduct, "source">> }>("/api/studio/products/read", { method: "POST", body: { project_id: projectId, images: batch.map(({ data, mime_type }) => ({ data, mime_type })) } });
                add("Screenshots", products);
                done += batch.length;
            }
        } catch (cause) {
            setError(`${done ? `Read ${done} of ${all.length} pictures. ` : ""}${cause instanceof Error ? cause.message : "Couldn't read the pictures."}`);
        } finally {
            setReading(null);
        }
    };

    const readText = async () => {
        if (!pasted.trim()) return;
        setError(null);
        setReading("Reading your list");
        try {
            // A table pasted from a spreadsheet goes through the import as it is; anything else is read.
            const table = importCatalogCsv(pasted);
            if (table.ok) add("Your list", table.products);
            else {
                const { products } = await api<{ products: Array<Omit<IncomingProduct, "source">> }>("/api/studio/products/read", { method: "POST", body: { project_id: projectId, text: pasted } });
                add("Your list", products);
            }
            setPasted("");
            setPasting(false);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't read your list.");
        } finally {
            setReading(null);
        }
    };

    const rows = useMemo(() => (step === "review" && catalog ? mergeProducts(catalog.products, incoming) : []), [step, catalog, incoming]);
    const count = (kind: MergeRow["kind"]) => rows.filter((row) => row.kind === kind).length;
    const changed = rows.filter((row) => row.kind !== "update" || row.changes.length > 0);

    const save = async () => {
        if (!catalog) return;
        setSaving(true);
        setError(null);
        try {
            const merged = applyMerge(catalog.products, rows, choices);
            await api(`/api/projects/${projectId}/catalog`, { method: "PUT", body: { products: merged.products, currency: catalog.currency } });
            // Stores brought in this time stay in sync from now on: remember which product each became.
            const links = productLinks(rows, choices);
            await Promise.all(Object.entries(fromStores).map(([provider, label]) => {
                const ids = new Set(incoming.filter((item) => item.source === label && item.externalId).map((item) => item.externalId!));
                return api("/api/studio/stores", { method: "POST", body: { project_id: projectId, action: "link", provider, links: Object.fromEntries(Object.entries(links).filter(([id]) => ids.has(id))) } });
            }));
            setResult({ added: merged.added, updated: merged.updated, dropped: merged.dropped, total: merged.products.length });
            setStep("saved");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't save the products.");
        } finally {
            setSaving(false);
        }
    };

    /** Switch on "sell products" for the assistant: a new version with the tool added, tested and made live, as Go live does. */
    const sellThem = async (agentId: string) => {
        setTurningOn(true);
        setError(null);
        const studio = `/api/projects/${projectId}/embedded-agents/studio`;
        try {
            const { version_id } = await api<{ version_id: string }>(studio, { method: "POST", body: { action: "new_version", agent_id: agentId } });
            // Saved without changes first: the answer has the tools it already has, which the next save must keep.
            const { system_tools } = await api<{ system_tools: Record<string, unknown> }>(studio, { method: "POST", body: { action: "save_tools", agent_id: agentId, version_id } });
            await api(studio, { method: "POST", body: { action: "save_tools", agent_id: agentId, version_id, system_tools: { ...system_tools, sell_products: true } } });
            await api(studio, { method: "POST", body: { action: "test_version", agent_id: agentId, version_id, input: "What do you sell?" } });
            await api(studio, { method: "POST", body: { action: "publish_version", agent_id: agentId, version_id } });
            onDone();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't switch it on. Try again.");
            setTurningOn(false);
        }
    };

    if (!catalog) return error ? <ErrorText>{error}</ErrorText> : <View style={{ marginTop: 20, alignItems: "center" }}><Spinner /></View>;

    if (step === "saved" && result) {
        const selling = assistant?.system_tools.includes("sell_products") ?? true;
        return (
            <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Icon name="check:lucide" size={16} color={palette.emerald600} /><T weight="600">{result.total} products saved</T></View>
                <T size={13} muted style={{ marginTop: 4 }}>
                    {[result.added && `${result.added} new`, result.updated && `${result.updated} updated`, result.dropped && `${result.dropped} left out (500 is the most)`].filter(Boolean).join(" · ") || "Nothing changed"}
                </T>
                {error ? <ErrorText style={{ marginTop: 12 }}>{error}</ErrorText> : null}
                {!selling && workspace.agents[0]
                    ? <Primary title="Let my employee sell them" busy={turningOn} onPress={() => void sellThem(assistant?.id ?? workspace.agents[0].id)} />
                    : <Primary title="Done" onPress={onDone} />}
            </>
        );
    }

    if (step === "review") {
        const updated = changed.filter((row) => row.kind === "update").length;
        return (
            <>
                <T leading={24}>{[count("new") > 0 && `${count("new")} new`, updated > 0 && `${updated} updated`, count("prices") + count("maybe") > 0 && `${count("prices") + count("maybe")} to check`].filter(Boolean).join(" · ") || "Already up to date"}</T>
                <View style={{ marginTop: 16, gap: 10 }}>
                    {changed.map((row) => (
                        <View key={row.key} style={{ borderRadius: 16, backgroundColor: colors.muted, paddingHorizontal: 16, paddingVertical: 12 }}>
                            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                                <T lines={1} style={{ flex: 1 }}>{row.product.name}</T>
                                {row.kind !== "prices" ? <T>{naira(row.product.price, catalog.currency)}</T> : null}
                            </View>
                            {row.kind === "prices" ? (
                                <>
                                    <T size={13} muted style={{ marginTop: 2 }}>Different prices. Which one?</T>
                                    <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                        {row.prices.map((option) => (
                                            <Choice key={option.price} chosen={(choices[row.key]?.price ?? row.prices[0].price) === option.price} onPress={() => setChoices((current) => ({ ...current, [row.key]: { price: option.price } }))} label={`${naira(option.price, catalog.currency)}  ${option.sources.join(", ")}`} />
                                        ))}
                                    </View>
                                </>
                            ) : null}
                            {row.kind === "maybe" ? (
                                <>
                                    <T size={13} muted style={{ marginTop: 2 }}>Same as “{row.existing.name}”?</T>
                                    <View style={{ marginTop: 8, flexDirection: "row", gap: 8 }}>
                                        {[true, false].map((same) => <Choice key={String(same)} chosen={!!choices[row.key]?.same === same} onPress={() => setChoices((current) => ({ ...current, [row.key]: { same } }))} label={same ? "Same" : "Different"} />)}
                                    </View>
                                </>
                            ) : null}
                            {row.kind === "update" ? <T size={13} muted style={{ marginTop: 2 }}>{row.changes.join(" · ")}</T> : null}
                            {row.kind === "new" ? <T size={13} muted style={{ marginTop: 2 }}>New · {row.sources.join(", ")}</T> : null}
                        </View>
                    ))}
                </View>
                {error ? <ErrorText style={{ marginTop: 12 }}>{error}</ErrorText> : null}
                <Primary title={changed.length === 0 ? "Nothing new" : "Save"} busy={saving} disabled={changed.length === 0} onPress={() => void save()} />
                <Pressable onPress={() => setStep("add")} style={{ marginTop: 12 }}><T size={13} muted center>Add more</T></Pressable>
            </>
        );
    }

    const options: Array<{ label: string; hint: string; icon: IconName; tone: Tone; onPress: () => void }> = [
        { label: "Spreadsheet", hint: "Shopify, Bumpa, Excel", icon: "document-text", tone: "emerald", onPress: () => void readFiles() },
        { label: "Screenshots", hint: "WhatsApp, Instagram", icon: "gallery", tone: "violet", onPress: () => void readPictures() },
        { label: "Type or paste", hint: "A price list", icon: "pen", tone: "orange", onPress: () => setPasting((open) => !open) },
    ];
    return (
        <View style={{ flex: 1 }}>
            <SheetLabel first action={catalog.products.length ? `${catalog.products.length} saved` : undefined}>Add from</SheetLabel>
            <View style={{ overflow: "hidden", borderRadius: 16, backgroundColor: colors.muted }}>
                {options.map((option, index) => (
                    <Pressable key={option.label} disabled={!!reading} onPress={option.onPress} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: index ? 1 : 0, borderTopColor: alpha(colors.border, 0.6), opacity: reading ? 0.5 : 1 }}>
                        <IconCircle name={option.icon} tone={option.tone} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <T weight="600">{option.label}</T>
                            <T size={13} muted lines={1}>{option.hint}</T>
                        </View>
                        <Icon name="chevron-right:lucide" size={16} color={colors.mutedForeground} />
                    </Pressable>
                ))}
            </View>
            {pasting ? (
                <View style={{ marginTop: 10 }}>
                    <TextInput value={pasted} onChangeText={setPasted} multiline placeholder={"Jollof rice ₦4,000\nChapman ₦2,500"} placeholderTextColor={colors.mutedForeground} style={{ minHeight: 120, borderRadius: 16, backgroundColor: colors.muted, paddingHorizontal: 16, paddingVertical: 12, fontFamily: fonts["500"], fontSize: 15, lineHeight: 22, color: colors.foreground, textAlignVertical: "top" }} />
                    <Pressable disabled={!pasted.trim() || !!reading} onPress={() => void readText()} style={{ marginTop: 8, height: 40, borderRadius: 999, borderWidth: 1, borderColor: alpha(colors.border, 0.6), alignItems: "center", justifyContent: "center", opacity: !pasted.trim() || reading ? 0.5 : 1 }}>
                        <T size={14} weight="600">Add this list</T>
                    </Pressable>
                </View>
            ) : null}
            <StoreSection disabled={!!reading} onProducts={(provider, label, products) => { add(label, products); setFromStores((current) => ({ ...current, [provider]: label })); }} onError={setError} />
            {reading ? <View style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}><Spinner /><T size={13} muted>{reading}</T></View> : null}
            {sources.length ? (
                <>
                    <SheetLabel>Added</SheetLabel>
                    <View style={{ overflow: "hidden", borderRadius: 16, backgroundColor: colors.muted }}>
                        {sources.map((source, index) => (
                            <View key={source.label} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: index ? 1 : 0, borderTopColor: alpha(colors.border, 0.6) }}>
                                <IconCircle name="check:lucide" tone="emerald" size={32} iconSize={16} />
                                <T lines={1} style={{ flex: 1 }}>{source.label}</T>
                                <T size={13} muted>{source.count}</T>
                                <Pressable accessibilityLabel={`Remove ${source.label}`} onPress={() => {
                                    setIncoming((current) => current.filter((item) => item.source !== source.label));
                                    setSources((current) => current.filter((item) => item !== source));
                                    setFromStores((current) => Object.fromEntries(Object.entries(current).filter(([, label]) => label !== source.label)));
                                }} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center", marginRight: -4 }}>
                                    <Icon name="x:lucide" size={16} color={colors.mutedForeground} />
                                </Pressable>
                            </View>
                        ))}
                    </View>
                </>
            ) : null}
            {error ? <ErrorText style={{ marginTop: 12 }}>{error}</ErrorText> : null}
            <View style={{ flex: 1, minHeight: 20 }} />
            <Primary title={incoming.length ? `Review ${incoming.length} products` : "Review"} disabled={incoming.length === 0 || !!reading} onPress={() => { setChoices({}); setStep("review"); }} />
        </View>
    );
}

type StoreState = { provider: string; label: string; connected: boolean; broken: boolean; syncing: boolean; last_synced_at: string | null; last_error: string | null; products: number };

function ago(iso: string): string {
    const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

/**
 * Online stores (Shopify, WooCommerce, Square): connect in the phone's
 * browser, bring the products in once through the review, then they stay in
 * sync by themselves.
 */
function StoreSection({ disabled, onProducts, onError }: { disabled: boolean; onProducts: (provider: string, label: string, products: Array<Omit<IncomingProduct, "source">>) => void; onError: (message: string | null) => void }) {
    const colors = useColors();
    const api = useApi();
    const projectId = useWorkspace().workspace.project.id;
    const [stores, setStores] = useState<StoreState[] | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [brought, setBrought] = useState<Record<string, boolean>>({});
    const load = useCallback(() => {
        api<{ stores: StoreState[] }>(`/api/studio/stores?project_id=${projectId}`).then((body) => setStores(body.stores)).catch(() => setStores([]));
    }, [api, projectId]);
    useEffect(load, [load]);

    const placeholder = (provider: string, label: string) => ({ provider, label, connected: false, broken: false, syncing: false, last_synced_at: null, last_error: null, products: 0, loading: true });
    const shown: Array<StoreState & { loading?: boolean }> = stores ?? [placeholder("woocommerce", "WooCommerce"), placeholder("square", "Square")];
    if (!shown.length) return null;

    const act = async (store: StoreState, action: "connect" | "fetch" | "sync" | "disconnect") => {
        setBusy(`${store.provider}:${action}`);
        onError(null);
        try {
            if (action === "connect") {
                const { url } = await api<{ url: string }>("/api/studio/stores", { method: "POST", body: { project_id: projectId, action, provider: store.provider, app: true } });
                // Square comes back to the app by itself (cencori app/api/studio/stores/return); the others when the window is closed.
                await WebBrowser.openAuthSessionAsync(url, "cencori-studio://store");
                load();
            } else if (action === "fetch") {
                const { products } = await api<{ products: Array<{ externalId: string; name: string; price: number; description: string; options: string; stock: number | null }> }>("/api/studio/stores", { method: "POST", body: { project_id: projectId, action, provider: store.provider } });
                onProducts(store.provider, store.label, products);
                setBrought((current) => ({ ...current, [store.provider]: true }));
            } else {
                await api("/api/studio/stores", { method: "POST", body: { project_id: projectId, action, provider: store.provider } });
                load();
            }
        } catch (cause) {
            onError(cause instanceof Error ? cause.message : "The store didn't answer. Try again.");
        } finally {
            setBusy(null);
        }
    };
    const button = (label: string, key: string, onPress: () => void, off?: boolean) => (
        <Pressable disabled={disabled || !!busy || off} onPress={onPress} style={{ height: 36, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, borderColor: alpha(colors.border, 0.6), paddingHorizontal: 14, opacity: disabled || busy || off ? 0.5 : 1 }}>
            {busy === key ? <Spinner /> : null}
            <T size={13} weight="600">{label}</T>
        </Pressable>
    );

    return (
        <>
            <SheetLabel>Online stores</SheetLabel>
            <View style={{ overflow: "hidden", borderRadius: 16, backgroundColor: colors.muted }}>
                {shown.map((store, index) => (
                    <View key={store.provider} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: index ? 1 : 0, borderTopColor: alpha(colors.border, 0.6) }}>
                        {STORE_LOGOS[store.provider]
                            ? <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#ffffff", overflow: "hidden" }}><Image source={{ uri: siteImage(STORE_LOGOS[store.provider]) }} style={{ flex: 1 }} contentFit="contain" /></View>
                            : <IconCircle tone="whatsapp"><WhatsAppMark size={20} color={palette.whatsapp} /></IconCircle>}
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <T weight="600">{store.label}</T>
                            <T size={13} muted lines={1}>
                                {store.syncing
                                    ? store.last_error ? "Last sync failed" : `${store.products} products · synced ${store.last_synced_at ? ago(store.last_synced_at) : ""}`
                                    : store.broken ? "Sign in again" : store.connected ? "Connected" : "Stays in sync by itself"}
                            </T>
                        </View>
                        {store.loading ? <Spinner />
                            : store.syncing ? (
                                <>
                                    {button("Sync now", `${store.provider}:sync`, () => void act(store, "sync"))}
                                    <Pressable disabled={disabled || !!busy} onPress={() => void act(store, "disconnect")} accessibilityLabel={`Stop syncing ${store.label}`}><Icon name="x:lucide" size={16} color={colors.mutedForeground} /></Pressable>
                                </>
                            ) : store.connected && !store.broken
                                ? button(brought[store.provider] ? "Added" : "Bring in", `${store.provider}:fetch`, () => void act(store, "fetch"), brought[store.provider])
                                : button("Connect", `${store.provider}:connect`, () => void act(store, "connect"))}
                    </View>
                ))}
            </View>
        </>
    );
}
