import { useState } from "react";
import { Alert, View } from "react-native";
import { router } from "expo-router";
import { useSales, useSalesAction } from "@/lib/queries";
import { bookingWhen, formatMoney, shortTime } from "@/lib/format";
import type { SalesBooking, SalesOrder } from "@/lib/types";
import { Body, Button, Card, Empty, LoadError, Loading, Page, Segmented } from "@/ui/kit";

const ORDER_STATUS: Record<SalesOrder["status"], string> = { awaiting_payment: "Waiting for payment", paid: "Paid", new: "New", done: "Done", cancelled: "Cancelled" };

/** Orders and bookings the assistant took. */
export default function SalesScreen() {
    const sales = useSales();
    const act = useSalesAction();
    const [view, setView] = useState<"orders" | "bookings">("orders");
    const data = sales.data;
    const run = (input: Parameters<typeof act.mutate>[0]) =>
        act.mutate(input, { onError: (cause) => Alert.alert("That didn't work", cause instanceof Error ? cause.message : "Try again.") });

    return (
        <Page title="Sales" refreshing={sales.isRefetching} onRefresh={() => void sales.refetch()}>
            <Segmented value={view} onChange={setView} options={[{ id: "orders", label: "Orders" }, { id: "bookings", label: "Bookings" }]} />
            <View style={{ marginTop: 16, gap: 8 }}>
                {sales.isPending ? <Loading /> : !data ? <LoadError error={sales.error} onRetry={() => void sales.refetch()} /> : view === "orders" ? (
                    data.orders.length === 0 ? <Empty title="No orders yet" body={data.has_products ? "Orders your assistant takes show up here." : "Add your products on studio.cencori.com so your assistant can take orders."} /> :
                        data.orders.map((order) => <OrderCard key={order.id} order={order} busy={act.isPending && act.variables?.id === order.id} onAction={(action) => run({ kind: "order", id: order.id, action })} />)
                ) : (
                    data.bookings.length === 0 ? <Empty title="No bookings yet" body="Bookings your assistant takes show up here." /> :
                        data.bookings.map((booking) => <BookingCard key={booking.id} booking={booking} busy={act.isPending && act.variables?.id === booking.id} onAction={(action) => run({ kind: "booking", id: booking.id, action })} />)
                )}
            </View>
        </Page>
    );
}

function OrderCard({ order, busy, onAction }: { order: SalesOrder; busy: boolean; onAction: (action: "paid" | "done" | "cancelled") => void }) {
    const open = order.status !== "done" && order.status !== "cancelled";
    return (
        <Card onPress={order.conversation_id ? () => router.push(`/conversation/${order.conversation_id}`) : undefined}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <View style={{ flex: 1 }}><Body weight="600" lines={1}>{order.customer ?? "Customer"}</Body></View>
                <Body weight="600">{formatMoney(order.total, order.currency)}</Body>
            </View>
            <Body muted size={13}>{order.items.map((item) => `${item.quantity} × ${item.name}${item.option ? ` (${item.option})` : ""}`).join(", ")}</Body>
            {order.delivery ? <Body muted size={13}>{order.delivery}</Body> : null}
            <View style={{ marginTop: 4 }}><Body muted size={12}>{`${ORDER_STATUS[order.status]} · ${shortTime(order.created_at)}`}</Body></View>
            {open ? (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                    {order.status === "awaiting_payment" ? <Button small kind="secondary" title="Mark paid" busy={busy} onPress={() => onAction("paid")} /> : null}
                    <Button small kind="secondary" title="Done" busy={busy} onPress={() => onAction("done")} />
                    <Button small kind="danger" title="Cancel" busy={busy} onPress={() => onAction("cancelled")} />
                </View>
            ) : null}
        </Card>
    );
}

function BookingCard({ booking, busy, onAction }: { booking: SalesBooking; busy: boolean; onAction: (action: "done" | "cancelled") => void }) {
    return (
        <Card onPress={booking.conversation_id ? () => router.push(`/conversation/${booking.conversation_id}`) : undefined}>
            <Body weight="600">{booking.title}</Body>
            {bookingWhen(booking.start) ? <Body size={14}>{bookingWhen(booking.start)}</Body> : null}
            {booking.detail ? <Body muted size={13}>{booking.detail}</Body> : null}
            {booking.deposit ? <Body muted size={13}>{`Deposit ${formatMoney(booking.deposit.amount, booking.deposit.currency)}`}</Body> : null}
            {booking.status === "confirmed" ? (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                    <Button small kind="secondary" title="Done" busy={busy} onPress={() => onAction("done")} />
                    <Button small kind="danger" title="Cancel" busy={busy} onPress={() => onAction("cancelled")} />
                </View>
            ) : <View style={{ marginTop: 4 }}><Body muted size={12}>{booking.status === "done" ? "Done" : "Cancelled"}</Body></View>}
        </Card>
    );
}
