import { useState } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useTransferAction } from "@/lib/queries";
import { formatMoney, shortBankName, shortTime } from "@/lib/format";
import type { BankAccount, TransferToConfirm } from "@/lib/types";
import { BankAccountSheet } from "@/components/bank-account";
import { Icon } from "@/ui/icons";
import { Button, Card, Caps, ErrorText, IconCircle, BankLogo, T, Tag, siteImage } from "@/ui/kit";
import { palette, useColors } from "@/ui/theme";

/**
 * Customers who said they've sent money (first), and ones asked to pay
 * recently. The owner checks their own account, then taps Received
 * (cencori components/studio/StudioTransfers.tsx).
 */
export function TransfersToConfirm({ transfers }: { transfers: TransferToConfirm[] }) {
    const colors = useColors();
    const act = useTransferAction();
    const claimed = transfers.filter((transfer) => transfer.status === "claimed");
    const waiting = transfers.filter((transfer) => transfer.status === "awaiting");
    if (transfers.length === 0) return null;
    return (
        <View style={{ marginTop: 24 }}>
            <T weight="600" style={{ marginBottom: 4 }}>Transfers to confirm{claimed.length > 0 ? ` · ${claimed.length}` : ""}</T>
            <T size={13} leading={20} muted style={{ marginBottom: 8 }}>Check your bank app. Tap Received only once you see the money.</T>
            {act.error ? <ErrorText style={{ marginBottom: 8 }}>{act.error.message}</ErrorText> : null}
            <Card bordered>
                {[...claimed, ...waiting].map((transfer) => {
                    const busy = act.isPending && act.variables?.reference === transfer.reference;
                    return (
                        <View key={transfer.reference} style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                                <T lines={1} style={{ flex: 1 }}>{transfer.customer?.split(/[·,]/)[0]?.trim() || "A customer"}</T>
                                <T weight="600">{formatMoney(transfer.amount, transfer.currency)}</T>
                            </View>
                            <T size={13} muted lines={1} style={{ marginTop: 2 }}>{transfer.description}</T>
                            <T size={12} weight={transfer.status === "claimed" ? "500" : "500"} color={transfer.status === "claimed" ? (colors.scheme === "dark" ? palette.amber400 : "#92400e") : colors.mutedForeground} style={{ marginTop: 4 }}>
                                {transfer.status === "claimed" ? `Says they've paid · ${shortTime(transfer.claimed_at ?? transfer.created_at)}` : `Asked to pay · ${shortTime(transfer.created_at)}`} · {transfer.reference}
                            </T>
                            <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}>
                                <Button height={36} size={14} title="Received" disabled={busy} onPress={() => act.mutate({ reference: transfer.reference, action: "confirm" })} />
                                {transfer.status === "claimed" ? <Button kind="outline" height={36} size={14} title="Not yet" disabled={busy} onPress={() => act.mutate({ reference: transfer.reference, action: "not_received" })} /> : null}
                            </View>
                        </View>
                    );
                })}
            </Card>
        </View>
    );
}

const PROVIDERS: Record<string, string> = { paystack: "Paystack", flutterwave: "Flutterwave", stripe: "Stripe" };
const PROVIDER_LOGOS: Record<string, string> = { paystack: "/payments/paystack.svg", flutterwave: "/payments/flutterwave.png", stripe: "/payments/stripe.png" };
/** Paystack's and Flutterwave's marks fill their icons edge to edge: a little room so they sit like the others. */
const PROVIDER_LOGO_INSET: Record<string, number> = { paystack: 6, flutterwave: 6 };

/**
 * Money → Get paid: how customers pay, one row each. With a payment provider
 * connected, that's the way (payment links), so it's the only row; without
 * one, the business's own account for transfers, and the provider to connect.
 */
export function GetPaidCard({ accounts, payments, onConnectProvider }: { accounts: BankAccount[]; payments: { provider: string; mode: string } | null; onConnectProvider: () => void }) {
    const colors = useColors();
    const [editing, setEditing] = useState<BankAccount | "new" | null>(null);
    const chevron = <Icon name="chevron-right:lucide" size={16} color={colors.mutedForeground} />;
    const row = { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, paddingHorizontal: 16, paddingVertical: 14 };
    const pressed = (on: boolean) => (on ? { backgroundColor: colors.muted } : null);
    return (
        <View style={{ marginTop: 36 }}>
            <Caps style={{ marginBottom: 12, paddingHorizontal: 4 }}>Get paid</Caps>
            <Card>
                {payments ? (
                    <View style={row}>
                        {PROVIDER_LOGOS[payments.provider]
                            ? <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#ffffff", padding: PROVIDER_LOGO_INSET[payments.provider] ?? 0, overflow: "hidden" }}><Image source={{ uri: siteImage(PROVIDER_LOGOS[payments.provider]) }} style={{ flex: 1 }} contentFit="contain" /></View>
                            : <IconCircle name="credit-card:lucide" tone="sky" />}
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <T weight="600">{PROVIDERS[payments.provider] ?? "Payment link"}</T>
                                {payments.mode === "test" ? <Tag tone="amber" label="Test" /> : null}
                            </View>
                            <T size={13} muted>Payments go straight to your account</T>
                        </View>
                    </View>
                ) : null}
                {payments ? null : accounts.map((account, index) => (
                    <Pressable key={account.id ?? account.account_number} onPress={() => setEditing(account)} style={({ pressed: on }) => [row, pressed(on)]}>
                        <BankLogo name={account.bank} logo={account.logo} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <T weight="600" lines={1}>{account.account_name}</T>
                            <T size={13} muted lines={1}>{shortBankName(account.bank)} · {account.account_number}</T>
                        </View>
                        {index === 0 && accounts.length > 1 ? <Tag tone="neutral" label="Main" /> : null}
                        {chevron}
                    </Pressable>
                ))}
                {payments ? null : (
                    <Pressable onPress={() => setEditing("new")} style={({ pressed: on }) => [row, pressed(on)]}>
                        <IconCircle name={accounts.length ? "plus:lucide" : "landmark:lucide"} tone="emerald" />
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <T weight="600">{accounts.length ? "Add another account" : "Bank transfer"}</T>
                            {!accounts.length ? <T size={13} muted lines={1}>Bank, OPay, PalmPay, Moniepoint</T> : null}
                        </View>
                        {chevron}
                    </Pressable>
                )}
                {payments ? null : (
                    <Pressable onPress={onConnectProvider} style={({ pressed: on }) => [row, pressed(on)]}>
                        <IconCircle name="credit-card:lucide" tone="sky" />
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <T weight="600">Payment link</T>
                            <T size={13} muted lines={1}>Paystack, Flutterwave, Stripe</T>
                        </View>
                        {chevron}
                    </Pressable>
                )}
            </Card>
            {accounts.length > 1 && !payments ? <T size={12} leading={20} muted style={{ marginTop: 8, paddingHorizontal: 4 }}>Customers are given your main account.</T> : null}
            <BankAccountSheet
                key={editing === null ? "closed" : editing === "new" ? "new" : editing.id ?? editing.account_number}
                account={editing === "new" ? null : editing}
                isMain={editing !== "new" && !!editing && accounts[0]?.id === editing.id}
                count={accounts.length}
                open={editing !== null}
                onClose={() => setEditing(null)}
            />
        </View>
    );
}
