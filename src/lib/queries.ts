import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import type { ConversationPayload, InboxConversation, Money, MoneyPeriod, Sales, StudioOverview } from "@/lib/types";

// Studio's data, through the same routes and refresh rhythm as the web app.

function useProjectId(): string {
    return useWorkspace().workspace.project.id;
}

export function useOverview() {
    const api = useApi();
    const projectId = useProjectId();
    return useQuery({
        queryKey: ["overview", projectId],
        queryFn: () => api<StudioOverview>(`/api/studio/overview?project_id=${projectId}`, { fallback: "Couldn't load your business." }),
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
        queryFn: () => api<Money>(`/api/studio/money?project_id=${projectId}&period=${period}`, { fallback: "Couldn't load your money." }),
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
