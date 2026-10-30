import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import type { StudioWorkspace } from "@/lib/types";

/**
 * The business the app shows. The server picks the default; the owner's own
 * pick (for people in more than one business) is kept on the phone and sent
 * with each workspace load.
 */

const PICK_KEY = "studio.organization";

interface WorkspaceValue {
    workspace: StudioWorkspace;
    choose(organizationId: string): Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function useWorkspaceQuery() {
    const api = useApi();
    const [picked, setPicked] = useState<string | null | undefined>(undefined);
    useEffect(() => {
        SecureStore.getItemAsync(PICK_KEY).then(setPicked).catch(() => setPicked(null));
    }, []);
    const query = useQuery({
        queryKey: ["workspace", picked ?? null],
        enabled: picked !== undefined,
        queryFn: () => api<{ workspace: StudioWorkspace | null }>(`/api/studio/workspace${picked ? `?organization_id=${picked}` : ""}`, { fallback: "Couldn't load your business." }),
    });
    const choose = useCallback(async (organizationId: string) => {
        await SecureStore.setItemAsync(PICK_KEY, organizationId);
        setPicked(organizationId);
    }, []);
    return { query, choose };
}

export function WorkspaceProvider({ workspace, choose, children }: WorkspaceValue & { children: ReactNode }) {
    const queryClient = useQueryClient();
    const switchTo = useCallback(async (organizationId: string) => {
        await choose(organizationId);
        // Everything below belongs to the business that was showing.
        queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "workspace" });
    }, [choose, queryClient]);
    return <WorkspaceContext.Provider value={{ workspace, choose: switchTo }}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
    const value = useContext(WorkspaceContext);
    if (!value) throw new Error("useWorkspace outside WorkspaceProvider");
    return value;
}
