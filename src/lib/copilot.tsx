import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import * as Crypto from "expo-crypto";
import { fetch } from "expo/fetch";
import { useQueryClient } from "@tanstack/react-query";
import { API_URL } from "@/lib/config";
import { useSession } from "@/lib/session";
import { taskForCopilotPage } from "@/lib/tasks";
import type { StudioWorkspace } from "@/lib/types";

/**
 * Copilot in Studio (cencori components/studio/StudioCopilot.tsx): how an
 * owner changes anything by asking. The same assistant as the console's
 * (/api/agent), with the same confirm-before-change actions. The chat lasts
 * while the app is open; the sheet (src/app/(app)/copilot.tsx) shows it.
 */

export type CopilotActionState = "pending" | "running" | "done" | "failed" | "cancelled" | "expired";
export type CopilotActionRequest = { method: "POST" | "PATCH" | "PUT" | "DELETE"; path: string; body?: Record<string, unknown> };
export type CopilotAction = {
    id: string;
    kind: string;
    title: string;
    tier: string;
    details: Array<{ label: string; value: string }>;
    confirmPhrase?: string;
    request: CopilotActionRequest;
    steps?: CopilotActionRequest[];
    link?: { href: string; label: string; sameTab?: boolean };
    doneMessage: string;
    state: CopilotActionState;
    result?: string;
};

/** Something the owner told their employee, saved straight away (cencori lib/copilot/remember.ts); Undo deletes it. */
export type CopilotNote = { id: string; fact: string; agent_id: string; agent_name: string; state: "saved" | "undoing" | "undone" | "failed" };

export type CopilotMessage = { id: string; role: "user" | "assistant"; content: string; actions?: CopilotAction[]; notes?: CopilotNote[]; hidden?: boolean };

export const isOpenAction = (action: CopilotAction) => action.state === "pending" || action.state === "running";

/** What Copilot is told after an action settles, so it reports back and carries on. */
export function actionOutcomeNote(action: CopilotAction): string {
    if (action.state === "done") return `[The user confirmed "${action.title}" and it succeeded: ${action.result ?? action.doneMessage}] Tell the user in one or two plain sentences what changed and what it means for them, then offer the next step if there is a natural one. Don't propose the same change again.`;
    if (action.state === "failed") return `[The user confirmed "${action.title}" but it failed: ${action.result ?? "unknown error"}] Explain briefly what went wrong and what they can do about it.`;
    return `[The user cancelled "${action.title}". Nothing was changed.] Acknowledge it in one short sentence and ask if they want something different.`;
}

/** Fill "{{key}}" placeholders from what earlier steps returned. */
function fillPlaceholders<T>(value: T, vars: Record<string, string>): T {
    return JSON.parse(JSON.stringify(value).replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match)) as T;
}

/**
 * Run a confirmed action: its request, or its steps in order, as the
 * signed-in owner. Ids a step returns fill the next steps' placeholders.
 */
export async function runAction(action: CopilotAction, token: string | null): Promise<{ state: "done" | "failed"; result: string; secret?: string }> {
    const steps = action.steps?.length ? action.steps : [action.request];
    const vars: Record<string, string> = {};
    let secret: string | undefined;
    for (const [index, raw] of steps.entries()) {
        const step = fillPlaceholders(raw, vars);
        try {
            const response = await fetch(`${API_URL}${step.path}`, {
                method: step.method,
                credentials: "omit",
                headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(step.body ? { "Content-Type": "application/json" } : {}) },
                body: step.body ? JSON.stringify(step.body) : undefined,
            });
            const payload = await response.json().catch(() => null) as ({ error?: string; apiKey?: { full_key?: string } } & Record<string, unknown>) | null;
            if (!response.ok) {
                const reason = payload?.error || `Request failed (${response.status}).`;
                return { state: "failed", result: index === 0 ? reason : `${reason} (step ${index + 1} of ${steps.length}; the earlier steps went through)` };
            }
            if (payload?.apiKey?.full_key) secret = payload.apiKey.full_key;
            for (const [key, value] of Object.entries(payload ?? {})) if (typeof value === "string" && /_id$/.test(key)) vars[key] = value;
        } catch {
            return { state: "failed", result: index === 0 ? "Couldn't reach the server. Nothing was changed." : `Couldn't reach the server at step ${index + 1} of ${steps.length}; the earlier steps went through.` };
        }
    }
    const ids = Object.entries(vars).map(([key, value]) => `${key}=${value}`).join(", ");
    return { state: "done", result: ids ? `${action.doneMessage} (${ids})` : action.doneMessage, ...(secret ? { secret } : {}) };
}

interface CopilotValue {
    messages: CopilotMessage[];
    streaming: string;
    status: string;
    busy: boolean;
    secret: { title: string; secret: string } | null;
    setSecret: (secret: { title: string; secret: string } | null) => void;
    send: (text: string) => void;
    stop: () => void;
    updateAction: (messageId: string, actionId: string, patch: Partial<CopilotAction>) => void;
    updateNote: (messageId: string, noteId: string, patch: Partial<CopilotNote>) => void;
}

const CopilotContext = createContext<CopilotValue | null>(null);

export function useCopilot(): CopilotValue {
    const value = useContext(CopilotContext);
    if (!value) throw new Error("useCopilot outside CopilotProvider");
    return value;
}

export function CopilotProvider({ workspace, children }: { workspace: StudioWorkspace; children: ReactNode }) {
    const queryClient = useQueryClient();
    const { token } = useSession();
    const [messages, setMessages] = useState<CopilotMessage[]>([]);
    const [streaming, setStreaming] = useState("");
    const [status, setStatus] = useState("Thinking");
    const [busy, setBusy] = useState(false);
    const [secret, setSecret] = useState<{ title: string; secret: string } | null>(null);
    const conversationId = useRef(Crypto.randomUUID());
    const abort = useRef<AbortController | null>(null);
    const messagesRef = useRef(messages);
    messagesRef.current = messages;

    const run = useCallback(async (next: CopilotMessage[]) => {
        setMessages(next);
        setBusy(true);
        setStreaming("");
        setStatus("Thinking");
        const controller = new AbortController();
        abort.current = controller;
        let content = "";
        const proposed: CopilotAction[] = [];
        const notes: CopilotNote[] = [];
        try {
            const response = await fetch(`${API_URL}/api/agent`, {
                method: "POST",
                credentials: "omit",
                headers: { "Content-Type": "application/json", Accept: "text/event-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({
                    messages: next.map((message) => ({
                        role: message.role,
                        content: [
                            message.content,
                            ...(message.actions ?? []).map((action) => `[${action.title}: ${action.state}${action.result ? ` — ${action.result}` : ""}]`),
                            // What it saved for customers, and whether the owner undid it since.
                            ...(message.notes ?? []).map((note) => `[Saved for customers (${note.agent_name}): "${note.fact}"${note.state === "undone" ? " — the owner undid this, so it's no longer told to customers" : ""}]`),
                        ].filter(Boolean).join("\n"),
                    })),
                    projectId: workspace.project.id,
                    organizationId: workspace.organization.id,
                    conversationId: conversationId.current,
                    environment: "production",
                    currentPath: "studio",
                    currentSurface: "Studio (the business owner's phone app)",
                    userName: workspace.user.firstName,
                }),
                signal: controller.signal,
            });
            if (!response.ok || !response.body) {
                const payload = await response.json().catch(() => null) as { error?: string } | null;
                throw new Error(payload?.error ?? "Your employee couldn't answer right now.");
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const chunks = buffer.split("\n\n");
                buffer = chunks.pop() ?? "";
                for (const chunk of chunks) {
                    const line = chunk.split("\n").find((item) => item.startsWith("data: "));
                    if (!line || line === "data: [DONE]") continue;
                    const payload = JSON.parse(line.slice(6)) as { content?: string; status?: string; discard?: boolean; error?: string; action?: CopilotAction; remembered?: Omit<CopilotNote, "state"> };
                    if (payload.error) throw new Error(payload.error);
                    if (payload.status) setStatus(payload.status);
                    if (payload.discard) {
                        content = "";
                        setStreaming("");
                    }
                    if (payload.content) {
                        content += payload.content;
                        setStreaming(content);
                    }
                    if (payload.remembered) notes.push({ ...payload.remembered, state: "saved" });
                    if (payload.action) {
                        // A page to set something up (WhatsApp, payments…) opens as a Studio sheet; other console links open in the browser.
                        const link = payload.action.kind === "open_agent_page"
                            ? { href: `studio-task:${taskForCopilotPage(payload.action.title)}`, label: payload.action.title, sameTab: true }
                            : payload.action.link && payload.action.link.href.startsWith("/")
                                ? { ...payload.action.link, href: `https://console.cencori.com${payload.action.link.href}` }
                                : payload.action.link;
                        proposed.push({ ...payload.action, ...(link ? { link } : {}), state: "pending" });
                    }
                }
            }
            setMessages([...next, { id: Crypto.randomUUID(), role: "assistant", content, ...(proposed.length ? { actions: proposed } : {}), ...(notes.length ? { notes } : {}) }]);
        } catch (error) {
            if ((error as Error).name !== "AbortError") setMessages([...next, { id: Crypto.randomUUID(), role: "assistant", content: (error as Error).message }]);
        } finally {
            setStreaming("");
            setBusy(false);
            abort.current = null;
        }
    }, [workspace, token]);

    const send = useCallback((text: string) => {
        const content = text.trim();
        if (!content || busy) return;
        // Moving on without answering a confirmation leaves it unconfirmed.
        const settled = messagesRef.current.map((message) => (message.actions?.some(isOpenAction) ? { ...message, actions: message.actions.map((action) => (isOpenAction(action) ? { ...action, state: "expired" as const } : action)) } : message));
        void run([...settled, { id: Crypto.randomUUID(), role: "user", content }]);
    }, [busy, run]);

    const updateAction = useCallback((messageId: string, actionId: string, patch: Partial<CopilotAction>) => {
        const next = messagesRef.current.map((message) => (message.id !== messageId || !message.actions ? message : { ...message, actions: message.actions.map((action) => (action.id === actionId ? { ...action, ...patch } : action)) }));
        messagesRef.current = next;
        setMessages(next);
        if (patch.state === "done") void queryClient.invalidateQueries();
        if (patch.state === "done" || patch.state === "failed" || patch.state === "cancelled") {
            const action = next.find((message) => message.id === messageId)?.actions?.find((item) => item.id === actionId);
            if (action) void run([...next, { id: Crypto.randomUUID(), role: "user", content: actionOutcomeNote(action), hidden: true }]);
        }
    }, [queryClient, run]);

    // An Undo on something saved: no new turn, the next message carries it (see the request body).
    const updateNote = useCallback((messageId: string, noteId: string, patch: Partial<CopilotNote>) => {
        const next = messagesRef.current.map((message) => (message.id !== messageId || !message.notes ? message : { ...message, notes: message.notes.map((note) => (note.id === noteId ? { ...note, ...patch } : note)) }));
        messagesRef.current = next;
        setMessages(next);
        if (patch.state === "undone") void queryClient.invalidateQueries({ queryKey: ["overview"] });
    }, [queryClient]);

    return (
        <CopilotContext.Provider value={{ messages, streaming, status, busy, secret, setSecret, send, stop: () => abort.current?.abort(), updateAction, updateNote }}>
            {children}
        </CopilotContext.Provider>
    );
}
