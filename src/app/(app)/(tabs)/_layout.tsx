import { NativeTabs } from "expo-router/native-tabs";
import { useInbox } from "@/lib/queries";
import { fonts, palette, useColors } from "@/ui/theme";

/**
 * The tabs: the phone's own tab bar, with the web Studio's icons and words
 * (cencori components/studio/StudioShell.tsx). The icons are the web's Solar
 * icons drawn to PNG (assets/tabs), tinted by the system like its own.
 */
export default function TabsLayout() {
    const colors = useColors();
    // Each tab's own background is the page's: iOS 26's glass reads what's behind it, and a light
    // screen showing for a moment while a tab opens turned it bright grey.
    const behind = { backgroundColor: colors.background };
    const unread = (useInbox().data?.conversations ?? []).filter((conversation) => conversation.unread).length;
    return (
        <NativeTabs
            iconColor={{ default: colors.mutedForeground, selected: colors.foreground }}
            labelStyle={{ default: { fontFamily: fonts["500"], color: colors.mutedForeground }, selected: { fontFamily: fonts["500"], color: colors.foreground } }}
            tintColor={colors.foreground}
            badgeBackgroundColor={palette.emerald600}
        >
            <NativeTabs.Trigger name="index" contentStyle={behind}>
                <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Icon src={require("../../../../assets/tabs/home.png")} renderingMode="template" />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="inbox" contentStyle={behind}>
                <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Icon src={require("../../../../assets/tabs/chat-round-line.png")} renderingMode="template" />
                {unread > 0 ? <NativeTabs.Trigger.Badge>{unread > 9 ? "9+" : String(unread)}</NativeTabs.Trigger.Badge> : null}
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="sales" contentStyle={behind}>
                <NativeTabs.Trigger.Label>Sales</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Icon src={require("../../../../assets/tabs/bag-4.png")} renderingMode="template" />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="money" contentStyle={behind}>
                <NativeTabs.Trigger.Label>Money</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Icon src={require("../../../../assets/tabs/wallet.png")} renderingMode="template" />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="assistant" contentStyle={behind}>
                <NativeTabs.Trigger.Label>AI</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Icon src={require("../../../../assets/tabs/stars-minimalistic.png")} renderingMode="template" />
            </NativeTabs.Trigger>
        </NativeTabs>
    );
}
