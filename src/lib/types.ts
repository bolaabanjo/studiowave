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
    status: "held" | "confirmed" | "done" | "cancelled" | "no_show";
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

export interface BankAccount {
    bank: string;
    account_number: string;
    account_name: string;
    /** Its bank's logo, when Money sends it. */
    logo?: string | null;
    /** Set on saved accounts. */
    id?: string;
}

/** Money as the web reads it: the summary, plus how customers pay. */
export type MoneyWithPayments = Money & {
    payments: { provider: string; mode: string } | null;
    bank_account: BankAccount | null;
    bank_accounts?: BankAccount[];
};

export interface StudioAssistantRow {
    id: string;
    name: string;
    published: boolean;
    active: boolean;
    whatsapp: { number: string | null } | null;
    link: boolean;
    website: boolean;
    chats_this_week: number;
}

export interface StudioEventTier { id: string; name: string; price: number; capacity: number | null; sold: number }

export interface StudioEventSummary {
    event: { id: string; slug: string; name: string; description: string; venue: string; starts_at: string; ends_at: string | null; currency: string; status: "live" | "closed" | "cancelled"; banner_url: string | null; tiers: Array<{ id: string; name: string; price: number; capacity: number | null }> };
    sold: number;
    capacity: number | null;
    earned: number;
    checked_in: number;
    by_tier: StudioEventTier[];
}

export interface StudioGuest { id: string; tier_id: string; code: string; buyer_name: string; buyer_phone: string | null; price: number; paid_at: string | null; checked_in_at: string | null }

/** The appointment book (cencori lib/studio/schedule-slots.ts). */
export interface ScheduleService { id: string; name: string; minutes: number; price: number | null; deposit?: number | null }
export type ScheduleDayHours = { open: string; close: string } | null;
export type ScheduleDeposit = { kind: "none" } | { kind: "fixed"; amount: number } | { kind: "percent"; percent: number };
export interface ScheduleSettings {
    services: ScheduleService[];
    /** Sunday first. */
    hours: ScheduleDayHours[];
    chairs: number;
    deposit: ScheduleDeposit;
    hold_minutes: number;
    buffer_minutes: number;
    lead_minutes: number;
    days_ahead: number;
    reminders: boolean;
}

export interface Appointment {
    id: string;
    title: string;
    service: string | null;
    service_id: string | null;
    starts_at: string | null;
    ends_at: string | null;
    status: "held" | "confirmed" | "done" | "cancelled" | "no_show";
    customer_name: string | null;
    customer_phone: string | null;
    price: number | null;
    currency: string;
    deposit: { amount: number; currency: string; method: "link" | "transfer"; paid: boolean; claimed: boolean } | null;
    held_until: string | null;
    note: string | null;
    conversation_id: string | null;
    reminders: { day_before?: string; two_hours?: string; skipped?: string };
    customer_confirmed: boolean;
    source: "calendar" | "schedule" | "owner";
    created_at: string;
}

export interface ScheduleView {
    set_up: boolean;
    settings: ScheduleSettings;
    time_zone: string;
    currency: string;
    takes_deposits: boolean;
    reminder_template: "approved" | "pending" | "rejected" | "error" | "none";
    from: string;
    days: number;
    appointments: Appointment[];
}

export interface ClientNote { id: string; text: string; at: string; by: "owner" | "employee" }

export interface ClientCard {
    phone: string;
    name: string | null;
    visits: number;
    no_shows: number;
    cancelled: number;
    upcoming: Array<{ id: string; service: string | null; starts_at: string; status: string; deposit_paid: boolean; customer_confirmed: boolean }>;
    recent: Array<{ service: string | null; starts_at: string | null; status: string }>;
    orders: Array<{ id: string; summary: string; total: number; currency: string; status: string; created_at: string }>;
    spent: { amount: number; currency: string };
    notes: ClientNote[];
    first_seen: string | null;
    chats: string[];
}
