import { palette, alpha, type Colors } from "@/ui/theme";

/** Online, Paused or Not online yet, with its tag colour and dot. */
export function assistantStatus(assistant: { published: boolean; active: boolean }, colors: Colors): { label: string; tone: "wait" | "off" | "good"; dot: string } {
    if (!assistant.published) return { label: "Not online yet", tone: "wait", dot: palette.amber500 };
    if (!assistant.active) return { label: "Paused", tone: "off", dot: alpha(colors.mutedForeground, 0.6) };
    return { label: "Online", tone: "good", dot: palette.emerald500 };
}
