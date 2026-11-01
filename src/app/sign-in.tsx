import { useEffect, useState, type ReactNode } from "react";
import { Animated, Linking, Platform, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { SITE_URL } from "@/lib/config";
import { useSession } from "@/lib/session";
import { Icon } from "@/ui/icons";
import { Button, Spinner, T } from "@/ui/kit";
import { useColors } from "@/ui/theme";

/**
 * Sign in on the purple glow: a phone number first (its own page,
 * app/phone.tsx, where email is the other way in), then Google and Apple
 * (iOS, drawn as ours to match), as pills at the bottom. Same account as
 * studio.cencori.com.
 */
export default function SignIn() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const session = useSession();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [appleAvailable, setAppleAvailable] = useState(false);

    useEffect(() => {
        if (Platform.OS === "ios") void AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => undefined);
    }, []);

    const run = async (action: () => Promise<unknown>) => {
        setError(null);
        setLoading(true);
        try {
            await action();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to sign in.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Glow />
            <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 8 }}>
                <View style={{ flex: 1, justifyContent: "flex-end" }}>
                    <View style={{ width: "100%", maxWidth: 384, alignSelf: "center", gap: 24 }}>
                        {error ? <T size={14} color={colors.destructive} accessibilityRole="alert">{error}</T> : null}
                        {/* The front door is a phone number (email is a link on that page); then Google, and Apple on iOS where the device offers it. */}
                        <SpringIn style={{ gap: 10 }}>
                            <Button title="Continue with phone" disabled={loading} onPress={() => router.push("/phone")} icon={<Icon name="smartphone" size={18} color={colors.background} />} />
                            <Button kind="muted" title="Continue with Google" disabled={loading} onPress={() => void run(() => session.signInWithProvider("google"))} icon={GOOGLE} />
                            {appleAvailable ? (
                                <Button kind="muted" title="Continue with Apple" disabled={loading} onPress={() => void run(() => session.signInWithApple())} icon={
                                    <Svg width={16} height={16} viewBox="0 0 24 24" fill={colors.foreground}><Path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" /></Svg>
                                } />
                            ) : null}
                        </SpringIn>
                    </View>
                </View>
                {loading ? <View style={{ position: "absolute", top: insets.top + 16, right: 16 }}><Spinner /></View> : null}
                <T size={12} muted center style={{ paddingBottom: 8, paddingTop: 16 }}>
                    By creating an account, you agree to our{" "}
                    <T size={12} muted style={{ textDecorationLine: "underline" }} onPress={() => void Linking.openURL(`${SITE_URL}/privacy`)}>Privacy Policy</T>
                    {" "}and{" "}
                    <T size={12} muted style={{ textDecorationLine: "underline" }} onPress={() => void Linking.openURL(`${SITE_URL}/terms`)}>Terms of Service</T>.
                </T>
            </ScrollView>
        </View>
    );
}

/**
 * Rises from below with a quick, slightly bouncy spring and fades in, on the
 * native thread (transform and opacity only). Remount it (a new key) to replay.
 */
function SpringIn({ children, style, onLanded }: { children: ReactNode; style?: StyleProp<ViewStyle>; onLanded?: () => void }) {
    const [progress] = useState(() => new Animated.Value(0));
    useEffect(() => {
        Animated.spring(progress, { toValue: 1, stiffness: 420, damping: 22, mass: 0.9, useNativeDriver: true }).start();
        const landed = onLanded ? setTimeout(onLanded, 220) : undefined;
        return () => clearTimeout(landed);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
    }, []);
    return (
        <Animated.View style={[style, { opacity: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [48, 0] }) }] }]}>
            {children}
        </Animated.View>
    );
}

/** Google's "G", in its colours. */
const GOOGLE = (
    <Svg width={16} height={16} viewBox="0 0 48 48">
        <Path fill="#EA4335" d="M24 9.5c3.54 0 6.29 1.46 8.18 2.69l6-5.84C34.28 3.64 29.52 2 24 2 14.64 2 6.61 7.86 3.24 15.81l7.36 5.72C12.23 14.55 17.56 9.5 24 9.5z" />
        <Path fill="#34A853" d="M46.14 24.5c0-1.62-.15-3.18-.42-4.69H24v9.01h12.55a10.78 10.78 0 0 1-4.68 7.09l7.36 5.7C43.62 37.1 46.14 31.3 46.14 24.5z" />
        <Path fill="#4A90E2" d="M10.6 28.49a14.32 14.32 0 0 1 0-8.98l-7.36-5.7A23.94 23.94 0 0 0 0 24c0 3.9.94 7.58 2.6 10.89l7.36-5.7z" />
        <Path fill="#FBBC05" d="M24 46c5.52 0 10.16-1.82 13.55-4.94l-7.36-5.7C28.1 36.3 26.13 37 24 37a13.46 13.46 0 0 1-12.4-8.51l-7.36 5.7C6.61 40.14 14.64 46 24 46z" />
    </Svg>
);

/** The purple glow at the top (AuthGradient, its phone size). */
function Glow() {
    return (
        <Svg pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0 }} width="100%" height={520}>
            <Defs>
                <RadialGradient id="glow" cx="50%" cy="-8%" rx="95%" ry="60%" fx="50%" fy="-8%" gradientUnits="objectBoundingBox">
                    <Stop offset="0" stopColor="rgb(216,205,255)" stopOpacity={0.95} />
                    <Stop offset="0.35" stopColor="rgb(150,124,255)" stopOpacity={0.5} />
                    <Stop offset="0.6" stopColor="rgb(88,62,190)" stopOpacity={0.18} />
                    <Stop offset="0.78" stopColor="rgb(88,62,190)" stopOpacity={0} />
                </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#glow)" />
        </Svg>
    );
}
