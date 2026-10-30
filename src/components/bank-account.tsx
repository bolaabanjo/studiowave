import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useRefreshMoney } from "@/lib/queries";
import { useWorkspace } from "@/lib/workspace";
import type { BankAccount } from "@/lib/types";
import { Icon } from "@/ui/icons";
import { BankLogo, Button, ErrorText, Field, Sheet, SheetHeader, Spinner, T } from "@/ui/kit";
import { alpha, palette, useColors } from "@/ui/theme";

type Bank = { name: string; also: string[]; popular: boolean; logo: string | null };
type Lookup = "idle" | "checking" | "found" | "not_found" | "unknown_bank" | "unavailable";

const empty: BankAccount = { bank: "", account_number: "", account_name: "" };

/**
 * The business's own account for transfers: the bank (suggested as it's
 * typed), the number, and the name, filled in by the bank once the number is
 * complete (cencori components/studio/StudioTransfers.tsx, BankAccountSheet).
 */
export function BankAccountSheet({ account, isMain, count, open, onClose }: { account: BankAccount | null; isMain: boolean; count: number; open: boolean; onClose: () => void }) {
    const colors = useColors();
    const api = useApi();
    const projectId = useWorkspace().workspace.project.id;
    const refresh = useRefreshMoney();
    // Opened fresh for each account (GetPaidCard keys the sheet by it): that account, or empty.
    const [form, setForm] = useState<BankAccount>(() => (account ? { bank: account.bank, account_number: account.account_number, account_name: account.account_name } : empty));
    const done = () => { refresh(); onClose(); };
    const save = useMutation({
        mutationFn: () => api("/api/studio/transfers", { method: "PUT", body: { project_id: projectId, bank: form.bank, account_number: form.account_number, account_name: form.account_name, ...(account?.id ? { id: account.id } : {}) } }),
        onSuccess: done,
    });
    const remove = useMutation({
        mutationFn: () => api(`/api/studio/transfers?project_id=${projectId}${account?.id ? `&id=${account.id}` : ""}`, { method: "DELETE" }),
        onSuccess: done,
    });
    const makeMain = useMutation({
        mutationFn: () => api("/api/studio/transfers", { method: "POST", body: { project_id: projectId, action: "main", id: account?.id } }),
        onSuccess: done,
    });
    const error = save.error ?? remove.error ?? makeMain.error;

    // Banks, suggested as the owner types: names and nicknames (GTB, UBA), best match first.
    // Loaded when the sheet opens, and kept; tried again on typing if that didn't work.
    const bankList = useQuery({
        queryKey: ["banks", projectId],
        queryFn: () => api<{ banks?: Bank[] }>(`/api/studio/transfers/banks?project_id=${projectId}`),
        enabled: open,
        staleTime: Infinity,
        retry: false,
    });
    const banks = bankList.data?.banks ?? [];
    const loadingBanks = bankList.isFetching;
    const [picking, setPicking] = useState(false);
    useEffect(() => {
        if (open && bankList.isError && form.bank.trim().length >= 2 && !bankList.isFetching) void bankList.refetch();
    }, [open, form.bank, bankList]);
    const chosenBank = banks.find((bank) => bank.name.toLowerCase() === form.bank.trim().toLowerCase()) ?? null;
    const query = form.bank.trim().toLowerCase();
    const suggestions = query.length < 2 || banks.some((bank) => bank.name === form.bank) ? [] : banks
        .map((bank) => {
            const name = bank.name.toLowerCase();
            const words = name.split(/[^a-z0-9]+/);
            const match = bank.also.some((nick) => nick === query) ? 0 : name.startsWith(query) || bank.also.some((nick) => nick.startsWith(query)) ? 1 : words.some((word) => word.startsWith(query)) ? 2 : name.includes(query) ? 3 : 9;
            // The banks and apps most people use go first among equal matches ("op": OPay before Optimus).
            return { ...bank, score: match === 9 ? 9 : match - (bank.popular ? 0.5 : 0) };
        })
        .filter((bank) => bank.score < 9)
        .sort((a, b) => a.score - b.score || a.name.length - b.name.length)
        .slice(0, 6);

    // Name enquiry: with a bank and all 10 digits, ask the bank whose account it is and fill the name in.
    // An account already saved and unchanged doesn't need checking again.
    const lookupKey = `${form.bank}|${form.account_number}`;
    const checkable = open && !!form.bank.trim() && form.account_number.length === 10 && !(account && account.bank === form.bank && account.account_number === form.account_number);
    const [checked, setChecked] = useState<{ key: string; status: Lookup } | null>(null);
    const lookup: Lookup = !checkable ? "idle" : checked?.key === lookupKey ? checked.status : "checking";
    const setLookup = (status: Lookup) => setChecked({ key: lookupKey, status });
    useEffect(() => {
        if (!checkable) return;
        let stale = false;
        const timer = setTimeout(async () => {
            try {
                const result = await api<{ ok: true; name: string } | { ok: false; reason: "not_found" | "unknown_bank" | "unavailable" }>(`/api/studio/transfers/resolve?project_id=${projectId}&bank=${encodeURIComponent(form.bank)}&account_number=${form.account_number}`);
                if (stale) return;
                if (result.ok) setForm((current) => ({ ...current, account_name: result.name }));
                setChecked({ key: lookupKey, status: result.ok ? "found" : result.reason });
            } catch {
                if (!stale) setChecked({ key: lookupKey, status: "unavailable" });
            }
        }, 350);
        return () => {
            stale = true;
            clearTimeout(timer);
        };
    }, [checkable, lookupKey, form.bank, form.account_number, projectId, api]);

    const line = { borderTopWidth: 1, borderTopColor: alpha(colors.border, 0.6) };
    return (
        <Sheet open={open} onClose={onClose}>
            <SheetHeader
                title={account ? (isMain && count > 1 ? "Main account" : "Your account") : count ? "Add another account" : "Add your account"}
                onClose={onClose}
                description="Customers send money straight to this account. You confirm it in Money once you see it."
            />
            <View style={{ marginTop: 16, flex: 1, gap: 12 }}>
                {/* One card: the bank (with its suggestions under it), the number, the name. */}
                <View style={{ overflow: "hidden", borderRadius: 16, backgroundColor: colors.muted }}>
                    <View>
                        {chosenBank ? <View style={{ position: "absolute", left: 12, top: 8, zIndex: 1 }}><BankLogo name={chosenBank.name} logo={chosenBank.logo} size={32} /></View> : null}
                        <Field flat value={form.bank} onChangeText={(bank) => { setForm({ ...form, bank }); setPicking(true); }} onFocus={() => setPicking(true)} placeholder="Bank Name" accessibilityLabel="Bank name" autoCorrect={false} style={chosenBank ? { paddingLeft: 56 } : undefined} />
                    </View>
                    {picking && form.bank.trim().length >= 2 && !banks.length ? (
                        <View style={[line, { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12 }]}>
                            {loadingBanks ? <><Spinner /><T size={13} muted>Loading banks…</T></> : <T size={13} muted>Couldn&apos;t load the list. Type your bank&apos;s full name.</T>}
                        </View>
                    ) : null}
                    {picking ? suggestions.map((bank) => (
                        <Pressable key={bank.name} onPress={() => { setForm({ ...form, bank: bank.name }); setPicking(false); }} style={[line, { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: alpha(colors.background, 0.4), paddingHorizontal: 16, paddingVertical: 10 }]}>
                            <BankLogo name={bank.name} logo={bank.logo} size={32} />
                            <T style={{ flex: 1 }}>{bank.name}</T>
                        </Pressable>
                    )) : null}
                    <View style={line}>
                        <Field flat value={form.account_number} onChangeText={(value) => setForm({ ...form, account_number: value.replace(/\D/g, "").slice(0, 10) })} keyboardType="number-pad" placeholder="Account Number" accessibilityLabel="Account number" onFocus={() => setPicking(false)} />
                    </View>
                    <View style={[line, { justifyContent: "center" }]}>
                        <Field flat value={form.account_name} onChangeText={(value) => { setForm({ ...form, account_name: value }); if (lookup === "found") setLookup("idle"); }} placeholder={lookup === "checking" ? "Checking…" : "Name on Account"} accessibilityLabel="Name on account" style={{ paddingRight: 48 }} onFocus={() => setPicking(false)} />
                        {lookup === "checking" ? <View style={{ position: "absolute", right: 20 }}><Spinner /></View> : null}
                        {/* The bank confirmed this name. */}
                        {lookup === "found" ? <View style={{ position: "absolute", right: 16 }} accessibilityLabel="Confirmed by your bank"><Icon name="verified-check" size={22} color={palette.emerald500} /></View> : null}
                    </View>
                </View>
                {lookup === "not_found" ? <T size={12} color={colors.destructive} style={{ marginTop: -4, paddingLeft: 20 }}>We couldn&apos;t find that account. Check the number and the bank.</T> : null}
                {lookup === "unknown_bank" ? <T size={12} muted style={{ marginTop: -4, paddingLeft: 20 }}>We don&apos;t know that bank. Pick one from the list, or type the name yourself.</T> : null}
                {lookup === "unavailable" ? <T size={12} muted style={{ marginTop: -4, paddingLeft: 20 }}>Couldn&apos;t check with the bank right now. Type the name as it is on the account.</T> : null}
                {error ? <ErrorText>{error.message}</ErrorText> : null}
                <View style={{ flex: 1 }} />
                <Button title={save.isPending ? "Saving…" : "Save"} disabled={save.isPending} onPress={() => save.mutate()} />
                {account ? (
                    <View style={{ flexDirection: "row", justifyContent: "center", gap: 24 }}>
                        {count > 1 && !isMain ? <Pressable disabled={makeMain.isPending} onPress={() => makeMain.mutate()} style={{ height: 40, justifyContent: "center" }}><T size={14} weight="600">Make main</T></Pressable> : null}
                        <Pressable disabled={remove.isPending} onPress={() => remove.mutate()} style={{ height: 40, justifyContent: "center" }}><T size={14} muted>{count > 1 ? "Remove account" : "Stop taking transfers"}</T></Pressable>
                    </View>
                ) : null}
            </View>
        </Sheet>
    );
}
