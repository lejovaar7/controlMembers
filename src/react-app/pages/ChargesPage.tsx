import { WhatsAppReminderDialog } from "@/components/whatsapp-reminder-dialog";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { SelectField } from "@/components/select-field";
import { useActionDialog } from "@/hooks/use-action-dialog";
import { MonthPicker } from "@/components/date-picker";
import { currencyName } from "../../shared/i18n";
import { ChargesTable } from "@/components/charges-table";
import { LoadingButton } from "@/components/loading-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppShell } from "@/hooks/use-app-shell";
import { usePagedDirectory } from "@/hooks/use-paged-directory";
import { controlMembersApi, type Charge } from "@/lib/controlmembers";
import { billingSetupApi, type Plan } from "@/lib/billing-setup";
import { useI18n } from "@/lib/i18n";

export function ChargesPage({ revision, onPay }: { revision: number; onPay: (charge: Charge, trigger: HTMLElement) => void }) {
	const { dialog, openDialog } = useActionDialog();
	const [reminder, setReminder] = useState<{ charge: Charge; trigger: HTMLElement } | null>(null);
	const { locale, t } = useI18n(); const shell = useAppShell();
	const [params, setParams] = useSearchParams();
	const period = params.get("period") ?? ""; const state = params.get("state") || "all";
	const planId = params.get("planId") ?? ""; const tag = params.get("tag") ?? ""; const search = params.get("search") ?? "";
	const [plans, setPlans] = useState<Plan[]>([]); const [plansFailed, setPlansFailed] = useState(false); const [catalogRevision, setCatalogRevision] = useState(0);
	const load = useCallback(async (offset: number, signal: AbortSignal) => {
		void revision;
		const result = await controlMembersApi.charges(shell.organizationId, period, state === "all" ? "" : state, offset, { planId, tag, search, branchId: shell.activeBranch?.id }, signal);
		return { rows: result.charges, nextOffset: result.nextOffset };
	}, [shell.organizationId, shell.activeBranch?.id, period, state, planId, tag, search, revision]);
	const list = usePagedDirectory(load);
	function syncUrl(next: Record<string, string>) { const query = new URLSearchParams(params); for (const [key, value] of Object.entries(next)) { if (value) query.set(key, value); else query.delete(key); } setParams(query, { replace: true }); }
	useEffect(() => { let active = true; void billingSetupApi.plans(shell.organizationId).then((result) => { if (active) { setPlans(result.plans); setPlansFailed(false); } }).catch(() => { if (active) setPlansFailed(true); }); return () => { active = false; }; }, [shell.organizationId, catalogRevision]);
	function adjust(item: Charge) {
		openDialog({ title: t("Adjust charge"), description: t("Update the adjustment for {name} · {plan}.", { name: item.memberName, plan: item.planName }), confirmLabel: t("Save changes"),
			fields: [{ name: "amount", label: t("New adjustment amount in {currency}", { currency: currencyName(locale, item.currency) }), type: "money", defaultValue: String(item.adjustmentMinor / 100), min: -(item.totalMinor - item.adjustmentMinor) / 100, step: 0.01 }, { name: "reason", label: t("Reason for this adjustment"), type: "textarea" }],
			onConfirm: async ({ amount, reason }) => { await controlMembersApi.adjustCharge(shell.organizationId, item.id, Math.round(Number(amount) * 100), reason); list.reload(); },
		});
	}
	function voidItem(item: Charge) {
		openDialog({ title: t("Void charge"), description: t("Void the charge for {name}? This cannot receive payments afterward.", { name: item.memberName }), confirmLabel: t("Void charge"), destructive: true,
			fields: [{ name: "reason", label: t("Reason for voiding this charge"), type: "textarea" }],
			onConfirm: async ({ reason }) => { await controlMembersApi.voidCharge(shell.organizationId, item.id, reason); list.reload(); },
		});
	}
	const tags = [...new Set(plans.flatMap((plan) => plan.tags.map((item) => item.name)))].sort();
	return <div className="space-y-5">{dialog}
		{reminder ? <WhatsAppReminderDialog key={shell.organizationId + (shell.activeBranch?.id ?? "") + reminder.charge.id} chargeId={reminder.charge.id} returnFocus={reminder.trigger} onClose={(refresh) => { setReminder(null); if (refresh) list.reload(); }} /> : null}
		<div className="flex flex-wrap gap-2" aria-label={t("Payment status")}><Button variant={state === "unpaid" ? "default" : "outline"} aria-pressed={state === "unpaid"} onClick={() => syncUrl({ state: "unpaid", period: "" })}>{t("To collect")}</Button><Button variant={state === "overdue" ? "default" : "outline"} aria-pressed={state === "overdue"} onClick={() => syncUrl({ state: "overdue", period: "" })}>{t("Overdue accounts")}</Button></div>
		<div className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
			<div className="grid gap-2"><Label htmlFor="charge-search">{t("Search")}</Label><Input id="charge-search" value={search} placeholder={t("Member or plan")} onChange={(event) => syncUrl({ search: event.target.value })} /></div>
			<div className="grid gap-2"><Label htmlFor="charge-period">{t("Billing period")}</Label><div className="flex gap-2"><div className="min-w-0 flex-1"><MonthPicker id="charge-period" label={t("Billing period")} emptyLabel={t("All months")} value={period} onChange={(value) => syncUrl({ period: value })} /></div>{period ? <Button variant="ghost" onClick={() => syncUrl({ period: "" })}>{t("All months")}</Button> : null}</div></div>
			<div className="grid gap-2"><Label htmlFor="charge-state">{t("Payment status")}</Label><SelectField id="charge-state" value={state} onValueChange={(value) => syncUrl({ state: value })} options={[{ value: "unpaid", label: t("To collect") }, { value: "all", label: t("All statuses") }, { value: "pending", label: t("Pending") }, { value: "overdue", label: t("Overdue accounts") }, { value: "partial", label: t("Partially paid") }, { value: "paid", label: t("Paid") }, { value: "void", label: t("Void") }]} /></div>
			<div className="grid gap-2"><Label htmlFor="charge-plan">{t("Plan")}</Label><SelectField id="charge-plan" value={planId} onValueChange={(value) => syncUrl({ planId: value })} options={[{ value: "", label: t("All plans") }, ...plans.map((plan) => ({ value: plan.id, label: plan.name }))]} /></div>
			{tags.length ? <div className="grid gap-2"><Label htmlFor="charge-tag">{t("Tag")}</Label><SelectField id="charge-tag" value={tag} onValueChange={(value) => syncUrl({ tag: value })} options={[{ value: "", label: t("All tags") }, ...tags.map((name) => ({ value: name, label: name }))]} /></div> : null}
		</div>
		{plansFailed ? <div role="alert" className="flex flex-wrap items-center gap-3"><p>{t("We could not load or update charges.")}</p><Button variant="outline" onClick={() => setCatalogRevision((value) => value + 1)}>{t("Try again")}</Button></div> : null}
		{list.failed ? <div role="alert" className="flex flex-wrap items-center gap-3"><p>{t("We could not load or update charges.")}</p><Button variant="outline" onClick={list.reload}>{t("Try again")}</Button></div> : list.loading || list.rows.length ? <ChargesTable charges={list.rows} loading={list.loading} canAdjust={shell.canAdjustCharges} onAdjust={adjust} onVoid={voidItem} onPay={onPay} onRemind={(charge, trigger) => setReminder({ charge, trigger })} /> : <div className="rounded-2xl border border-dashed p-8 text-center"><p>{t("No fees match these filters.")}</p><Button className="mt-3" variant="outline" onClick={() => setParams({ state: "all" })}>{t("Clear filters")}</Button></div>}
		{list.moreFailed ? <p role="alert">{t("We could not load the next results.")}</p> : null}
		{list.nextOffset !== null ? <LoadingButton variant="outline" loading={list.morePending} onClick={() => void list.loadMore()}>{t("Load more")}</LoadingButton> : null}
	</div>;
}
