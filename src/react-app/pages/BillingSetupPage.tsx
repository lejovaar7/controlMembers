import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppShell } from "@/hooks/use-app-shell";
import { billingSetupApi, type BillingPlan, type BillingSettings, type Program } from "@/lib/billing-setup";
import { useT } from "@/lib/i18n";

type Workspace = { settings: BillingSettings; programs: Program[]; plans: BillingPlan[] };

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
		Promise.all([
			billingSetupApi.settings(shell.organizationId),
			billingSetupApi.programs(shell.organizationId),
			billingSetupApi.plans(shell.organizationId),
		]).then(([settings, programs, plans]) => {
			if (!controller.signal.aborted) setWorkspace({ settings, programs: programs.programs, plans: plans.plans });
		}).catch(() => { if (!controller.signal.aborted) setFailed(true); });
		return () => controller.abort();
	}, [shell.organizationId, revision]);

	return <PageContainer className="space-y-6">
		<PageHeader title={t("Billing setup")} description={t("Configure company billing, Programs and monthly Plans.")} />
		{failed ? <div role="alert" className="rounded-lg border p-4"><p>{t("We could not load billing setup.")}</p><Button className="mt-3" variant="outline" onClick={() => { setFailed(false); setWorkspace(null); setRevision((value) => value + 1); }}>{t("Try again")}</Button></div> : null}
		{!workspace && !failed ? <p role="status" className="text-muted-foreground">{t("Loading billing setup…")}</p> : null}
		{workspace ? <>
			<SettingsForm settings={workspace.settings} onSaved={(settings) => setWorkspace({ ...workspace, settings })} />
			<div className="grid gap-6 xl:grid-cols-2">
				<ProgramsPanel programs={workspace.programs} onCreated={(program) => setWorkspace({ ...workspace, programs: [...workspace.programs, program] })} />
				<PlansPanel settings={workspace.settings} programs={workspace.programs} plans={workspace.plans} onCreated={(plan) => setWorkspace({ ...workspace, plans: [...workspace.plans, plan] })} />
			</div>
		</> : null}
	</PageContainer>;
}

function SettingsForm({ settings, onSaved }: { settings: BillingSettings; onSaved: (value: BillingSettings) => void }) {
	const t = useT();
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
	return <form onSubmit={submit} className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
		<div className="sm:col-span-2"><h2 className="text-lg font-semibold">{t("Company billing settings")}</h2><p className="text-sm text-muted-foreground">{t("Currency and timezone apply to future billing records.")}</p></div>
		<div className="grid gap-2"><Label htmlFor="billing-currency">{t("Currency")}</Label><Input id="billing-currency" value={currency} maxLength={3} onChange={(event) => setCurrency(event.target.value.toUpperCase())} required /></div>
		<div className="grid gap-2"><Label htmlFor="billing-timezone">{t("Timezone")}</Label><Input id="billing-timezone" value={timezone} maxLength={100} onChange={(event) => setTimezone(event.target.value)} required /></div>
		<div className="flex items-center gap-3 sm:col-span-2"><Button disabled={pending}>{t(pending ? "Saving…" : "Save billing settings")}</Button>{feedback ? <span role={feedback === "failed" ? "alert" : "status"} className="text-sm">{t(feedback === "saved" ? "Billing settings saved." : "We could not save billing settings.")}</span> : null}</div>
	</form>;
}

function ProgramsPanel({ programs, onCreated }: { programs: Program[]; onCreated: (value: Program) => void }) {
	const t = useT();
	const shell = useAppShell();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [branchIds, setBranchIds] = useState(() => shell.branches.map((branch) => branch.id));
	const [pending, setPending] = useState(false);
	const [failed, setFailed] = useState(false);
	async function submit(event: FormEvent) {
		event.preventDefault(); if (!name.trim() || branchIds.length === 0) return;
		setPending(true); setFailed(false);
		try { const created = await billingSetupApi.createProgram(shell.organizationId, { name, description, branchIds }); onCreated(created); setName(""); setDescription(""); }
		catch { setFailed(true); }
		finally { setPending(false); }
	}
	return <section className="space-y-4 rounded-xl border p-4"><div><h2 className="text-lg font-semibold">{t("Programs")}</h2><p className="text-sm text-muted-foreground">{t("Activities offered by this organization.")}</p></div>
		{programs.length ? <ul className="grid gap-2">{programs.map((program) => <li key={program.id} className="rounded-lg bg-muted/50 p-3"><strong>{program.name}</strong><p className="text-sm text-muted-foreground">{program.description || t("No description")}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">{t("No Programs yet.")}</p>}
		<form onSubmit={submit} className="grid gap-3 border-t pt-4"><h3 className="font-medium">{t("Add Program")}</h3><div className="grid gap-2"><Label htmlFor="program-name">{t("Program name")}</Label><Input id="program-name" value={name} maxLength={120} required onChange={(event) => setName(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="program-description">{t("Description")}</Label><Input id="program-description" value={description} maxLength={1000} onChange={(event) => setDescription(event.target.value)} /></div>
			<fieldset className="grid gap-2"><legend className="text-sm font-medium">{t("Offered at Branches")}</legend>{shell.branches.map((branch) => <label key={branch.id} className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={branchIds.includes(branch.id)} onChange={(event) => setBranchIds((current) => event.target.checked ? [...current, branch.id] : current.filter((id) => id !== branch.id))} />{branch.name}</label>)}</fieldset>
			{failed ? <p role="alert" className="text-sm">{t("We could not save the Program.")}</p> : null}<Button disabled={pending || !name.trim() || branchIds.length === 0}>{t(pending ? "Saving…" : "Add Program")}</Button></form>
	</section>;
}

function PlansPanel({ settings, programs, plans, onCreated }: { settings: BillingSettings; programs: Program[]; plans: BillingPlan[]; onCreated: (value: BillingPlan) => void }) {
	const t = useT();
	const shell = useAppShell();
	const [name, setName] = useState("");
	const [programId, setProgramId] = useState("");
	const [amount, setAmount] = useState("");
	const [dueDay, setDueDay] = useState("5");
	const [pending, setPending] = useState(false);
	const [failed, setFailed] = useState(false);
	async function submit(event: FormEvent) {
		event.preventDefault();
		const amountMinor = Math.round(Number(amount) * 100);
		if (!name.trim() || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) return;
		setPending(true); setFailed(false);
		try { const created = await billingSetupApi.createPlan(shell.organizationId, { name, programId: programId || null, amountMinor, defaultDueDay: Number(dueDay) }); onCreated(created); setName(""); setAmount(""); }
		catch { setFailed(true); }
		finally { setPending(false); }
	}
	return <section className="space-y-4 rounded-xl border p-4"><div><h2 className="text-lg font-semibold">{t("Monthly Plans")}</h2><p className="text-sm text-muted-foreground">{t("Prices and due-day defaults for new Enrollments.")}</p></div>
		{plans.length ? <ul className="grid gap-2">{plans.map((plan) => <li key={plan.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3"><strong>{plan.name}</strong><span>{new Intl.NumberFormat(undefined, { style: "currency", currency: plan.currency }).format(plan.amountMinor / 100)}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">{t("No monthly Plans yet.")}</p>}
		<form onSubmit={submit} className="grid gap-3 border-t pt-4"><h3 className="font-medium">{t("Add monthly Plan")}</h3><div className="grid gap-2"><Label htmlFor="plan-name">{t("Plan name")}</Label><Input id="plan-name" value={name} maxLength={120} required onChange={(event) => setName(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="plan-program">{t("Program restriction")}</Label><select id="plan-program" className="h-10 rounded-md border bg-background px-3" value={programId} onChange={(event) => setProgramId(event.target.value)}><option value="">{t("Available to any Program")}</option>{programs.filter((program) => program.isActive).map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></div><div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="plan-amount">{t("Monthly amount ({currency})", { currency: settings.currency ?? "—" })}</Label><Input id="plan-amount" type="number" min="0.01" step="0.01" value={amount} required onChange={(event) => setAmount(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="plan-due-day">{t("Due day")}</Label><Input id="plan-due-day" type="number" min="1" max="28" value={dueDay} required onChange={(event) => setDueDay(event.target.value)} /></div></div>
			{!settings.currency ? <p role="alert" className="text-sm">{t("Save company billing settings before adding a Plan.")}</p> : null}{failed ? <p role="alert" className="text-sm">{t("We could not save the Plan.")}</p> : null}<Button disabled={pending || !settings.currency}>{t(pending ? "Saving…" : "Add monthly Plan")}</Button></form>
	</section>;
}
