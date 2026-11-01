import { ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspace";
import type { StudioTask } from "@/lib/tasks";
import { AlertsTask, BusinessTask, EventTask, GoLiveTask, KnowledgeTask, LaterTask, NewBusinessTask, PaymentsTask, PlansTask, WebsiteTask, WhatsAppTask } from "@/components/tasks";
import { ProductsTask } from "@/components/products";
import { KeyboardSafe, SheetHeader, T, useKeyboard, useSheetTop } from "@/ui/kit";
import { useColors } from "@/ui/theme";

const TITLES: Record<StudioTask, string> = {
    knowledge: "Add knowledge",
    products: "Add products",
    event: "New event",
    whatsapp: "Connect WhatsApp",
    website: "Chat on your website",
    golive: "Go live",
    alerts: "Get told when someone needs you",
    payments: "Get paid by link",
    plans: "Choose a plan",
    business: "",
    newbusiness: "New business",
    later: "Coming to Studiowave soon",
};

/** Sheets whose main button sits at the bottom. */
const FILLS = new Set<StudioTask>(["payments", "products"]);

/** One task sheet (cencori components/studio/StudioTasks.tsx): set something up without leaving Studio. */
export default function Task() {
    const params = useLocalSearchParams<{ task: StudioTask; agentId?: string; eventId?: string; business?: string }>();
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const sheetTop = useSheetTop();
    const queryClient = useQueryClient();
    const keyboard = useKeyboard();
    const { workspace } = useWorkspace();
    const task = params.task in TITLES ? params.task : "later";
    const done = () => {
        router.back();
        void queryClient.invalidateQueries();
    };
    const target = task === "business" ? workspace.organizations.find((item) => item.id === params.business) ?? null : null;
    const agentId = params.agentId ?? workspace.agents[0]?.id ?? null;
    const agentBase = agentId ? `/api/projects/${workspace.project.id}/embedded-agents/${agentId}` : null;
    const title = task === "business" ? target?.name ?? "" : task === "event" && params.eventId ? "Edit event" : TITLES[task];

    const body = (() => {
        if (task === "business") return target ? <BusinessTask target={{ id: target.id, name: target.name, isBusiness: target.isBusiness }} onDone={done} /> : null;
        if (task === "plans") return <PlansTask onDone={done} />;
        if (task === "newbusiness") return <NewBusinessTask />;
        if (task === "products") return <ProductsTask onDone={done} />;
        if (task === "event") return <EventTask eventId={params.eventId ?? null} onDone={done} />;
        if (task === "later") return <LaterTask onDone={done} />;
        if (!agentId || !agentBase) return <T leading={24} muted>Set up your employee first.</T>;
        if (task === "knowledge") return <KnowledgeTask agentBase={agentBase} onDone={done} />;
        if (task === "whatsapp") return <WhatsAppTask agentBase={agentBase} agentId={agentId} onDone={done} />;
        if (task === "website") return <WebsiteTask agentBase={agentBase} />;
        if (task === "golive") return <GoLiveTask agentId={agentId} agentBase={agentBase} onDone={done} />;
        if (task === "alerts") return <AlertsTask agentBase={agentBase} email={workspace.user.email} onDone={done} />;
        return <PaymentsTask onDone={done} />;
    })();

    return (
        <KeyboardSafe style={{ backgroundColor: colors.background }}>
            {/* The title scrolls with the sheet's content, so nothing can sit over it. */}
            <ScrollView contentContainerStyle={{ flexGrow: FILLS.has(task) ? 1 : undefined, paddingHorizontal: 20, paddingTop: sheetTop, paddingBottom: keyboard.shown ? 12 : insets.bottom + 20 }} keyboardShouldPersistTaps="handled">
                <View style={{ marginBottom: 4 }}><SheetHeader title={title} onClose={() => router.back()} /></View>
                {body}
            </ScrollView>
        </KeyboardSafe>
    );
}
