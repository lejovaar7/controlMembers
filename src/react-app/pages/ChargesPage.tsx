import { SelectField } from "@/components/select-field";
import { useActionDialog } from "@/hooks/use-action-dialog";
import { MonthPicker } from "@/components/date-picker";
import { currencyName } from "../../shared/i18n";
import { ChargesTable } from "@/components/charges-table";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppShell } from "@/hooks/use-app-shell";
import { controlMembersApi, currentPeriod, type Charge } from "@/lib/controlmembers";
import { billingSetupApi, type Plan } from "@/lib/billing-setup";
import { useI18n, useT } from "@/lib/i18n";

export function ChargesPage() {
	const { dialog, openDialog } = useActionDialog();
	const t = useT(); const { locale } = useI18n(); const shell = useAppShell();
	const [searchParams, setSearchParams] = useSearchParams();
	const [period, setPeriod] = useState(searchParams.get("period") || currentPeriod()); const [state, setState] = useState(searchParams.get("state") || ""); const branchId = shell.activeBranch?.id ?? ""; const [planId, setPlanId] = useState(searchParams.get("planId") || ""); const [tag, setTag] = useState(searchParams.get("tag") || ""); const [search, setSearch] = useState(searchParams.get("search") || ""); const [plans, setPlans] = useState<Plan[]>([]); const [charges, setCharges] = useState<Charge[]>([]); const [nextOffset, setNextOffset] = useState<number | null>(null); const [loading, setLoading] = useState(true); const [failed, setFailed] = useState(false); const [message, setMessage] = useState<string | null>(null); const [revision, setRevision] = useState(0);
	const filterValues = useMemo(() => ({ ...(branchId ? { branchId } : {}), ...(planId ? { planId } : {}), ...(tag ? { tag } : {}), ...(search ? { search } : {}) }), [branchId, planId, search, tag]);
	function syncUrl(next: { period?: string; state?: string; branchId?: string; planId?: string; tag?: string; search?: string }) { const values = { period, state, branchId, planId, tag, search, ...next }; const query = new URLSearchParams(); for (const [key, value] of Object.entries(values)) if (value) query.set(key, value); setSearchParams(query, { replace: true }); }
	useEffect(() => { void billingSetupApi.plans(shell.organizationId).then((result) => setPlans(result.plans)).catch(() => setFailed(true)); }, [shell.organizationId]);
	useEffect(() => { const timer = window.setTimeout(() => { void controlMembersApi.charges(shell.organizationId, period, state, 0, filterValues).then((result) => { setCharges(result.charges); setNextOffset(result.nextOffset); setFailed(false); }).catch(() => setFailed(true)).finally(() => setLoading(false)); }, 200); return () => window.clearTimeout(timer); }, [filterValues, period, revision, shell.organizationId, state]);
	async function loadMore() { if (nextOffset === null) return; const result = await controlMembersApi.charges(shell.organizationId, period, state, nextOffset, filterValues); setCharges((current) => [...current, ...result.charges]); setNextOffset(result.nextOffset); }
	async function generate() {
		try {
			const preview = await controlMembersApi.previewChargeGeneration(shell.organizationId, period);
			openDialog({ title: t("Generate monthly charges"), description: t("Generate {count} missing charges for {period}? {existing} already exist and will not change.", { count: preview.willCreate, period, existing: preview.alreadyExisting }), confirmLabel: t("Generate monthly charges"),
				onConfirm: async () => { const result = await controlMembersApi.generateCharges(shell.organizationId, period); setMessage(t("Created: {created}. Already existed: {existing}.", { created: result.created, existing: result.alreadyExisting })); setRevision((value) => value + 1); },
			});
		} catch { setFailed(true); }
	}
	function adjust(item: Charge) {
		openDialog({ title: t("Adjust charge"), description: t("Update the adjustment for {name} · {plan}.", { name: item.memberName, plan: item.planName }), confirmLabel: t("Save changes"),
			fields: [{ name: "amount", label: t("New adjustment amount in {currency}", { currency: currencyName(locale, item.currency) }), type: "money", defaultValue: String(item.adjustmentMinor / 100), min: -(item.totalMinor - item.adjustmentMinor) / 100, step: 0.01 }, { name: "reason", label: t("Reason for this adjustment"), type: "textarea" }],
			onConfirm: async ({ amount, reason }) => { await controlMembersApi.adjustCharge(shell.organizationId, item.id, Math.round(Number(amount) * 100), reason); setRevision((value) => value + 1); },
		});
	}
	function voidItem(item: Charge) {
		openDialog({ title: t("Void charge"), description: t("Void the charge for {name}? This cannot receive payments afterward.", { name: item.memberName }), confirmLabel: t("Void charge"), destructive: true,
			fields: [{ name: "reason", label: t("Reason for voiding this charge"), type: "textarea" }],
			onConfirm: async ({ reason }) => { await controlMembersApi.voidCharge(shell.organizationId, item.id, reason); setRevision((value) => value + 1); },
		});
	}
	const tags = [...new Set(plans.flatMap((plan) => plan.tags.map((item) => item.name)))].sort();
	return <PageContainer className="space-y-6">{dialog}<PageHeader title={t("Charges")} description={t("Monthly amounts expected from members and their payment status.")} actions={["owner", "admin"].includes(shell.organizationRole ?? "") ? <Button onClick={() => void generate()}>{t("Generate monthly charges")}</Button> : null} /><div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4"><div className="grid gap-2"><Label htmlFor="charge-search">{t("Search")}</Label><Input id="charge-search" value={search} placeholder={t("Member or plan")} onChange={(event) => { setSearch(event.target.value); syncUrl({ search: event.target.value }); }} /></div><div className="grid gap-2"><Label htmlFor="charge-period">{t("Billing period")}</Label><MonthPicker id="charge-period" label={t("Billing period")} value={period} onChange={(value) => { setPeriod(value); syncUrl({ period: value }); }} /></div><div className="grid gap-2"><Label htmlFor="charge-state">{t("Payment status")}</Label><SelectField id="charge-state" className="h-11 rounded-md border bg-background px-3" value={state} onValueChange={(value) => { setState(value); syncUrl({ state: value }); }} options={[{ value: "", label: t("All statuses") }, { value: "pending", label: t("Pending") }, { value: "overdue", label: t("Overdue") }, { value: "partial", label: t("Partially paid") }, { value: "paid", label: t("Paid") }, { value: "void", label: t("Void") }]} /></div><div className="grid gap-2"><Label htmlFor="charge-plan">{t("Plan")}</Label><SelectField id="charge-plan" className="h-11 rounded-md border bg-background px-3" value={planId} onValueChange={(value) => { setPlanId(value); syncUrl({ planId: value }); }} options={[{ value: "", label: t("All plans") }, ...plans.map((plan) => ({ value: plan.id, label: plan.name }))]} /></div>{tags.length ? <div className="grid gap-2"><Label htmlFor="charge-tag">{t("Tag")}</Label><SelectField id="charge-tag" className="h-11 rounded-md border bg-background px-3" value={tag} onValueChange={(value) => { setTag(value); syncUrl({ tag: value }); }} options={[{ value: "", label: t("All tags") }, ...tags.map((name) => ({ value: name, label: name }))]} /></div> : null}</div>{message ? <p role="status" className="rounded-lg bg-muted p-3 text-sm">{message}</p> : null}{failed ? <p role="alert">{t("We could not load or update charges.")}</p> : null}{loading ? <ChargesTable charges={[]} loading canAdjust={shell.canAdjustCharges} onAdjust={adjust} onVoid={voidItem} /> : null}{!loading && !failed && !charges.length ? <div className="rounded-xl border border-dashed p-8 text-center"><h2 className="font-semibold">{t("No charges in this period")}</h2><p className="text-sm text-muted-foreground">{t("Create members and enrollments, then generate monthly charges.")}</p></div> : !loading && !failed ? <ChargesTable charges={charges} canAdjust={shell.canAdjustCharges} onAdjust={adjust} onVoid={voidItem} /> : null}{nextOffset !== null && !loading ? <Button variant="outline" onClick={() => void loadMore()}>{t("Load more")}</Button> : null}</PageContainer>;
}
