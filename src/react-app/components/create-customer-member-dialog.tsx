import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { CenteredDialog, type DialogReturnFocus } from "@/components/centered-dialog";
import { SelectField } from "@/components/select-field";
import { LoadingButton } from "@/components/loading-button";
import { DatePicker } from "@/components/date-picker";
import { BillingDayInput } from "@/components/billing-day-input";
import { MemberPhoneFields } from "@/components/member-phone-fields";
import { PlanEditor } from "@/components/plan-editor";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppShell } from "@/hooks/use-app-shell";
import { useI18n } from "@/lib/i18n";
import { billingSetupApi, type BillingSettings, type Plan, type Tag } from "@/lib/billing-setup";
import { controlMembersApi, ProductApiError } from "@/lib/controlmembers";
import { billingDateInMonth, nextBillingMonth } from "../../shared/billing-dates";
import { formatDate, formatMoney, type MessageKey } from "../../shared/i18n";

export function CreateCustomerMemberDialog({ onCreated, onCancel, returnFocus }: {
	onCreated: (member: { id: string; firstChargeId: string | null }) => void; onCancel: () => void; returnFocus: DialogReturnFocus;
}) {
	const { t, locale } = useI18n(); const shell = useAppShell();
	const [name, setName] = useState(""); const [documentNumber, setDocumentNumber] = useState(""); const [email, setEmail] = useState("");
	const [phone, setPhone] = useState(""); const [sameAsPhone, setSameAsPhone] = useState(true); const [whatsapp, setWhatsapp] = useState("");
	const [branchId, setBranchId] = useState(shell.activeBranch?.id ?? shell.branches[0]?.id ?? "");
	const [planId, setPlanId] = useState(""); const [startDate, setStartDate] = useState(""); const [chosenDay, setChosenDay] = useState<string | null>(null);
	const [catalog, setCatalog] = useState<{ plans: Plan[]; tags: Tag[]; settings: BillingSettings } | null>(null);
	const [loadFailed, setLoadFailed] = useState(false); const [revision, setRevision] = useState(0); const [creatingPlan, setCreatingPlan] = useState(false);
	const [pending, setPending] = useState(false); const [error, setError] = useState<MessageKey | null>(null); const busy = useRef(false);
	const createPlanButton = useRef<HTMLButtonElement>(null);
	const canManagePlans = shell.organizationRole === "owner" || (shell.organizationRole === "admin" && shell.allBranches);
	useEffect(() => {
		let active = true;
		void Promise.all([billingSetupApi.plans(shell.organizationId), billingSetupApi.settings(shell.organizationId)]).then(([plans, settings]) => {
			if (!active) return;
			setCatalog({ ...plans, settings }); setLoadFailed(false);
			const parts = new Intl.DateTimeFormat("en", { timeZone: settings.timezone ?? "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
			const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)!.value;
			setStartDate((current) => current || `${part("year")}-${part("month")}-${part("day")}`);
		}).catch(() => { if (active) setLoadFailed(true); });
		return () => { active = false; };
	}, [shell.organizationId, revision]);
	const plans = catalog?.plans.filter((plan) => plan.isActive && plan.branchIds.includes(branchId)) ?? [];
	const selectedPlan = plans.find((plan) => plan.id === planId);
	const day = chosenDay ?? startDate.slice(8, 10).replace(/^0/, ""); const recurringDay = Number(day);
	const validDay = Number.isInteger(recurringDay) && recurringDay >= 1 && recurringDay <= 31;
	const ready = !!name.trim() && !!branchId && !!selectedPlan && !!startDate && validDay && !!catalog?.settings.currency && !!catalog?.settings.timezone && !loadFailed;
	async function submit(event: FormEvent) {
		event.preventDefault(); if (busy.current || !ready) return;
		busy.current = true; setPending(true); setError(null);
		try {
			const result = await controlMembersApi.createMember(shell.organizationId, { displayName: name, primaryBranchId: branchId, planId, startDate, recurringDay, documentNumber, email, phoneE164: phone, whatsappSameAsPhone: sameAsPhone, whatsappE164: sameAsPhone ? null : whatsapp });
			onCreated(result);
		} catch (cause) {
			setError(cause instanceof ProductApiError && cause.code === "MEMBER_IDENTIFIER_EXISTS" ? "A member with this ID number or reference already exists." : "We could not save the member. Check the information and try again.");
		} finally { busy.current = false; setPending(false); }
	}
	return <>
		<CenteredDialog open={!creatingPlan} title={t("Add member")} description={t("Name, branch and plan are required. The first monthly fee is created when you save.")} pending={pending} onClose={onCancel} returnFocus={returnFocus} wide>
			<form onSubmit={submit} className="space-y-5 px-5 pt-5 sm:px-7" aria-label={t("New member")} aria-busy={pending}>
				<fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
					<div className="grid gap-2"><Label htmlFor="customer-name">{t("Full name")}</Label><Input id="customer-name" value={name} maxLength={200} required onChange={(event) => setName(event.target.value)} /></div>
					<div className="grid gap-2"><Label htmlFor="customer-branch">{t("Branch")}</Label><SelectField id="customer-branch" value={branchId} required onValueChange={(value) => { setBranchId(value); setPlanId(""); }} options={(shell.activeBranch ? [shell.activeBranch] : shell.branches).map((branch) => ({ value: branch.id, label: branch.name }))} /></div>
					<div className="grid gap-2 sm:col-span-2"><Label htmlFor="customer-plan">{t("Plan")}</Label><SelectField id="customer-plan" name="planId" value={selectedPlan?.id ?? ""} required disabled={!catalog || loadFailed || !plans.length} onValueChange={setPlanId} options={[{ value: "", label: t("Choose a plan") }, ...plans.map((plan) => ({ value: plan.id, label: `${plan.name} · ${formatMoney(locale, plan.amountMinor, plan.currency)}` }))]} />
						{loadFailed ? <div role="alert" className="text-sm"><p>{t("We could not load plans. Try again before creating the member.")}</p><Button type="button" variant="outline" onClick={() => { setLoadFailed(false); setRevision((value) => value + 1); }}>{t("Try again")}</Button></div> : !catalog ? <p role="status" className="text-sm text-muted-foreground">{t("Loading plans…")}</p> : !plans.length ? <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm"><p>{t("Create an active plan for this branch before adding a member.")}</p>{canManagePlans ? catalog.settings.currency ? <Button ref={createPlanButton} type="button" variant="outline" onClick={() => setCreatingPlan(true)}>{t("Add plan")}</Button> : <Link to="/app/billing-setup" className={buttonVariants({ variant: "outline" })}>{t("Open plans")}</Link> : <p className="text-muted-foreground">{t("Ask an administrator to create a plan for this branch.")}</p>}</div> : null}
					</div>
					{selectedPlan ? <><div className="grid gap-2"><Label htmlFor="customer-start">{t("Start date")}</Label><DatePicker id="customer-start" label={t("Start date")} value={startDate} onChange={setStartDate} /></div><div className="grid gap-2"><Label htmlFor="customer-day">{t("Monthly payment day")}</Label><BillingDayInput id="customer-day" value={day} onValueChange={setChosenDay} maxDay={31} required /></div>
						{startDate && validDay ? <p className="rounded-lg bg-muted/50 p-3 text-sm leading-6 sm:col-span-2">{t("First monthly fee: {amount}, due {date}.", { amount: formatMoney(locale, selectedPlan.amountMinor, selectedPlan.currency), date: formatDate(locale, new Date(startDate), { dateStyle: "medium", timeZone: "UTC" }) })} {t("Following payment: {date}. Short months use their last day.", { date: formatDate(locale, new Date(billingDateInMonth(nextBillingMonth(startDate.slice(0, 7)), recurringDay)), { dateStyle: "medium", timeZone: "UTC" }) })}</p> : null}</> : null}
					<div className="grid gap-2"><Label htmlFor="customer-document">{t("Document (optional)")}</Label><Input id="customer-document" value={documentNumber} maxLength={80} onChange={(event) => setDocumentNumber(event.target.value)} /></div>
					<div className="grid gap-2"><Label htmlFor="customer-email">{t("Email (optional)")}</Label><Input id="customer-email" type="email" value={email} maxLength={254} onChange={(event) => setEmail(event.target.value)} /></div>
					<MemberPhoneFields prefix="customer" phone={phone} onPhoneChange={setPhone} sameAsPhone={sameAsPhone} onSameAsPhoneChange={setSameAsPhone} whatsapp={whatsapp} onWhatsappChange={setWhatsapp} />
				</fieldset>
				{error ? <p role="alert" className="text-sm text-destructive">{t(error)}</p> : null}
				<div className="-mx-5 flex flex-col-reverse gap-2 border-t bg-muted/30 px-5 py-4 sm:-mx-7 sm:flex-row sm:justify-end sm:px-7"><Button type="button" variant="outline" disabled={pending} onClick={onCancel}>{t("Cancel")}</Button><LoadingButton type="submit" loading={pending} loadingLabel={t("Saving…")} disabled={pending || !ready}>{t("Save and review payment")}</LoadingButton></div>
			</form>
		</CenteredDialog>
		{creatingPlan && catalog ? <PlanEditor plan={null} settings={catalog.settings} tags={catalog.tags} returnFocus={createPlanButton} onClose={() => setCreatingPlan(false)} onSaved={(plan) => { setCatalog((current) => current ? { ...current, plans: [...current.plans, plan] } : current); setPlanId(plan.branchIds.includes(branchId) ? plan.id : ""); setCreatingPlan(false); }} /> : null}
	</>;
}
