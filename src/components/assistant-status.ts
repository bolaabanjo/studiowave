import { palette, alpha, type Colors } from "@/ui/theme";

/** Live, Paused or Not live yet, with its tag colour and dot. */
export function assistantStatus(assistant: { published: boolean; active: boolean }, colors: Colors): { label: string; tone: "wait" | "off" | "good"; dot: string } {
    if (!assistant.published) return { label: "Not live yet", tone: "wait", dot: palette.amber500 };
    if (!assistant.active) return { label: "Paused", tone: "off", dot: alpha(colors.mutedForeground, 0.6) };
    return { label: "Live", tone: "good", dot: palette.emerald500 };
}
