import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import type { ConversationPayload, InboxConversation, MoneyPeriod, MoneyWithPayments, Sales, StudioAssistantRow, StudioEventSummary, StudioGuest, StudioOverview } from "@/lib/types";

// Studio's data, through the same routes and refresh rhythm as the web app.

function useProjectId(): string {
    return useWorkspace().workspace.project.id;
}

/** The business at a glance; with an assistant's id, that assistant's (the AI tab's detail page). */
export function useOverview(agentId?: string) {
    const api = useApi();
    const projectId = useProjectId();
    return useQuery({
        queryKey: ["overview", projectId, agentId ?? null],
        queryFn: () => api<StudioOverview>(`/api/studio/overview?project_id=${projectId}${agentId ? `&agent_id=${agentId}` : ""}`, { fallback: "Couldn't load your business." }),
        staleTime: 30_000,
    });
}

/** The conversation list, refreshed every 15 seconds while the app is open. */
export function useInbox() {
    const api = useApi();
    const projectId = useProjectId();
    return useQuery({
        queryKey: ["inbox", projectId],
        queryFn: () => api<{ conversations: InboxConversation[] }>(`/api/studio/inbox?project_id=${projectId}`, { fallback: "Couldn't load your chats." }),
        refetchInterval: 15_000,
    });
}

export function useConversation(id: string) {
    const api = useApi();
    const projectId = useProjectId();
    return useQuery({
        queryKey: ["conversation", projectId, id],
        queryFn: () => api<ConversationPayload>(`/api/studio/inbox/${id}?project_id=${projectId}`, { fallback: "Couldn't load this chat." }),
        refetchInterval: 10_000,
    });
}

/** Step in, hand back, reply, or mark read; the chat and the list refresh after. */
export function useConversationAction(id: string) {
    const api = useApi();
    const projectId = useProjectId();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { action: "step_in" | "hand_back" | "reply" | "mark_read" | "mark_unread"; text?: string }) =>
            api<ConversationPayload>(`/api/studio/inbox/${id}`, { method: "POST", body: { project_id: projectId, ...input } }),
        onSuccess: (data) => {
            queryClient.setQueryData(["conversation", projectId, id], data);
            void queryClient.invalidateQueries({ queryKey: ["inbox", projectId] });
        },
    });
}

export function useSales() {
    const api = useApi();
    const projectId = useProjectId();
    return useQuery({
        queryKey: ["sales", projectId],
        queryFn: () => api<Sales>(`/api/studio/sales?project_id=${projectId}`, { fallback: "Couldn't load your sales." }),
        refetchInterval: 30_000,
    });
}

/** Mark an order paid, or an order or booking done or cancelled. */
export function useSalesAction() {
    const api = useApi();
    const projectId = useProjectId();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { kind: "order" | "booking"; id: string; action: "paid" | "done" | "cancelled" }) =>
            api<Sales>("/api/studio/sales", { method: "POST", body: { project_id: projectId, ...input } }),
        onSuccess: (data) => {
            queryClient.setQueryData(["sales", projectId], data);
            void queryClient.invalidateQueries({ queryKey: ["overview", projectId] });
            void queryClient.invalidateQueries({ queryKey: ["money", projectId] });
        },
    });
}

export function useMoney(period: MoneyPeriod) {
    const api = useApi();
    const projectId = useProjectId();
    return useQuery({
        queryKey: ["money", projectId, period],
        queryFn: () => api<MoneyWithPayments>(`/api/studio/money?project_id=${projectId}&period=${period}`, { fallback: "Couldn't load your money." }),
    });
}

/** The owner checked their account: a customer's transfer arrived, or it hasn't yet. */
export function useTransferAction() {
    const api = useApi();
    const projectId = useProjectId();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { reference: string; action: "confirm" | "not_received" }) =>
            api("/api/studio/transfers", { method: "POST", body: { project_id: projectId, ...input } }),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["money", projectId] });
            void queryClient.invalidateQueries({ queryKey: ["overview", projectId] });
            void queryClient.invalidateQueries({ queryKey: ["sales", projectId] });
        },
    });
}

/** Mark a chat read or unread; shown straight away, confirmed by the next refresh. */
export function useMarkRead() {
    const api = useApi();
    const projectId = useProjectId();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, read }: { id: string; read: boolean }) =>
            api(`/api/studio/inbox/${id}`, { method: "POST", body: { project_id: projectId, action: read ? "mark_read" : "mark_unread" } }),
        onMutate: ({ id, read }) => {
            queryClient.setQueriesData<{ conversations: InboxConversation[] }>({ queryKey: ["inbox", projectId] }, (data) =>
                data && { conversations: data.conversations.map((conversation) => (conversation.id === id ? { ...conversation, unread: !read } : conversation)) });
        },
        onSettled: () => void queryClient.invalidateQueries({ queryKey: ["inbox", projectId] }),
    });
}

/** Every assistant in the business, for the AI tab's list. */
export function useAssistants() {
    const api = useApi();
    const projectId = useProjectId();
    return useQuery({
        queryKey: ["assistants", projectId],
        queryFn: () => api<{ assistants: StudioAssistantRow[] }>(`/api/studio/assistants?project_id=${projectId}`, { fallback: "Couldn't load your assistants." }),
    });
}

/** Pause an assistant, or switch it back on. */
export function useSetAssistantActive() {
    const api = useApi();
    const projectId = useProjectId();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ agentId, active }: { agentId: string; active: boolean }) =>
            api("/api/studio/assistants", { method: "PATCH", body: { project_id: projectId, agent_id: agentId, active } }),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["assistants", projectId] });
            void queryClient.invalidateQueries({ queryKey: ["overview", projectId] });
        },
    });
}

export function useEvents() {
    const api = useApi();
    const projectId = useProjectId();
    return useQuery({
        queryKey: ["events", projectId],
        queryFn: () => api<{ events: StudioEventSummary[] }>(`/api/studio/events?project_id=${projectId}`, { fallback: "Couldn't load your events." }),
        refetchInterval: 30_000,
    });
}

export function useEvent(eventId: string) {
    const api = useApi();
    const projectId = useProjectId();
    return useQuery({
        queryKey: ["event", projectId, eventId],
        queryFn: () => api<{ event: StudioEventSummary; guests: StudioGuest[] }>(`/api/studio/events?project_id=${projectId}&event_id=${eventId}`, { fallback: "Couldn't load your events." }),
        refetchInterval: 15_000,
    });
}

/** Refresh everything a change to money touches: Money, Sales, Home, the inbox. */
export function useRefreshMoney() {
    const projectId = useProjectId();
    const queryClient = useQueryClient();
    return () => {
        for (const key of ["money", "sales", "overview", "inbox"]) void queryClient.invalidateQueries({ queryKey: [key, projectId] });
    };
}

export type EmployeeTone = "warm" | "professional" | "playful" | "direct";
export type EmployeeLanguage = "customer" | "english" | "pidgin" | "yoruba" | "igbo" | "hausa" | "french";
export type EmployeeProfile = {
    name: string;
    tone: EmployeeTone;
    style: string;
    language: EmployeeLanguage;
    emoji: boolean;
    choices: { tones: { id: EmployeeTone; label: string; description: string }[]; languages: { id: EmployeeLanguage; label: string }[] };
};

/** An employee's name and personality (cencori app/api/studio/employee). */
export function useEmployee(agentId: string) {
    const api = useApi();
    const projectId = useProjectId();
    return useQuery({
        queryKey: ["employee", projectId, agentId],
        queryFn: () => api<EmployeeProfile>(`/api/studio/employee?project_id=${projectId}&agent_id=${agentId}`, { fallback: "Couldn't load this employee." }),
    });
}

/** Rename an employee or change its personality: live on the next customer message. The new name shows everywhere at once. */
export function useSaveEmployee(agentId: string) {
    const api = useApi();
    const projectId = useProjectId();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (change: Partial<Pick<EmployeeProfile, "name" | "tone" | "style" | "language" | "emoji">>) =>
            api<EmployeeProfile>("/api/studio/employee", { method: "POST", body: { project_id: projectId, agent_id: agentId, ...change }, fallback: "Couldn't save that." }),
        onSuccess: (profile) => {
            queryClient.setQueryData(["employee", projectId, agentId], profile);
            void queryClient.invalidateQueries({ queryKey: ["assistants", projectId] });
            void queryClient.invalidateQueries({ queryKey: ["overview", projectId] });
        },
    });
}
