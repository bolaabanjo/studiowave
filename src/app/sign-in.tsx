import { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { SITE_URL } from "@/lib/config";
import { useSession } from "@/lib/session";
import { Icon } from "@/ui/icons";
import { Spinner, T } from "@/ui/kit";
import { alpha, fonts, useColors } from "@/ui/theme";

/**
 * Sign in, as the web's login page (cencori app/login/page.tsx and
 * components/login-form.tsx): the Cencori mark on the purple glow, email and
 * password, or GitHub and Google. Same account as studio.cencori.com.
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

    const input = { height: 36, borderRadius: 6, borderWidth: 1, borderColor: colors.input, backgroundColor: colors.scheme === "dark" ? alpha(colors.input, 0.3) : "transparent", paddingHorizontal: 12, fontFamily: fonts["500"], fontSize: 14, color: colors.foreground };
    const label = (text: string) => <T size={14}>{text}</T>;

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
            <Glow />
            <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 8 }} keyboardShouldPersistTaps="handled">
                <View style={{ flex: 1, justifyContent: "center" }}>
                    <View style={{ width: "100%", maxWidth: 384, alignSelf: "center", gap: 24 }}>
                        <View style={{ alignItems: "center", marginBottom: 8 }}>
                            <Image source={colors.scheme === "dark" ? require("../../assets/brand/mark-white.png") : require("../../assets/brand/mark-black.png")} style={{ width: 24, height: 24 }} accessibilityLabel="Cencori logo" />
                        </View>
                        <View>
                            <T size={18} center leading={28}>Welcome back!</T>
                            <T size={14} muted center style={{ marginTop: 4 }}>Enter your email below to login to your account</T>
                        </View>

                        {error ? <T size={14} color={colors.destructive} accessibilityRole="alert">{error}</T> : null}

                        <View style={{ gap: 16 }}>
                            <View style={{ gap: 6 }}>
                                {label("Email")}
                                <TextInput value={email} onChangeText={setEmail} placeholder="bola@example.com" placeholderTextColor={alpha(colors.mutedForeground, 0.7)} autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" textContentType="emailAddress" style={input} />
                            </View>
                            <View style={{ gap: 6 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                    {label("Password")}
                                    <Pressable onPress={() => void Linking.openURL(`${SITE_URL}/forgot`)} hitSlop={6}>
                                        <T size={14} style={{ textDecorationLine: "underline" }}>Forgot your password?</T>
                                    </Pressable>
                                </View>
                                <View style={{ justifyContent: "center" }}>
                                    <TextInput value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoComplete="current-password" textContentType="password" onSubmitEditing={() => void login()} returnKeyType="go" style={[input, { paddingRight: 40 }]} />
                                    <Pressable onPress={() => setShowPassword((value) => !value)} accessibilityLabel={showPassword ? "Hide password" : "Show password"} hitSlop={8} style={{ position: "absolute", right: 10 }}>
                                        <Icon name={showPassword ? "eye-off:lucide" : "eye:lucide"} size={16} color={colors.mutedForeground} />
                                    </Pressable>
                                </View>
                            </View>
                            <Pressable onPress={() => void login()} disabled={loading} style={({ pressed }) => ({ height: 36, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: colors.foreground, opacity: loading ? 0.5 : pressed ? 0.9 : 1 })}>
                                <T size={14} color={colors.background}>{loading ? "Working…" : "Login"}</T>
                            </Pressable>

                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                                <T size={12} muted>Or continue with</T>
                                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                            </View>

                            <View style={{ gap: 8 }}>
                                <ProviderButton label="GitHub" disabled={loading} onPress={() => void run(() => session.signInWithProvider("github"))} icon={
                                    <Svg width={16} height={16} viewBox="0 0 24 24" fill={colors.foreground}><Path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></Svg>
                                } />
                                <ProviderButton label="Google" disabled={loading} onPress={() => void run(() => session.signInWithProvider("google"))} icon={
                                    <Svg width={16} height={16} viewBox="0 0 48 48">
                                        <Path fill="#EA4335" d="M24 9.5c3.54 0 6.29 1.46 8.18 2.69l6-5.84C34.28 3.64 29.52 2 24 2 14.64 2 6.61 7.86 3.24 15.81l7.36 5.72C12.23 14.55 17.56 9.5 24 9.5z" />
                                        <Path fill="#34A853" d="M46.14 24.5c0-1.62-.15-3.18-.42-4.69H24v9.01h12.55a10.78 10.78 0 0 1-4.68 7.09l7.36 5.7C43.62 37.1 46.14 31.3 46.14 24.5z" />
                                        <Path fill="#4A90E2" d="M10.6 28.49a14.32 14.32 0 0 1 0-8.98l-7.36-5.7A23.94 23.94 0 0 0 0 24c0 3.9.94 7.58 2.6 10.89l7.36-5.7z" />
                                        <Path fill="#FBBC05" d="M24 46c5.52 0 10.16-1.82 13.55-4.94l-7.36-5.7C28.1 36.3 26.13 37 24 37a13.46 13.46 0 0 1-12.4-8.51l-7.36 5.7C6.61 40.14 14.64 46 24 46z" />
                                    </Svg>
                                } />
                                <View style={{ marginTop: 4, flexDirection: "row", justifyContent: "center" }}>
                                    <T size={14} muted>Don&apos;t have an account? </T>
                                    <Pressable onPress={() => void Linking.openURL(`${SITE_URL}/signup`)}><T size={14} style={{ textDecorationLine: "underline" }}>Sign up</T></Pressable>
                                </View>
                            </View>
                        </View>
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

function ProviderButton({ label, icon, onPress, disabled }: { label: string; icon: React.ReactNode; onPress: () => void; disabled?: boolean }) {
    const colors = useColors();
    return (
        <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => ({ height: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 6, borderWidth: 1, borderColor: colors.input, backgroundColor: pressed ? colors.muted : colors.background, opacity: disabled ? 0.5 : 1 })}>
            {icon}
            <T size={14}>{label}</T>
        </Pressable>
    );
}

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
