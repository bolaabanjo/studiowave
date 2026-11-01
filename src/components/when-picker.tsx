import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Icon } from "@/ui/icons";
import { T } from "@/ui/kit";
import { alpha, useColors } from "@/ui/theme";

/**
 * A day and a time, picked in the business's time zone (the picker shows its
 * clock, not the phone's), as on the event form: two pills that open the
 * phone's own date and time pickers.
 */
export function WhenPicker({ value, onChange, timeZone }: { value: Date; onChange: (value: Date) => void; timeZone: string }) {
    const colors = useColors();
    const [picking, setPicking] = useState<"date" | "time" | null>(null);
    const day = value.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone });
    const time = value.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone });
    const pill = (mode: "date" | "time", label: string, icon: "calendar:linear" | "clock-3:lucide") => (
        <Pressable
            onPress={() => setPicking(picking === mode ? null : mode)}
            style={{ flex: 1, height: 48, borderRadius: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.muted, borderWidth: picking === mode ? 1 : 0, borderColor: alpha(colors.foreground, 0.4) }}
        >
            <Icon name={icon} size={16} color={colors.mutedForeground} />
            <T>{label}</T>
        </Pressable>
    );
    return (
        <View>
            <View style={{ flexDirection: "row", gap: 8 }}>
                {pill("date", day, "calendar:linear")}
                {pill("time", time, "clock-3:lucide")}
            </View>
            {picking ? (
                <DateTimePicker
                    value={value}
                    mode={picking}
                    timeZoneName={timeZone}
                    minuteInterval={picking === "time" ? 15 : undefined}
                    display={Platform.OS === "ios" ? (picking === "date" ? "inline" : "spinner") : "default"}
                    onChange={(event, picked) => {
                        if (Platform.OS !== "ios") setPicking(null);
                        if (event.type === "set" && picked) onChange(picked);
                    }}
                />
            ) : null}
        </View>
    );
}
