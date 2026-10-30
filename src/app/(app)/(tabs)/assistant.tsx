import { View } from "react-native";
import { useOverview } from "@/lib/queries";
import { useWorkspace } from "@/lib/workspace";
import { Body, Card, Label, LoadError, Loading, Page } from "@/ui/kit";

/**
 * The assistant: where it's answering and what it can do. Changing it
 * (Copilot) is still on studio.cencori.com.
 */
export default function Assistant() {
    const { workspace } = useWorkspace();
    const overview = useOverview();
    const assistant = overview.data?.assistant;

    return (
        <Page title="AI" subtitle={workspace.organization.name} refreshing={overview.isRefetching} onRefresh={() => void overview.refetch()}>
            {overview.isPending ? <Loading /> : !overview.data ? <LoadError error={overview.error} onRetry={() => void overview.refetch()} /> : !assistant ? (
                <Card style={{ marginTop: 16 }}><Body>No assistant yet. Set one up on studio.cencori.com.</Body></Card>
            ) : (
                <>
                    <Card inverted style={{ marginTop: 16 }}>
                        <Body inverted weight="700" size={20}>{assistant.name}</Body>
                        <Body inverted size={14}>{assistant.published ? "Live, answering customers" : "Not live yet"}</Body>
                    </Card>

                    <Label>Where it answers</Label>
                    <Card style={{ gap: 8 }}>
                        <Line label="WhatsApp" value={assistant.whatsapp ? `${assistant.whatsapp.number ?? "Connected"}${assistant.whatsapp.replies_on ? "" : " · replies off"}` : "Not connected"} />
                        <Line label="Your website" value={assistant.website_chat?.on ? assistant.website_chat.sites.join(", ") || "On" : "Off"} />
                        <Line label="Your link" value={assistant.website_chat ? "On" : "Off"} />
                    </Card>

                    <Label>What it knows and does</Label>
                    <Card style={{ gap: 8 }}>
                        <Line label="Products" value={assistant.products ? `${assistant.products.count}` : "None"} />
                        <Line label="Payments" value={assistant.payments?.provider ? "Taking payments" : "Off"} />
                        <Line label="Knowledge" value={assistant.knowledge.length ? `${assistant.knowledge.length} source${assistant.knowledge.length === 1 ? "" : "s"}` : "None"} />
                    </Card>

                    <View style={{ marginTop: 20 }}>
                        <Body muted size={13}>To change what your assistant says or does, use Copilot on studio.cencori.com. It&apos;s coming to the app next.</Body>
                    </View>
                </>
            )}
        </Page>
    );
}

function Line({ label, value }: { label: string; value: string }) {
    return (
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <Body size={14}>{label}</Body>
            <View style={{ flex: 1, alignItems: "flex-end" }}><Body size={14} muted lines={1}>{value}</Body></View>
        </View>
    );
}
