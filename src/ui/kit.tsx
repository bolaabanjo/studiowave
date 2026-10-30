import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/ui/theme";
import { ApiError } from "@/lib/api";

/** A tab's page: a big title, pull to refresh, room under the tabs. */
export function Page({ title, subtitle, right, refreshing, onRefresh, children }: { title: string; subtitle?: string; right?: ReactNode; refreshing?: boolean; onRefresh?: () => void; children: ReactNode }) {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    return (
        <ScrollView
            style={{ backgroundColor: colors.background }}
            contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, paddingHorizontal: 16 }}
            refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.mutedForeground} /> : undefined}
        >
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    {subtitle ? <Text numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 12 }}>{subtitle}</Text> : null}
                    <Text style={{ color: colors.foreground, fontSize: 26, fontWeight: "600", letterSpacing: -0.4 }}>{title}</Text>
                </View>
                {right}
            </View>
            {children}
        </ScrollView>
    );
}

export function Card({ children, style, inverted, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; inverted?: boolean; onPress?: () => void }) {
    const colors = useColors();
    const body = <View style={[styles.card, { backgroundColor: inverted ? colors.accent : colors.muted }, style]}>{children}</View>;
    return onPress ? <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>{body}</Pressable> : body;
}

export function Label({ children }: { children: ReactNode }) {
    const colors = useColors();
    return <Text style={{ color: colors.mutedForeground, fontSize: 13, fontWeight: "600", marginTop: 24, marginBottom: 8 }}>{children}</Text>;
}

export function Body({ children, muted, size = 15, weight, inverted, lines }: { children: ReactNode; muted?: boolean; size?: number; weight?: "400" | "500" | "600" | "700"; inverted?: boolean; lines?: number }) {
    const colors = useColors();
    return <Text numberOfLines={lines} style={{ color: inverted ? colors.onAccent : muted ? colors.mutedForeground : colors.foreground, fontSize: size, fontWeight: weight, lineHeight: Math.round(size * 1.4) }}>{children}</Text>;
}

export function Button({ title, onPress, kind = "primary", disabled, busy, small }: { title: string; onPress: () => void; kind?: "primary" | "secondary" | "danger"; disabled?: boolean; busy?: boolean; small?: boolean }) {
    const colors = useColors();
    const background = kind === "primary" ? colors.accent : "transparent";
    const color = kind === "primary" ? colors.onAccent : kind === "danger" ? colors.danger : colors.foreground;
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled || busy}
            style={({ pressed }) => [styles.button, { height: small ? 36 : 46, paddingHorizontal: small ? 14 : 20, backgroundColor: background, borderColor: kind === "primary" ? background : colors.border, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 }]}
        >
            {busy ? <ActivityIndicator color={color} /> : <Text style={{ color, fontSize: small ? 13 : 15, fontWeight: "600" }}>{title}</Text>}
        </Pressable>
    );
}

export function Loading() {
    const colors = useColors();
    return <View style={{ paddingVertical: 48 }}><ActivityIndicator color={colors.mutedForeground} /></View>;
}

/** Nothing could be loaded: say why, with a retry. */
export function LoadError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
    const colors = useColors();
    return (
        <View style={[styles.card, { backgroundColor: colors.muted, alignItems: "center", marginTop: 24, paddingVertical: 32 }]}>
            <Text style={{ color: colors.danger, fontSize: 14, textAlign: "center", lineHeight: 20 }}>{error instanceof Error ? error.message : "Couldn't load this."}</Text>
            {error instanceof ApiError && error.status >= 400 ? <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>Error {error.status}</Text> : null}
            {onRetry ? <View style={{ marginTop: 12 }}><Button small kind="secondary" title="Try again" onPress={onRetry} /></View> : null}
        </View>
    );
}

export function Empty({ title, body }: { title: string; body?: string }) {
    return (
        <Card style={{ alignItems: "center", paddingVertical: 32, marginTop: 8 }}>
            <Body weight="600">{title}</Body>
            {body ? <View style={{ marginTop: 4 }}><Body muted size={14}>{body}</Body></View> : null}
        </Card>
    );
}

export function Avatar({ text, size = 40 }: { text: string; size?: number }) {
    const colors = useColors();
    return (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: size * 0.36 }}>{text}</Text>
        </View>
    );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<{ id: T; label: string }>; onChange: (value: T) => void }) {
    const colors = useColors();
    return (
        <View style={{ flexDirection: "row", backgroundColor: colors.muted, borderRadius: 999, padding: 4, marginTop: 16 }}>
            {options.map((option) => (
                <Pressable key={option.id} onPress={() => onChange(option.id)} style={{ flex: 1, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: value === option.id ? colors.background : "transparent" }}>
                    <Text style={{ color: value === option.id ? colors.foreground : colors.mutedForeground, fontWeight: "500", fontSize: 14 }}>{option.label}</Text>
                </Pressable>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
    card: { borderRadius: 20, padding: 16 },
    button: { borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row" },
});
