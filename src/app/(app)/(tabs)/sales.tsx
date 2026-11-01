import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSales, useSalesAction } from "@/lib/queries";
import { bookingWhen, formatMoney, shortTime } from "@/lib/format";
import { useTasks } from "@/lib/tasks";
import type { SalesBooking, SalesOrder } from "@/lib/types";
import { EventsList } from "@/components/events";
import { Icon } from "@/ui/icons";
import { Button, EmptyCard, ErrorText, LoadError, Page, PageTitle, Skeleton, Switcher, T, Tag, type TagTone } from "@/ui/kit";
import { alpha, useColors } from "@/ui/theme";

function orderStatus(order: SalesOrder): { label: string; tone: TagTone } {
    if (order.status === "paid") return { label: order.paid_by === "owner" ? "Marked paid" : order.paid_by === "transfer" ? "Paid by transfer" : "Paid by link", tone: "good" };
    if (order.status === "awaiting_payment") return { label: "Waiting for payment", tone: "wait" };
    if (order.status === "new") return { label: "Not paid yet", tone: "wait" };
    if (order.status === "done") return { label: "Done", tone: "off" };
    return { label: "Cancelled", tone: "off" };
}

function bookingStatus(booking: SalesBooking): { label: string; tone: TagTone } {
    if (booking.status === "done") return { label: "Came", tone: "off" };
    if (booking.status === "cancelled") return { label: "Cancelled", tone: "off" };
    if (booking.status === "no_show") return { label: "Didn't come", tone: "off" };
    if (booking.status === "held") return { label: "Waiting for deposit", tone: "wait" };
    const start = booking.start ? new Date(booking.start) : null;
    if (start && !Number.isNaN(start.getTime()) && start.getTime() < Date.now()) return { label: "Did they come?", tone: "wait" };
    return { label: "Booked", tone: "good" };
}

function SmallButton({ title, onPress, disabled, strong }: { title: string; onPress: () => void; disabled?: boolean; strong?: boolean }) {
    return <Button kind={strong ? "primary" : "outline"} height={32} size={13} title={title} onPress={onPress} disabled={disabled} style={{ paddingHorizontal: 12 }} />;
}

function ChatButton({ id }: { id: string }) {
    const colors = useColors();
    return (
        <Pressable onPress={() => router.push(`/conversation/${id}`)} accessibilityLabel="Open the chat" style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: alpha(colors.border, 0.6) }}>
            <Icon name="message-circle:lucide" size={16} color={colors.foreground} />
        </Pressable>
    );
}

/** Orders, bookings and events: what, who, when, paid or not (cencori components/studio/views/SalesView.tsx). */
export default function Sales() {
    const colors = useColors();
    // A ticket notification opens ?view=events.
    const params = useLocalSearchParams<{ view?: string }>();
    const [view, setView] = useState<"orders" | "bookings" | "events">(params.view === "events" ? "events" : "orders");
    const sales = useSales();
    const act = useSalesAction();
    const tasks = useTasks();
    const data = sales.data;
    const orders = data?.orders ?? [];
    const bookings = data?.bookings ?? [];
    const toCollect = orders.filter((order) => order.status === "new" || order.status === "awaiting_payment");
    const empty = view !== "events" && !!data && (view === "orders" ? orders : bookings).length === 0;
    const line = alpha(colors.border, 0.4);
    const item = (key: string, children: ReactNode) => <View key={key} style={{ borderBottomWidth: 1, borderBottomColor: line, paddingHorizontal: 16, paddingVertical: 14 }}>{children}</View>;

    return (
        <Page
            fill={empty || view === "events"}
            onRefresh={() => sales.refetch()}
            header={
                <>
                    <PageTitle>Sales</PageTitle>
                    <Switcher value={view} onChange={setView} options={[
                        { id: "orders", label: `Orders${orders.length ? ` · ${orders.length}` : ""}` },
                        { id: "bookings", label: `Bookings${bookings.length ? ` · ${bookings.length}` : ""}` },
                        { id: "events", label: "Events" },
                    ]} />
                    {view === "events" ? <Button height={44} title="New event" onPress={() => tasks.open("event")} style={{ marginTop: 12 }} /> : null}
                    {view === "bookings" ? <Button height={44} title="Open your schedule" icon={<Icon name="calendar:linear" size={18} color={colors.background} />} onPress={() => router.push("/schedule")} style={{ marginTop: 12 }} /> : null}
                </>
            }
        >
            {act.error ? <ErrorText style={{ marginTop: 12 }}>{act.error.message}</ErrorText> : null}
            {view === "events" ? (
                <EventsList />
            ) : sales.isLoading ? (
                <View style={{ marginTop: 16, gap: 12 }}>{[0, 1, 2, 3].map((index) => <Skeleton key={index} height={80} radius={16} />)}</View>
            ) : !data ? (
                <LoadError error={sales.error} fallback="Couldn't load your sales." onRetry={() => void sales.refetch()} />
            ) : view === "orders" ? (
                orders.length === 0 ? (
                    data.has_products ? (
                        <EmptyCard icon="bag-4" title="No orders yet" description="When customers order from your employee, they show up here." />
                    ) : (
                        <EmptyCard icon="box" title="No products yet" description="Your employee can take orders once it has your product list.">
                            <Button height={44} size={14} title="Add your products" onPress={() => tasks.open("products")} style={{ marginTop: 16 }} />
                        </EmptyCard>
                    )
                ) : (
                    <>
                        {toCollect.length > 0 ? (
                            <T size={13} muted style={{ marginTop: 16 }}>
                                {formatMoney(toCollect.reduce((sum, order) => sum + order.total, 0), data.currency)} still to collect from {toCollect.length} {toCollect.length === 1 ? "order" : "orders"}
                            </T>
                        ) : null}
                        <View style={{ marginHorizontal: -16, marginTop: 8 }}>
                            {orders.map((order) => {
                                const status = orderStatus(order);
                                const unpaid = order.status === "new" || order.status === "awaiting_payment";
                                return item(order.id, (
                                    <>
                                        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                                            <View style={{ flex: 1, minWidth: 0 }}>
                                                <T weight="600">{order.customer ?? order.id}<T size={12} weight="400" muted>{`  ${shortTime(order.created_at)}`}</T></T>
                                                <T size={13} leading={20} muted style={{ marginTop: 2 }}>{order.items.map((entry) => `${entry.quantity} × ${entry.name}${entry.option ? ` (${entry.option})` : ""}`).join(", ")}</T>
                                                {order.delivery ? <T size={13} muted lines={1} style={{ marginTop: 2 }}>To: {order.delivery}</T> : null}
                                                <View style={{ marginTop: 6 }}><Tag round tone={status.tone} label={status.label} /></View>
                                            </View>
                                            <T weight="600">{formatMoney(order.total, order.currency)}</T>
                                        </View>
                                        {unpaid || order.status === "paid" ? (
                                            <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                                {unpaid ? <SmallButton strong title="Mark as paid" disabled={act.isPending} onPress={() => act.mutate({ kind: "order", id: order.id, action: "paid" })} /> : null}
                                                {order.status === "paid" ? <SmallButton title="Sent / done" disabled={act.isPending} onPress={() => act.mutate({ kind: "order", id: order.id, action: "done" })} /> : null}
                                                <SmallButton title="Cancel" disabled={act.isPending} onPress={() => act.mutate({ kind: "order", id: order.id, action: "cancelled" })} />
                                                {order.conversation_id ? <ChatButton id={order.conversation_id} /> : null}
                                            </View>
                                        ) : null}
                                    </>
                                ));
                            })}
                        </View>
                    </>
                )
            ) : bookings.length === 0 ? (
                <EmptyCard icon="calendar" title="No bookings yet" description="When your employee books a table or an appointment, it shows up here. Set up your schedule so it can book appointments itself." />
            ) : (
                <View style={{ marginHorizontal: -16, marginTop: 12 }}>
                    {bookings.map((booking) => {
                        const status = bookingStatus(booking);
                        const when = bookingWhen(booking.start);
                        return item(booking.id, (
                            <>
                                <T weight="600">{booking.title}</T>
                                {when ? <T size={13} color={alpha(colors.foreground, 0.8)} style={{ marginTop: 2 }}>{when}</T> : null}
                                {booking.detail ? <T size={13} leading={20} muted lines={2} style={{ marginTop: 2 }}>{booking.detail}</T> : null}
                                <View style={{ marginTop: 6, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                                    <Tag round tone={status.tone} label={status.label} />
                                    {booking.deposit ? <Tag round tone="good" label={`Deposit paid · ${formatMoney(booking.deposit.amount, booking.deposit.currency)}`} /> : null}
                                </View>
                                {booking.status === "confirmed" ? (
                                    <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                        <SmallButton title="They came" disabled={act.isPending} onPress={() => act.mutate({ kind: "booking", id: booking.id, action: "done" })} />
                                        <SmallButton title="Cancelled" disabled={act.isPending} onPress={() => act.mutate({ kind: "booking", id: booking.id, action: "cancelled" })} />
                                        {booking.conversation_id ? <ChatButton id={booking.conversation_id} /> : null}
                                    </View>
                                ) : null}
                            </>
                        ));
                    })}
                </View>
            )}
        </Page>
    );
}
