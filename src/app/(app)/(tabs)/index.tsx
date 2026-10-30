import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useInbox, useOverview } from "@/lib/queries";
import { useWorkspace } from "@/lib/workspace";
import { greeting, setupSteps } from "@/lib/format";
import { useTasks } from "@/lib/tasks";
import { COPILOT_TAB } from "@/lib/copilot-tab";
import type { StudioOverview } from "@/lib/types";
import { BriefSection, NeedsYouSection, QuickActions, SetupSection, TodayCard, UpNextSection } from "@/components/home";
import { Icon } from "@/ui/icons";
import { Button, EmptyCard, LoadError, Page, PersonAvatar, Skeleton, T } from "@/ui/kit";
import { alpha, palette, useColors } from "@/ui/theme";

/** Home: today at a glance (cencori components/studio/views/HomeView.tsx). */
export default function Home() {
    const { workspace } = useWorkspace();
    const overview = useOverview();
    const inbox = useInbox();
    const data = overview.data;
    const steps = setupSteps(data?.assistant?.still_to_do ?? []);
    // Set up once an assistant has been published; one that setup only started still means setup isn't finished.
    const setUp = workspace.agents.some((agent) => agent.published);
    const started = workspace.agents.length > 0;
    const { user, organization } = workspace;

    return (
        <Page fill={!setUp} onRefresh={() => Promise.all([overview.refetch(), inbox.refetch()])}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Pressable onPress={() => router.push("/profile")} accessibilityLabel="You">
                    <PersonAvatar name={user.fullName ?? user.email ?? "?"} url={user.avatarUrl} size={40} />
                </Pressable>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <T size={12} muted lines={1}>{organization.name}</T>
                    <T size={20} weight="600" leading={25} style={{ letterSpacing: -0.5 }}>{greeting()}{user.firstName ? `, ${user.firstName}` : ""}</T>
                </View>
                {setUp && !COPILOT_TAB ? <CopilotButton /> : null}
                {setUp ? <NotificationBell /> : null}
            </View>

            {setUp && data?.plan ? <PlanNotice plan={data.plan} /> : null}

            {!setUp ? (
                <EmptyCard
                    inverted
                    icon="user-rounded"
                    title={started ? "Finish setting up your assistant" : "Set up your assistant"}
                    description={started
                        ? "You're part of the way there. Pick up where you left off, and it starts answering customers on your link and WhatsApp."
                        : "A few questions about your business, and it starts answering customers on your link and WhatsApp."}
                >
                    <Button kind="inverse" height={44} size={14} title={started ? "Continue" : "Start"} onPress={() => router.push("/setup")} style={{ marginTop: 16 }} />
                </EmptyCard>
            ) : overview.isPending ? (
                <View style={{ marginTop: 20, gap: 12 }}>
                    <Skeleton width={224} height={20} />
                    <Skeleton height={144} radius={24} />
                    <Skeleton height={96} radius={16} />
                </View>
            ) : !data ? (
                <LoadError error={overview.error} fallback="Couldn't load your business." onRetry={() => void overview.refetch()} />
            ) : (
                <>
                    <TodayCard data={data} />
                    <NeedsYouSection />
                    <UpNextSection />
                    {data.brief ? <BriefSection brief={data.brief} /> : null}
                    <QuickActions data={data} />
                    <SetupSection steps={steps} />
                </>
            )}
        </Page>
    );
}

/** Copilot, where it has no tab of its own (Android, iOS before 26.1): beside the bell. */
function CopilotButton() {
    const colors = useColors();
    return (
        <Pressable
            onPress={() => router.push("/copilot")}
            accessibilityLabel="Ask or change anything"
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: alpha(colors.border, 0.6) }}
        >
            <Icon name="airdrop:huge" size={20} color={colors.foreground} />
        </Pressable>
    );
}

/** The bell: a count of chats waiting on the owner, opening Notifications. */
function NotificationBell() {
    const colors = useColors();
    const count = (useInbox().data?.conversations ?? []).filter((conversation) => conversation.needs_owner || conversation.owner_active).length;
    return (
        <Pressable
            onPress={() => router.push("/notifications")}
            accessibilityLabel={count ? `Notifications, ${count} need you` : "Notifications"}
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: alpha(colors.border, 0.6) }}
        >
            <Icon name="bell" size={20} color={colors.foreground} />
            {count > 0 ? (
                <View style={{ position: "absolute", right: -2, top: -2, height: 16, minWidth: 16, borderRadius: 8, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", backgroundColor: palette.orange600 }}>
                    <T size={9} weight="600" leading={11} color="#ffffff">{count > 9 ? "9+" : String(count)}</T>
                </View>
            ) : null}
        </Pressable>
    );
}

/** A plan's last days, its grace days, its extras, or a plan that has stopped: say so, with the way to pay. */
function PlanNotice({ plan }: { plan: NonNullable<StudioOverview["plan"]> }) {
    const colors = useColors();
    const tasks = useTasks();
    const [now] = useState(Date.now);
    const daysLeft = plan.period_end ? Math.ceil((Date.parse(plan.period_end) - now) / 86_400_000) : null;
    const graceDays = plan.grace_end ? Math.max(1, Math.ceil((Date.parse(plan.grace_end) - now) / 86_400_000)) : null;
    const name = plan.name === "Free trial" ? "free trial" : `${plan.name} plan`;
    const ending = plan.active && !plan.in_grace && daysLeft !== null && daysLeft <= 3;
    const overChats = plan.active && plan.used >= plan.conversations;
    if (plan.active && !plan.in_grace && !ending && !overChats) return null;
    const [title, body] = !plan.active
        ? ["Your assistant has stopped", "Choose a plan to switch it back on."]
        : plan.in_grace
            ? [`Your ${name} has ended`, `Still answering for ${graceDays} more day${graceDays === 1 ? "" : "s"}.`]
            : overChats
                ? ["All your chats used", `${Math.max(0, plan.capacity - plan.used)} extra left.`]
                : [daysLeft! <= 1 ? `Your ${name} ends today` : `Your ${name} ends in ${daysLeft} days`, "Renew to keep your assistant answering."];
    const darkMode = colors.scheme === "dark";
    const look = plan.active
        ? { background: darkMode ? alpha(palette.amber500, 0.1) : palette.amber50, color: darkMode ? palette.amber200 : palette.amber900 }
        : { background: alpha(colors.destructive, 0.1), color: colors.destructive };
    return (
        <View style={{ marginTop: 20, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: look.background }}>
            <T weight="600" color={look.color}>{title}</T>
            <T size={13} leading={20} color={look.color} style={{ marginTop: 2, opacity: 0.9 }}>{body}</T>
            <Button height={40} size={14} title={plan.name === "Free trial" || !plan.active ? "Choose a plan" : "Renew"} onPress={() => tasks.open("plans")} style={{ marginTop: 12, alignSelf: "flex-start" }} />
        </View>
    );
}
