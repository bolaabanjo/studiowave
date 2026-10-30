import { useState } from "react";
import { Alert, View } from "react-native";
import { useMoney, useTransferAction } from "@/lib/queries";
import { formatMoney, shortTime } from "@/lib/format";
import type { MoneyPeriod } from "@/lib/types";
import { Body, Button, Card, Label, LoadError, Loading, Page, Segmented } from "@/ui/kit";
import { useColors } from "@/ui/theme";

const PERIODS: Array<{ id: MoneyPeriod; label: string; caption: string }> = [
    { id: "week", label: "Week", caption: "Last 7 days" },
    { id: "month", label: "Month", caption: "This month so far" },
    { id: "year", label: "Year", caption: "This year so far" },
];

/** What came in through the assistant: paid links, transfers you confirmed, and orders you marked paid. */
export default function MoneyScreen() {
    const colors = useColors();
    const [period, setPeriod] = useState<MoneyPeriod>("week");
    const money = useMoney(period);
    const transfer = useTransferAction();
    const data = money.data;
    const max = Math.max(1, ...(data?.bars ?? []).map((bar) => bar.amount));
    const claimed = (data?.transfers_to_confirm ?? []).filter((item) => item.status === "claimed");

    return (
        <Page title="Money" refreshing={money.isRefetching} onRefresh={() => void money.refetch()}>
            <Segmented value={period} onChange={setPeriod} options={PERIODS} />
            {money.isPending ? <Loading /> : !data ? <LoadError error={money.error} onRetry={() => void money.refetch()} /> : (
                <>
                    <View style={{ marginTop: 20 }}>
                        <Body muted size={13}>{PERIODS.find((item) => item.id === period)!.caption}</Body>
                        <Body weight="700" size={34}>{formatMoney(data.total, data.currency)}</Body>
                        <Body muted size={13}>{`${data.paid_count} payment${data.paid_count === 1 ? "" : "s"}${data.to_collect > 0 ? ` · ${formatMoney(data.to_collect, data.currency)} still to collect` : ""}`}</Body>
                    </View>

                    <Card style={{ marginTop: 16 }}>
                        <View style={{ flexDirection: "row", alignItems: "flex-end", height: 120, gap: 6 }}>
                            {data.bars.map((bar, index) => (
                                <View key={index} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                                    <View style={{ width: "100%", height: Math.max(3, (bar.amount / max) * 96), borderRadius: 6, backgroundColor: bar.current ? colors.foreground : colors.border }} />
                                    <Body muted size={11}>{bar.label}</Body>
                                </View>
                            ))}
                        </View>
                    </Card>

                    {claimed.length > 0 ? (
                        <>
                            <Label>Check your account</Label>
                            <View style={{ gap: 8 }}>
                                {claimed.map((item) => (
                                    <Card key={item.reference}>
                                        <Body weight="600">{`${item.customer ?? "A customer"} says they've paid ${formatMoney(item.amount, item.currency)}`}</Body>
                                        <Body muted size={13}>{`${item.description} · ${shortTime(item.claimed_at ?? item.created_at)}`}</Body>
                                        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                                            <Button small title="It arrived" busy={transfer.isPending && transfer.variables?.reference === item.reference && transfer.variables.action === "confirm"} onPress={() => transfer.mutate({ reference: item.reference, action: "confirm" }, { onError: (cause) => Alert.alert("That didn't work", cause instanceof Error ? cause.message : "Try again.") })} />
                                            <Button small kind="secondary" title="Not yet" busy={transfer.isPending && transfer.variables?.reference === item.reference && transfer.variables.action === "not_received"} onPress={() => transfer.mutate({ reference: item.reference, action: "not_received" })} />
                                        </View>
                                    </Card>
                                ))}
                            </View>
                        </>
                    ) : null}

                    <Label>Where it came from</Label>
                    <Card style={{ gap: 6 }}>
                        <Row label="Paid by link" value={formatMoney(data.by_link, data.currency)} />
                        <Row label="Bank transfers" value={formatMoney(data.by_transfer, data.currency)} />
                        <Row label="Marked paid by you" value={formatMoney(data.marked_paid, data.currency)} />
                    </Card>

                    {data.top_items.length > 0 ? (
                        <>
                            <Label>What sold</Label>
                            <Card style={{ gap: 6 }}>
                                {data.top_items.map((item) => <Row key={item.name} label={`${item.quantity} × ${item.name}`} value={formatMoney(item.amount, data.currency)} />)}
                            </Card>
                        </>
                    ) : null}
                </>
            )}
        </Page>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1 }}><Body size={14} lines={1}>{label}</Body></View>
            <Body size={14} weight="600">{value}</Body>
        </View>
    );
}
