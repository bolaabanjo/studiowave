import { useState, type ReactNode } from "react";
import { Linking, Pressable, ScrollView, TextInput, View, type TextInputProps } from "react-native";
import { goBack } from "@/lib/navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL, SITE_URL } from "@/lib/config";
import { COUNTRIES, toInternational, type Country } from "@/lib/countries";
import { AuthError, useSession } from "@/lib/session";
import { Icon } from "@/ui/icons";
import { BottomSheet, Button, ErrorText, IconButton, KeyboardSafe, T } from "@/ui/kit";
import { CodeInput } from "@/ui/code-input";
import { fonts, palette, useColors } from "@/ui/theme";

type Mode = "signup" | "login";
type Method = "phone" | "email";
type Step = "form" | "code" | "name";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Sign up or log in, on one page, with a phone number (the front door) or an
 * email ("Use email instead"):
 * - Phone: the country and number, and signing up an email if they have one,
 *   their name and whether they want news; then the 6-digit code on WhatsApp
 *   (cencori lib/auth/better-auth.ts phone-number plugin).
 * - Email: email and password (and signing up their name); a new account
 *   confirms the emailed code (Better Auth email OTP), as on the web.
 * A new account's details are saved before its session is kept, so the app
 * opens already knowing them.
 */
export default function GetStarted() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const session = useSession();
    const [mode, setMode] = useState<Mode>("signup");
    const [method, setMethod] = useState<Method>("phone");
    const [step, setStep] = useState<Step>("form");
    const [country, setCountry] = useState<Country>(COUNTRIES[0]);
    const [picking, setPicking] = useState(false);
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [first, setFirst] = useState("");
    const [last, setLast] = useState("");
    const [marketing, setMarketing] = useState(false);
    const [code, setCode] = useState("");
    // Wrong codes so far: each one shakes the boxes red.
    const [wrong, setWrong] = useState(0);
    // Logged in with a number that had no account yet: their name, then in.
    const [pending, setPending] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const number = toInternational(country, phone);
    const address = email.trim().toLowerCase();
    const name = `${first.trim()} ${last.trim()}`.trim();
    const signingUp = mode === "signup";

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        setError(null);
        try {
            await action();
        } catch (cause) {
            // An email account that never confirmed its code: send a fresh one, straight to the code.
            if (cause instanceof AuthError && cause.code === "EMAIL_NOT_VERIFIED") {
                await session.sendSignUpCode(address).catch(() => undefined);
                setCode("");
                setStep("code");
                setError("Confirm your email first: we sent you a new code.");
                return;
            }
            setError(cause instanceof Error ? cause.message : "Something went wrong. Try again.");
        } finally {
            setBusy(false);
        }
    };

    /** A new account's details, saved with its token before the app opens. */
    const saveDetails = async (token: string, details: { full_name: string; contact_email?: string; marketing?: boolean }) => {
        const response = await fetch(`${API_URL}/api/studio/account`, { method: "PATCH", credentials: "omit", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(details) }).catch(() => null);
        if (!response?.ok) throw new Error("Couldn't save your details. Try again.");
    };

    const submit = () => run(async () => {
        if (signingUp && (!first.trim() || !last.trim())) throw new Error("Enter your first and last name.");
        if (method === "phone") {
            if (!number) throw new Error(`Enter your phone number, like ${country.example}.`);
            if (signingUp && email.trim() && !EMAIL_PATTERN.test(email.trim())) throw new Error("That email doesn't look right.");
            await session.sendPhoneCode(number);
            setCode("");
            setStep("code");
            return;
        }
        if (!EMAIL_PATTERN.test(address)) throw new Error("Enter your email address.");
        if (!password) throw new Error("Enter your password.");
        if (!signingUp) return session.signInWithPassword(address, password);
        if (password.length < 8) throw new Error("Use at least 8 characters for your password.");
        await session.signUp(address, password);
        setCode("");
        setStep("code");
    });

    const verify = (value = code) => run(async () => {
        if (value.length !== 6) throw new Error(method === "phone" ? "Enter the 6-digit code from WhatsApp." : "Enter the 6-digit code from your email.");
        try {
            await checkCode(value);
        } catch (cause) {
            // A wrong code shakes the boxes; an expired one or too many tries just says so (they need a new code).
            if (cause instanceof AuthError && cause.code === "INVALID_OTP") {
                setWrong((count) => count + 1);
                throw new Error("That code isn't right. Try again.");
            }
            throw cause;
        }
    });
    const checkCode = async (value: string) => {
        if (method === "email") {
            const token = await session.verifySignUpCode(address, value);
            // Signing up: their name goes on before the app opens. A login that had to confirm its email goes straight in.
            if (signingUp && name) await saveDetails(token, { full_name: name, marketing });
            return session.keepSession(token);
        }
        if (!number) throw new Error("Enter your phone number.");
        const result = await session.verifyPhoneCode(number, value);
        if (signingUp && result.isNew) {
            await saveDetails(result.token, { full_name: name, ...(email.trim() ? { contact_email: email.trim() } : {}), marketing });
            return session.keepSession(result.token);
        }
        if (!result.isNew) return session.keepSession(result.token);
        setPending(result.token);
        setStep("name");
    };

    const finish = () => run(async () => {
        if (!pending) return;
        if (!first.trim() || !last.trim()) throw new Error("Enter your first and last name.");
        await saveDetails(pending, { full_name: name });
        await session.keepSession(pending);
    });

    const resend = () => run(async () => {
        if (method === "phone" && number) await session.sendPhoneCode(number);
        else await session.sendSignUpCode(address);
    });

    const switchMode = () => {
        setMode(signingUp ? "login" : "signup");
        setStep("form");
        setError(null);
    };
    const switchMethod = () => {
        setMethod(method === "phone" ? "email" : "phone");
        setError(null);
    };
    const back = () => (step === "code" ? setStep("form") : step === "name" ? undefined : goBack("/sign-in"));

    const formReady = method === "phone"
        ? !!phone.trim() && (!signingUp || (!!first.trim() && !!last.trim()))
        : !!address && !!password && (!signingUp || (!!first.trim() && !!last.trim()));

    return (
        <KeyboardSafe style={{ backgroundColor: colors.background }}>
            <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                {step === "name" ? <View style={{ height: 44 }} /> : <IconButton name="chevron-left:lucide" label="Back" kind="muted" size={44} onPress={back} />}
                {step === "form" ? (
                    <Pressable onPress={switchMode} style={{ height: 40, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: colors.muted }}>
                        <T size={14} weight="600">{signingUp ? "Log in" : "Sign up"}</T>
                        <Icon name="user-rounded" size={16} color={colors.foreground} />
                    </Pressable>
                ) : null}
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
                {step === "name" ? (
                    <>
                        <Heading title="What's your name?" detail="This number didn't have an account yet, so we made one. Tell us who you are." />
                        <NameFields first={first} last={last} onFirst={setFirst} onLast={setLast} />
                    </>
                ) : step === "code" ? (
                    <>
                        <Heading
                            title={method === "phone" ? "Check WhatsApp" : "Check your email"}
                            detail={`We sent a 6-digit code to ${method === "phone" ? number ?? phone : address}.`}
                        />
                        <View style={{ marginTop: 28 }}>
                            <CodeInput value={code} onChange={setCode} onComplete={(digits) => { if (!busy) void verify(digits); }} wrong={wrong} disabled={busy} />
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 16 }}>
                            <T size={14} muted>Didn&apos;t get it? </T>
                            <Pressable onPress={() => void resend()} disabled={busy} hitSlop={6}><T size={14} style={{ textDecorationLine: "underline" }}>Send again</T></Pressable>
                        </View>
                    </>
                ) : (
                    <>
                        <Heading
                            title={signingUp ? "Let's get started" : "Welcome back"}
                            detail={method === "phone"
                                ? (signingUp ? "Enter your details to create your account. We'll send a code to your number on WhatsApp." : "Enter your phone number and we'll send you a code on WhatsApp.")
                                : (signingUp ? "Enter your details to create your account. We'll email you a code to confirm it." : "Log in with your email and password.")}
                        />
                        {method === "phone" ? (
                            <View style={{ flexDirection: "row", gap: 12, marginTop: 28 }}>
                                <View>
                                    <Label required={signingUp}>Country</Label>
                                    <Pressable onPress={() => setPicking(true)} accessibilityLabel={`Country: ${country.name}`} style={{ height: 52, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.muted }}>
                                        <T size={20}>{country.flag}</T>
                                        <Icon name="chevron-down:lucide" size={16} color={colors.foreground} />
                                    </Pressable>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Label required={signingUp}>Phone number</Label>
                                    <View style={{ height: 52, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 16, borderRadius: 16, backgroundColor: colors.muted }}>
                                        <T>+{country.dial}</T>
                                        <TextInput value={phone} onChangeText={setPhone} placeholder={country.example} placeholderTextColor={colors.mutedForeground} keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel"
                                            style={{ flex: 1, height: 52, paddingRight: 16, fontFamily: fonts["500"], fontSize: 15, color: colors.foreground }} />
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <View style={{ marginTop: 8 }}>
                                <Label required={signingUp}>Email address</Label>
                                <Input value={email} onChangeText={setEmail} placeholder="example@email.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" autoComplete="email" />
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                    <Label required={signingUp}>Password</Label>
                                    {!signingUp ? <Pressable onPress={() => void Linking.openURL(`${SITE_URL}/forgot`)} hitSlop={6} style={{ marginTop: 20, marginBottom: 8 }}><T size={13} style={{ textDecorationLine: "underline" }}>Forgot your password?</T></Pressable> : null}
                                </View>
                                <View style={{ justifyContent: "center" }}>
                                    <Input value={password} onChangeText={setPassword} secureTextEntry={!showPassword} placeholder={signingUp ? "At least 8 characters" : "Your password"}
                                        autoComplete={signingUp ? "new-password" : "current-password"} textContentType={signingUp ? "newPassword" : "password"} style={{ paddingRight: 52 }} />
                                    <Pressable onPress={() => setShowPassword((value) => !value)} accessibilityLabel={showPassword ? "Hide password" : "Show password"} hitSlop={8} style={{ position: "absolute", right: 18 }}>
                                        <Icon name={showPassword ? "eye-off:lucide" : "eye:lucide"} size={18} color={colors.mutedForeground} />
                                    </Pressable>
                                </View>
                            </View>
                        )}
                        {signingUp ? (
                            <>
                                {method === "phone" ? (
                                    <>
                                        <Label optional>Email address</Label>
                                        <Input value={email} onChangeText={setEmail} placeholder="example@email.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" autoComplete="email" />
                                    </>
                                ) : null}
                                <NameFields first={first} last={last} onFirst={setFirst} onLast={setLast} />
                                <Pressable onPress={() => setMarketing((value) => !value)} accessibilityRole="checkbox" accessibilityState={{ checked: marketing }} style={{ flexDirection: "row", gap: 12, marginTop: 24, alignItems: "flex-start" }}>
                                    <View style={{ width: 22, height: 22, marginTop: 1, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: marketing ? palette.emerald600 : "transparent", borderWidth: marketing ? 0 : 1.5, borderColor: colors.mutedForeground }}>
                                        {marketing ? <Icon name="check:lucide" size={14} color="#ffffff" /> : null}
                                    </View>
                                    <T size={14} leading={21} style={{ flex: 1 }}>I want to get news, tips and offers from Studiowave</T>
                                </Pressable>
                            </>
                        ) : null}
                    </>
                )}
                {error ? <ErrorText style={{ marginTop: 16 }}>{error}</ErrorText> : null}
            </ScrollView>

            <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 16 }}>
                {step === "name" ? (
                    <Button title="Continue" busy={busy} disabled={!first.trim() || !last.trim()} onPress={() => void finish()} />
                ) : step === "code" ? (
                    <Button title="Continue" busy={busy} disabled={code.length !== 6} onPress={() => void verify()} />
                ) : (
                    <>
                        <Button kind="muted" title={method === "phone" ? "Use email instead" : "Use phone instead"} disabled={busy} onPress={switchMethod}
                            icon={<Icon name={method === "phone" ? "letter" : "smartphone"} size={18} color={colors.foreground} />} style={{ marginBottom: 10 }} />
                        <Button title={!signingUp && method === "email" ? "Log in" : "Continue"} busy={busy} disabled={!formReady} onPress={() => void submit()} />
                    </>
                )}
            </View>

            <BottomSheet open={picking} onClose={() => setPicking(false)}>
                <T size={17} weight="600" style={{ marginBottom: 8 }}>Country</T>
                <ScrollView style={{ maxHeight: 420 }}>
                    {COUNTRIES.map((item) => (
                        <Pressable key={item.code} onPress={() => { setCountry(item); setPicking(false); }} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, height: 48, paddingHorizontal: 8, borderRadius: 12, backgroundColor: pressed ? colors.muted : "transparent" })}>
                            <T size={20}>{item.flag}</T>
                            <T style={{ flex: 1 }}>{item.name}</T>
                            <T muted>+{item.dial}</T>
                            {item.code === country.code ? <Icon name="check:lucide" size={16} color={colors.foreground} /> : null}
                        </Pressable>
                    ))}
                </ScrollView>
            </BottomSheet>
        </KeyboardSafe>
    );
}

function Heading({ title, detail }: { title: string; detail: string }) {
    return (
        <View style={{ alignItems: "center" }}>
            <T size={32} weight="600" leading={38} center style={{ letterSpacing: -0.8 }}>{title}</T>
            <T size={15} leading={22} muted center style={{ marginTop: 10, maxWidth: 330 }}>{detail}</T>
        </View>
    );
}

function Label({ children, required, optional }: { children: ReactNode; required?: boolean; optional?: boolean }) {
    return (
        <T size={14} weight="600" style={{ marginTop: 20, marginBottom: 8 }}>
            {children}
            {required ? <T size={14} color={palette.orange500}> *</T> : null}
            {optional ? <T size={13} muted> (optional)</T> : null}
        </T>
    );
}

function Input(props: TextInputProps) {
    const colors = useColors();
    return <TextInput placeholderTextColor={colors.mutedForeground} {...props} style={[{ height: 52, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.muted, fontFamily: fonts["500"], fontSize: 15, color: colors.foreground }, props.style]} />;
}

function NameFields({ first, last, onFirst, onLast }: { first: string; last: string; onFirst: (value: string) => void; onLast: (value: string) => void }) {
    return (
        <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
                <Label required>First name</Label>
                <Input value={first} onChangeText={onFirst} placeholder="e.g. Ada" autoCapitalize="words" textContentType="givenName" autoComplete="given-name" />
            </View>
            <View style={{ flex: 1 }}>
                <Label required>Last name</Label>
                <Input value={last} onChangeText={onLast} placeholder="e.g. Obi" autoCapitalize="words" textContentType="familyName" autoComplete="family-name" />
            </View>
        </View>
    );
}
