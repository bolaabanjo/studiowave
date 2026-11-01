import { useState, type ReactNode } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { API_URL } from "@/lib/config";
import { useOverview } from "@/lib/queries";
import { usePushState } from "@/lib/push";
import { useSession } from "@/lib/session";
import { useTasks } from "@/lib/tasks";
import { useThemeChoice, type ThemeChoice } from "@/lib/theme-choice";
import { useWorkspace } from "@/lib/workspace";
import { Icon, type IconName } from "@/ui/icons";
import { ErrorText, PersonAvatar, T, useSheetTop } from "@/ui/kit";
import { alpha, palette, useColors } from "@/ui/theme";

/** One row of a group: icon, label, and what sits on the right. */
function Row({ icon, label, right, onPress, disabled }: { icon?: IconName; label: string; right?: ReactNode; onPress?: () => void; disabled?: boolean }) {
    const colors = useColors();
    const inner = (
        <>
            {icon ? <Icon name={icon} size={20} color={colors.foreground} /> : null}
            <T lines={1} style={{ flex: 1 }}>{label}</T>
            {right ?? (onPress ? <Icon name="alt-arrow-right:linear" size={16} color={colors.mutedForeground} /> : null)}
        </>
    );
    const style = { minHeight: 52, flexDirection: "row" as const, alignItems: "center" as const, gap: 12, paddingHorizontal: 16, paddingVertical: 12, opacity: disabled ? 0.6 : 1 };
    return onPress ? <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [style, pressed && { backgroundColor: colors.pressed }]}>{inner}</Pressable> : <View style={style}>{inner}</View>;
}

function Group({ title, children }: { title?: string; children: ReactNode }) {
    const colors = useColors();
    const items = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean);
    return (
        <View style={{ marginTop: 20 }}>
            {title ? <T size={12} muted style={{ marginBottom: 8, paddingHorizontal: 4 }}>{title}</T> : null}
            <View style={{ overflow: "hidden", borderRadius: 16, backgroundColor: colors.card }}>
                {items.map((child, index) => <View key={index} style={index ? { borderTopWidth: 1, borderTopColor: alpha(colors.border, 0.4) } : undefined}>{child}</View>)}
            </View>
        </View>
    );
}

const THEMES: Array<{ id: ThemeChoice; label: string; icon: IconName }> = [
    { id: "light", label: "Light", icon: "sun" },
    { id: "dark", label: "Dark", icon: "moon" },
    { id: "system", label: "System", icon: "monitor-smartphone" },
];

/** A phone photo, cropped to the middle and shrunk to a 512px square JPEG (the upload limit is 2MB). */
async function squareJpeg(asset: ImagePicker.ImagePickerAsset): Promise<string> {
    const side = Math.min(asset.width, asset.height);
    const context = ImageManipulator.manipulate(asset.uri)
        .crop({ originX: (asset.width - side) / 2, originY: (asset.height - side) / 2, width: side, height: side })
        .resize({ width: Math.min(512, side), height: Math.min(512, side) });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.88 });
    return saved.uri;
}

/**
 * You (cencori components/studio/StudioProfile.tsx): who's signed in, which
 * business, the plan, this phone's settings, help, and sign out.
 */
export default function Profile() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const sheetTop = useSheetTop();
    const queryClient = useQueryClient();
    const { workspace, choose } = useWorkspace();
    const { user, organization, organizations } = workspace;
    const { token, signOut } = useSession();
    const overview = useOverview().data;
    const plan = overview?.plan ?? null;
    const tasks = useTasks();
    const push = usePushState(workspace.project.id);
    const [theme, setTheme] = useThemeChoice();
    const [screen, setScreen] = useState<"profile" | "theme" | "businesses">("profile");
    const [switching, setSwitching] = useState<string | null>(null);
    const [signingOut, setSigningOut] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
    const [uploading, setUploading] = useState(false);
    const name = user.fullName || user.firstName || user.email || "You";
    const border = alpha(colors.border, 0.6);
    const check = <Icon name="check-circle" size={20} color={colors.foreground} />;

    const uploadPhoto = async () => {
        const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
        const asset = picked.assets?.[0];
        if (picked.canceled || !asset) return;
        setUploading(true);
        setError(null);
        try {
            const form = new FormData();
            form.append("file", { uri: await squareJpeg(asset), name: "avatar.jpg", type: "image/jpeg" } as unknown as Blob);
            const response = await fetch(`${API_URL}/api/user/avatar`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form, credentials: "omit" });
            const payload = await response.json().catch(() => null) as { avatar_url?: string; error?: string } | null;
            if (!response.ok || !payload?.avatar_url) throw new Error(payload?.error ?? "Couldn't change your photo.");
            setAvatarUrl(payload.avatar_url);
            // Home's avatar reads it from the workspace.
            void queryClient.invalidateQueries({ queryKey: ["workspace"] });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't change your photo.");
        } finally {
            setUploading(false);
        }
    };

    const switchTo = async (organizationId: string) => {
        if (organizationId === organization.id) return;
        setSwitching(organizationId);
        setError(null);
        try {
            await choose(organizationId);
            router.dismissAll();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't switch business.");
            setSwitching(null);
        }
    };

    // The open business shows its tick. Any other opens when tapped, and its ⋯ renames or deletes it.
    const businessRow = (item: { id: string; name: string; isBusiness?: boolean }) => item.id === organization.id ? (
        <Row key={item.id} icon="shop-2" label={organization.name} right={check} />
    ) : (
        <View key={item.id} style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Row icon="shop-2" label={item.name} onPress={() => void switchTo(item.id)} disabled={switching !== null} right={switching === item.id ? <T size={14} muted>Opening…</T> : <View />} />
            </View>
            <Pressable onPress={() => tasks.open("business", { business: item.id })} accessibilityLabel={`More for ${item.name}`} style={{ marginRight: 8, width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                <Icon name="menu-dots:bold" size={20} color={colors.mutedForeground} />
            </Pressable>
        </View>
    );

    const subHeader = (title: string) => (
        <View style={{ paddingTop: 12, alignItems: "center", justifyContent: "center" }}>
            <Pressable onPress={() => setScreen("profile")} accessibilityLabel="Back" style={{ position: "absolute", left: 0, top: 12, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: border }}>
                <Icon name="alt-arrow-left:linear" size={16} color={colors.foreground} />
            </Pressable>
            <View style={{ height: 36, justifyContent: "center" }}><T weight="600">{title}</T></View>
        </View>
    );

    const notifications = push.state === "on" ? <T size={14} muted>On</T>
        : push.state === "denied" ? <T size={14} muted>Blocked</T>
            : <T size={14} weight="600">{push.busy ? "Turning on…" : "Turn on"}</T>;

    return (
        <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: sheetTop, paddingBottom: insets.bottom + 24 }}>
            <View style={{ alignItems: "center" }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: alpha(colors.mutedForeground, 0.3) }} /></View>
            {screen === "businesses" ? (
                <>
                    {subHeader("Your businesses")}
                    <Group>{organizations.map(businessRow)}</Group>
                    <Pressable onPress={() => router.push("/new-business")} style={{ marginTop: 20, height: 48, borderRadius: 999, borderWidth: 1, borderColor: border, alignItems: "center", justifyContent: "center" }}><T>New business</T></Pressable>
                    {error ? <ErrorText style={{ marginTop: 8, paddingHorizontal: 4 }}>{error}</ErrorText> : null}
                </>
            ) : screen === "theme" ? (
                <>
                    {subHeader("Theme")}
                    <Group>
                        {THEMES.map((item) => <Row key={item.id} icon={item.icon} label={item.label} onPress={() => setTheme(item.id)} right={theme === item.id ? check : <View />} />)}
                    </Group>
                    <T size={12} leading={20} muted style={{ marginTop: 8, paddingHorizontal: 4 }}>System follows your phone&apos;s light or dark setting.</T>
                </>
            ) : (
                <>
                    <View style={{ alignItems: "center", paddingTop: 16 }}>
                        <Pressable onPress={() => void uploadPhoto()} disabled={uploading} accessibilityLabel="Change your photo">
                            <View style={{ opacity: uploading ? 0.5 : 1 }}><PersonAvatar name={name} url={avatarUrl} size={80} /></View>
                            <View style={{ position: "absolute", right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.background, backgroundColor: colors.foreground }}>
                                <Icon name="camera" size={14} color={colors.background} />
                            </View>
                        </Pressable>
                        <T size={18} weight="600" style={{ marginTop: 12 }}>{name}</T>
                        {user.email && user.email !== name ? <T size={14} muted>{user.email}</T> : null}
                        <Pressable onPress={() => router.push("/account")} style={{ marginTop: 14, height: 40, paddingHorizontal: 20, borderRadius: 999, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}><T size={14} weight="600">Edit profile</T></Pressable>
                    </View>

                    <Group title={organizations.length > 1 ? "Your businesses" : "Your business"}>
                        {organizations.length > 1
                            // The one open now and one other; the rest are under All businesses.
                            ? [organization, ...organizations.filter((item) => item.id !== organization.id).slice(0, 1)].map(businessRow)
                            : businessRow(organization)}
                        {organizations.length > 2 ? <Row label="All businesses" onPress={() => setScreen("businesses")} right={<View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><T size={14} muted>{organizations.length}</T><Icon name="alt-arrow-right:linear" size={16} color={colors.mutedForeground} /></View>} /> : null}
                        {organizations.length <= 2 ? <Row label="New business" onPress={() => router.push("/new-business")} right={<T size={18} leading={18} muted>+</T>} /> : null}
                    </Group>
                    <Pressable onPress={() => router.push("/business-profile")} style={{ marginTop: 12, height: 48, borderRadius: 999, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}><T weight="600">Edit business</T></Pressable>

                    {plan ? (
                        <Group title="Your plan">
                            <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                                <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                                    <T>{plan.name}</T>
                                    {plan.active && plan.period_end ? (
                                        <T size={12} color={plan.in_grace ? colors.destructive : colors.mutedForeground}>
                                            {plan.in_grace ? "Ended" : plan.name === "Free trial" ? "Ends" : "Renews"} {new Date(plan.period_end).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                                        </T>
                                    ) : null}
                                </View>
                                <View style={{ marginTop: 12, height: 6, overflow: "hidden", borderRadius: 3, backgroundColor: colors.background }}>
                                    <View style={{ height: "100%", borderRadius: 3, backgroundColor: plan.used > plan.conversations ? palette.amber500 : colors.foreground, width: `${Math.min(100, Math.round((plan.used / Math.max(1, plan.conversations)) * 100))}%` }} />
                                </View>
                                <T size={13} muted style={{ marginTop: 8 }}>
                                    {!plan.active
                                        ? "Ended. Your employee has stopped."
                                        : plan.in_grace && plan.grace_end
                                            ? `Still answering until ${new Date(plan.grace_end).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                                            : plan.used > plan.conversations
                                                ? `All ${plan.conversations} used · ${plan.used - plan.conversations} of ${plan.capacity - plan.conversations} extra`
                                                : `${plan.used} of ${plan.conversations} chats used`}
                                </T>
                                {plan.earned?.amount && overview?.currency === "NGN" ? <T size={13} style={{ marginTop: 4 }}>₦{Math.round(plan.earned.amount).toLocaleString("en-NG")} earned on this plan</T> : null}
                                {(() => {
                                    const strong = plan.name === "Free trial" || !plan.active || plan.in_grace;
                                    return (
                                        <Pressable onPress={() => tasks.open("plans")} style={{ marginTop: 12, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: strong ? colors.foreground : "transparent", borderWidth: strong ? 0 : 1, borderColor: border }}>
                                            <T size={14} weight="600" color={strong ? colors.background : colors.foreground}>{plan.name === "Free trial" || !plan.active ? "Choose a plan" : plan.in_grace ? "Renew" : "Change or renew"}</T>
                                        </Pressable>
                                    );
                                })()}
                            </View>
                        </Group>
                    ) : null}

                    <Group title="Settings">
                        <Row icon="palette" label="Theme" onPress={() => setScreen("theme")} right={<View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><T size={14} muted>{THEMES.find((item) => item.id === theme)?.label ?? "System"}</T><Icon name="alt-arrow-right:linear" size={16} color={colors.mutedForeground} /></View>} />
                        {push.state !== "unsupported" ? <Row icon="bell" label="Notifications" right={notifications} onPress={push.state === "off" ? () => void push.turnOn() : undefined} disabled={push.busy} /> : null}
                        <Row icon="monitor" label="Open the full console" onPress={() => void Linking.openURL("https://console.cencori.com")} />
                    </Group>
                    {push.error ? <ErrorText style={{ marginTop: 8, paddingHorizontal: 4 }}>{push.error}</ErrorText> : null}

                    <Group>
                        <Row icon="question-circle" label="Help & feedback" onPress={() => void Linking.openURL("mailto:support@cencori.com")} />
                    </Group>

                    {error ? <ErrorText style={{ marginTop: 12, paddingHorizontal: 4 }}>{error}</ErrorText> : null}

                    <Pressable
                        onPress={() => { setSigningOut(true); void signOut(); }}
                        disabled={signingOut}
                        style={{ marginTop: 24, height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 999, borderWidth: 1, borderColor: border, opacity: signingOut ? 0.6 : 1 }}
                    >
                        <Icon name="logout-2" size={18} color={palette.red500} />
                        <T weight="600" color={palette.red500}>{signingOut ? "Signing out…" : "Sign out"}</T>
                    </Pressable>
                </>
            )}
        </ScrollView>
    );
}
