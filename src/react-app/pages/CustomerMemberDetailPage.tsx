import { PaymentApplicationDetails, PaymentReceiptStatus } from "@/components/payment-application-details";
import { MemberBalanceSummary } from "@/components/member-balance-summary";
import { MemberPhoneFields } from "@/components/member-phone-fields";
import { BillingDayInput } from "@/components/billing-day-input";
import { defaultFirstDueDate, billingDateInMonth, nextBillingMonth } from "../../shared/billing-dates";
import { PaymentDialog } from "@/components/payment-dialog";
import { paymentMethodLabel } from "@/hooks/use-payment-methods";
import { SelectField } from "@/components/select-field";
import { CenteredDialog, type DialogReturnFocus } from "@/components/centered-dialog";
import { useActionDialog } from "@/hooks/use-action-dialog";
import { DatePicker } from "@/components/date-picker";
import { dateValue } from "@/lib/calendar-dates";
import { ArrowLeft, CalendarDays, CreditCard, Mail, MapPin, Pencil, Phone, Plus, UserRound } from "lucide-react";
import { formatMoney, currencyName, formatDate, type MessageKey } from "../../shared/i18n";
import { LoadingButton } from "@/components/loading-button";
import { DetailSkeleton } from "@/components/content-skeleton";
import { StatusBadge } from "@/components/status-badge";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { PageContainer } from "@/components/page";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppShell } from "@/hooks/use-app-shell";
import { billingSetupApi, type Plan } from "@/lib/billing-setup";
import { controlMembersApi, ProductApiError, type MemberDetail } from "@/lib/controlmembers";
import { useI18n, useT } from "@/lib/i18n";

export function CustomerMemberDetailPage() {
	const shell = useAppShell(); const { id } = useParams();
	return <MemberDetailWorkspace key={`${shell.organizationId}:${shell.activeBranch?.id}:${id}`} />;
}

function MemberDetailWorkspace() {
	const editButtonRef = useRef<HTMLButtonElement>(null);
	const paymentButtonRef = useRef<HTMLButtonElement>(null);
	const { dialog, openDialog } = useActionDialog();
	const { id = "" } = useParams();
	const t = useT();
	const { locale } = useI18n();
	const shell = useAppShell();
	const [detail, setDetail] = useState<MemberDetail | null>(null);
	const [plans, setPlans] = useState<Plan[]>([]);
	const [failed, setFailed] = useState(false);
	const [revision, setRevision] = useState(0);
	const [editing, setEditing] = useState(false);
	const [paymentOpen, setPaymentOpen] = useState(false);
	const [paymentChargeId, setPaymentChargeId] = useState<string | undefined>(undefined);
	const [receipt, setReceipt] = useState<string | null>(null);
	const [section, setSection] = useState<"overview" | "payments" | "profile">("overview");
	useEffect(() => {
		let active = true;
		void Promise.all([controlMembersApi.member(shell.organizationId, id), billingSetupApi.plans(shell.organizationId)])
			.then(([member, catalog]) => { if (active) { setDetail(member); setPlans(catalog.plans.filter((plan) => plan.isActive)); setFailed(false); } })
			.catch(() => { if (active) setFailed(true); });
		return () => { active = false; };
	}, [id, revision, shell.organizationId]);
	if (failed) return <PageContainer><p role="alert">{t("We could not load this member.")}</p></PageContainer>;
	if (!detail) return <PageContainer><DetailSkeleton label={t("Loading member…")} /></PageContainer>;
	const currency = detail.charges[0]?.currency ?? detail.enrollments[0]?.currency ?? plans[0]?.currency ?? "COP";
	const money = (value: number) => formatMoney(locale, value, currency);
	return <PageContainer className="space-y-6">
		{dialog}
		<Link to="/app/customer-members" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" />{t("Back to members")}</Link>
		<header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
			<div className="flex min-w-0 items-center gap-4">
				<div className="min-w-0 space-y-2"><div className="flex flex-wrap items-center gap-2.5"><h1 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">{detail.member.displayName}</h1><StatusBadge tone={detail.member.status === "active" ? "success" : detail.member.status === "paused" ? "warning" : "neutral"}>{t(detail.member.status === "active" ? "Active" : detail.member.status === "paused" ? "Paused" : "Inactive")}</StatusBadge></div>
					<p className="flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="size-3.5 shrink-0" />{shell.activeBranch?.name ?? shell.branches.find((branch) => branch.id === detail.member.primaryBranchId)?.name}</p>
				</div>
			</div>
			<div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 lg:flex"><Button ref={editButtonRef} variant="outline" onClick={() => setEditing(true)}><Pencil className="size-4" />{t("Edit member")}</Button><Button ref={paymentButtonRef} onClick={() => { setReceipt(null); setPaymentChargeId(undefined); setPaymentOpen(true); }}><Plus className="size-4" />{t("Review and record payment")}</Button></div>
		</header>
		<MemberBalanceSummary summary={detail.summary} currency={currency} />
		<div role="group" aria-label={t("Member details")} className="flex w-full gap-1 rounded-xl border bg-muted/40 p-1 sm:w-fit">
			{([{ id: "overview", label: "Summary", icon: CalendarDays }, { id: "payments", label: "Payment history", icon: CreditCard }, { id: "profile", label: "Personal information", icon: UserRound }] as const).map(({ id: sectionId, label, icon: Icon }) => <button key={sectionId} type="button" aria-pressed={section === sectionId} aria-controls={`member-${sectionId}`} onClick={() => setSection(sectionId)} className={cn("flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-2 text-xs font-medium transition-colors sm:flex-none sm:px-4 sm:text-sm", section === sectionId ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/60 hover:text-foreground")}><Icon aria-hidden="true" className="hidden size-4 shrink-0 sm:block" />{t(label)}</button>)}
		</div>
		{editing ? <MemberProfileForm member={detail.member} onCancel={() => setEditing(false)} returnFocus={editButtonRef} onSaved={() => { setEditing(false); reload(); }} /> : null}
		<div id="member-overview" hidden={section !== "overview"}><div className="grid items-start gap-5 xl:grid-cols-[1fr_1.15fr]"><EnrollmentSection memberId={id} memberBranchId={shell.activeBranch?.id ?? detail.member.primaryBranchId} plans={plans} enrollments={detail.enrollments} onChanged={reload} onCollect={(chargeId) => { setReceipt(null); setPaymentChargeId(chargeId); setPaymentOpen(true); }} /><FinancialSection detail={detail} money={money} /></div></div>
		{receipt ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{t("Payment recorded. Receipt: {receipt}", { receipt })}</p> : null}
		{paymentOpen ? <PaymentDialog memberId={id} chargeId={paymentChargeId} returnFocus={paymentButtonRef} onClose={() => setPaymentOpen(false)} onSaved={(result) => { setReceipt(result.receiptNumber); setPaymentOpen(false); reload(); setSection("payments"); }} /> : null}
		<PaymentHistory payments={detail.payments} showHistory={section === "payments"} />
		<div id="member-profile" hidden={section !== "profile"}><div className="grid items-start gap-5 xl:grid-cols-2">
			<section className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6"><SectionHeading title={t("Personal information")} description={t("The member's details and contact information.")} /><dl className="grid gap-5 sm:grid-cols-2"><Info label={t("Document number")} value={[detail.member.documentType, detail.member.documentNumber].filter(Boolean).join(" ")} /><Info label={t("Birth date")} value={detail.member.birthDate ? formatDate(locale, new Date(detail.member.birthDate), { dateStyle: "medium", timeZone: "UTC" }) : null} /><Info label={t("Email")} value={detail.member.email} icon={<Mail className="size-4" />} /><Info label={t("Phone")} value={detail.member.phoneE164} icon={<Phone className="size-4" />} /><Info label={t("WhatsApp")} value={detail.member.whatsappSameAsPhone ? detail.member.phoneE164 : detail.member.whatsappE164} /></dl>{detail.member.notes ? <div className="rounded-xl bg-muted/40 p-4"><p className="mb-1 text-sm font-medium">{t("Notes")}</p><p className="text-sm leading-6 whitespace-pre-wrap break-words text-muted-foreground">{detail.member.notes}</p></div> : null}<div className="border-t pt-5"><h3 className="mb-3 text-sm font-medium">{t("Member status")}</h3><div className="flex flex-wrap gap-2">{detail.member.status === "active" ? <><Button variant="outline" onClick={() => void changeStatus("paused")}>{t("Pause member")}</Button><Button variant="outline" onClick={() => void changeStatus("inactive")}>{t("Deactivate member")}</Button></> : <Button variant="outline" onClick={() => void changeStatus("active")}>{t("Reactivate member")}</Button>}</div></div></section>
			<ContactSection memberId={id} contacts={detail.contacts} onChanged={reload} />
		</div></div>
	</PageContainer>;

	function reload() { setRevision((value) => value + 1); }
	async function changeStatus(status: string) {
		openDialog({
			title: t(status === "active" ? "Reactivate member" : status === "paused" ? "Pause member" : "Deactivate member"),
			description: t("Change the status of {name}. Existing charges and payments will be kept.", { name: detail!.member.displayName }),
			confirmLabel: t(status === "active" ? "Reactivate member" : status === "paused" ? "Pause member" : "Deactivate member"),
			destructive: status !== "active",
			fields: [{ name: "reason", label: t("Reason for this change"), type: "textarea" }],
			onConfirm: async ({ reason }) => { await controlMembersApi.updateMemberStatus(shell.organizationId, id, status, reason); reload(); },
		});
	}
}

function MemberProfileForm({ member, onSaved, onCancel, returnFocus }: { member: MemberDetail["member"]; onSaved: () => void; onCancel: () => void; returnFocus: DialogReturnFocus }) {
	const t = useT(); const shell = useAppShell(); const [pending, setPending] = useState(false); const [failed, setFailed] = useState(false);
	const [phone, setPhone] = useState(member.phoneE164 ?? "");
	const [sameAsPhone, setSameAsPhone] = useState(member.whatsappSameAsPhone);
	const [whatsapp, setWhatsapp] = useState(member.whatsappE164 ?? "");
	const busyRef = useRef(false);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (busyRef.current) return;
		const form = new FormData(event.currentTarget);
		if (!String(form.get("displayName") ?? "").trim()) return;
		busyRef.current = true; setPending(true); setFailed(false);
		try {
			await controlMembersApi.updateMember(shell.organizationId, member.id, { displayName: form.get("displayName"), primaryBranchId: form.get("primaryBranchId"), documentType: form.get("documentType"), documentNumber: form.get("documentNumber"), birthDate: form.get("birthDate"), email: form.get("email"), phoneE164: phone, whatsappSameAsPhone: sameAsPhone, whatsappE164: sameAsPhone ? null : whatsapp, notes: form.get("notes") });
			onSaved();
		} catch { setFailed(true); } finally { busyRef.current = false; setPending(false); }
	}
	return <CenteredDialog open title={t("Edit member")} description={t("Update this member's personal and contact information.")} pending={pending} onClose={onCancel} returnFocus={returnFocus} wide>
		<form onSubmit={submit} className="space-y-5 px-5 pt-5 sm:px-7" aria-label={t("Edit member")} aria-busy={pending}>
		<fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
		<Field label={t("Name")} name="displayName" defaultValue={member.displayName} required />
		{shell.branches.length > 1 ? <div className="grid gap-2"><Label htmlFor="member-branch">{t("Branch")}</Label><SelectField id="member-branch" name="primaryBranchId" defaultValue={member.primaryBranchId} className="h-11 rounded-md border bg-background px-3" options={[...shell.branches.map((branch) => ({ value: branch.id, label: branch.name }))]} /></div> : <input type="hidden" name="primaryBranchId" value={member.primaryBranchId} />}
		<Field label={t("Document type")} name="documentType" defaultValue={member.documentType ?? ""} />
		<Field label={t("Document number")} name="documentNumber" defaultValue={member.documentNumber ?? ""} />
		<Field label={t("Birth date")} name="birthDate" defaultValue={(member as MemberDetail["member"] & { birthDate?: string | null }).birthDate ?? ""} type="date" />
		<Field label={t("Email")} name="email" defaultValue={member.email ?? ""} type="email" />
		<MemberPhoneFields prefix="edit-member" phone={phone} onPhoneChange={setPhone} sameAsPhone={sameAsPhone} onSameAsPhoneChange={setSameAsPhone} whatsapp={whatsapp} onWhatsappChange={setWhatsapp} />
		<div className="grid gap-2 sm:col-span-2"><Label htmlFor="member-notes">{t("Notes")}</Label><textarea id="member-notes" name="notes" defaultValue={member.notes ?? ""} maxLength={2000} className="min-h-24 rounded-md border bg-background p-3" /></div>
		</fieldset>
		{failed ? <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{t("We could not update this member.")}</p> : null}
		<div className="-mx-5 flex flex-col-reverse gap-2 border-t bg-muted/30 px-5 py-4 sm:-mx-7 sm:flex-row sm:justify-end sm:px-7"><Button type="button" variant="outline" disabled={pending} onClick={onCancel}>{t("Cancel")}</Button><LoadingButton type="submit" loading={pending} loadingLabel={t("Saving…")} disabled={pending}>{t("Save member")}</LoadingButton></div>
		</form>
	</CenteredDialog>;
}

function Field({ label, name, defaultValue, required, type = "text" }: { label: string; name: string; defaultValue: string; required?: boolean; type?: string }) {
	return <div className="grid gap-2"><Label htmlFor={`member-${name}`}>{label}</Label>{type === "date" ? <DatePicker id={`member-${name}`} label={label} name={name} defaultValue={defaultValue} /> : <Input id={`member-${name}`} name={name} type={type} defaultValue={defaultValue} required={required} />}</div>;
}

function SectionHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
	return <div className="flex flex-col items-start justify-between gap-3 sm:flex-row"><div className="min-w-0 flex-1"><h2 className="text-base font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p></div>{action}</div>;
}

function Info({ label, value, icon }: { label: string; value: string | null; icon?: ReactNode }) {
	const t = useT();
	return <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="mt-1.5 flex items-start gap-2 text-sm break-all">{value ? icon : null}<span>{value || t("Not provided")}</span></dd></div>;
}

function EnrollmentSection({ memberId, memberBranchId, plans, enrollments, onChanged, onCollect }: { memberId: string; memberBranchId: string; plans: Plan[]; enrollments: MemberDetail["enrollments"]; onChanged: () => void; onCollect: (chargeId: string) => void }) {
	const { dialog, openDialog } = useActionDialog();
	const [adding, setAdding] = useState(false);
	const addButtonRef = useRef<HTMLButtonElement>(null);
	const t = useT(); const { locale } = useI18n(); const shell = useAppShell();
	const availablePlans = plans.filter((plan) => plan.branchIds.includes(memberBranchId));
	const [selectedPlanId, setPlanId] = useState(availablePlans[0]?.id ?? "");
	const planId = availablePlans.some((plan) => plan.id === selectedPlanId) ? selectedPlanId : availablePlans[0]?.id ?? "";
	const [startDate, setStartDate] = useState(dateValue(new Date()));
	const [chosenDay, setChosenDay] = useState<string | null>(null);
	const firstDueDate = defaultFirstDueDate(startDate);
	const monthlyDay = chosenDay ?? startDate.slice(8, 10).replace(/^0/, "");
	const recurringDay = Number(monthlyDay);
	const invalidDay = !Number.isInteger(recurringDay) || recurringDay < 1 || recurringDay > 31;
	const selectedPlan = availablePlans.find((plan) => plan.id === planId);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<MessageKey | null>(null);
	async function submit(event: FormEvent) {
		event.preventDefault();
		if (pending || !startDate || invalidDay) return;
		setPending(true); setError(null);
		try {
			const created = await controlMembersApi.addEnrollment(shell.organizationId, memberId, { planId, branchId: memberBranchId, startDate, firstDueDate, recurringDay });
			setAdding(false); onChanged();
			if (created.firstChargeId) onCollect(created.firstChargeId);
		} catch (cause) {
			if (cause instanceof ProductApiError && cause.code === "ENROLLMENT_ALREADY_EXISTS") {
				const existing = enrollments.find((item) => item.planId === planId && item.branchId === memberBranchId && item.status !== "ended");
				setError(existing?.status === "active"
					? "This member already has an active enrollment in this plan. You cannot add another while it remains active."
					: existing?.status === "paused"
						? "This member already has a paused enrollment in this plan. Resume it instead of adding another."
						: "This member already has an active or paused enrollment in this plan. Check their enrollments before adding another.");
			} else { setError(cause instanceof ProductApiError && cause.code === "INVALID_INPUT" ? "Check the start date and monthly payment day." : "We could not add the enrollment."); }
		} finally { setPending(false); }
	}
	function status(id: string, value: string) {
		const item = enrollments.find((enrollment) => enrollment.id === id)!;
		const title = t(value === "ended" ? "End enrollment" : value === "paused" ? "Pause enrollment" : "Resume enrollment");
		openDialog({ title, confirmLabel: title, destructive: value !== "active",
			description: value === "ended" ? t("End {plan}? No new charges will be generated for this enrollment. Existing charges and payments will be kept.", { plan: item.planName }) : value === "paused" ? t("Pause {plan}? New charges will pause until you resume this enrollment.", { plan: item.planName }) : t("Resume {plan}? This enrollment will be included in future monthly charges.", { plan: item.planName }),
			fields: [{ name: "reason", label: t("Reason for this change"), type: "textarea" }],
			onConfirm: async ({ reason }) => { await controlMembersApi.updateEnrollment(shell.organizationId, id, { status: value, reason }); onChanged(); },
		});
	}
	function editTerms(item: MemberDetail["enrollments"][number]) {
		openDialog({ title: t("Edit future terms"), description: t("Update {plan}. These changes apply to future charges; existing charges will stay the same.", { plan: item.planName }), confirmLabel: t("Save changes"),
			fields: [
				{ name: "amount", label: t("Agreed monthly amount ({currency})", { currency: currencyName(locale, item.currency) }), type: "money", defaultValue: String(item.agreedAmountMinor / 100), min: 0.01, step: 0.01 },
				{ name: "dueDay", label: t(item.firstDueDate ? "Monthly due day (1–31)" : "Due day from 1 to 28"), type: "day", defaultValue: String(item.dueDay), max: item.firstDueDate ? 31 : 28 },
				{ name: "discount", label: t("Monthly discount ({currency})", { currency: currencyName(locale, item.currency) }), type: "money", defaultValue: String(item.discountMinor / 100), min: 0, step: 0.01 },
				{ name: "reason", label: t("Reason for this change"), type: "textarea" },
			],
			validate: ({ amount, discount }) => Number(discount) > Number(amount) ? "The discount cannot exceed the monthly amount." : null,
			onConfirm: async ({ amount, dueDay, discount, reason }) => { await controlMembersApi.updateEnrollment(shell.organizationId, item.id, { agreedAmountMinor: Math.round(Number(amount) * 100), dueDay: Number(dueDay), discountMinor: Math.round(Number(discount) * 100), reason }); onChanged(); },
		});
	}
	return <section className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6">
		<SectionHeading title={t("Enrollments")} description={t("Plans currently or previously assigned to this member.")} action={<Button ref={addButtonRef} variant="outline" onClick={() => { setError(null); setAdding(true); }}><Plus className="size-4" />{t("Add enrollment")}</Button>} />
		{enrollments.length ? <ul className="space-y-3">{enrollments.map((item) => <li key={item.id} className="rounded-xl border p-4">
			<div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold break-words">{item.planName}</h3><StatusBadge tone={item.status === "active" ? "success" : item.status === "paused" ? "warning" : "neutral"}>{t(item.status === "active" ? "Active" : item.status === "paused" ? "Paused" : "Ended")}</StatusBadge></div>
			<p className="mt-3 text-xl font-semibold tabular-nums">{formatMoney(locale, item.agreedAmountMinor - item.discountMinor, item.currency)}<span className="ml-1.5 text-xs font-normal text-muted-foreground">{t("per month")}</span></p>
			<div className="mt-2 space-y-1 text-sm leading-6 text-muted-foreground">
				<p>{t("Started {date}", { date: formatDate(locale, new Date(item.startDate), { dateStyle: "long", timeZone: "UTC" }) })}</p>
				{item.paymentDue ? <p className="font-medium text-foreground">{t(item.paymentDue.kind === "pending" ? "Payment due: {date}" : "Expected payment due: {date}", { date: formatDate(locale, new Date(item.paymentDue.date), { dateStyle: "long", timeZone: "UTC" }) })}</p> : <p>{t("No upcoming payment scheduled.")}</p>}
			</div>
			{item.status !== "ended" ? <div className="mt-4 flex flex-wrap gap-2 border-t pt-3"><Button className="min-h-10" size="sm" variant="outline" onClick={() => editTerms(item)}>{t("Edit future terms")}</Button><Button className="min-h-10" size="sm" variant="outline" onClick={() => status(item.id, item.status === "active" ? "paused" : "active")}>{t(item.status === "active" ? "Pause" : "Resume")}</Button><Button className="min-h-10" size="sm" variant="outline" onClick={() => status(item.id, "ended")}>{t("End")}</Button></div> : null}
		</li>)}</ul> : <EmptyState text={t("No enrollments yet.")} />}
		{adding ? <CenteredDialog open title={t("Add enrollment")} description={t("The first monthly fee is due on the start date. Then pay once a month.")} pending={pending} onClose={() => setAdding(false)} returnFocus={addButtonRef}>
			<form onSubmit={submit} className="space-y-5 p-5 sm:p-7"><fieldset disabled={pending} className="grid gap-4">
				<div className="grid gap-2"><Label htmlFor="enrollment-plan">{t("Plan")}</Label><SelectField id="enrollment-plan" value={planId} onValueChange={(value) => { setPlanId(value); setError(null); }} options={[{ value: "", label: t("Choose a plan") }, ...availablePlans.map((plan) => ({ value: plan.id, label: plan.name }))]} />{availablePlans.length === 0 ? <p className="text-sm text-muted-foreground">{t("No active plans are available at this member's branch.")}</p> : null}</div>
				<div className="grid gap-2"><Label htmlFor="enrollment-start">{t("Start date")}</Label><DatePicker id="enrollment-start" label={t("Start date")} value={startDate} onChange={(value) => { setStartDate(value); setError(null); }} /></div>
				<div className="grid gap-2"><Label htmlFor="enrollment-day">{t("Monthly payment day")}</Label><BillingDayInput id="enrollment-day" value={monthlyDay} onValueChange={(value) => { setChosenDay(value); setError(null); }} maxDay={31} required /><p className="text-xs leading-5 text-muted-foreground">{t("Starts with the signup day. You can choose any day from 1 to 31. Short months use their last day, then return to your chosen day.")}</p>{chosenDay !== null ? <Button type="button" variant="ghost" className="w-fit px-0 text-sm" onClick={() => setChosenDay(null)}>{t("Use the signup day")}</Button> : null}</div>
				{firstDueDate && !invalidDay && selectedPlan ? <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm leading-6"><p className="font-medium">{t("First monthly fee: {amount}, due {date}.", { amount: formatMoney(locale, selectedPlan.amountMinor, selectedPlan.currency), date: formatDate(locale, new Date(firstDueDate), { dateStyle: "long", timeZone: "UTC" }) })}</p><p>{t("Following payment: {date}. Short months use their last day.", { date: formatDate(locale, new Date(billingDateInMonth(nextBillingMonth(firstDueDate.slice(0, 7)), recurringDay)), { dateStyle: "long", timeZone: "UTC" }) })}</p><p className="text-muted-foreground">{t("The full monthly amount applies. Saving creates the fee; confirm the money received in the next step.")}</p></div> : null}
			</fieldset>{error ? <p role="alert" className="text-sm text-destructive">{t(error)}</p> : null}<div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={pending} onClick={() => setAdding(false)}>{t("Cancel")}</Button><LoadingButton type="submit" loading={pending} loadingLabel={t("Saving…")} disabled={pending || !planId || !startDate || invalidDay}>{t("Save and review payment")}</LoadingButton></div></form>
		</CenteredDialog> : null}
		{dialog}
	</section>;
}

function PaymentHistory({ payments, showHistory }: { payments: MemberDetail["payments"]; showHistory: boolean }) {
	const { locale, t } = useI18n();
	return <div id="member-payments" hidden={!showHistory}><section className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6"><SectionHeading title={t("Payment history")} description={t("See which monthly fees each receipt covers and any money left as an advance.")} />{payments.length ? <ul className="divide-y">{payments.map((item) => <li key={item.id} className="space-y-4 py-5 first:pt-0 last:pb-0">
		<div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-muted-foreground break-all">{t("Receipt: {receipt}", { receipt: item.receiptNumber })}</p><p className="mt-1 text-sm">{formatDate(locale, new Date(item.paidAt), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {paymentMethodLabel({ id: item.method, name: item.methodName }, t)}</p></div><div className="flex flex-wrap items-center gap-3"><strong className="text-lg tabular-nums">{formatMoney(locale, item.amountMinor, item.currency)}</strong><PaymentReceiptStatus payment={item} /></div></div>
		<div className="rounded-xl bg-muted/35 p-4"><PaymentApplicationDetails payment={item} /></div>
	</li>)}</ul> : <EmptyState text={t("No payments yet.")} />}</section></div>;
}

function ContactSection({ memberId, contacts, onChanged }: { memberId: string; contacts: MemberDetail["contacts"]; onChanged: () => void }) {
	const { dialog, openDialog } = useActionDialog();
	const [adding, setAdding] = useState(false);
	const addButtonRef = useRef<HTMLButtonElement>(null);
	const t = useT(); const shell = useAppShell(); const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [relationship, setRelationship] = useState(""); const [pending, setPending] = useState(false); const [failed, setFailed] = useState(false);
	async function submit(event: FormEvent) { event.preventDefault(); setPending(true); setFailed(false); try { await controlMembersApi.addContact(shell.organizationId, memberId, { displayName: name, phoneE164: phone, relationship, isPrimary: contacts.length === 0, isBillingContact: true }); setName(""); setPhone(""); setRelationship(""); setAdding(false); onChanged(); } catch { setFailed(true); } finally { setPending(false); } }
	async function update(item: MemberDetail["contacts"][number], input: Record<string, unknown>) { setFailed(false); try { await controlMembersApi.updateContact(shell.organizationId, memberId, item.relationshipId, input); onChanged(); } catch { setFailed(true); } }
	function unlink(item: MemberDetail["contacts"][number]) {
		openDialog({ title: t("Unlink contact"), description: t("Unlink {name} from this member? The contact record will be preserved.", { name: item.displayName }), confirmLabel: t("Unlink"), destructive: true,
			onConfirm: async () => { await controlMembersApi.unlinkContact(shell.organizationId, memberId, item.relationshipId); onChanged(); },
		});
	}
	return <section className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6">{dialog}
		<SectionHeading title={t("Contacts")} description={t("People to contact about this member.")} action={<Button ref={addButtonRef} variant="outline" onClick={() => { setFailed(false); setAdding(true); }}><Plus className="size-4" />{t("Add contact")}</Button>} />
		{contacts.length ? <ul className="space-y-3">{contacts.map((item) => <li key={item.relationshipId} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="font-semibold break-words">{item.displayName}</h3><p className="mt-1 text-sm text-muted-foreground">{item.relationship}</p></div><div className="flex flex-wrap gap-1">{item.isPrimary ? <StatusBadge>{t("Primary contact")}</StatusBadge> : null}{item.isBillingContact ? <StatusBadge>{t("Billing contact")}</StatusBadge> : null}</div></div><p className="mt-3 text-sm break-all">{[item.phoneE164, item.email].filter(Boolean).join(" · ") || t("No contact information")}</p><div className="mt-4 flex flex-wrap gap-2 border-t pt-3">{!item.isPrimary ? <Button className="min-h-10" size="sm" variant="outline" onClick={() => void update(item, { isPrimary: true })}>{t("Make primary")}</Button> : null}{!item.isBillingContact ? <Button className="min-h-10" size="sm" variant="outline" onClick={() => void update(item, { isBillingContact: true })}>{t("Make billing contact")}</Button> : null}<Button className="min-h-10 text-muted-foreground" size="sm" variant="ghost" onClick={() => unlink(item)}>{t("Unlink")}</Button></div></li>)}</ul> : <EmptyState text={t("No contacts yet.")} />}
		{failed && !adding ? <p role="alert" className="text-sm text-destructive">{t("We could not update contacts.")}</p> : null}
		{adding ? <CenteredDialog open title={t("Add contact")} description={t("People to contact about this member.")} pending={pending} onClose={() => setAdding(false)} returnFocus={addButtonRef}><form onSubmit={submit} className="space-y-5 p-5 sm:p-7"><fieldset disabled={pending} className="grid gap-4"><div className="grid gap-2"><Label htmlFor="contact-name">{t("Contact name")}</Label><Input id="contact-name" value={name} required onChange={(event) => setName(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="contact-relationship">{t("Relationship")}</Label><Input id="contact-relationship" placeholder={t("Relationship, for example: mother")} value={relationship} required onChange={(event) => setRelationship(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="contact-phone">{t("Contact phone")}</Label><Input id="contact-phone" type="tel" placeholder="+57 300 000 0000" value={phone} onChange={(event) => setPhone(event.target.value)} /></div></fieldset>{failed ? <p role="alert" className="text-sm text-destructive">{t("We could not update contacts.")}</p> : null}<div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={pending} onClick={() => setAdding(false)}>{t("Cancel")}</Button><LoadingButton type="submit" loading={pending} loadingLabel={t("Saving…")} disabled={pending || !name.trim() || !relationship.trim()}>{t("Add contact")}</LoadingButton></div></form></CenteredDialog> : null}
	</section>;
}

function EmptyState({ text }: { text: string }) {
	return <p className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm leading-6 text-muted-foreground">{text}</p>;
}

function FinancialSection({ detail, money }: { detail: MemberDetail; money: (value: number) => string }) {
	const t = useT();
	const { locale } = useI18n();
	return <section className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6"><SectionHeading title={t("Charges")} description={t("Check which monthly fees are paid or still outstanding.")} />{detail.charges.length ? <ul className="divide-y">{detail.charges.map((item) => <li key={item.id} className="space-y-3 py-4 first:pt-0 last:pb-0"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="font-medium break-words">{item.planName}</h3><p className="mt-1 text-xs text-muted-foreground">{formatDate(locale, new Date(item.billingPeriod + "-01"), { month: "long", year: "numeric", timeZone: "UTC" })} · {t("Due {date}", { date: formatDate(locale, new Date(item.dueDate), { day: "numeric", month: "short", timeZone: "UTC" }) })}</p></div><StatusBadge tone={item.paymentState === "paid" ? "success" : item.paymentState === "overdue" ? "danger" : item.paymentState === "void" ? "neutral" : "warning"}>{t(item.paymentState === "paid" ? "Paid" : item.paymentState === "overdue" ? "Overdue" : item.paymentState === "partial" ? "Partial" : item.paymentState === "void" ? "Cancelled" : "Pending")}</StatusBadge></div><div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/35 px-3 py-2 text-sm"><span className="text-muted-foreground">{t("Outstanding")}</span><strong className="tabular-nums">{money(item.outstandingMinor)}</strong></div></li>)}</ul> : <EmptyState text={t("No charges yet.")} />}</section>;
}
