import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, TextInput, View, type TextInputInstance } from "react-native";
import * as Haptics from "expo-haptics";
import { T } from "@/ui/kit";
import { alpha, fonts, useColors } from "@/ui/theme";

const LENGTH = 6;

/**
 * A 6-digit code, one box per digit. One hidden field takes the typing (so the
 * phone can still offer the code from a text or email, and pasting works),
 * the boxes show it, and the box being typed into is outlined. The sixth digit
 * calls onComplete.
 *
 * `wrong` counts the wrong tries: each new one turns the boxes red, shakes
 * them, buzzes, and clears them for another go. Typing again takes the red off.
 */
export function CodeInput({ value, onChange, onComplete, wrong = 0, autoFocus = true, disabled }: {
    value: string;
    onChange: (value: string) => void;
    onComplete?: (code: string) => void;
    wrong?: number;
    autoFocus?: boolean;
    disabled?: boolean;
}) {
    const colors = useColors();
    const input = useRef<TextInputInstance>(null);
    const [shake] = useState(() => new Animated.Value(0));
    const [focused, setFocused] = useState(autoFocus);
    const [red, setRed] = useState(false);
    const seen = useRef(wrong);

    useEffect(() => {
        if (wrong === seen.current) return;
        seen.current = wrong;
        setRed(true);
        onChange("");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
        // A quick side-to-side shake, settling back in the middle.
        Animated.sequence([10, -10, 8, -8, 4, -4, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 45, useNativeDriver: true }))).start();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a new wrong try comes in
    }, [wrong]);

    const type = (text: string) => {
        const digits = text.replace(/\D/g, "").slice(0, LENGTH);
        if (red) setRed(false);
        onChange(digits);
        if (digits.length === LENGTH) onComplete?.(digits);
    };
    const active = Math.min(value.length, LENGTH - 1);

    return (
        <Pressable onPress={() => input.current?.focus()} accessibilityLabel="Enter the 6-digit code" disabled={disabled}>
            <Animated.View style={{ flexDirection: "row", gap: 8, transform: [{ translateX: shake }] }}>
                {Array.from({ length: LENGTH }, (_, index) => {
                    const digit = value[index] ?? "";
                    const current = focused && index === active && !red;
                    return (
                        <View key={index} style={{
                            flex: 1, aspectRatio: 0.82, maxHeight: 64, borderRadius: 16, alignItems: "center", justifyContent: "center",
                            backgroundColor: red ? alpha(colors.destructive, 0.08) : colors.muted,
                            borderWidth: 1.5, borderColor: red ? colors.destructive : current ? colors.foreground : "transparent",
                        }}>
                            <T size={24} weight="600" color={red ? colors.destructive : colors.foreground}>{digit}</T>
                        </View>
                    );
                })}
            </Animated.View>
            <TextInput
                ref={input}
                value={value}
                onChangeText={type}
                autoFocus={autoFocus}
                editable={!disabled}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={LENGTH}
                caretHidden
                // Invisible but focusable: the boxes are what's seen.
                style={{ position: "absolute", width: 1, height: 1, opacity: 0, fontFamily: fonts["500"] }}
            />
        </Pressable>
    );
}
