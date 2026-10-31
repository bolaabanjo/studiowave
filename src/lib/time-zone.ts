import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useOverview } from "@/lib/queries";

/**
 * The business's time zone (cencori lib/studio/business-zone.ts): event times
 * are shown and picked in it, whatever zone the phone is in. A business nobody
 * chose a zone for takes the owner's phone's, the first time they open the app.
 */

export const DEFAULT_TIME_ZONE = "Africa/Lagos";

/** The phone's IANA time zone ("Europe/London"), or nothing when the runtime can't say. */
export function deviceTimeZone(): string | undefined {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
    } catch {
        return undefined;
    }
}

/** The business's zone, once the overview has it (null until then: a form that types times waits for it). */
export function useBusinessTimeZone(): string | null {
    return useOverview().data?.time_zone ?? null;
}

/** "Africa/Lagos" → "Lagos", "America/New_York" → "New York". */
export function zoneCity(timeZone: string): string {
    if (timeZone === "UTC" || timeZone === "Etc/UTC") return "UTC";
    return (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ");
}

/** Once per business per launch: a business with no zone set takes this phone's. */
export function useAdoptTimeZone(projectId: string | null) {
    const api = useApi();
    const queryClient = useQueryClient();
    useEffect(() => {
        const zone = deviceTimeZone();
        if (!zone || !projectId) return;
        void api<{ adopted?: boolean }>("/api/studio/time-zone", { method: "POST", body: { project_id: projectId, time_zone: zone } })
            .then((body) => { if (body?.adopted) void queryClient.invalidateQueries(); })
            .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per business: api changes identity with the token
    }, [projectId]);
}
