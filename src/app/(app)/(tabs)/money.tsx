import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { useMoney } from "@/lib/queries";
import { formatMoney } from "@/lib/format";
import { SITE_URL } from "@/lib/config";
import { useTasks } from "@/lib/tasks";
import type { MoneyPeriod } from "@/lib/types";
import { GetPaidCard, TransfersToConfirm } from "@/components/transfers";
import { Icon } from "@/ui/icons";
import { Card, LoadError, Page, PageTitle, Skeleton, Switcher, T } from "@/ui/kit";
import { alpha, palette, useColors } from "@/ui/theme";

const PERIODS: Array<{ id: MoneyPeriod; label: string; caption: string; previous: string }> = [
    { id: "week", label: "Week", caption: "Last 7 days", previous: "the 7 days before" },
    { id: "month", label: "Month", caption: "This month so far", previous: "the same days last month" },
    { id: "year", label: "Year", caption: "This year so far", previous: "the same time last year" },
];

/** What came in through the assistant: totals, a bar chart, where it came from and what sold (cencori components/studio/views/MoneyView.tsx). */
export default function Money() {
    const colors = useColors();
    const tasks = useTasks();
    const [period, setPeriod] = useState<MoneyPeriod>("week");
    const meta = PERIODS.find((item) => item.id === period)!;
    const money = useMoney(period);
    const data = money.data;
    const max = Math.max(1, ...(data?.bars ?? []).map((bar) => bar.amount));
    const change = data ? data.total - data.previous : 0;
    const darkMode = colors.scheme === "dark";
    const line = (label: string, amount: number, color?: string) => (
        <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 }}>
            <T color={color}>{label}</T>
            <T weight="600" color={color}>{formatMoney(amount, data!.currency)}</T>
        </View>
    );

    return (
        <Page
            refreshing={money.isRefetching}
            onRefresh={() => void money.refetch()}
            header={
                <>
                    <PageTitle>Money</PageTitle>
                    <Switcher value={period} onChange={setPeriod} options={PERIODS} />
                </>
            }
        >
            {money.isPending ? (
                <View style={{ marginTop: 24, gap: 12 }}><Skeleton width={192} height={40} /><Skeleton height={128} radius={16} /><Skeleton height={112} radius={16} /></View>
            ) : !data ? (
                <LoadError error={money.error} fallback="Couldn't load your money." onRetry={() => void money.refetch()} />
            ) : (
                <>
                    <T size={13} muted style={{ marginTop: 20 }}>{meta.caption}</T>
                    <T size={38} weight="600" leading={42} style={{ marginTop: 4, letterSpacing: -0.95 }}>{formatMoney(data.total, data.currency)}</T>
                    {data.total > 0 || data.previous > 0 ? (
                        <T size={13} color={change >= 0 ? (darkMode ? palette.emerald400 : palette.emerald700) : colors.mutedForeground} style={{ marginTop: 8 }}>
                            {change === 0 ? `Same as ${meta.previous}` : `${change > 0 ? "Up" : "Down"} ${formatMoney(Math.abs(change), data.currency)} on ${meta.previous}`}
                        </T>
                    ) : null}

                    <TransfersToConfirm transfers={data.transfers_to_confirm} />

                    <View accessibilityRole="image" accessibilityLabel={`${meta.caption}: ${data.bars.map((bar) => `${bar.label} ${formatMoney(bar.amount, data.currency)}`).join(", ")}`} style={{ marginTop: 20, height: 128, flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                        {data.bars.map((bar, index) => (
                            <View key={`${bar.label}-${index}`} style={{ flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                                <View style={{ flex: 1, width: "100%", justifyContent: "flex-end" }}>
                                    <View style={{ width: "100%", borderRadius: 6, backgroundColor: bar.amount > 0 ? (bar.current ? colors.foreground : alpha(palette.emerald600, 0.8)) : colors.muted, height: bar.amount > 0 ? `${Math.max(6, Math.round((bar.amount / max) * 100))}%` : 4 }} />
                                </View>
                                <T size={11} weight={bar.current ? "600" : "500"} muted={!bar.current}>{bar.label}</T>
                            </View>
                        ))}
                    </View>

                    <Card style={{ marginTop: 24 }}>
                        {line("Paid by link", data.by_link)}
                        {data.by_transfer > 0 || data.bank_account ? line("By transfer, confirmed", data.by_transfer) : null}
                        {line(data.bank_account ? "Cash, marked paid" : "Cash and transfer, marked paid", data.marked_paid)}
                        {data.to_collect > 0 ? line("Still to collect", data.to_collect, darkMode ? palette.amber400 : "#92400e") : null}
                    </Card>

                    {data.top_items.length > 0 ? (
                        <View style={{ marginTop: 24 }}>
                            <T weight="600" style={{ marginBottom: 8 }}>Best sellers</T>
                            <Card bordered>
                                {data.top_items.map((item) => (
                                    <View key={item.name} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 }}>
                                        <T lines={1} style={{ flex: 1 }}>{item.name}<T size={12} muted>{`  × ${item.quantity}`}</T></T>
                                        <T weight="600">{formatMoney(item.amount, data.currency)}</T>
                                    </View>
                                ))}
                            </Card>
                        </View>
                    ) : null}

                    <GetPaidCard accounts={data.bank_accounts ?? (data.bank_account ? [data.bank_account] : [])} payments={data.payments} onConnectProvider={() => tasks.open("payments")} />
                    <Pressable onPress={() => void Linking.openURL(`${SITE_URL}/docs/agents/payments-and-products#your-money-in-studio`)} style={{ marginTop: 24, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 4 }}>
                        <T size={13} muted>How we handle your money</T>
                        <Icon name="chevron-right:lucide" size={14} color={colors.mutedForeground} />
                    </Pressable>
                </>
            )}
        </Page>
    );
}
