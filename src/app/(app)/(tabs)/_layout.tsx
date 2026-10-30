import { NativeTabs } from "expo-router/native-tabs";
import { useInbox } from "@/lib/queries";

/** The five tabs, as on the web: the phone's own tab bar. */
export default function TabsLayout() {
    const unread = (useInbox().data?.conversations ?? []).filter((conversation) => conversation.unread).length;
    return (
        <NativeTabs>
            <NativeTabs.Trigger name="index">
                <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="inbox">
                <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Icon sf={{ default: "bubble.left", selected: "bubble.left.fill" }} md="chat_bubble" />
                {unread > 0 ? <NativeTabs.Trigger.Badge>{String(unread)}</NativeTabs.Trigger.Badge> : null}
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="sales">
                <NativeTabs.Trigger.Label>Sales</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Icon sf={{ default: "bag", selected: "bag.fill" }} md="shopping_bag" />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="money">
                <NativeTabs.Trigger.Label>Money</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Icon sf={{ default: "wallet.bifold", selected: "wallet.bifold.fill" }} md="account_balance_wallet" />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="assistant">
                <NativeTabs.Trigger.Label>AI</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Icon sf="sparkles" md="auto_awesome" />
            </NativeTabs.Trigger>
        </NativeTabs>
    );
}
