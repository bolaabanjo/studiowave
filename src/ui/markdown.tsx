import type { ReactNode } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { WhatsAppMark } from "@/ui/icons";
import { T } from "@/ui/kit";
import { fonts, palette, useColors } from "@/ui/theme";

/** A bare web address in text (trailing punctuation isn't part of it). */
const URL = /https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/g;
/** WhatsApp chat links: shown as a button, not as a long address. */
const WHATSAPP = /^https?:\/\/(wa\.me|api\.whatsapp\.com)\//i;

/**
 * The assistant's and Copilot's replies: the Markdown they write (paragraphs,
 * lists, headings, **bold**, *italic*, `code`, links), in Studio's type.
 * Links are tappable, written ones and bare addresses alike (long ones
 * shortened); a WhatsApp chat link also gets an Open WhatsApp button.
 */
export function Markdown({ content, size = 15, leading = 24, color }: { content: string; size?: number; leading?: number; color?: string }) {
    const blocks = content.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
    const whatsapp = [...new Set([...(content.match(URL) ?? []), ...[...content.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1])].filter((url) => WHATSAPP.test(url)))];
    return (
        <View style={{ gap: 8 }}>
            {blocks.map((block, index) => {
                const lines = block.split("\n");
                if (lines.every((line) => /^\s*([-*•]|\d+[.)])\s+/.test(line))) {
                    return (
                        <View key={index} style={{ gap: 4 }}>
                            {lines.map((line, row) => {
                                const numbered = /^\s*(\d+)[.)]\s+/.exec(line);
                                return (
                                    <View key={row} style={{ flexDirection: "row", gap: 8, paddingLeft: /^\s{2,}/.test(line) ? 16 : 0 }}>
                                        <T size={size} leading={leading} color={color}>{numbered ? `${numbered[1]}.` : "•"}</T>
                                        <T size={size} leading={leading} color={color} style={{ flex: 1 }}>{inline(line.replace(/^\s*([-*•]|\d+[.)])\s+/, ""))}</T>
                                    </View>
                                );
                            })}
                        </View>
                    );
                }
                const heading = /^(#{1,4})\s+(.*)$/.exec(lines[0]);
                if (heading && lines.length === 1) return <T key={index} size={size + (heading[1].length <= 2 ? 2 : 0)} weight="600" leading={leading} color={color}>{inline(heading[2])}</T>;
                return <T key={index} size={size} leading={leading} color={color}>{inline(lines.join("\n"))}</T>;
            })}
            {whatsapp.map((url) => <WhatsAppButton key={url} url={url} />)}
        </View>
    );
}

function WhatsAppButton({ url }: { url: string }) {
    return (
        <Pressable onPress={() => void Linking.openURL(url)} accessibilityRole="link" style={({ pressed }) => ({ marginTop: 4, alignSelf: "flex-start", height: 44, paddingHorizontal: 18, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: palette.whatsapp, opacity: pressed ? 0.85 : 1 })}>
            <WhatsAppMark size={18} color="#ffffff" />
            <T weight="600" color="#ffffff">Open WhatsApp</T>
        </Pressable>
    );
}

/** "wa.me/2348031419230", "paystack.com/pay/…": short enough to read in a line. */
function shortUrl(url: string): string {
    const bare = url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\?.*$/, "");
    return bare.length > 36 ? `${bare.slice(0, 34)}…` : bare;
}

function LinkText({ url, label }: { url: string; label: string }) {
    return <Text style={{ textDecorationLine: "underline" }} onPress={() => void Linking.openURL(url)} suppressHighlighting={false}>{label}</Text>;
}

/** Bold, italic, code and links inside a line; bare addresses first, so their _ and * aren't read as styling. */
function inline(text: string): ReactNode[] {
    const out: ReactNode[] = [];
    let last = 0;
    for (const match of text.matchAll(/\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/g)) {
        const at = match.index ?? 0;
        if (at > last) out.push(...styled(text.slice(last, at), out.length));
        const written = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(match[0]);
        const url = written ? written[2] : match[0];
        // A WhatsApp link has its own button below; in the text it's just named.
        const label = written ? written[1] : WHATSAPP.test(url) ? "the WhatsApp link" : shortUrl(url);
        out.push(<LinkText key={`link-${out.length}`} url={url} label={label} />);
        last = at + match[0].length;
    }
    if (last < text.length) out.push(...styled(text.slice(last), out.length));
    return out;
}

function styled(text: string, offset: number): ReactNode[] {
    return text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g).filter(Boolean).map((part, position) => {
        const index = offset + position;
        if (/^(\*\*|__)/.test(part)) return <Text key={index} style={{ fontFamily: fonts["700"] }}>{part.slice(2, -2)}</Text>;
        if (part.startsWith("`")) return <Code key={index}>{part.slice(1, -1)}</Code>;
        if (/^[*_].+[*_]$/.test(part)) return <Text key={index} style={{ fontStyle: "italic" }}>{part.slice(1, -1)}</Text>;
        return part;
    });
}

function Code({ children }: { children: string }) {
    const colors = useColors();
    return <Text style={{ fontFamily: "Menlo", fontSize: 13, backgroundColor: colors.muted }}>{children}</Text>;
}
