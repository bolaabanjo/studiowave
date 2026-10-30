import { useRef, useState } from "react";
import { Share, View, type HostInstance } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { Icon } from "@/ui/icons";
import { Button, SHEET_TOP, SheetHeader, T } from "@/ui/kit";
import { useColors } from "@/ui/theme";

/**
 * The customer link as a QR code, for a table card, a shop window or a flyer
 * (cencori components/studio/StudioLinkQr.tsx): shown big enough to scan off
 * the phone, shared as a link, or saved as a ready-to-print card.
 */
export default function LinkQr() {
    const { url, name } = useLocalSearchParams<{ url: string; name: string }>();
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const card = useRef<HostInstance>(null);
    const [saving, setSaving] = useState(false);

    // The printable card: the business name, the code, and what to do with it, drawn off-screen and shared as a PNG.
    const saveCard = async () => {
        setSaving(true);
        try {
            const file = await captureRef(card, { format: "png", width: 1080, height: 1350 });
            await Sharing.shareAsync(file, { mimeType: "image/png", dialogTitle: `${name} QR code` });
        } catch {
            // Dismissed the share sheet.
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background, paddingHorizontal: 20, paddingTop: SHEET_TOP, paddingBottom: insets.bottom + 20 }}>
            <SheetHeader title="Your QR code" onClose={() => router.back()} description="Customers scan it to chat with your assistant. Put it on tables, your counter, flyers or packaging." />
            <View style={{ marginTop: 20, alignSelf: "center", width: "100%", maxWidth: 280, aspectRatio: 1, borderRadius: 24, backgroundColor: "#ffffff", padding: 16 }}>
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <QRCode value={url} size={248} color="#111111" backgroundColor="#ffffff" ecl="M" quietZone={4} />
                </View>
            </View>
            <T size={13} muted center lines={1} style={{ marginTop: 12 }}>{url.replace(/^https?:\/\//, "")}</T>
            <View style={{ marginTop: 20, flexDirection: "row", gap: 8 }}>
                <Button kind="outline" grow title="Share link" icon={<Icon name="share-2:lucide" size={16} color={colors.foreground} />} onPress={() => void Share.share({ title: name, message: url, url }).catch(() => undefined)} />
                <Button grow title="Save card" disabled={saving} icon={<Icon name="download:lucide" size={16} color={colors.background} />} onPress={() => void saveCard()} />
            </View>

            {/* The card to print, laid out at 1080×1350 (scaled down) where it can't be seen. */}
            <View style={{ position: "absolute", left: -10_000, top: 0 }} pointerEvents="none">
                <View ref={card} collapsable={false} style={{ width: 360, height: 450, backgroundColor: "#ffffff", alignItems: "center" }}>
                    <T size={21} weight="600" lines={1} color="#111111" style={{ marginTop: 36, maxWidth: 306 }}>{name}</T>
                    <View style={{ marginTop: 22 }}><QRCode value={url} size={253} color="#111111" backgroundColor="#ffffff" ecl="M" quietZone={4} /></View>
                    <T size={17} weight="600" color="#111111" style={{ marginTop: 22 }}>Scan to chat with us</T>
                    <T size={12} color="#6b6b6b" style={{ marginTop: 6 }}>Ask, order or book, any time</T>
                </View>
            </View>
        </View>
    );
}
