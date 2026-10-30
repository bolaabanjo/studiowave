import type { InboxChannel, InboxConversation } from "@/lib/types";

// Same words and formats as the web app (cencori: components/studio/useInbox.ts, useStudioOverview.ts).

export const CHANNEL_LABEL: Record<InboxChannel, string> = { whatsapp: "WhatsApp", website: "Website", link: "Link", other: "Chat" };

export function formatMoney(amount: number, currency: string): string {
    try {
        return new Intl.NumberFormat("en-NG", { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
    } catch {
        return `${currency} ${amount.toLocaleString("en-NG")}`;
    }
}

export function greeting(): string {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** "now", "4m", "2h", "Yesterday", "Mon", "12 Oct". */
export function shortTime(iso: string): string {
    const then = new Date(iso);
    const minutes = Math.round((Date.now() - then.getTime()) / 60_000);
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.round(minutes / 60);
    if (hours < 24 && then.getDate() === new Date().getDate()) return `${hours}h`;
    const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86_400_000);
    if (days <= 1) return "Yesterday";
    if (days < 7) return then.toLocaleDateString("en-GB", { weekday: "short" });
    return then.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function initials(name: string): string {
    const words = name.replace(/[^\p{L}\p{N}\s]/gu, "").trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";
    return (words[0][0] + (words[1]?.[0] ?? "")).toUpperCase();
}

export function conversationTitle(conversation: Pick<InboxConversation, "named" | "name" | "topic">): string {
    return conversation.named ? conversation.name : conversation.topic ?? conversation.name;
}

export function needsOwnerLabel(reason: string): string {
    if (/^wants a call ?back/i.test(reason)) return "Wants a callback";
    if (/^says they('|’)ve paid/i.test(reason)) return "Says they've paid";
    return "Asked for you";
}

/** "Fri 30 Oct, 8:00 pm" for a booking's start; the raw text when it isn't a date. */
export function bookingWhen(start: string | null): string | null {
    if (!start) return null;
    const date = new Date(start);
    if (Number.isNaN(date.getTime())) return start;
    if (/^\d{4}-\d{2}-\d{2}$/.test(start)) return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
    return date.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

export function setupSteps(items: string[]): string[] {
    return items
        .map((item) => item.replace(/\s*\([^)]*\)\s*$/, "").replace(/^optional:\s*/i, "").trim())
        .map((item) => (item === "publish" ? "go live" : item))
        .filter(Boolean)
        .map((item) => item.charAt(0).toUpperCase() + item.slice(1));
}

/** Events happen in Lagos: their times are shown in Lagos time, whatever the phone's own zone. */
export const EVENT_TIME_ZONE = "Africa/Lagos";

/** "Sat 20 Dec · 8:00 pm", in Lagos time. */
export function eventWhen(iso: string): string {
    const date = new Date(iso);
    const day = date.toLocaleDateString("en-GB", { timeZone: EVENT_TIME_ZONE, weekday: "short", day: "numeric", month: "short" });
    const time = date.toLocaleTimeString("en-GB", { timeZone: EVENT_TIME_ZONE, hour: "numeric", minute: "2-digit", hour12: true });
    return `${day} · ${time}`;
}

/** "OPay Digital Services Limited (OPay)" → "OPay", "Guaranty Trust Bank" → "GTBank": the names people use. */
const SHORT_BANK: Record<string, string> = { "guaranty trust bank": "GTBank", "united bank for africa": "UBA", "first bank of nigeria": "First Bank", "first city monument bank": "FCMB", "moniepoint mfb": "Moniepoint", "stanbic ibtc bank": "Stanbic IBTC" };
export function shortBankName(name: string): string {
    const bracket = /\(([^)]+)\)\s*$/.exec(name)?.[1];
    if (bracket) return bracket;
    return SHORT_BANK[name.trim().toLowerCase()] ?? name.replace(/\s+(limited|ltd|plc)\.?$/i, "");
}
