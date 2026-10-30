import { Tabs, type BottomTabBarProps } from "expo-router/tabs";
import { router } from "expo-router";
import { Platform, Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import { BlurView } from "expo-blur";
import { GlassContainer, GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInbox } from "@/lib/queries";
import { Icon, type IconName } from "@/ui/icons";
import { T } from "@/ui/kit";
import { alpha, palette, useColors } from "@/ui/theme";

const TABS: Array<{ name: string; label: string; icon: IconName }> = [
    { name: "index", label: "Home", icon: "home" },
    { name: "inbox", label: "Inbox", icon: "chat-round-line" },
    { name: "sales", label: "Sales", icon: "bag-4" },
    { name: "money", label: "Money", icon: "wallet" },
    { name: "assistant", label: "AI", icon: "stars-minimalistic" },
];

/** The five tabs, as on the web (cencori components/studio/StudioShell.tsx): a floating pill with labels, and Copilot's button beside it. */
export default function TabsLayout() {
    return (
        <Tabs tabBar={(props) => <TabPill {...props} />} screenOptions={{ headerShown: false }}>
            {TABS.map((tab) => <Tabs.Screen key={tab.name} name={tab.name} />)}
        </Tabs>
    );
}

/**
 * Apple's Liquid Glass where the phone has it (iOS 26 and later); checked
 * once, since some iOS 26 betas lack the API and would crash, and a build
 * without the glass module falls back to the blur.
 */
const LIQUID_GLASS = (() => {
    try {
        return Platform.OS === "ios" && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
    } catch {
        return false;
    }
})();

/**
 * A surface of the tab bar: Apple's real glass on iOS 26, else the web's look
 * (border-border/60, bg-background/90, backdrop-blur-md).
 */
function Glass({ style, children }: { style: StyleProp<ViewStyle>; children: ReactNode }) {
    const colors = useColors();
    if (LIQUID_GLASS) return <GlassView glassEffectStyle="regular" isInteractive colorScheme={colors.scheme} style={style}>{children}</GlassView>;
    return (
        <View style={[{ borderWidth: 1, borderColor: alpha(colors.border, 0.6), backgroundColor: alpha(colors.background, 0.9), overflow: "hidden" }, style]}>
            <BlurView intensity={30} tint={colors.scheme} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
            {children}
        </View>
    );
}

/** The web's pill: rounded-full, p-1, gap-3; each tab a 48px circle, the current one ringed; Copilot's circle beside it. */
function TabPill({ state, navigateToTab }: BottomTabBarProps) {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    // On glass, the two shapes sit in one container so they blend into each other as iOS's own controls do.
    const Row = LIQUID_GLASS ? GlassContainer : View;
    return (
        <Row {...(LIQUID_GLASS ? { spacing: 8 } : {})} pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }}>
            <Glass style={{ flexDirection: "row", gap: 12, padding: 4, borderRadius: 999 }}>
                {TABS.map((tab) => {
                    const index = state.routes.findIndex((route) => route.name === tab.name);
                    const active = state.index === index;
                    const color = active ? colors.foreground : colors.mutedForeground;
                    return (
                        <Pressable
                            key={tab.name}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={tab.label}
                            onPress={() => { if (!active) navigateToTab(state.routes[index].key); }}
                            style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", gap: 2, borderWidth: 1, borderColor: active ? colors.border : "transparent" }}
                        >
                            <View>
                                <Icon name={tab.icon} size={18} color={color} />
                                {tab.name === "inbox" ? <UnreadBadge /> : null}
                            </View>
                            <T size={9} leading={11} color={color}>{tab.label}</T>
                        </Pressable>
                    );
                })}
            </Glass>
            {/* Copilot: one tap into it, a round button as tall as the pill. */}
            <Glass style={{ width: 58, height: 58, borderRadius: 29 }}>
                <Pressable onPress={() => router.push("/copilot")} accessibilityRole="button" accessibilityLabel="Ask or change anything" style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Icon name="airdrop:huge" size={20} color={colors.foreground} />
                </Pressable>
            </Glass>
        </Row>
    );
}

/** The number of unread chats, on the Inbox tab. */
function UnreadBadge() {
    const count = (useInbox().data?.conversations ?? []).filter((conversation) => conversation.unread).length;
    if (count === 0) return null;
    return (
        <View style={{ position: "absolute", right: -10, top: -6, height: 16, minWidth: 16, borderRadius: 8, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", backgroundColor: palette.emerald600 }}>
            <T size={9} weight="600" leading={11} color="#ffffff">{count > 9 ? "9+" : String(count)}</T>
        </View>
    );
}
