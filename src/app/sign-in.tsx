import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/lib/session";
import { Body, Button } from "@/ui/kit";
import { useColors } from "@/ui/theme";

type Step = "email" | "password" | "code";

/**
 * Sign in with the same account as studio.cencori.com: a password, or a
 * 6-digit code by email (for people who signed up with Google and have none).
 */
export default function SignIn() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const session = useSession();
    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState("");
    const [secret, setSecret] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        setError(null);
        try {
            await action();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't sign in. Try again.");
        } finally {
            setBusy(false);
        }
    };
    const cleanEmail = email.trim().toLowerCase();
    const input = [styles.input, { backgroundColor: colors.muted, color: colors.foreground }];

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24, paddingTop: insets.top, paddingBottom: insets.bottom + 24 }}>
                <Text style={{ color: colors.foreground, fontSize: 30, fontWeight: "700", letterSpacing: -0.6 }}>Studio</Text>
                <View style={{ marginTop: 6, marginBottom: 28 }}>
                    <Body muted>
                        {step === "email" ? "Sign in to run your business from your phone." : step === "password" ? cleanEmail : `We sent a 6-digit code to ${cleanEmail}.`}
                    </Body>
                </View>

                {step === "email" ? (
                    <>
                        <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" style={input} />
                        <View style={styles.gap}>
                            <Button title="Continue with password" disabled={!cleanEmail.includes("@")} onPress={() => setStep("password")} />
                        </View>
                        <View style={styles.gap}>
                            <Button kind="secondary" title="Email me a code" busy={busy} disabled={!cleanEmail.includes("@")} onPress={() => run(async () => {
                                await session.sendCode(cleanEmail);
                                setSecret("");
                                setStep("code");
                            })} />
                        </View>
                    </>
                ) : (
                    <>
                        <TextInput
                            value={secret}
                            onChangeText={setSecret}
                            placeholder={step === "password" ? "Password" : "6-digit code"}
                            placeholderTextColor={colors.mutedForeground}
                            secureTextEntry={step === "password"}
                            autoFocus
                            keyboardType={step === "code" ? "number-pad" : "default"}
                            textContentType={step === "code" ? "oneTimeCode" : "password"}
                            autoComplete={step === "code" ? "one-time-code" : "current-password"}
                            maxLength={step === "code" ? 6 : undefined}
                            style={input}
                        />
                        <View style={styles.gap}>
                            <Button
                                title="Sign in"
                                busy={busy}
                                disabled={step === "code" ? secret.length !== 6 : !secret}
                                onPress={() => run(() => (step === "password" ? session.signInWithPassword(cleanEmail, secret) : session.signInWithCode(cleanEmail, secret.trim())))}
                            />
                        </View>
                        <Pressable onPress={() => { setStep("email"); setSecret(""); setError(null); }} style={styles.link}>
                            <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Use a different way</Text>
                        </Pressable>
                    </>
                )}

                {error ? <Text style={{ color: colors.danger, fontSize: 14, marginTop: 14, lineHeight: 20 }}>{error}</Text> : null}
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    input: { height: 50, borderRadius: 14, paddingHorizontal: 16, fontSize: 16 },
    gap: { marginTop: 12 },
    link: { alignSelf: "center", marginTop: 16, padding: 8 },
});
