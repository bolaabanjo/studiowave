import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useInbox, useOverview } from "@/lib/queries";
import { useWorkspace } from "@/lib/workspace";
import { conversationTitle, formatMoney, greeting, initials, needsOwnerLabel, setupSteps, shortTime } from "@/lib/format";
import { Avatar, Body, Card, Label, LoadError, Loading, Page } from "@/ui/kit";
import { useColors } from "@/ui/theme";

/** Home: today at a glance. */
export default function Home() {
    const { workspace } = useWorkspace();
    const overview = useOverview();
    const inbox = useInbox();
    const data = overview.data;
    const needsYou = (inbox.data?.conversations ?? []).filter((conversation) => conversation.needs_owner && conversation.open);
    const setUp = workspace.agents.some((agent) => agent.published);
    const steps = setupSteps(data?.assistant?.still_to_do ?? []);

    return (
        <Page
            title={`${greeting()}${workspace.user.firstName ? `, ${workspace.user.firstName}` : ""}`}
            subtitle={workspace.organization.name}
            right={<Pressable onPress={() => router.push("/profile")} hitSlop={8}><Avatar text={initials(workspace.user.fullName ?? workspace.user.email ?? "?")} /></Pressable>}
            refreshing={overview.isRefetching}
            onRefresh={() => { void overview.refetch(); void inbox.refetch(); }}
        >
            {!setUp ? (
                <Card inverted style={{ marginTop: 16, alignItems: "center", paddingVertical: 32 }}>
                    <Body inverted weight="600" size={18}>Set up your assistant</Body>
                    <View style={{ marginTop: 6 }}>
                        <Body inverted size={14}>Setup is on studio.cencori.com for now. Your business shows up here as soon as it&apos;s live.</Body>
                    </View>
                </Card>
            ) : overview.isPending ? <Loading /> : !data ? <LoadError error={overview.error} onRetry={() => void overview.refetch()} /> : (
                <>
                    <PlanNotice plan={data.plan} />

                    <Card inverted style={{ marginTop: 16 }}>
                        <Body inverted muted size={13}>Today</Body>
                        <View style={{ flexDirection: "row", marginTop: 8, gap: 24 }}>
                            <View>
                                <Body inverted weight="700" size={28}>{String(data.today.chats)}</Body>
                                <Body inverted size={13}>{data.today.chats === 1 ? "chat" : "chats"}</Body>
                            </View>
                            {data.today.earned ? (
                                <View>
                                    <Body inverted weight="700" size={28}>{formatMoney(data.today.earned.amount, data.currency)}</Body>
                                    <Body inverted size={13}>came in</Body>
                                </View>
                            ) : null}
                        </View>
                        <View style={{ marginTop: 12 }}>
                            <Body inverted size={13}>{`This month: ${data.month.chats} chats${data.month.earned ? ` · ${formatMoney(data.month.earned.amount, data.currency)}` : ""}`}</Body>
                        </View>
                    </Card>

                    {needsYou.length > 0 ? (
                        <>
                            <Label>Needs you</Label>
                            <View style={{ gap: 8 }}>
                                {needsYou.slice(0, 5).map((conversation) => (
                                    <Card key={conversation.id} onPress={() => router.push(`/conversation/${conversation.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                                        <Avatar text={initials(conversationTitle(conversation))} />
                                        <View style={{ flex: 1 }}>
                                            <Body weight="600" lines={1}>{conversationTitle(conversation)}</Body>
                                            <Body muted size={13} lines={1}>{needsOwnerLabel(conversation.needs_owner!.reason)}</Body>
                                        </View>
                                        <Body muted size={12}>{shortTime(conversation.needs_owner!.at)}</Body>
                                    </Card>
                                ))}
                            </View>
                        </>
                    ) : null}

                    {data.brief ? (
                        <>
                            <Label>Your brief</Label>
                            <Card>
                                <Body weight="600">{data.brief.headline}</Body>
                                <View style={{ marginTop: 6, gap: 4 }}>
                                    {data.brief.points.map((point, index) => <Body key={index} muted size={14}>{`• ${point}`}</Body>)}
                                </View>
                            </Card>
                        </>
                    ) : null}

                    {steps.length > 0 ? (
                        <>
                            <Label>Still to do</Label>
                            <Card style={{ gap: 6 }}>
                                {steps.map((step) => <Body key={step} size={14}>{`○ ${step}`}</Body>)}
                            </Card>
                        </>
                    ) : null}
                </>
            )}
        </Page>
    );
}

/** A plan's last days, its grace days, its extras, or a plan that has stopped. Paying is on the web. */
function PlanNotice({ plan }: { plan: NonNullable<ReturnType<typeof useOverview>["data"]>["plan"] }) {
    const colors = useColors();
    if (!plan) return null;
    const daysLeft = plan.period_end ? Math.ceil((Date.parse(plan.period_end) - Date.now()) / 86_400_000) : null;
    const graceDays = plan.grace_end ? Math.max(1, Math.ceil((Date.parse(plan.grace_end) - Date.now()) / 86_400_000)) : null;
    const name = plan.name === "Free trial" ? "free trial" : `${plan.name} plan`;
    const ending = plan.active && !plan.in_grace && daysLeft !== null && daysLeft <= 3;
    const overChats = plan.active && plan.used >= plan.conversations;
    if (plan.active && !plan.in_grace && !ending && !overChats) return null;
    const [title, body] = !plan.active
        ? ["Your assistant has stopped", "Choose a plan on studio.cencori.com to switch it back on."]
        : plan.in_grace
            ? [`Your ${name} has ended`, `Still answering for ${graceDays} more day${graceDays === 1 ? "" : "s"}. Renew on studio.cencori.com.`]
            : overChats
                ? ["All your chats used", `${Math.max(0, plan.capacity - plan.used)} extra left.`]
                : [daysLeft! <= 1 ? `Your ${name} ends today` : `Your ${name} ends in ${daysLeft} days`, "Renew on studio.cencori.com to keep your assistant answering."];
    return (
        <View style={{ marginTop: 16, borderRadius: 16, padding: 14, backgroundColor: plan.active ? colors.warningBackground : colors.dangerBackground }}>
            <Body weight="600">{title}</Body>
            <Body size={13}>{body}</Body>
        </View>
    );
}
