import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { fetch } from "expo/fetch";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { API_URL } from "@/lib/config";

/**
 * Who is signed in: a Better Auth session token, kept in the phone's secure
 * storage and sent as `Authorization: Bearer` on every call. Cookies are
 * never used (credentials: "omit"), so the server treats the app like the
 * Tensor desktop app, not like a browser.
 */

const TOKEN_KEY = "studio.session";

interface SessionValue {
    /** Null until the stored token has been read. */
    ready: boolean;
    token: string | null;
    signInWithPassword(email: string, password: string): Promise<void>;
    sendCode(email: string): Promise<void>;
    signInWithCode(email: string, code: string): Promise<void>;
    /** Google or GitHub, in the phone's browser; false when the owner closed it. */
    signInWithProvider(provider: "google" | "github"): Promise<boolean>;
    signOut(): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

async function authCall(path: string, body: unknown): Promise<{ token: string | null }> {
    const response = await fetch(`${API_URL}/api/auth/${path}`, {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
    }).catch(() => null);
    if (!response) throw new Error("Couldn't reach Studio. Check your connection and try again.");
    const json = (await response.json().catch(() => null)) as { token?: string; message?: string; code?: string } | null;
    if (!response.ok) throw new Error(signInError(json?.code, json?.message));
    // The bearer plugin sends the session token in this header; sign-in also returns it in the body.
    return { token: response.headers.get("set-auth-token") ?? json?.token ?? null };
}

function signInError(code: string | undefined, message: string | undefined): string {
    if (code === "INVALID_EMAIL_OR_PASSWORD") return "That email and password don't match.";
    if (code === "INVALID_OTP" || code === "OTP_EXPIRED") return "That code didn't work. Check it, or send a new one.";
    if (code === "TOO_MANY_ATTEMPTS") return "Too many tries. Send a new code.";
    if (code === "EMAIL_NOT_VERIFIED") return "Confirm your email first: sign in with a code instead.";
    return message || "Couldn't sign in. Try again.";
}

/**
 * Google or GitHub sign-in (the server's half: cencori app/api/studio/app-auth).
 * The browser signs in as on the web, and Studio sends back a sealed one-time
 * code; only this app, holding the secret whose hash went out with it, can
 * trade that code for the session (PKCE), so a link caught on the way is no
 * use to anyone else.
 */
async function providerSignIn(provider: "google" | "github"): Promise<string | null> {
    const verifier = Array.from(Crypto.getRandomBytes(32), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const challenge = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.HEX });
    const back = Linking.createURL("auth");
    const result = await WebBrowser.openAuthSessionAsync(`${API_URL}/api/studio/app-auth/start?provider=${provider}&challenge=${challenge}&return=${encodeURIComponent(back)}`, back);
    if (result.type !== "success") return null;
    const params = new URL(result.url).searchParams;
    if (params.get("outcome") !== "done") throw new Error(params.get("message") || "Couldn't sign in. Try again.");
    const response = await fetch(`${API_URL}/api/studio/app-auth/finish`, {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ code: params.get("code"), verifier }),
    }).catch(() => null);
    if (!response) throw new Error("Couldn't reach Studio. Check your connection and try again.");
    const json = (await response.json().catch(() => null)) as { token?: string; error?: string } | null;
    if (!response.ok || !json?.token) throw new Error(json?.error ?? "Couldn't sign in. Try again.");
    return json.token;
}

export function SessionProvider({ children }: { children: ReactNode }) {
    const [ready, setReady] = useState(false);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        SecureStore.getItemAsync(TOKEN_KEY).then((saved) => setToken(saved)).finally(() => setReady(true));
    }, []);

    const keep = useCallback(async (next: string | null) => {
        if (!next) throw new Error("Couldn't sign in. Try again.");
        await SecureStore.setItemAsync(TOKEN_KEY, next);
        setToken(next);
    }, []);

    const signOut = useCallback(async () => {
        const current = token;
        setToken(null);
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        if (current) {
            await fetch(`${API_URL}/api/auth/sign-out`, {
                method: "POST",
                credentials: "omit",
                headers: { Authorization: `Bearer ${current}`, "Content-Type": "application/json" },
                body: "{}",
            }).catch(() => undefined);
        }
    }, [token]);

    const value = useMemo<SessionValue>(() => ({
        ready,
        token,
        signInWithPassword: async (email, password) => keep((await authCall("sign-in/email", { email, password })).token),
        sendCode: async (email) => void (await authCall("email-otp/send-verification-otp", { email, type: "sign-in" })),
        signInWithCode: async (email, code) => keep((await authCall("sign-in/email-otp", { email, otp: code })).token),
        signInWithProvider: async (provider) => {
            const next = await providerSignIn(provider);
            if (!next) return false;
            await keep(next);
            return true;
        },
        signOut,
    }), [ready, token, keep, signOut]);

    return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
    const value = useContext(SessionContext);
    if (!value) throw new Error("useSession outside SessionProvider");
    return value;
}
