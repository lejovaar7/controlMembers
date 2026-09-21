import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { CalendarDays, MapPin, Plus, Search, Settings2 } from "lucide-react";
import { CenteredDialog } from "@/components/centered-dialog";
import { PlanEditor } from "@/components/plan-editor";
import { SelectField } from "@/components/select-field";
import { LoadingButton } from "@/components/loading-button";
import { PlansSkeleton } from "@/components/content-skeleton";
import { StatusBadge } from "@/components/status-badge";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionDialog } from "@/hooks/use-action-dialog";
import { useAppShell } from "@/hooks/use-app-shell";
import { billingSetupApi, type BillingSettings, type Plan, type Tag } from "@/lib/billing-setup";
import { useI18n } from "@/lib/i18n";
import { currencyName, formatMoney } from "../../shared/i18n";

type Workspace = { settings: BillingSettings; plans: Plan[]; tags: Tag[] };

export function BillingSetupPage() {
	const shell = useAppShell();
	if (!(shell.organizationRole === "owner" || (shell.organizationRole === "admin" && shell.allBranches))) return <Navigate to="/app/dashboard" replace />;
	return <BillingSetupWorkspace key={`${shell.organizationId}:${shell.activeBranch?.id}`} />;
}

function BillingSetupWorkspace() {
	const { t } = useI18n();
	const shell = useAppShell();
	const [workspace, setWorkspace] = useState<Workspace | null>(null);
	const [failed, setFailed] = useState(false);
	const [revision, setRevision] = useState(0);
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState("");
	const [editor, setEditor] = useState<{ plan: Plan | null; trigger: HTMLElement } | null>(null);
	const [settingsTrigger, setSettingsTrigger] = useState<HTMLElement | null>(null);
	const [feedback, setFeedback] = useState<"Plan created." | "Plan updated." | "Billing settings saved." | null>(null);
	useEffect(() => {
		let active = true;
		void Promise.all([billingSetupApi.settings(shell.organizationId), billingSetupApi.plans(shell.organizationId)])
			.then(([settings, catalog]) => { if (active) setWorkspace({ settings, plans: catalog.plans, tags: catalog.tags }); })
			.catch(() => { if (active) setFailed(true); });
		return () => { active = false; };
	}, [shell.organizationId, revision]);
	function updatePlan(plan: Plan) {
		setWorkspace((current) => current ? { ...current, plans: [...current.plans.filter((item) => item.id !== plan.id), plan], tags: [...new Map([...current.tags, ...plan.tags].map((tag) => [tag.id, tag])).values()] } : current);
	}
	const plans = (workspace?.plans ?? []).filter((plan) => plan.branchIds.includes(shell.activeBranch?.id ?? ""));
	const query = search.trim().toLocaleLowerCase();
	const visiblePlans = plans.filter((plan) => (!status || (status === "active") === plan.isActive) && (!query || [plan.name, plan.description ?? "", ...plan.tags.map((tag) => tag.name)].some((value) => value.toLocaleLowerCase().includes(query))))
		.sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
	return <PageContainer className="space-y-6">
		<PageHeader title={t("Plans")} description={t("Manage monthly prices and plans for this branch.")} actions={<><Button variant="outline" disabled={!workspace?.settings.canEdit} onClick={(event) => setSettingsTrigger(event.currentTarget)}><Settings2 aria-hidden="true" />{t("Billing settings")}</Button><Button disabled={!workspace?.settings.currency} onClick={(event) => { setFeedback(null); setEditor({ plan: null, trigger: event.currentTarget }); }}><Plus aria-hidden="true" />{t("Add plan")}</Button></>} />
		{feedback ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{t(feedback)}</p> : null}
		{workspace && !workspace.settings.currency ? <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm text-amber-900">{t("Save billing settings before adding a plan.")}</p><Button variant="outline" disabled={!workspace.settings.canEdit} onClick={(event) => setSettingsTrigger(event.currentTarget)}>{t("Save billing settings")}</Button></div> : null}
		<div className="grid gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_220px]">
			<div className="grid gap-2"><Label htmlFor="plan-search">{t("Search plans")}</Label><div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="plan-search" className="pl-10" value={search} placeholder={t("Search by name or tag")} onChange={(event) => setSearch(event.target.value)} /></div></div>
			<div className="grid gap-2"><Label htmlFor="plan-status">{t("Status")}</Label><SelectField id="plan-status" value={status} onValueChange={setStatus} options={[{ value: "", label: t("All statuses") }, { value: "active", label: t("Active") }, { value: "inactive", label: t("Inactive") }]} /></div>
		</div>
		{failed ? <div role="alert" className="rounded-xl border bg-card p-5"><p>{t("We could not load plans.")}</p><Button className="mt-3" variant="outline" onClick={() => { setFailed(false); setWorkspace(null); setRevision((value) => value + 1); }}>{t("Try again")}</Button></div> : null}
		{!workspace && !failed ? <PlansSkeleton label={t("Loading plans…")} /> : null}
		{workspace ? <section className="space-y-4" aria-labelledby="plans-list-title">
			<div className="flex flex-wrap items-center justify-between gap-2"><h2 id="plans-list-title" className="text-base font-semibold">{t("Your plans")}</h2><p className="text-sm text-muted-foreground">{t(visiblePlans.length === 1 ? "{count} plan in {branch}" : "{count} plans in {branch}", { count: visiblePlans.length, branch: shell.activeBranch?.name ?? "" })}</p></div>
			{visiblePlans.length ? <ul className="grid items-stretch gap-4 md:grid-cols-2 2xl:grid-cols-3">{visiblePlans.map((plan) => <PlanCard key={plan.id} plan={plan} onUpdated={updatePlan} onEdit={(trigger) => { setFeedback(null); setEditor({ plan, trigger }); }} />)}</ul> : <div className="space-y-3 rounded-2xl border border-dashed bg-card px-5 py-12 text-center"><h3 className="text-lg font-semibold">{t(plans.length ? "No matching plans" : "No plans yet")}</h3><p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">{t(plans.length ? "Try another search or change the status filter." : "Create your first plan to define what members pay each month.")}</p>{plans.length ? <Button variant="outline" onClick={() => { setSearch(""); setStatus(""); }}>{t("Clear filters")}</Button> : <Button disabled={!workspace.settings.currency} onClick={(event) => setEditor({ plan: null, trigger: event.currentTarget })}><Plus aria-hidden="true" />{t("Add plan")}</Button>}</div>}
		</section> : null}
		{workspace && editor ? <PlanEditor plan={editor.plan} settings={workspace.settings} tags={workspace.tags} returnFocus={editor.trigger} onClose={() => setEditor(null)} onSaved={(plan) => { updatePlan(plan); setFeedback(editor.plan ? "Plan updated." : "Plan created."); setEditor(null); }} /> : null}
		{workspace && settingsTrigger ? <BillingSettingsDialog settings={workspace.settings} returnFocus={settingsTrigger} onClose={() => setSettingsTrigger(null)} onSaved={(settings) => { setWorkspace((current) => current ? { ...current, settings } : current); setSettingsTrigger(null); setFeedback("Billing settings saved."); }} /> : null}
	</PageContainer>;
}

function PlanCard({ plan, onUpdated, onEdit }: { plan: Plan; onUpdated: (plan: Plan) => void; onEdit: (trigger: HTMLElement) => void }) {
	const { locale, t } = useI18n();
	const shell = useAppShell();
	const { dialog, openDialog } = useActionDialog();
	const [pending, setPending] = useState(false);
	const [failed, setFailed] = useState(false);
	async function changeStatus() {
		if (plan.isActive) {
			openDialog({ title: t("Deactivate plan"), description: t("Deactivate {name}? Existing records will be kept.", { name: plan.name }), confirmLabel: t("Deactivate plan"), destructive: true,
				onConfirm: async () => { onUpdated(await billingSetupApi.updatePlan(shell.organizationId, plan.id, { isActive: false })); },
			});
			return;
		}
		setPending(true); setFailed(false);
		try { onUpdated(await billingSetupApi.updatePlan(shell.organizationId, plan.id, { isActive: true })); }
		catch { setFailed(true); }
		finally { setPending(false); }
	}
	return <li className="flex min-w-0 flex-col rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
		{dialog}
		<div className="flex items-start justify-between gap-3"><h3 className="min-w-0 text-base leading-6 font-semibold break-words">{plan.name}</h3><div className="shrink-0"><StatusBadge tone={plan.isActive ? "success" : "neutral"}>{t(plan.isActive ? "Active" : "Inactive")}</StatusBadge></div></div>
		{plan.description ? <p className="mt-2 text-sm leading-6 break-words text-muted-foreground">{plan.description}</p> : null}
		<p className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1"><strong className="text-2xl font-semibold tracking-tight tabular-nums">{formatMoney(locale, plan.amountMinor, plan.currency)}</strong><span className="text-sm text-muted-foreground">{t("per month")}</span></p>
		<div className="mt-4 space-y-3 text-sm text-muted-foreground"><p className="flex items-center gap-2"><CalendarDays className="size-4 shrink-0" aria-hidden="true" />{t("Payment date chosen at enrollment")}</p><div className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><p className="min-w-0 break-words"><span className="sr-only">{t("Available at branches")}: </span>{shell.branches.filter((branch) => plan.branchIds.includes(branch.id)).map((branch) => branch.name).join(", ")}</p></div></div>
		{plan.tags.length ? <div className="mt-4 flex flex-wrap gap-2">{plan.tags.map((tag) => <span key={tag.id} className="max-w-full rounded-md bg-muted px-2 py-1 text-xs break-words text-muted-foreground">{tag.name}</span>)}</div> : null}
		{failed ? <p role="alert" className="mt-4 text-sm text-destructive">{t("We could not update the plan.")}</p> : null}
		<div className="mt-auto pt-5"><div className="flex flex-wrap gap-2 border-t pt-4"><Button className="flex-1" variant="outline" disabled={pending} onClick={(event) => onEdit(event.currentTarget)}>{t("Edit plan")}</Button><LoadingButton className="flex-1" variant="ghost" loading={pending} disabled={pending} onClick={changeStatus}>{t(plan.isActive ? "Deactivate plan" : "Activate plan")}</LoadingButton></div></div>
	</li>;
}

function BillingSettingsDialog({ settings, returnFocus, onClose, onSaved }: { settings: BillingSettings; returnFocus: HTMLElement; onClose: () => void; onSaved: (settings: BillingSettings) => void }) {
	const { locale, t } = useI18n();
	const shell = useAppShell();
	const [currency, setCurrency] = useState(settings.currency ?? "COP");
	const [timezone, setTimezone] = useState(settings.timezone ?? "America/Bogota");
	const [pending, setPending] = useState(false);
	const [failed, setFailed] = useState(false);
	const intl = Intl as typeof Intl & { supportedValuesOf?: (key: "currency") => string[] };
	const currencies = [...new Set([currency, ...(intl.supportedValuesOf?.("currency") ?? ["COP", "USD", "EUR", "MXN", "ARS", "CLP", "PEN", "BRL", "GBP", "CAD"])])];
	async function submit(event: FormEvent) {
		event.preventDefault(); setPending(true); setFailed(false);
		try { onSaved(await billingSetupApi.saveSettings(shell.organizationId, currency, timezone)); }
		catch { setFailed(true); }
		finally { setPending(false); }
	}
	return <CenteredDialog open title={t("Billing settings")} description={t("Currency and timezone apply to every branch of your company.")} pending={pending} returnFocus={returnFocus} onClose={onClose}><form onSubmit={submit} className="space-y-5 px-5 pt-5 pb-6 sm:px-7 sm:pb-7"><fieldset disabled={pending} className="min-w-0 space-y-4"><div className="grid gap-2"><Label htmlFor="billing-currency">{t("Currency")}</Label><SelectField id="billing-currency" value={currency} onValueChange={setCurrency} required options={currencies.map((code) => ({ value: code, label: currencyName(locale, code) })).sort((a, b) => a.label.localeCompare(b.label, locale))} /></div><div className="grid gap-2"><Label htmlFor="billing-timezone">{t("Timezone")}</Label><Input id="billing-timezone" value={timezone} maxLength={100} onChange={(event) => setTimezone(event.target.value)} required /></div></fieldset>{failed ? <p role="alert" className="text-sm text-destructive">{t("We could not save billing settings.")}</p> : null}<div className="flex flex-wrap justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={pending} onClick={onClose}>{t("Cancel")}</Button><LoadingButton type="submit" loading={pending} loadingLabel={t("Saving…")} disabled={pending}>{t("Save changes")}</LoadingButton></div></form></CenteredDialog>;
}
