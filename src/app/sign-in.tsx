import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { SITE_URL } from "@/lib/config";
import { useSession } from "@/lib/session";
import { Icon } from "@/ui/icons";
import { Button, Field, Spinner, T } from "@/ui/kit";
import { useColors } from "@/ui/theme";

/**
 * Sign in on the purple glow: Google, Apple (iOS) or email, each a grey pill
 * at the bottom (Apple drawn as ours, to match the others); email opens the email and password form in their place. Same
 * account as studio.cencori.com.
 */
export default function SignIn() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const session = useSession();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [byEmail, setByEmail] = useState(false);
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
    const login = () => run(async () => {
        if (!email.trim() || !password) throw new Error("Enter your email and password.");
        await session.signInWithPassword(email.trim().toLowerCase(), password);
    });

    const label = (text: string) => <T size={14}>{text}</T>;

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
            <Glow />
            <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 8 }} keyboardShouldPersistTaps="handled">
                <View style={{ flex: 1, justifyContent: "flex-end" }}>
                    <View style={{ width: "100%", maxWidth: 384, alignSelf: "center", gap: 24 }}>
                        {error ? <T size={14} color={colors.destructive} accessibilityRole="alert">{error}</T> : null}

                        {byEmail ? (
                            <View style={{ gap: 16 }}>
                                <View style={{ gap: 6 }}>
                                    {label("Email")}
                                    <Field value={email} onChangeText={setEmail} placeholder="bola@example.com" autoFocus autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
                                </View>
                                <View style={{ gap: 6 }}>
                                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                        {label("Password")}
                                        <Pressable onPress={() => void Linking.openURL(`${SITE_URL}/forgot`)} hitSlop={6}>
                                            <T size={14} style={{ textDecorationLine: "underline" }}>Forgot your password?</T>
                                        </Pressable>
                                    </View>
                                    <View style={{ justifyContent: "center" }}>
                                        <Field value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoComplete="current-password" textContentType="password" onSubmitEditing={() => void login()} returnKeyType="go" style={{ paddingRight: 52 }} />
                                        <Pressable onPress={() => setShowPassword((value) => !value)} accessibilityLabel={showPassword ? "Hide password" : "Show password"} hitSlop={8} style={{ position: "absolute", right: 20 }}>
                                            <Icon name={showPassword ? "eye-off:lucide" : "eye:lucide"} size={18} color={colors.mutedForeground} />
                                        </Pressable>
                                    </View>
                                </View>
                                <Button title="Login" busy={loading} onPress={() => void login()} />
                                <View style={{ flexDirection: "row", justifyContent: "center" }}>
                                    <T size={14} muted>Don&apos;t have an account? </T>
                                    <Pressable onPress={() => void Linking.openURL(`${SITE_URL}/signup`)}><T size={14} style={{ textDecorationLine: "underline" }}>Sign up</T></Pressable>
                                </View>
                                <Pressable onPress={() => { setError(null); setByEmail(false); }} hitSlop={6} style={{ alignSelf: "center" }}>
                                    <T size={14} muted>Other ways to sign in</T>
                                </Pressable>
                            </View>
                        ) : (
                            // The first screen: three ways in. Apple is iOS only, and only where the device offers it.
                            <View style={{ gap: 10 }}>
                                <Button kind="muted" title="Sign in with Google" disabled={loading} onPress={() => void run(() => session.signInWithProvider("google"))} icon={GOOGLE} />
                                {appleAvailable ? (
                                    <Button kind="muted" title="Sign in with Apple" disabled={loading} onPress={() => void run(() => session.signInWithApple())} icon={
                                        <Svg width={16} height={16} viewBox="0 0 24 24" fill={colors.foreground}><Path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" /></Svg>
                                    } />
                                ) : null}
                                <Button kind="muted" title="Sign in with email" disabled={loading} onPress={() => { setError(null); setByEmail(true); }} icon={<Icon name="letter" size={18} color={colors.foreground} />} />
                            </View>
                        )}
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
        </KeyboardAvoidingView>
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
