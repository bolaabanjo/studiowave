import { useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import { CategoryChips, DESCRIPTION_LIMIT, DaysEditor, HoursModePicker, LocationFields, defaultDays, type HoursMode, type HoursSet } from "@/components/business-onboarding";
import { Button, ErrorText, Field, IconButton, KeyboardSafe, LoadError, PageTitle, Skeleton, T } from "@/ui/kit";
import { useColors } from "@/ui/theme";

type Profile = {
    categories: string[];
    hours: { mode: HoursMode; days: HoursSet[][] };
    address: string | null;
    no_location: boolean;
    website: string | null;
    description: string | null;
};

/**
 * The business's profile, to change: its name, categories, hours, where it
 * is, website and description, as set when it was created (cencori
 * /api/studio/business). Every staff member is told it, so a change reaches
 * customers on their next message.
 */
export default function BusinessProfile() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const api = useApi();
    const { workspace } = useWorkspace();
    const query = useQuery({
        queryKey: ["business-profile", workspace.project.id],
        queryFn: () => api<{ profile: Profile | null }>(`/api/studio/business?project_id=${workspace.project.id}`, { fallback: "Couldn't load your business profile." }),
    });
    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {query.data ? (
                <Form profile={query.data.profile} />
            ) : (
                <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16 }}>
                    <View style={{ marginLeft: -8 }}><IconButton name="chevron-left:lucide" label="Back" onPress={() => router.back()} /></View>
                    <PageTitle>Business profile</PageTitle>
                    {query.isLoading
                        ? <View style={{ marginTop: 16, gap: 12 }}>{[0, 1, 2].map((index) => <Skeleton key={index} height={64} radius={16} />)}</View>
                        : <LoadError error={query.error} fallback="Couldn't load your business profile." onRetry={() => void query.refetch()} />}
                </View>
            )}
        </View>
    );
}

function Form({ profile }: { profile: Profile | null }) {
    const insets = useSafeAreaInsets();
    const api = useApi();
    const queryClient = useQueryClient();
    const { workspace } = useWorkspace();
    const [name, setName] = useState(workspace.organization.name);
    const [categories, setCategories] = useState<string[]>(profile?.categories ?? []);
    const [mode, setMode] = useState<HoursMode>(profile?.hours.mode ?? "selected");
    // A business that was always open, or had none set, starts from Monday to Friday 9 to 6 if it switches to set hours.
    const [days, setDays] = useState<HoursSet[][]>(() => (profile?.hours.mode === "selected" && profile.hours.days.length === 7 ? profile.hours.days : defaultDays()));
    const [address, setAddress] = useState(profile?.address ?? "");
    const [noLocation, setNoLocation] = useState(profile?.no_location ?? false);
    const [website, setWebsite] = useState(profile?.website ?? "");
    const [description, setDescription] = useState(profile?.description ?? "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            const next = name.replace(/\s+/g, " ").trim();
            if (next && next !== workspace.organization.name) {
                await api("/api/studio/business", { method: "PATCH", body: { organization_id: workspace.organization.id, name: next }, fallback: "Couldn't rename the business." });
                void queryClient.invalidateQueries({ queryKey: ["workspace"] });
            }
            const body = { categories, hours: { mode, days }, address: noLocation ? null : address.trim() || null, no_location: noLocation, website: website.trim() || null, description: description.trim() || null };
            await api("/api/studio/business", { method: "PUT", body: { project_id: workspace.project.id, profile: body }, fallback: "Couldn't save your business profile." });
            void queryClient.invalidateQueries({ queryKey: ["business-profile", workspace.project.id] });
            router.back();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't save your business profile.");
            setBusy(false);
        }
    };

    return (
        <KeyboardSafe>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
                <View style={{ marginLeft: -8 }}><IconButton name="chevron-left:lucide" label="Back" onPress={() => router.back()} /></View>
                <PageTitle>Business profile</PageTitle>
                <T size={14} leading={22} muted style={{ marginTop: 4 }}>Your staff tell customers this, from their next message.</T>

                <Section title="Name">
                    <Field value={name} onChangeText={setName} maxLength={48} placeholder="Business name" autoCapitalize="words" />
                </Section>
                <Section title="What kind of business" hint="Up to 3">
                    <CategoryChips value={categories} onChange={setCategories} />
                </Section>
                <Section title="When you're open">
                    <HoursModePicker value={mode} onChange={setMode} />
                    {mode === "selected" ? <DaysEditor days={days} onChange={setDays} /> : null}
                </Section>
                <Section title="Where">
                    <LocationFields address={address} onAddress={setAddress} noLocation={noLocation} onNoLocation={setNoLocation} website={website} onWebsite={setWebsite} />
                </Section>
                <Section title="Description">
                    <Field value={description} onChangeText={(value) => setDescription(value.slice(0, DESCRIPTION_LIMIT))} multiline placeholder="What you do and why customers should choose you."
                        style={{ minHeight: 140, borderRadius: 20, paddingTop: 14, paddingBottom: 14, textAlignVertical: "top" }} />
                    <T size={12} muted style={{ marginTop: 6, textAlign: "right" }}>{description.length} / {DESCRIPTION_LIMIT}</T>
                </Section>
            </ScrollView>
            <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 16 }}>
                {error ? <ErrorText style={{ marginBottom: 8 }}>{error}</ErrorText> : null}
                <Button title="Save" busy={busy} disabled={!name.trim()} onPress={() => void save()} />
            </View>
        </KeyboardSafe>
    );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
    return (
        <View style={{ marginTop: 28 }}>
            <T size={13} weight="600" style={{ marginBottom: 10, paddingHorizontal: 4 }}>{title}{hint ? <T size={13} muted>{`  ${hint}`}</T> : null}</T>
            {children}
        </View>
    );
}
