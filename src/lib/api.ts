import { useCallback } from "react";
import { fetch } from "expo/fetch";
import { API_URL } from "@/lib/config";
import { useSession } from "@/lib/session";

export class ApiError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
    }
}

/**
 * Calls to the Studio API as the signed-in owner. A 401 means the session is
 * gone (signed out elsewhere, or expired): the app signs out and shows sign-in.
 */
export function useApi() {
    const { token, signOut } = useSession();
    return useCallback(async <T,>(path: string, init?: { method?: string; body?: unknown; fallback?: string }): Promise<T> => {
        const response = await fetch(`${API_URL}${path}`, {
            method: init?.method ?? "GET",
            credentials: "omit",
            headers: {
                Accept: "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
            },
            ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
        }).catch(() => null);
        if (!response) throw new ApiError("Couldn't reach Studio. Check your connection and try again.", 0);
        const json = await response.json().catch(() => null);
        if (response.status === 401) {
            void signOut();
            throw new ApiError("Sign in again.", 401);
        }
        if (!response.ok) throw new ApiError((json as { error?: string } | null)?.error ?? init?.fallback ?? "That didn't work. Try again.", response.status);
        return json as T;
    }, [token, signOut]);
}
