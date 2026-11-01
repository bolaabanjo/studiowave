import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as AppleAuthentication from "expo-apple-authentication";
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
    /** A new account, unverified until the emailed 6-digit code (as the web's sign-up). */
    signUp(email: string, password: string): Promise<void>;
    sendSignUpCode(email: string): Promise<void>;
    /** The sign-up code: verifies the email and signs the new owner in. */
    verifySignUp(email: string, code: string): Promise<void>;
    /** Google or GitHub, in the phone's browser; false when the owner closed it. */
    signInWithProvider(provider: "google" | "github"): Promise<boolean>;
    /** Sign in with Apple, natively (iOS); false when the owner cancelled. */
    signInWithApple(): Promise<boolean>;
    /** A 6-digit code to a phone number ("+2348012345678"), on WhatsApp. */
    sendPhoneCode(phoneNumber: string): Promise<void>;
    /**
     * Check the code: signs in (a new number becomes a new account). Doesn't keep the
     * session yet, so a new account can give its name first: then call keepSession.
     */
    verifyPhoneCode(phoneNumber: string, code: string): Promise<{ token: string; isNew: boolean }>;
    keepSession(token: string): Promise<void>;
    /** The email sign-up code, without keeping the session: so a new account's details are saved first. */
    verifySignUpCode(email: string, code: string): Promise<string>;
    signOut(): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

/** A failed auth call, with Better Auth's code (e.g. EMAIL_NOT_VERIFIED) for screens that act on it. */
export class AuthError extends Error {
    constructor(message: string, readonly code?: string) {
        super(message);
    }
}

async function authCall(path: string, body: unknown): Promise<{ token: string | null; user: { name?: string } | null }> {
    const response = await fetch(`${API_URL}/api/auth/${path}`, {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
    }).catch(() => null);
    if (!response) throw new Error("Couldn't reach Studiowave. Check your connection and try again.");
    const json = (await response.json().catch(() => null)) as { token?: string; message?: string; code?: string; user?: { name?: string } } | null;
    if (!response.ok) throw new AuthError(signInError(json?.code, json?.message), json?.code);
    // The bearer plugin sends the session token in this header; sign-in also returns it in the body.
    return { token: response.headers.get("set-auth-token") ?? json?.token ?? null, user: json?.user ?? null };
}

function signInError(code: string | undefined, message: string | undefined): string {
    if (code === "INVALID_EMAIL_OR_PASSWORD") return "That email and password don't match.";
    if (code === "INVALID_OTP" || code === "OTP_EXPIRED") return "That code didn't work. Check it, or send a new one.";
    if (code === "TOO_MANY_ATTEMPTS") return "Too many tries. Send a new code.";
    if (code === "USER_ALREADY_EXISTS" || code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") return "That email already has an account. Sign in instead.";
    if (code === "PASSWORD_TOO_SHORT") return "Use at least 8 characters for your password.";
    if (code === "PASSWORD_TOO_LONG") return "That password is too long.";
    if (code === "INVALID_EMAIL") return "Enter a valid email address.";
    if (code === "EMAIL_NOT_VERIFIED") return "Confirm your email first.";
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
    if (!response) throw new Error("Couldn't reach Studiowave. Check your connection and try again.");
    const json = (await response.json().catch(() => null)) as { token?: string; error?: string } | null;
    if (!response.ok || !json?.token) throw new Error(json?.error ?? "Couldn't sign in. Try again.");
    return json.token;
}

/**
 * Sign in with Apple: iOS's own sheet, then Apple's ID token to Better Auth
 * (cencori lib/auth/better-auth.ts), which checks it against Apple's keys. The
 * nonce goes to Apple hashed and to Studio raw, so a token can't be replayed.
 * Apple gives the name only the first time, so it's passed along then.
 */
async function appleSignIn(): Promise<string | null> {
    const nonce = Array.from(Crypto.getRandomBytes(32), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce, { encoding: Crypto.CryptoEncoding.HEX });
    let credential: AppleAuthentication.AppleAuthenticationCredential;
    try {
        credential = await AppleAuthentication.signInAsync({
            requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
            nonce: hashed,
        });
    } catch (cause) {
        if ((cause as { code?: string }).code === "ERR_REQUEST_CANCELED") return null;
        throw new Error("Couldn't sign in with Apple. Try again.");
    }
    if (!credential.identityToken) throw new Error("Couldn't sign in with Apple. Try again.");
    const name = credential.fullName?.givenName || credential.fullName?.familyName
        ? { firstName: credential.fullName.givenName ?? undefined, lastName: credential.fullName.familyName ?? undefined }
        : undefined;
    const { token } = await authCall("sign-in/social", {
        provider: "apple",
        idToken: { token: credential.identityToken, nonce, ...(name || credential.email ? { user: { ...(name ? { name } : {}), ...(credential.email ? { email: credential.email } : {}) } } : {}) },
    });
    return token;
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
        // Better Auth's own sign-up and email OTP (cencori lib/auth/better-auth.ts): the account is
        // created unverified, the code is the web's, and verifying it signs in (autoSignInAfterVerification).
        signUp: async (email, password) => {
            await authCall("sign-up/email", { email, password, name: email.split("@")[0] });
            await authCall("email-otp/send-verification-otp", { email, type: "email-verification" });
        },
        sendSignUpCode: async (email) => void (await authCall("email-otp/send-verification-otp", { email, type: "email-verification" })),
        verifySignUp: async (email, code) => keep((await authCall("email-otp/verify-email", { email, otp: code })).token),
        signInWithProvider: async (provider) => {
            const next = await providerSignIn(provider);
            if (!next) return false;
            await keep(next);
            return true;
        },
        signInWithApple: async () => {
            const next = await appleSignIn();
            if (!next) return false;
            await keep(next);
            return true;
        },
        // Better Auth's phone-number plugin (cencori lib/auth/better-auth.ts): the code goes out on WhatsApp.
        sendPhoneCode: async (phoneNumber) => void (await authCall("phone-number/send-otp", { phoneNumber })),
        verifyPhoneCode: async (phoneNumber, code) => {
            const result = await authCall("phone-number/verify", { phoneNumber, code });
            if (!result.token) throw new Error("Couldn't sign in. Try again.");
            // A new account is named after its number until its owner says otherwise.
            return { token: result.token, isNew: !result.user?.name || result.user.name === phoneNumber };
        },
        keepSession: keep,
        verifySignUpCode: async (email, code) => {
            const result = await authCall("email-otp/verify-email", { email, otp: code });
            if (!result.token) throw new Error("Couldn't sign in. Try again.");
            return result.token;
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
