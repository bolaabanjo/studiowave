// The Studio API's shapes, as the web app reads them (cencori: components/studio/use*.ts, lib/studio/*).

export interface StudioWorkspace {
    user: { id: string; firstName: string | null; fullName: string | null; email: string | null; avatarUrl: string | null };
    organization: { id: string; name: string; slug: string; isBusiness: boolean };
    organizations: Array<{ id: string; name: string; isBusiness: boolean }>;
    project: { id: string; name: string; slug: string };
    agents: Array<{ id: string; name: string; live: boolean; published: boolean }>;
}

export interface Earned {
    amount: number;
    count: number;
}

export interface StudioAssistantSummary {
    id: string;
    name: string;
    published: boolean;
    template: string | null;
    system_tools: string[];
    connected_apps: Array<{ app: string; tools_on: number }>;
    payments: { provider: string | null; mode: string | null; currency: string | null } | null;
    products: { count: number; currency: string; orders_to_fulfil: number } | null;
    knowledge: Array<{ id?: string; name: string; status: string }>;
    website_chat: { on: boolean; sites: string[] } | null;
    whatsapp: { number: string | null; replies_on: boolean } | null;
    owner_alerts: { emails: string[] } | null;
    still_to_do: string[];
}

export interface StudioOverview {
    assistant: StudioAssistantSummary | null;
    share_token: string | null;
    time_zone: string;
    brief: { headline: string; points: string[]; at: string } | null;
    today: { chats: number; earned?: Earned };
    month: { chats: number; earned?: Earned };
    all_time?: { earned: Earned };
    currency: string;
    payments_connected: boolean;
    plan: {
        name: string;
        conversations: number;
        capacity: number;
        agents: number;
        used: number;
        active: boolean;
        in_grace: boolean;
        period_end: string | null;
        grace_end: string | null;
        earned: Earned | null;
    } | null;
}

export type InboxChannel = "whatsapp" | "website" | "link" | "other";

export interface InboxConversation {
    id: string;
    channel: InboxChannel;
    name: string;
    named: boolean;
    topic: string | null;
    number: string | null;
    last_message: string | null;
    last_from: "customer" | "assistant" | "owner" | null;
    updated_at: string;
    open: boolean;
    needs_owner: { reason: string; at: string } | null;
    owner_active: boolean;
    unread: boolean;
}

export interface InboxMessage {
    id: string;
    from: "customer" | "assistant" | "owner";
    text: string;
    at: string;
}

export type ReplyAbility = { possible: true; reason: null } | { possible: false; reason: "website" | "window" };

export interface ConversationPayload {
    conversation: InboxConversation;
    messages: InboxMessage[];
    reply: ReplyAbility;
}

export interface SalesOrder {
    id: string;
    items: Array<{ name: string; option: string | null; quantity: number }>;
    total: number;
    currency: string;
    customer: string | null;
    delivery: string | null;
    note: string | null;
    status: "awaiting_payment" | "paid" | "new" | "done" | "cancelled";
    paid_by: "link" | "transfer" | "owner" | null;
    conversation_id: string | null;
    created_at: string;
    paid_at: string | null;
}

export interface SalesBooking {
    id: string;
    title: string;
    start: string | null;
    detail: string | null;
    status: "confirmed" | "done" | "cancelled";
    conversation_id: string | null;
    created_at: string;
    deposit: { amount: number; currency: string } | null;
}

export interface Sales {
    currency: string;
    has_products: boolean;
    orders: SalesOrder[];
    bookings: SalesBooking[];
}

export type MoneyPeriod = "week" | "month" | "year";

export interface TransferToConfirm {
    reference: string;
    amount: number;
    currency: string;
    description: string;
    customer: string | null;
    status: "claimed" | "awaiting";
    created_at: string;
    claimed_at: string | null;
    conversation_id: string | null;
}

export interface Money {
    period: MoneyPeriod;
    currency: string;
    total: number;
    previous: number;
    by_link: number;
    by_transfer: number;
    marked_paid: number;
    to_collect: number;
    paid_count: number;
    bars: Array<{ label: string; amount: number; current: boolean }>;
    top_items: Array<{ name: string; quantity: number; amount: number }>;
    transfers_to_confirm: TransferToConfirm[];
}
