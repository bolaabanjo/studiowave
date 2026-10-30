import type { ReactNode } from "react";
import { Linking, Text, View } from "react-native";
import { T } from "@/ui/kit";
import { fonts, useColors } from "@/ui/theme";

/**
 * The assistant's and Copilot's replies: the Markdown they write (paragraphs,
 * lists, headings, **bold**, *italic*, `code`, links), in Studio's type.
 */
export function Markdown({ content, size = 15, leading = 24, color }: { content: string; size?: number; leading?: number; color?: string }) {
    const blocks = content.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
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
        </View>
    );
}

/** Bold, italic, code and links inside a line. */
function inline(text: string): ReactNode[] {
    return text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g).filter(Boolean).map((part, index) => {
        if (/^(\*\*|__)/.test(part)) return <Text key={index} style={{ fontFamily: fonts["700"] }}>{part.slice(2, -2)}</Text>;
        if (part.startsWith("`")) return <Code key={index}>{part.slice(1, -1)}</Code>;
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
        if (link) return <Text key={index} style={{ textDecorationLine: "underline" }} onPress={() => void Linking.openURL(link[2])}>{link[1]}</Text>;
        if (/^[*_].+[*_]$/.test(part)) return <Text key={index} style={{ fontStyle: "italic" }}>{part.slice(1, -1)}</Text>;
        return part;
    });
}

function Code({ children }: { children: string }) {
    const colors = useColors();
    return <Text style={{ fontFamily: "Menlo", fontSize: 13, backgroundColor: colors.muted }}>{children}</Text>;
}
