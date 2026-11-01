import { router } from "expo-router";

/**
 * Back a screen, or, with nothing behind (opened from a notification or a
 * link, or after a reload), to where it belongs: Home when signed in, the
 * sign-in screen when not. A bare router.back() there is "GO_BACK was not
 * handled by any navigator".
 */
export function goBack(fallback: "/" | "/sign-in" = "/"): void {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
}
