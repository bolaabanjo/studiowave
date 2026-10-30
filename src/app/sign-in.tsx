import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Keyboard, Linking, Platform, Pressable, ScrollView, View, type StyleProp, type TextInputInstance, type ViewStyle } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { SITE_URL } from "@/lib/config";
import { AuthError, useSession } from "@/lib/session";
import { Icon } from "@/ui/icons";
import { Button, Field, IconButton, Spinner, T } from "@/ui/kit";
import { useColors } from "@/ui/theme";

/**
 * Sign in on the purple glow: Google, Apple (iOS) or email, each a grey pill
 * at the bottom (Apple drawn as ours, to match the others). Email opens
 * sign-in, which links to sign-up: the web's flow, an unverified account and
 * then the emailed 6-digit code, which signs in. Same account as
 * studio.cencori.com.
 */
export default function SignIn() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const session = useSession();
    const [step, setStep] = useState<Step>("options");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [unverified, setUnverified] = useState(false);
    const [codeFrom, setCodeFrom] = useState<"signin" | "signup">("signup");
    const [appleAvailable, setAppleAvailable] = useState(false);
    const firstField = useRef<TextInputInstance>(null);
    const lift = useKeyboardLift(insets.bottom);

    useEffect(() => {
        if (Platform.OS === "ios") void AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => undefined);
    }, []);

    const go = (next: Step) => {
        setError(null);
        setNotice(null);
        setUnverified(false);
        setStep(next);
    };
    const run = async (action: () => Promise<unknown>) => {
        setError(null);
        setNotice(null);
        setUnverified(false);
        setLoading(true);
        try {
            await action();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to sign in.");
            // Signed up but never entered the code: offer a fresh one, straight to the code step.
            if (cause instanceof AuthError && cause.code === "EMAIL_NOT_VERIFIED") setUnverified(true);
        } finally {
            setLoading(false);
        }
    };
    const address = () => email.trim().toLowerCase();
    const login = () => run(async () => {
        if (!address() || !password) throw new Error("Enter your email and password.");
        await session.signInWithPassword(address(), password);
    });
    const signUp = () => run(async () => {
        if (!address() || !password) throw new Error("Enter your email and a password.");
        if (password.length < 8) throw new Error("Use at least 8 characters for your password.");
        await session.signUp(address(), password);
        setCode("");
        setCodeFrom("signup");
        go("code");
    });
    const verify = (value = code) => run(async () => {
        if (value.length !== 6) throw new Error("Enter the 6-digit code from your email.");
        await session.verifySignUp(address(), value);
    });
    const sendCode = () => run(async () => {
        await session.sendSignUpCode(address());
        setCode("");
        setCodeFrom("signin");
        go("code");
    });
    const resend = () => run(async () => {
        await session.sendSignUpCode(address());
        setNotice("We sent a new code.");
    });

    const label = (text: string) => <T size={14}>{text}</T>;
    const emailInput = (
        <View style={{ gap: 6 }}>
            {label("Email")}
            <Field ref={firstField} value={email} onChangeText={setEmail} placeholder="bola@example.com" autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" textContentType="emailAddress" returnKeyType="next" />
        </View>
    );
    const swap = (question: string, action: string, next: Step) => (
        <View style={{ flexDirection: "row", justifyContent: "center" }}>
            <T size={14} muted>{question} </T>
            <Pressable onPress={() => go(next)} hitSlop={6}><T size={14} style={{ textDecorationLine: "underline" }}>{action}</T></Pressable>
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Glow />
            <Animated.View style={{ flex: 1, transform: [{ translateY: lift }] }}>
                <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 8 }} keyboardShouldPersistTaps="handled">
                    <View style={{ flex: 1, justifyContent: "flex-end" }}>
                        <View style={{ width: "100%", maxWidth: 384, alignSelf: "center", gap: 24 }}>
                            {error ? (
                                <T size={14} color={colors.destructive} accessibilityRole="alert">
                                    {error}
                                    {unverified ? <>{" "}<T size={14} color={colors.destructive} weight="600" style={{ textDecorationLine: "underline" }} onPress={() => void sendCode()}>Send me a code</T></> : null}
                                </T>
                            ) : null}
                            {notice ? <T size={14} muted>{notice}</T> : null}

                            {step === "options" ? (
                                // The first screen: three ways in. Apple is iOS only, and only where the device offers it.
                                <SpringIn key="options" style={{ gap: 10 }}>
                                    <Button kind="muted" title="Sign in with Google" disabled={loading} onPress={() => void run(() => session.signInWithProvider("google"))} icon={GOOGLE} />
                                    {appleAvailable ? (
                                        <Button kind="muted" title="Sign in with Apple" disabled={loading} onPress={() => void run(() => session.signInWithApple())} icon={
                                            <Svg width={16} height={16} viewBox="0 0 24 24" fill={colors.foreground}><Path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" /></Svg>
                                        } />
                                    ) : null}
                                    <Button kind="muted" title="Sign in with email" disabled={loading} onPress={() => go("signin")} icon={<Icon name="letter" size={18} color={colors.foreground} />} />
                                </SpringIn>
                            ) : step === "signin" ? (
                                // The keyboard waits for the spring to land: rising together, they fought and lagged.
                                <SpringIn key="signin" onLanded={() => firstField.current?.focus()} style={{ gap: 16 }}>
                                    {emailInput}
                                    <View style={{ gap: 6 }}>
                                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                            {label("Password")}
                                            <Pressable onPress={() => void Linking.openURL(`${SITE_URL}/forgot`)} hitSlop={6}>
                                                <T size={14} style={{ textDecorationLine: "underline" }}>Forgot your password?</T>
                                            </Pressable>
                                        </View>
                                        <PasswordField value={password} onChangeText={setPassword} onSubmit={() => void login()} />
                                    </View>
                                    <Button title="Login" busy={loading} onPress={() => void login()} />
                                    {swap("Don't have an account?", "Sign up", "signup")}
                                </SpringIn>
                            ) : step === "signup" ? (
                                <SpringIn key="signup" onLanded={() => firstField.current?.focus()} style={{ gap: 16 }}>
                                    {emailInput}
                                    <View style={{ gap: 6 }}>
                                        {label("Password")}
                                        <PasswordField value={password} onChangeText={setPassword} onSubmit={() => void signUp()} isNew />
                                        <T size={13} muted>At least 8 characters.</T>
                                    </View>
                                    <Button title="Create account" busy={loading} onPress={() => void signUp()} />
                                    {swap("Already have an account?", "Sign in", "signin")}
                                </SpringIn>
                            ) : (
                                // The web's 6-digit code (10 minutes, 5 tries); the sixth digit submits it.
                                <SpringIn key="code" onLanded={() => firstField.current?.focus()} style={{ gap: 16 }}>
                                    <View>
                                        <T size={20} weight="600">Check your email</T>
                                        <T size={14} muted style={{ marginTop: 4 }}>We sent a 6-digit code to {address()}.</T>
                                    </View>
                                    <Field
                                        ref={firstField}
                                        value={code}
                                        onChangeText={(value) => {
                                            const digits = value.replace(/\D/g, "").slice(0, 6);
                                            setCode(digits);
                                            if (digits.length === 6 && !loading) void verify(digits);
                                        }}
                                        placeholder="000000"
                                        keyboardType="number-pad"
                                        textContentType="oneTimeCode"
                                        autoComplete="one-time-code"
                                        maxLength={6}
                                        style={{ textAlign: "center", fontSize: 20, letterSpacing: 8 }}
                                    />
                                    <Button title="Verify" busy={loading} onPress={() => void verify()} />
                                    <View style={{ flexDirection: "row", justifyContent: "center" }}>
                                        <T size={14} muted>Didn&apos;t get it? </T>
                                        <Pressable onPress={() => void resend()} disabled={loading} hitSlop={6}><T size={14} style={{ textDecorationLine: "underline" }}>Send again</T></Pressable>
                                    </View>
                                </SpringIn>
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
            </Animated.View>
            {/* Back a step (the code goes back to where it was sent from); fixed, so it stays put while the form rides the keyboard. */}
            {step !== "options" ? (
                <View style={{ position: "absolute", top: insets.top + 8, left: 8 }}>
                    <IconButton name="chevron-left:lucide" label={step === "code" ? (codeFrom === "signin" ? "Back to sign in" : "Back to sign up") : "Back to sign-in options"} onPress={() => go(step === "code" ? codeFrom : "options")} />
                </View>
            ) : null}
        </View>
    );
}

type Step = "options" | "signin" | "signup" | "code";

/** A password field with its show/hide eye; `isNew` asks the phone to suggest a strong one. */
function PasswordField({ value, onChangeText, onSubmit, isNew }: { value: string; onChangeText: (value: string) => void; onSubmit: () => void; isNew?: boolean }) {
    const colors = useColors();
    const [shown, setShown] = useState(false);
    return (
        <View style={{ justifyContent: "center" }}>
            <Field value={value} onChangeText={onChangeText} secureTextEntry={!shown} autoComplete={isNew ? "new-password" : "current-password"} textContentType={isNew ? "newPassword" : "password"} onSubmitEditing={onSubmit} returnKeyType="go" style={{ paddingRight: 52 }} />
            <Pressable onPress={() => setShown((current) => !current)} accessibilityLabel={shown ? "Hide password" : "Show password"} hitSlop={8} style={{ position: "absolute", right: 20 }}>
                <Icon name={shown ? "eye-off:lucide" : "eye:lucide"} size={18} color={colors.mutedForeground} />
            </Pressable>
        </View>
    );
}

/**
 * How far to raise the screen over the iOS keyboard, moving with it: its own
 * duration on a curve close to its own, as a native transform. A
 * KeyboardAvoidingView re-laid the screen out from JavaScript instead, which
 * trailed the keyboard and felt slow. Android resizes the window itself.
 */
function useKeyboardLift(bottomInset: number): Animated.Value {
    const [lift] = useState(() => new Animated.Value(0));
    useEffect(() => {
        if (Platform.OS !== "ios") return;
        const move = (to: number, duration: number) =>
            Animated.timing(lift, { toValue: to, duration: duration || 250, easing: Easing.bezier(0.38, 0.7, 0.125, 1), useNativeDriver: true }).start();
        const show = Keyboard.addListener("keyboardWillShow", (event) => move(-Math.max(0, event.endCoordinates.height - bottomInset), event.duration));
        const hide = Keyboard.addListener("keyboardWillHide", (event) => move(0, event.duration));
        return () => { show.remove(); hide.remove(); };
    }, [lift, bottomInset]);
    return lift;
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
