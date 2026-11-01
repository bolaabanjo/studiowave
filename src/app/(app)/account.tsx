import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useSession } from "@/lib/session";
import { BottomSheet, Button, ErrorText, Field, IconButton, KeyboardSafe, LoadError, PageTitle, Sheet, SheetHeader, Skeleton, Spinner, T } from "@/ui/kit";
import { alpha, useColors } from "@/ui/theme";

type Account = { full_name: string | null; email: string | null; sign_in: string[]; businesses: string[]; owns_developer_organizations: boolean };

const METHOD: Record<string, string> = { email: "Email and password", google: "Google", apple: "Apple", github: "GitHub" };

/**
 * Your own account (cencori /api/studio/account): your name, your email
 * (changed with a code sent to the new address), how you sign in, and
 * deleting the account with the businesses you own.
 */
export default function AccountScreen() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const api = useApi();
    const query = useQuery({ queryKey: ["account"], queryFn: () => api<Account>("/api/studio/account", { fallback: "Couldn't load your account." }) });

    return (
        <KeyboardSafe style={{ backgroundColor: colors.background }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
                <View style={{ marginLeft: -8 }}><IconButton name="chevron-left:lucide" label="Back" onPress={() => router.back()} /></View>
                <PageTitle>Edit profile</PageTitle>
                {query.isLoading ? (
                    <View style={{ marginTop: 16, gap: 12 }}>{[0, 1, 2].map((index) => <Skeleton key={index} height={64} radius={16} />)}</View>
                ) : !query.data ? (
                    <LoadError error={query.error} fallback="Couldn't load your account." onRetry={() => void query.refetch()} />
                ) : (
                    <Details account={query.data} />
                )}
            </ScrollView>
        </KeyboardSafe>
    );
}

function Details({ account }: { account: Account }) {
    const colors = useColors();
    const api = useApi();
    const queryClient = useQueryClient();
    const [name, setName] = useState(account.full_name ?? "");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [changingEmail, setChangingEmail] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const next = name.replace(/\s+/g, " ").trim();

    const saveName = async () => {
        setSaving(true);
        setError(null);
        try {
            await api("/api/studio/account", { method: "PATCH", body: { full_name: next }, fallback: "Couldn't change your name." });
            setSaved(true);
            // Your name shows on Home and Profile, from the workspace.
            void queryClient.invalidateQueries({ queryKey: ["workspace"] });
            void queryClient.invalidateQueries({ queryKey: ["account"] });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't change your name.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Section title="Full name">
                <Field value={name} onChangeText={(value) => { setName(value); setSaved(false); }} maxLength={80} autoCapitalize="words" placeholder="Your name" />
                {error ? <ErrorText style={{ marginTop: 8 }}>{error}</ErrorText> : null}
                {next && next !== (account.full_name ?? "") ? (
                    <Button title="Save name" busy={saving} onPress={() => void saveName()} style={{ marginTop: 10 }} />
                ) : saved ? <T size={13} muted style={{ marginTop: 8, paddingHorizontal: 4 }}>Saved.</T> : null}
            </Section>

            <Section title="Email">
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 999, backgroundColor: colors.muted, paddingLeft: 20, paddingRight: 6, height: 52 }}>
                    <T lines={1} style={{ flex: 1 }}>{account.email ?? "No email"}</T>
                    <Pressable onPress={() => setChangingEmail(true)} style={{ height: 40, paddingHorizontal: 16, borderRadius: 20, justifyContent: "center", backgroundColor: colors.pressed }}><T size={14} weight="600">Change</T></Pressable>
                </View>
            </Section>

            {account.sign_in.length ? (
                <Section title="You sign in with">
                    <T style={{ paddingHorizontal: 4 }}>{account.sign_in.map((method) => METHOD[method] ?? method).join(", ")}</T>
                </Section>
            ) : null}

            <Pressable onPress={() => setDeleting(true)} accessibilityRole="button" style={({ pressed }) => ({ marginTop: 40, height: 48, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "#dc2626", opacity: pressed ? 0.85 : 1 })}>
                <T weight="600" color="#ffffff">Delete account</T>
            </Pressable>

            <EmailSheet key={account.email ?? ""} open={changingEmail} onClose={() => setChangingEmail(false)} />
            <DeleteSheet account={account} open={deleting} onClose={() => setDeleting(false)} />
        </>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <View style={{ marginTop: 28 }}>
            <T size={13} weight="600" style={{ marginBottom: 10, paddingHorizontal: 4 }}>{title}</T>
            {children}
        </View>
    );
}

/** A new address, then the code sent to it. */
function EmailSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
    const api = useApi();
    const queryClient = useQueryClient();
    const [email, setEmail] = useState("");
    const [sentTo, setSentTo] = useState<string | null>(null);
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const close = () => {
        setEmail("");
        setSentTo(null);
        setCode("");
        setError(null);
        onClose();
    };
    const send = async () => {
        setBusy(true);
        setError(null);
        try {
            const result = await api<{ email: string }>("/api/studio/account", { method: "POST", body: { action: "email_code", email: email.trim() }, fallback: "Couldn't send the code." });
            setSentTo(result.email);
            setCode("");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't send the code.");
        } finally {
            setBusy(false);
        }
    };
    const confirm = async (value: string) => {
        setBusy(true);
        setError(null);
        try {
            await api("/api/studio/account", { method: "POST", body: { action: "email_confirm", code: value }, fallback: "Couldn't change your email." });
            void queryClient.invalidateQueries({ queryKey: ["account"] });
            void queryClient.invalidateQueries({ queryKey: ["workspace"] });
            close();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't change your email.");
        } finally {
            setBusy(false);
        }
    };
    return (
        <Sheet open={open} onClose={close}>
            <SheetHeader title="Change email" onClose={close} description={sentTo ? `Enter the 6-digit code we sent to ${sentTo}.` : "We'll send a code to the new address to check it's yours."} />
            {sentTo ? (
                <>
                    <Field value={code} autoFocus keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} placeholder="000000"
                        onChangeText={(value) => {
                            const digits = value.replace(/\D/g, "").slice(0, 6);
                            setCode(digits);
                            if (digits.length === 6 && !busy) void confirm(digits);
                        }}
                        style={{ marginTop: 16, height: 56, fontSize: 24, letterSpacing: 8, textAlign: "center" }} />
                    {error ? <ErrorText style={{ marginTop: 8 }}>{error}</ErrorText> : null}
                    <View style={{ flex: 1, minHeight: 16 }} />
                    <Button title="Change email" busy={busy} disabled={code.length !== 6} onPress={() => void confirm(code)} />
                    <Pressable onPress={() => void send()} disabled={busy} style={{ marginTop: 14 }}><T size={13} muted center>Send the code again</T></Pressable>
                </>
            ) : (
                <>
                    <Field value={email} onChangeText={setEmail} autoFocus keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" placeholder="New email" style={{ marginTop: 16 }} />
                    {error ? <ErrorText style={{ marginTop: 8 }}>{error}</ErrorText> : null}
                    <View style={{ flex: 1, minHeight: 16 }} />
                    <Button title="Send code" busy={busy} disabled={!email.trim()} onPress={() => void send()} />
                </>
            )}
        </Sheet>
    );
}

/** Deleting the account, for good: typed DELETE to be sure. */
function DeleteSheet({ account, open, onClose }: { account: Account; open: boolean; onClose: () => void }) {
    const colors = useColors();
    const api = useApi();
    const { signOut } = useSession();
    const [typed, setTyped] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const remove = async () => {
        setBusy(true);
        setError(null);
        try {
            await api("/api/studio/account", { method: "POST", body: { action: "delete", confirm: "DELETE" }, fallback: "Couldn't delete your account." });
            await signOut();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't delete your account.");
            setBusy(false);
        }
    };
    const businesses = account.businesses;
    return (
        <BottomSheet open={open} onClose={onClose}>
            <T size={17} weight="600">Delete your account?</T>
            <T size={14} leading={22} muted style={{ marginTop: 8 }}>
                {businesses.length
                    ? `This deletes your account and ${businesses.length === 1 ? "your business" : `your ${businesses.length} businesses`} (${businesses.join(", ")}): their staff, chats, sales and money records. Customers stop getting answers. This can't be undone.`
                    : "This deletes your account. This can't be undone."}
            </T>
            {account.owns_developer_organizations ? (
                <T size={13} leading={20} color={colors.destructive} style={{ marginTop: 8 }}>You also own organizations on Cencori&apos;s console. Delete those there first.</T>
            ) : null}
            <Field value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} placeholder="Type DELETE" style={{ marginTop: 16 }} />
            {error ? <ErrorText style={{ marginTop: 8 }}>{error}</ErrorText> : null}
            <Pressable onPress={() => void remove()} disabled={busy || typed.trim() !== "DELETE"} accessibilityRole="button"
                style={({ pressed }) => ({ marginTop: 16, height: 48, borderRadius: 999, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#dc2626", opacity: busy || typed.trim() !== "DELETE" ? 0.4 : pressed ? 0.85 : 1 })}>
                {busy ? <Spinner color="#ffffff" /> : null}
                <T weight="600" color="#ffffff">Delete my account</T>
            </Pressable>
            <Button kind="outline" title="Keep it" disabled={busy} onPress={onClose} style={{ marginTop: 8, borderColor: alpha(colors.border, 0.6) }} />
        </BottomSheet>
    );
}
