import { formatMoney, currencyName } from "../../shared/i18n";
import { LoadingButton } from "@/components/loading-button";
import { FormSkeleton } from "@/components/content-skeleton";
import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { Navigate } from "react-router";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppShell } from "@/hooks/use-app-shell";
import { billingSetupApi, type BillingSettings, type Plan, type Tag } from "@/lib/billing-setup";
import { useI18n, useT } from "@/lib/i18n";

type Workspace = { settings: BillingSettings; plans: Plan[]; tags: Tag[] };

function availableCurrencies(current: string) {
	const intl = Intl as typeof Intl & { supportedValuesOf?: (key: "currency") => string[] };
	return [...new Set([current, ...(intl.supportedValuesOf?.("currency") ?? ["COP", "USD", "EUR", "MXN", "ARS", "CLP", "PEN", "BRL", "GBP", "CAD"])])];
}

export function BillingSetupPage() {
	const shell = useAppShell();
	if (!(shell.organizationRole === "owner" || (shell.organizationRole === "admin" && shell.allBranches))) {
		return <Navigate to="/app/dashboard" replace />;
	}
	return <BillingSetupWorkspace key={shell.organizationId} />;
}

function BillingSetupWorkspace() {
	const t = useT();
	const shell = useAppShell();
	const [workspace, setWorkspace] = useState<Workspace | null>(null);
	const [failed, setFailed] = useState(false);
	const [revision, setRevision] = useState(0);

	useEffect(() => {
		const controller = new AbortController();
		Promise.all([billingSetupApi.settings(shell.organizationId), billingSetupApi.plans(shell.organizationId)])
			.then(([settings, catalog]) => {
				if (!controller.signal.aborted) setWorkspace({ settings, plans: catalog.plans, tags: catalog.tags });
			})
			.catch(() => { if (!controller.signal.aborted) setFailed(true); });
		return () => controller.abort();
	}, [shell.organizationId, revision]);

	return <PageContainer className="space-y-6">
		<PageHeader title={t("Plans")} description={t("Create the monthly options available to your members.")} />
		{failed ? <div role="alert" className="rounded-xl border p-4"><p>{t("We could not load plans.")}</p><Button className="mt-3" variant="outline" onClick={() => { setFailed(false); setWorkspace(null); setRevision((value) => value + 1); }}>{t("Try again")}</Button></div> : null}
		{!workspace && !failed ? <FormSkeleton label={t("Loading plans…")} /> : null}
		{workspace ? <>
			<SettingsForm settings={workspace.settings} onSaved={(settings) => setWorkspace({ ...workspace, settings })} />
			<PlansPanel
				settings={workspace.settings}
				plans={workspace.plans}
				tags={workspace.tags}
				onCreated={(created) => setWorkspace({
					...workspace,
					plans: [...workspace.plans, created].sort((left, right) => left.name.localeCompare(right.name)),
					tags: mergeTags(workspace.tags, created.tags),
				})}
				onUpdated={(updated) => setWorkspace({
					...workspace,
					plans: workspace.plans.map((item) => item.id === updated.id ? updated : item).sort((left, right) => left.name.localeCompare(right.name)),
					tags: mergeTags(workspace.tags, updated.tags),
				})}
			/>
		</> : null}
	</PageContainer>;
}

function mergeTags(current: Tag[], added: Tag[]) {
	const byId = new Map([...current, ...added].map((item) => [item.id, item]));
	return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function SettingsForm({ settings, onSaved }: { settings: BillingSettings; onSaved: (value: BillingSettings) => void }) {
	const t = useT();
	const { locale } = useI18n();
	const shell = useAppShell();
	const [currency, setCurrency] = useState(settings.currency ?? "COP");
	const [timezone, setTimezone] = useState(settings.timezone ?? "America/Bogota");
	const [pending, setPending] = useState(false);
	const [feedback, setFeedback] = useState<"saved" | "failed" | null>(null);
	async function submit(event: FormEvent) {
		event.preventDefault();
		setPending(true); setFeedback(null);
		try { onSaved(await billingSetupApi.saveSettings(shell.organizationId, currency, timezone)); setFeedback("saved"); }
		catch { setFeedback("failed"); }
		finally { setPending(false); }
	}
	return <form onSubmit={submit} className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
		<div className="sm:col-span-2"><h2 className="text-lg font-semibold">{t("Billing settings")}</h2><p className="text-sm text-muted-foreground">{t("Choose the currency and timezone used for billing.")}</p></div>
		<div className="grid min-w-0 gap-2"><Label htmlFor="billing-currency">{t("Currency")}</Label><select id="billing-currency" className="h-11 w-full min-w-0 rounded-md border bg-background px-3" value={currency} onChange={(event) => setCurrency(event.target.value)} required>{availableCurrencies(currency).map((code) => ({ code, name: currencyName(locale, code) })).sort((a, b) => a.name.localeCompare(b.name, locale)).map(({ code, name }) => <option key={code} value={code}>{name}</option>)}</select></div>
		<div className="grid gap-2"><Label htmlFor="billing-timezone">{t("Timezone")}</Label><Input id="billing-timezone" value={timezone} maxLength={100} onChange={(event) => setTimezone(event.target.value)} required /></div>
		<div className="flex flex-wrap items-center gap-3 sm:col-span-2"><LoadingButton loading={pending} loadingLabel={t("Saving…")} disabled={pending}>{t("Save billing settings")}</LoadingButton>{feedback ? <span role={feedback === "failed" ? "alert" : "status"} className="text-sm">{t(feedback === "saved" ? "Billing settings saved." : "We could not save billing settings.")}</span> : null}</div>
	</form>;
}

function PlansPanel({ settings, plans, tags, onCreated, onUpdated }: { settings: BillingSettings; plans: Plan[]; tags: Tag[]; onCreated: (value: Plan) => void; onUpdated: (value: Plan) => void }) {
	const t = useT();
	const { locale } = useI18n();
	const shell = useAppShell();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [amount, setAmount] = useState("");
	const [dueDay, setDueDay] = useState("5");
	const [branchIds, setBranchIds] = useState(() => shell.branches.map((branch) => branch.id));
	const [tagNames, setTagNames] = useState<string[]>([]);
	const [tagInput, setTagInput] = useState("");
	const [pending, setPending] = useState(false);
	const [failed, setFailed] = useState(false);
	const multipleBranches = shell.branches.length > 1;
	const suggestedTags = useMemo(() => tags.filter((item) => !tagNames.some((name) => normalizeTag(name) === normalizeTag(item.name)) && (!tagInput.trim() || normalizeTag(item.name).includes(normalizeTag(tagInput)))), [tagInput, tagNames, tags]);

	function addTag(value: string) {
		const next = value.trim().replace(/\s+/g, " ");
		if (!next || next.length > 40 || tagNames.length >= 20 || tagNames.some((item) => normalizeTag(item) === normalizeTag(next))) return;
		setTagNames((current) => [...current, next]);
		setTagInput("");
	}

	function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === "Enter" || event.key === ",") {
			event.preventDefault();
			addTag(tagInput);
		} else if (event.key === "Backspace" && !tagInput && tagNames.length) {
			setTagNames((current) => current.slice(0, -1));
		}
	}

	async function submit(event: FormEvent) {
		event.preventDefault();
		const amountMinor = Math.round(Number(amount) * 100);
		const submittedTags = tagInput.trim() ? [...tagNames, tagInput.trim()] : tagNames;
		if (!name.trim() || !Number.isSafeInteger(amountMinor) || amountMinor <= 0 || branchIds.length === 0) return;
		setPending(true); setFailed(false);
		try {
			const created = await billingSetupApi.createPlan(shell.organizationId, { name, description, amountMinor, defaultDueDay: Number(dueDay), branchIds, tagNames: submittedTags });
			onCreated(created); setName(""); setDescription(""); setAmount(""); setTagNames([]); setTagInput("");
		} catch { setFailed(true); }
		finally { setPending(false); }
	}

	return <section className="space-y-5 rounded-xl border bg-card p-4">
		<div><h2 className="text-lg font-semibold">{t("Your plans")}</h2><p className="text-sm text-muted-foreground">{t("Each plan includes its monthly price and usual due day. Tags are optional and only help you organize plans.")}</p></div>
		{plans.length ? <ul className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">{plans.map((item) => <PlanCard key={item.id} plan={item} onUpdated={onUpdated} />)}</ul> : <div className="rounded-lg bg-muted/50 p-4"><p className="font-medium">{t("No plans yet")}</p><p className="text-sm text-muted-foreground">{t("Create your first plan to define what members pay each month.")}</p></div>}

		<form onSubmit={submit} className="grid gap-4 border-t pt-5">
			<div><h3 className="font-semibold">{t("Add plan")}</h3><p className="text-sm text-muted-foreground">{t("You can use tags such as Football, Piano or Children to keep plans organized.")}</p></div>
			<div className="grid gap-4 md:grid-cols-2">
				<div className="grid gap-2"><Label htmlFor="plan-name">{t("Plan name")}</Label><Input id="plan-name" value={name} maxLength={120} required placeholder={t("For example: Children monthly plan")} onChange={(event) => setName(event.target.value)} /></div>
				<div className="grid gap-2"><Label htmlFor="plan-description">{t("Description (optional)")}</Label><Input id="plan-description" value={description} maxLength={1000} onChange={(event) => setDescription(event.target.value)} /></div>
				<div className="grid gap-2"><Label htmlFor="plan-amount">{t("Monthly price ({currency})", { currency: settings.currency ? currencyName(locale, settings.currency) : "—" })}</Label><Input id="plan-amount" type="number" min="0.01" step="0.01" value={amount} required onChange={(event) => setAmount(event.target.value)} /></div>
				<div className="grid gap-2"><Label htmlFor="plan-due-day">{t("Usual due day")}</Label><Input id="plan-due-day" type="number" min="1" max="28" value={dueDay} required onChange={(event) => setDueDay(event.target.value)} /><p className="text-xs text-muted-foreground">{t("Choose a day from 1 to 28.")}</p></div>
			</div>

			<div className="grid gap-2"><Label htmlFor="plan-tags">{t("Tags (optional)")}</Label>
				<div className="flex min-h-11 flex-wrap items-center gap-2 rounded-md border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
					{tagNames.map((tag) => <button key={tag} type="button" className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium" onClick={() => setTagNames((current) => current.filter((item) => item !== tag))} aria-label={t("Remove tag {tag}", { tag })}>{tag} ×</button>)}
					<input id="plan-tags" className="min-w-40 flex-1 bg-transparent text-sm outline-none" value={tagInput} maxLength={40} placeholder={tagNames.length ? "" : t("Type a tag and press Enter")} onChange={(event) => setTagInput(event.target.value.replace(",", ""))} onKeyDown={handleTagKeyDown} onBlur={() => addTag(tagInput)} />
				</div>
				{suggestedTags.length && tagInput.trim() ? <div className="flex flex-wrap gap-2" aria-label={t("Suggested tags")}>{suggestedTags.slice(0, 6).map((tag) => <button key={tag.id} type="button" className="rounded-full border px-2.5 py-1 text-xs hover:bg-muted" onMouseDown={(event) => event.preventDefault()} onClick={() => addTag(tag.name)}>{tag.name}</button>)}</div> : null}
				<p className="text-xs text-muted-foreground">{t("Press Enter after each tag. Tags do not change the price or billing rules.")}</p>
			</div>

			{multipleBranches ? <fieldset className="grid gap-2"><legend className="text-sm font-medium">{t("Available at branches")}</legend><div className="grid gap-2 sm:grid-cols-2">{shell.branches.map((branch) => <label key={branch.id} className="flex min-h-10 items-center gap-2 rounded-md border px-3"><input type="checkbox" checked={branchIds.includes(branch.id)} onChange={(event) => setBranchIds((current) => event.target.checked ? [...current, branch.id] : current.filter((id) => id !== branch.id))} />{branch.name}</label>)}</div></fieldset> : null}
			{!settings.currency ? <p role="alert" className="text-sm">{t("Save billing settings before adding a plan.")}</p> : null}
			{failed ? <p role="alert" className="text-sm">{t("We could not save the plan.")}</p> : null}
			<div><LoadingButton loading={pending} loadingLabel={t("Saving…")} disabled={pending || !settings.currency || !name.trim() || !amount || branchIds.length === 0}>{t("Add plan")}</LoadingButton></div>
		</form>
	</section>;
}

function normalizeTag(value: string) {
	return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

function PlanCard({ plan, onUpdated }: { plan: Plan; onUpdated: (value: Plan) => void }) {
	const t = useT();
	const { locale } = useI18n();
	const shell = useAppShell();
	const [editing, setEditing] = useState(false);
	const [name, setName] = useState(plan.name);
	const [description, setDescription] = useState(plan.description ?? "");
	const [amount, setAmount] = useState(String(plan.amountMinor / 100));
	const [dueDay, setDueDay] = useState(String(plan.defaultDueDay));
	const [tagText, setTagText] = useState(plan.tags.map((item) => item.name).join(", "));
	const [branchIds, setBranchIds] = useState(plan.branchIds);
	const [pending, setPending] = useState(false);
	const [failed, setFailed] = useState(false);
	const multipleBranches = shell.branches.length > 1;

	function reset() {
		setName(plan.name);
		setDescription(plan.description ?? "");
		setAmount(String(plan.amountMinor / 100));
		setDueDay(String(plan.defaultDueDay));
		setTagText(plan.tags.map((item) => item.name).join(", "));
		setBranchIds(plan.branchIds);
		setFailed(false);
	}

	async function save(event: FormEvent) {
		event.preventDefault();
		const amountMinor = Math.round(Number(amount) * 100);
		if (!name.trim() || !Number.isSafeInteger(amountMinor) || amountMinor <= 0 || branchIds.length === 0) return;
		setPending(true); setFailed(false);
		try {
			const updated = await billingSetupApi.updatePlan(shell.organizationId, plan.id, {
				name,
				description,
				amountMinor,
				defaultDueDay: Number(dueDay),
				branchIds,
				tagNames: tagText.split(",").map((item) => item.trim()).filter(Boolean),
			});
			onUpdated(updated); setEditing(false);
		} catch { setFailed(true); }
		finally { setPending(false); }
	}

	async function changeStatus() {
		if (plan.isActive && !window.confirm(t("Deactivate {name}? Existing records will be kept.", { name: plan.name }))) return;
		setPending(true); setFailed(false);
		try { onUpdated(await billingSetupApi.updatePlan(shell.organizationId, plan.id, { isActive: !plan.isActive })); }
		catch { setFailed(true); }
		finally { setPending(false); }
	}

	return <li className="rounded-xl border bg-background p-4">
		{editing ? <form onSubmit={save} className="grid gap-3">
			<div className="grid gap-2"><Label htmlFor={`edit-plan-name-${plan.id}`}>{t("Plan name")}</Label><Input id={`edit-plan-name-${plan.id}`} value={name} maxLength={120} required onChange={(event) => setName(event.target.value)} /></div>
			<div className="grid gap-2"><Label htmlFor={`edit-plan-description-${plan.id}`}>{t("Description (optional)")}</Label><Input id={`edit-plan-description-${plan.id}`} value={description} maxLength={1000} onChange={(event) => setDescription(event.target.value)} /></div>
			<div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor={`edit-plan-amount-${plan.id}`}>{t("Monthly price ({currency})", { currency: currencyName(locale, plan.currency) })}</Label><Input id={`edit-plan-amount-${plan.id}`} type="number" min="0.01" step="0.01" value={amount} required onChange={(event) => setAmount(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor={`edit-plan-due-${plan.id}`}>{t("Usual due day")}</Label><Input id={`edit-plan-due-${plan.id}`} type="number" min="1" max="28" value={dueDay} required onChange={(event) => setDueDay(event.target.value)} /></div></div>
			<div className="grid gap-2"><Label htmlFor={`edit-plan-tags-${plan.id}`}>{t("Tags separated by commas (optional)")}</Label><Input id={`edit-plan-tags-${plan.id}`} value={tagText} maxLength={820} placeholder={t("For example: Football, Children")} onChange={(event) => setTagText(event.target.value)} /></div>
			{multipleBranches ? <fieldset className="grid gap-2"><legend className="text-sm font-medium">{t("Available at branches")}</legend>{shell.branches.map((branch) => <label key={branch.id} className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={branchIds.includes(branch.id)} onChange={(event) => setBranchIds((current) => event.target.checked ? [...current, branch.id] : current.filter((id) => id !== branch.id))} />{branch.name}</label>)}</fieldset> : null}
			{failed ? <p role="alert" className="text-sm">{t("We could not save the plan.")}</p> : null}
			<div className="flex flex-wrap gap-2"><LoadingButton loading={pending} loadingLabel={t("Saving…")} disabled={pending || branchIds.length === 0}>{t("Save changes")}</LoadingButton><Button type="button" variant="outline" disabled={pending} onClick={() => { reset(); setEditing(false); }}>{t("Cancel")}</Button></div>
		</form> : <>
			<div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{plan.name}</h3>{!plan.isActive ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{t("Inactive")}</span> : null}</div>{plan.description ? <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p> : null}</div><span className="whitespace-nowrap font-semibold">{formatMoney(locale, plan.amountMinor, plan.currency)}</span></div>
			<p className="mt-3 text-sm text-muted-foreground">{t("Due on day {day}", { day: plan.defaultDueDay })}</p>
			{plan.tags.length ? <div className="mt-3 flex flex-wrap gap-2">{plan.tags.map((tag) => <span key={tag.id} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{tag.name}</span>)}</div> : null}
			{failed ? <p role="alert" className="mt-3 text-sm">{t("We could not update the plan.")}</p> : null}
			<div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={pending} onClick={() => { reset(); setEditing(true); }}>{t("Edit plan")}</Button><LoadingButton loading={pending} type="button" variant="outline" disabled={pending} onClick={changeStatus}>{t(plan.isActive ? "Deactivate plan" : "Activate plan")}</LoadingButton></div>
		</>}
	</li>;
}
