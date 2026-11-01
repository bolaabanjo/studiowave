import { forwardRef, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Animated, Dimensions, Image, Keyboard, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View, type StyleProp, type HostInstance, type TextInputInstance, type TextInputProps, type TextStyle, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { ApiError } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { Icon, WhatsAppMark, type IconName } from "@/ui/icons";
import { alpha, fonts, palette, tone as toneOf, useColors, type Tone, type Weight } from "@/ui/theme";
import type { InboxConversation } from "@/lib/types";

/**
 * Studio's parts, drawn as the web draws them (cencori components/studio):
 * the same sizes, weights, colours and corners as its Tailwind classes.
 */

/** Text in Manrope. The web's body is medium (500); sizes are the web's px. */
export function T({ children, size = 15, weight = "500", color, muted, lines, style, upper, center, leading, onPress, accessibilityRole }: {
    children: ReactNode; size?: number; weight?: Weight; color?: string; muted?: boolean; lines?: number; style?: StyleProp<TextStyle>; upper?: boolean; center?: boolean; leading?: number; onPress?: () => void; accessibilityRole?: "alert" | "link" | "header";
}) {
    const colors = useColors();
    return (
        <Text
            numberOfLines={lines}
            onPress={onPress}
            accessibilityRole={accessibilityRole}
            style={[{
                fontFamily: fonts[weight],
                fontSize: size,
                lineHeight: leading ?? Math.round(size * 1.4),
                color: color ?? (muted ? colors.mutedForeground : colors.foreground),
                textAlign: center ? "center" : undefined,
            }, upper && { textTransform: "uppercase", letterSpacing: size * 0.14 }, style]}
        >
            {children}
        </Text>
    );
}

/** A tab's title (text-[26px] font-semibold tracking-tight). */
export function PageTitle({ children }: { children: ReactNode }) {
    return <T size={26} weight="600" leading={32} style={{ letterSpacing: -0.65 }}>{children}</T>;
}

/** A section's small caps label (text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground). */
export function Caps({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
    return <T size={12} weight="600" muted upper style={style}>{children}</T>;
}

/** Bottom room under a tab's content (the native tab bar insets the scroll view itself on iOS). */
export const TAB_ROOM = 32;

/**
 * A tab's page: the header (title and switcher) stays put while the rest
 * scrolls under it, as the web's sticky header does; pull to refresh.
 * The spinner is the pull's own, held until onRefresh settles: a query's
 * isRefetching is also true for every background poll, and on iOS that
 * dropped the spinner (and a gap) over the list every few seconds.
 */
export function Page({ header, children, onRefresh, fill, tabs = true }: { header?: ReactNode; children: ReactNode; onRefresh?: () => Promise<unknown>; fill?: boolean; tabs?: boolean }) {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const [pulling, setPulling] = useState(false);
    const refresh = () => {
        setPulling(true);
        void onRefresh?.().catch(() => undefined).finally(() => setPulling(false));
    };
    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {header ? <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: colors.background }}>{header}</View> : null}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={[{ paddingHorizontal: 16, paddingTop: header ? 0 : insets.top + 20, paddingBottom: insets.bottom + (tabs ? TAB_ROOM : 32) }, fill && { flexGrow: 1 }]}
                refreshControl={onRefresh ? <RefreshControl refreshing={pulling} onRefresh={refresh} tintColor={colors.mutedForeground} /> : undefined}
                keyboardShouldPersistTaps="handled"
            >
                {children}
            </ScrollView>
        </View>
    );
}

/** The three-way switch under a title (grid-cols-3 rounded-full bg-muted p-1). */
export function Switcher<V extends string>({ value, options, onChange, style }: { value: V; options: Array<{ id: V; label: string }>; onChange: (value: V) => void; style?: StyleProp<ViewStyle> }) {
    const colors = useColors();
    return (
        <View style={[{ flexDirection: "row", gap: 4, backgroundColor: colors.muted, borderRadius: 999, padding: 4, marginTop: 16 }, style]}>
            {options.map((option) => {
                const active = value === option.id;
                return (
                    <Pressable key={option.id} onPress={() => onChange(option.id)} accessibilityRole="tab" accessibilityState={{ selected: active }} style={{ flex: 1, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: active ? colors.background : "transparent" }}>
                        <T size={14} color={active ? colors.foreground : colors.mutedForeground}>{option.label}</T>
                    </Pressable>
                );
            })}
        </View>
    );
}

/** A grouped card (rounded-2xl bg-muted/60), its rows split by lines (divide-y divide-border/60). */
export function Card({ children, style, divided = true, bordered }: { children: ReactNode; style?: StyleProp<ViewStyle>; divided?: boolean; bordered?: boolean }) {
    const colors = useColors();
    const items = (Array.isArray(children) ? children.flat() : [children]).filter((child) => child !== null && child !== undefined && child !== false);
    return (
        <View style={[{ borderRadius: 16, overflow: "hidden" }, bordered ? { borderWidth: 1, borderColor: alpha(colors.border, 0.6) } : { backgroundColor: colors.card }, style]}>
            {divided ? items.map((child, index) => (
                <View key={index} style={index > 0 ? { borderTopWidth: 1, borderTopColor: bordered ? alpha(colors.border, 0.6) : colors.divider } : undefined}>{child}</View>
            )) : children}
        </View>
    );
}

/** A tappable row that darkens while pressed (active:bg-muted). */
export function Row({ children, onPress, style, disabled, onLongPress }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; disabled?: boolean; onLongPress?: () => void }) {
    const colors = useColors();
    const base: StyleProp<ViewStyle> = [{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 }, style];
    if (!onPress) return <View style={base}>{children}</View>;
    return (
        <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={500} disabled={disabled} style={({ pressed }) => [base, pressed && { backgroundColor: colors.pressed }]}>
            {children}
        </Pressable>
    );
}

/** Home's sections: a caps title with an optional action, then the content (mt-8). */
export function Section({ title, action, children, style }: { title: string; action?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
    return (
        <View style={[{ marginTop: 32 }, style]}>
            <View style={{ marginBottom: 10, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 4 }}>
                <Caps>{title}</Caps>
                {action}
            </View>
            {children}
        </View>
    );
}

type ButtonKind = "primary" | "outline" | "muted" | "inverse";

/**
 * The web's buttons: rounded-full; primary is bg-foreground text-background
 * font-semibold, outline is border-border/60 font-medium.
 */
export function Button({ title, onPress, kind = "primary", disabled, busy, height = 48, size, style, icon, grow }: {
    title: string; onPress: () => void; kind?: ButtonKind; disabled?: boolean; busy?: boolean; height?: number; size?: number; style?: StyleProp<ViewStyle>; icon?: ReactNode; grow?: boolean;
}) {
    const colors = useColors();
    const fill = kind === "primary" ? colors.foreground : kind === "muted" ? colors.muted : kind === "inverse" ? colors.background : "transparent";
    const color = kind === "primary" ? colors.background : colors.foreground;
    const fontSize = size ?? (height >= 48 ? 15 : height >= 40 ? 14 : 13);
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled || busy}
            style={({ pressed }) => [{
                height, borderRadius: 999, paddingHorizontal: height >= 44 ? 20 : height >= 36 ? 16 : 12,
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                backgroundColor: fill,
                borderWidth: kind === "outline" ? 1 : 0, borderColor: alpha(colors.border, 0.6),
                opacity: disabled || busy ? (kind === "primary" ? 0.6 : 0.5) : pressed ? 0.8 : 1,
            }, grow && { flex: 1 }, style]}
        >
            {busy ? <ActivityIndicator size="small" color={color} /> : icon}
            <T size={fontSize} weight={kind === "primary" || kind === "inverse" ? "600" : "500"} color={color}>{title}</T>
        </Pressable>
    );
}

/** A round icon button (h-10 w-10 rounded-full). */
export function IconButton({ name, onPress, label, size = 40, iconSize = 20, kind = "plain", color, disabled, children }: {
    name?: IconName; onPress: () => void; label: string; size?: number; iconSize?: number; kind?: "plain" | "muted" | "outline"; color?: string; disabled?: boolean; children?: ReactNode;
}) {
    const colors = useColors();
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={label}
            hitSlop={4}
            style={({ pressed }) => ({
                width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center",
                backgroundColor: kind === "muted" ? colors.muted : "transparent",
                borderWidth: kind === "outline" ? 1 : 0, borderColor: alpha(colors.border, 0.6),
                opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
            })}
        >
            {name ? <Icon name={name} size={iconSize} color={color ?? colors.foreground} /> : null}
            {children}
        </Pressable>
    );
}

export type TagTone = "good" | "wait" | "off" | "amber" | "violet" | "neutral";

/** A small status tag (text-[11px] font-semibold), as on Sales, the inbox and the AI tab. */
export function Tag({ label, tone, round, style }: { label: string; tone: TagTone; round?: boolean; style?: StyleProp<ViewStyle> }) {
    const colors = useColors();
    const darkMode = colors.scheme === "dark";
    const look = {
        good: { background: darkMode ? alpha(palette.emerald500, 0.15) : "#ecfdf5", color: darkMode ? "#6ee7b7" : "#065f46" },
        wait: { background: darkMode ? alpha(palette.amber500, 0.15) : palette.amber50, color: darkMode ? palette.amber300 : "#92400e" },
        off: { background: colors.muted, color: colors.mutedForeground },
        amber: { background: alpha(palette.amber500, 0.15), color: darkMode ? palette.amber300 : palette.amber700 },
        violet: { background: alpha(palette.violet500, 0.15), color: darkMode ? "#c4b5fd" : "#7c3aed" },
        neutral: { background: alpha(colors.foreground, 0.1), color: colors.foreground },
    }[tone];
    return (
        <View style={[{ alignSelf: "flex-start", borderRadius: round ? 999 : 6, paddingHorizontal: round ? 8 : 6, paddingVertical: 2, backgroundColor: look.background }, style]}>
            <T size={11} weight="600" leading={16} color={look.color}>{label}</T>
        </View>
    );
}

/** A tinted circle with an icon (flex h-10 w-10 rounded-full bg-…/15 text-…). */
export function IconCircle({ name, tone, size = 40, iconSize, children }: { name?: IconName; tone: Tone; size?: number; iconSize?: number; children?: ReactNode }) {
    const colors = useColors();
    const look = toneOf(colors, tone);
    return (
        <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: look.background }}>
            {name ? <Icon name={name} size={iconSize ?? Math.round(size / 2)} color={look.color} /> : children}
        </View>
    );
}

/** A loading placeholder that pulses (animate-pulse rounded-md bg-accent). */
export function Skeleton({ width = "100%", height, radius = 6, style }: { width?: number | `${number}%`; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
    const colors = useColors();
    const [pulse] = useState(() => new Animated.Value(1));
    useEffect(() => {
        const loop = Animated.loop(Animated.sequence([
            Animated.timing(pulse, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ]));
        loop.start();
        return () => loop.stop();
    }, [pulse]);
    return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.muted, opacity: pulse }, style]} />;
}

export function Spinner({ color, size = "small" }: { color?: string; size?: "small" | "large" }) {
    const colors = useColors();
    return <ActivityIndicator size={size} color={color ?? colors.mutedForeground} />;
}

/** What went wrong loading, in words for the owner: offline first, else the server's message (studio-data.tsx). */
export function loadErrorMessage(error: unknown, fallback: string): string {
    if ((error instanceof ApiError && error.status === 0) || error instanceof TypeError || (error instanceof Error && /network|fetch|load failed|offline/i.test(error.message))) return "You're offline. This will load when you're back online.";
    return error instanceof Error && error.message ? error.message : fallback;
}

/** The data area when nothing could be loaded: offline, or an error, with a retry (StudioLoadError). */
export function LoadError({ error, fallback = "Couldn't load this.", onRetry, style }: { error: unknown; fallback?: string; onRetry?: () => void; style?: StyleProp<ViewStyle> }) {
    const colors = useColors();
    const message = loadErrorMessage(error, fallback);
    const offline = message.startsWith("You're offline");
    return (
        <View style={[{ marginTop: 24, alignItems: "center", borderRadius: 24, backgroundColor: colors.card, paddingHorizontal: 24, paddingVertical: 40 }, style]}>
            {offline ? <View style={{ marginBottom: 8 }}><Icon name="cloud-cross" size={36} color={colors.mutedForeground} /></View> : null}
            <T size={14} leading={24} center color={offline ? colors.mutedForeground : colors.destructive}>{message}</T>
            {!offline && error instanceof ApiError && error.status >= 400 ? <T size={12} muted center>Error {error.status}</T> : null}
            {onRetry ? <Button kind="outline" height={36} size={14} title="Try again" onPress={onRetry} style={{ marginTop: 12 }} /> : null}
        </View>
    );
}

/** A tab's empty state: a tall card in the middle of the page, icon over centred text (StudioEmptyCard). */
export function EmptyCard({ icon, title, description, children, inverted }: { icon: IconName; title: string; description?: string; children?: ReactNode; inverted?: boolean }) {
    const colors = useColors();
    const color = inverted ? colors.background : colors.foreground;
    return (
        <View style={{ marginVertical: "auto", minHeight: 416, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: inverted ? colors.foreground : colors.card, padding: 24 }}>
            <View style={{ marginBottom: 12 }}><Icon name={icon} size={40} color={color} /></View>
            <T size={18} weight="600" center color={color}>{title}</T>
            {description ? <T size={14} leading={24} center color={inverted ? alpha(colors.background, 0.8) : colors.mutedForeground} style={{ marginTop: 4 }}>{description}</T> : null}
            {children}
        </View>
    );
}

const COLOURS = [palette.violet500, palette.orange500, palette.emerald600, palette.sky600, palette.pink600, palette.amber600, palette.teal600, palette.indigo600];

function colourFor(name: string): string {
    let hash = 0;
    for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return COLOURS[hash % COLOURS.length];
}

function personInitials(name: string): string {
    const words = name.replace(/[^\p{L}\p{N}\s]/gu, "").trim().split(/\s+/).filter(Boolean);
    return words.length ? (words[0][0] + (words[1]?.[0] ?? "")).toUpperCase() : "?";
}

/**
 * Who a chat is with, at a glance: a named WhatsApp customer's initials on a
 * colour of their own, with a small WhatsApp badge; otherwise where they came
 * from (WhatsApp, the share link, the website) in a tinted circle.
 */
export function ConversationAvatar({ conversation, size = 44 }: { conversation: Pick<InboxConversation, "channel" | "named" | "name">; size?: number }) {
    const colors = useColors();
    const circle: ViewStyle = { width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" };
    if (conversation.named) {
        return (
            <View style={[circle, { backgroundColor: colourFor(conversation.name) }]}>
                <T size={14} weight="600" color="#ffffff">{personInitials(conversation.name)}</T>
                {conversation.channel === "whatsapp" ? (
                    <View style={{ position: "absolute", right: -2, bottom: -2, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: palette.whatsapp, borderWidth: 2, borderColor: colors.background }}>
                        <WhatsAppMark size={10} color="#ffffff" />
                    </View>
                ) : null}
            </View>
        );
    }
    if (conversation.channel === "whatsapp") return <View style={[circle, { backgroundColor: alpha(palette.whatsapp, 0.15) }]}><WhatsAppMark size={20} color={palette.whatsapp} /></View>;
    const look = toneOf(colors, conversation.channel === "link" ? "sky" : "violet");
    return <View style={[circle, { backgroundColor: look.background }]}><Icon name={conversation.channel === "link" ? "link" : "global"} size={22} color={look.color} /></View>;
}

function bankInitials(name: string): string {
    const words = name.replace(/\(.*?\)/g, "").replace(/\b(limited|ltd|plc|bank|mfb|microfinance|of|nigeria|the)\b/gi, "").trim().split(/\s+/).filter(Boolean);
    return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : (words[0] ?? name).slice(0, 2)).toUpperCase();
}

/** A site path (/banks/x.png) as a full address. */
export function siteImage(path: string): string {
    return /^https?:/.test(path) ? path : `${API_URL}${path}`;
}

/** A bank's logo in a circle, or its initials on a colour picked from its name. */
export function BankLogo({ name, logo, size = 40 }: { name: string; logo: string | null | undefined; size?: number }) {
    if (logo) return <Image source={{ uri: siteImage(logo) }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#ffffff" }} resizeMode="contain" />;
    return (
        <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: colourFor(name) }}>
            <T size={size >= 40 ? 13 : 11} weight="600" color="#ffffff">{bankInitials(name)}</T>
        </View>
    );
}

/** FNV-1a, as the web's orb uses, so an assistant's orb is the same on both. */
function orbHash(seed: string) {
    let value = 2166136261;
    for (let index = 0; index < seed.length; index++) {
        value ^= seed.charCodeAt(index);
        value = Math.imul(value, 16777619);
    }
    return value >>> 0;
}

/** Mixes two hsl stops (hues the short way round). */
function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
    let dh = b[0] - a[0];
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;
    return [(a[0] + dh * t + 360) % 360, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * An assistant's orb (AgentOrb): the web's conic gradient from its id, drawn
 * as fine wedges, with the same glossy highlight and inner shade.
 */
export function AgentOrb({ seed, size = 44 }: { seed: string; size?: number }) {
    const value = orbHash(seed);
    const hue = value % 360;
    const accent = (hue + 35 + ((value >>> 9) % 70)) % 360;
    const turn = (value >>> 3) % 360;
    const light = 52 + ((value >>> 17) % 12);
    const stops: Array<[number, number, number]> = [[hue, 90, light], [accent, 92, light + 10], [hue, 85, light - 22], [accent, 95, light + 18], [hue, 90, light]];
    const wedges = 72;
    const wedge = (index: number) => {
        const t = index / wedges;
        const scaled = t * (stops.length - 1);
        const at = Math.floor(scaled);
        const [h, s, l] = mix(stops[at], stops[at + 1], scaled - at);
        // CSS conic gradients start at the top and go clockwise; each wedge overlaps the next a little, so no seams show.
        const from = ((turn + t * 360 - 90) * Math.PI) / 180;
        const to = ((turn + ((index + 1.5) / wedges) * 360 - 90) * Math.PI) / 180;
        const d = `M50 50 L${50 + 50 * Math.cos(from)} ${50 + 50 * Math.sin(from)} A50 50 0 0 1 ${50 + 50 * Math.cos(to)} ${50 + 50 * Math.sin(to)} Z`;
        return <Path key={index} d={d} fill={`hsl(${Math.round(h)}, ${s}%, ${Math.max(0, Math.min(100, l))}%)`} />;
    };
    return (
        <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden" }}>
            <Svg width={size} height={size} viewBox="0 0 100 100">
                <Defs>
                    <RadialGradient id="gloss" cx="32%" cy="26%" r="48%">
                        <Stop offset="0" stopColor="#ffffff" stopOpacity={0.85} />
                        <Stop offset="0.46" stopColor="#ffffff" stopOpacity={0.25} />
                        <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
                    </RadialGradient>
                    <RadialGradient id="shade" cx="50%" cy="40%" r="62%">
                        <Stop offset="0.8" stopColor="#000000" stopOpacity={0} />
                        <Stop offset="1" stopColor="#000000" stopOpacity={0.25} />
                    </RadialGradient>
                </Defs>
                {Array.from({ length: wedges }, (_, index) => wedge(index))}
                <Rect x="0" y="0" width="100" height="100" fill="url(#gloss)" />
                <Rect x="0" y="0" width="100" height="100" fill="url(#shade)" />
            </Svg>
        </View>
    );
}

/** The person's photo, or their initials (StudioProfile's avatar). */
export function PersonAvatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
    const colors = useColors();
    if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.muted }} />;
    return (
        <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: colors.muted }}>
            <T size={Math.round(size * 0.36)} weight="600">{personInitials(name)}</T>
        </View>
    );
}

/** A sheet's header: the title, and a close button (flex h-10 items-center justify-between). */
export function SheetHeader({ title, onClose, description }: { title: string; onClose?: () => void; description?: string }) {
    return (
        <View>
            <View style={{ height: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <T size={17} weight="600" lines={1} style={{ flex: 1 }}>{title}</T>
                {onClose ? <View style={{ marginRight: -8 }}><IconButton name="x:lucide" label="Close" onPress={onClose} /></View> : null}
            </View>
            {description ? <T size={13} leading={20} muted>{description}</T> : null}
        </View>
    );
}

/** An inline error message (text-[13px] text-destructive). */
export function ErrorText({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
    const colors = useColors();
    return <T size={13} leading={20} color={colors.destructive} style={style}>{children}</T>;
}

/**
 * A dropdown menu under its button (the web's DropdownMenu: rounded-2xl,
 * popover background, soft shadow). `anchor` is where it hangs from, in
 * window coordinates; a tap anywhere else closes it.
 */
export function Menu({ open, onClose, anchor, align = "right", width = 176, children }: { open: boolean; onClose: () => void; anchor: { x: number; y: number } | null; align?: "left" | "right"; width?: number; children: ReactNode }) {
    const colors = useColors();
    return (
        <Modal visible={open && !!anchor} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={{ flex: 1 }} onPress={onClose}>
                {anchor ? (
                    <View style={{
                        position: "absolute", top: anchor.y + 6, width,
                        ...(align === "right" ? { right: anchor.x } : { left: anchor.x }),
                        borderRadius: 16, padding: 4, backgroundColor: colors.popover,
                        shadowColor: "#000000", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 18 }, elevation: 12,
                    }}>
                        {children}
                    </View>
                ) : null}
            </Pressable>
        </Modal>
    );
}

/** One item in a Menu (flex h-10 items-center justify-between rounded-xl px-3 text-[15px]). */
export function MenuItem({ label, onPress, checked, right, disabled, muted }: { label: string; onPress: () => void; checked?: boolean; right?: ReactNode; disabled?: boolean; muted?: boolean }) {
    const colors = useColors();
    return (
        <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => ({ height: 40, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, backgroundColor: pressed ? colors.muted : "transparent", opacity: disabled ? 0.5 : 1 })}>
            <T lines={1} color={muted ? colors.mutedForeground : undefined} style={{ flex: 1 }}>{label}</T>
            {right ?? (checked ? <Icon name="check:lucide" size={16} color={colors.foreground} /> : null)}
        </Pressable>
    );
}

/**
 * A small sheet from below for a few choices (the web's short vaul drawers:
 * rounded-t-3xl, a line on top, the page dimmed behind).
 */
export function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    return (
        <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)" }} onPress={onClose} />
            <View style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: alpha(colors.border, 0.6), backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 16 }}>
                {children}
            </View>
        </Modal>
    );
}

/** Where a view is on screen, for hanging a Menu from it. */
export function measureAnchor(view: HostInstance | null, align: "left" | "right", done: (anchor: { x: number; y: number }) => void) {
    view?.measureInWindow((x, y, width, height) => {
        const screen = Dimensions.get("window").width;
        done({ x: align === "right" ? screen - (x + width) : x, y: y + height });
    });
}

/** Room above a sheet's first line: clear of iOS 26's large rounded sheet corners. */
export const SHEET_TOP = 24;

/**
 * A tall sheet from below (the web's vaul sheets): the phone's own page
 * sheet on iOS, drag down to close; full screen sliding up on Android.
 */
export function Sheet({ open, onClose, children, scroll = true }: { open: boolean; onClose: () => void; children: ReactNode; scroll?: boolean }) {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const padding = { paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? SHEET_TOP : insets.top + SHEET_TOP, paddingBottom: insets.bottom + 20 };
    return (
        <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <KeyboardSafe style={{ backgroundColor: colors.background }}>
                {scroll
                    ? <ScrollView contentContainerStyle={[padding, { flexGrow: 1 }]} keyboardShouldPersistTaps="handled">{children}</ScrollView>
                    : <View style={[padding, { flex: 1 }]}>{children}</View>}
            </KeyboardSafe>
        </Modal>
    );
}

/** A text field in Studio's type (bg-muted, rounded, h-12, text-[15px]). */
export const Field = forwardRef<TextInputInstance, TextInputProps & { flat?: boolean }>(function Field({ flat, style, ...props }, ref) {
    const colors = useColors();
    return (
        <TextInput
            ref={ref}
            placeholderTextColor={colors.mutedForeground}
            {...props}
            style={[{ height: props.multiline ? undefined : 48, minHeight: 48, paddingHorizontal: 20, fontFamily: fonts["500"], fontSize: 15, color: colors.foreground }, !flat && { borderRadius: 999, backgroundColor: colors.muted }, style]}
        />
    );
});

/** Whether the keyboard is up, and where its top edge is on screen. */
export function useKeyboard(): { shown: boolean; top: number } {
    const [state, setState] = useState({ shown: false, top: Dimensions.get("window").height });
    useEffect(() => {
        const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (event) => setState({ shown: true, top: event.endCoordinates.screenY }));
        const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setState({ shown: false, top: Dimensions.get("window").height }));
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);
    return state;
}

/**
 * Keeps what's at the bottom (a message box, a Save button) just above the
 * keyboard. Sheets end at the bottom of the screen, so that's the keyboard's
 * height: positions measured inside a sheet are the sheet's own, not the
 * screen's, which is why the standard KeyboardAvoidingView comes up short there.
 */
export function KeyboardSafe({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
    const keyboard = useKeyboard();
    const lift = keyboard.shown ? Math.max(0, Dimensions.get("window").height - keyboard.top) : 0;
    return <View style={[{ flex: 1, paddingBottom: lift }, style]}>{children}</View>;
}

/** Room above a sheet's first line: SHEET_TOP on iOS's card, and the status bar too on Android, where sheets fill the screen. */
export function useSheetTop(): number {
    const insets = useSafeAreaInsets();
    return Platform.OS === "ios" ? SHEET_TOP : insets.top + SHEET_TOP;
}
