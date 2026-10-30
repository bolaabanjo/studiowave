import { Tabs, type BottomTabBarProps } from "expo-router/tabs";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { BlurView } from "expo-blur";
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

/** The web's pill: rounded-full, border-border/60, bg-background/90 with a blur, p-1, gap-3; each tab a 48px circle, the current one ringed. */
function TabPill({ state, navigateToTab }: BottomTabBarProps) {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const glass = { borderWidth: 1, borderColor: alpha(colors.border, 0.6), backgroundColor: alpha(colors.background, 0.9), overflow: "hidden" as const };
    const blur = <BlurView intensity={30} tint={colors.scheme} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />;
    return (
        <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }}>
            <View style={[glass, { flexDirection: "row", gap: 12, padding: 4, borderRadius: 999 }]}>
                {blur}
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
            </View>
            {/* Copilot: one tap into it, a round button as tall as the pill. */}
            <Pressable onPress={() => router.push("/copilot")} accessibilityRole="button" accessibilityLabel="Ask or change anything" style={[glass, { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" }]}>
                {blur}
                <Icon name="airdrop:huge" size={20} color={colors.foreground} />
            </Pressable>
        </View>
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
