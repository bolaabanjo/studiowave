import { useCallback } from "react";
import { router } from "expo-router";

/**
 * Studio's task sheets (cencori components/studio/StudioTasks.tsx): each
 * thing an owner sets up opens in a sheet of its own, here a route
 * (src/app/(app)/task/[task].tsx).
 */
export type StudioTask = "knowledge" | "products" | "event" | "whatsapp" | "website" | "golive" | "alerts" | "payments" | "plans" | "business" | "newbusiness" | "later";

/** agentId: which assistant (else the first). eventId: the event to edit. business: the business the ⋯ menu acts on. */
export type TaskOptions = { agentId?: string; eventId?: string; business?: string };

export function useTasks() {
    const open = useCallback((task: StudioTask, options: TaskOptions = {}) => {
        const params = Object.fromEntries(Object.entries(options).filter(([, value]) => value)) as Record<string, string>;
        router.push({ pathname: "/task/[task]", params: { task, ...params } });
    }, []);
    return { open };
}

/** The sheet for a "Finish setting up" step, or null when Copilot should help instead. */
export function taskForStep(step: string): StudioTask | null {
    const text = step.toLowerCase();
    if (text.startsWith("add knowledge")) return "knowledge";
    if (text.startsWith("add products")) return "products";
    if (text.startsWith("go live")) return "golive";
    if (text.startsWith("connect whatsapp")) return "whatsapp";
    if (text.startsWith("set owner alerts")) return "alerts";
    if (text.startsWith("connect a payment provider") || text.startsWith("connect payments")) return "payments";
    return null;
}

/** The sheet for one of Copilot's "open the page" offers (by its title). */
export function taskForCopilotPage(title: string): StudioTask {
    const text = title.toLowerCase();
    if (text.includes("whatsapp")) return "whatsapp";
    if (text.includes("website")) return "website";
    if (text.includes("product")) return "products";
    if (text.includes("payment")) return "payments";
    return "later";
}
