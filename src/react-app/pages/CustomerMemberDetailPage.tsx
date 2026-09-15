import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppShell } from "@/hooks/use-app-shell";
import { billingSetupApi, type Plan } from "@/lib/billing-setup";
import { controlMembersApi, type MemberDetail } from "@/lib/controlmembers";
import { useI18n, useT } from "@/lib/i18n";

export function CustomerMemberDetailPage() {
	const { id = "" } = useParams();
	const t = useT();
	const { locale } = useI18n();
	const shell = useAppShell();
	const [detail, setDetail] = useState<MemberDetail | null>(null);
	const [plans, setPlans] = useState<Plan[]>([]);
	const [failed, setFailed] = useState(false);
	const [revision, setRevision] = useState(0);
	const [editing, setEditing] = useState(false);
	useEffect(() => {
		void Promise.all([controlMembersApi.member(shell.organizationId, id), billingSetupApi.plans(shell.organizationId)])
			.then(([member, catalog]) => { setDetail(member); setPlans(catalog.plans.filter((plan) => plan.isActive)); setFailed(false); })
			.catch(() => setFailed(true));
	}, [id, revision, shell.organizationId]);
	if (failed) return <PageContainer><p role="alert">{t("We could not load this member.")}</p></PageContainer>;
	if (!detail) return <PageContainer><p role="status">{t("Loading member…")}</p></PageContainer>;
	const currency = detail.charges[0]?.currency ?? detail.enrollments[0]?.currency ?? plans[0]?.currency ?? "COP";
	const money = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency }).format(value / 100);
	return <PageContainer className="space-y-6">
		<Link to="/app/customer-members" className="text-sm font-medium underline">← {t("Back to members")}</Link>
		<PageHeader title={detail.member.displayName} description={t("Member profile, enrollments and payment history.")} />
		<div className="grid gap-3 sm:grid-cols-3"><Metric label={t("Outstanding")} value={money(detail.summary.grossOutstandingMinor)} /><Metric label={t("Available credit")} value={money(detail.summary.creditMinor)} /><Metric label={t("Net balance")} value={money(detail.summary.netMinor)} /></div>
		<div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-muted px-3 py-1 text-sm">{t(detail.member.status === "active" ? "Active" : detail.member.status === "paused" ? "Paused" : "Inactive")}</span><Button variant="outline" onClick={() => setEditing((value) => !value)}>{t(editing ? "Close form" : "Edit member")}</Button>{detail.member.status === "active" ? <><Button variant="outline" onClick={() => void changeStatus("paused")}>{t("Pause member")}</Button><Button variant="outline" onClick={() => void changeStatus("inactive")}>{t("Deactivate member")}</Button></> : <Button variant="outline" onClick={() => void changeStatus("active")}>{t("Reactivate member")}</Button>}</div>
		{editing ? <MemberProfileForm member={detail.member} onSaved={() => { setEditing(false); reload(); }} /> : null}
		<div className="grid gap-6 xl:grid-cols-2"><EnrollmentSection memberId={id} memberBranchId={detail.member.primaryBranchId} plans={plans} enrollments={detail.enrollments} onChanged={reload} /><PaymentSection memberId={id} branchId={detail.member.primaryBranchId} payments={detail.payments} currency={currency} onChanged={reload} /></div>
		<div className="grid gap-6 xl:grid-cols-2"><ContactSection memberId={id} contacts={detail.contacts} onChanged={reload} /><FinancialSection detail={detail} money={money} /></div>
	</PageContainer>;

	function reload() { setRevision((value) => value + 1); }
	async function changeStatus(status: string) {
		const consequence = status === "active" ? t("Reactivate this member?") : t("This keeps all existing charges and payments. Continue?");
		if (!window.confirm(consequence)) return;
		const reason = window.prompt(t("Reason for this change"));
		if (!reason?.trim()) return;
		await controlMembersApi.updateMemberStatus(shell.organizationId, id, status, reason); reload();
	}
}

function MemberProfileForm({ member, onSaved }: { member: MemberDetail["member"]; onSaved: () => void }) {
	const t = useT(); const shell = useAppShell(); const [pending, setPending] = useState(false); const [failed, setFailed] = useState(false);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault(); setPending(true); setFailed(false);
		const form = new FormData(event.currentTarget);
		try {
			await controlMembersApi.updateMember(shell.organizationId, member.id, { displayName: form.get("displayName"), primaryBranchId: form.get("primaryBranchId"), documentType: form.get("documentType"), documentNumber: form.get("documentNumber"), birthDate: form.get("birthDate"), email: form.get("email"), phoneE164: form.get("phoneE164"), notes: form.get("notes") });
			onSaved();
		} catch { setFailed(true); } finally { setPending(false); }
	}
	return <form onSubmit={submit} className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
		<h2 className="font-semibold sm:col-span-2">{t("Edit member")}</h2>
		<Field label={t("Name")} name="displayName" defaultValue={member.displayName} required />
		{shell.branches.length > 1 ? <div className="grid gap-2"><Label htmlFor="member-branch">{t("Branch")}</Label><select id="member-branch" name="primaryBranchId" defaultValue={member.primaryBranchId} className="h-10 rounded-md border bg-background px-3">{shell.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div> : <input type="hidden" name="primaryBranchId" value={member.primaryBranchId} />}
		<Field label={t("Document type")} name="documentType" defaultValue={member.documentType ?? ""} />
		<Field label={t("Document number")} name="documentNumber" defaultValue={member.documentNumber ?? ""} />
		<Field label={t("Birth date")} name="birthDate" defaultValue={(member as MemberDetail["member"] & { birthDate?: string | null }).birthDate ?? ""} type="date" />
		<Field label={t("Email")} name="email" defaultValue={member.email ?? ""} type="email" />
		<Field label={t("Phone")} name="phoneE164" defaultValue={member.phoneE164 ?? ""} />
		<div className="grid gap-2 sm:col-span-2"><Label htmlFor="member-notes">{t("Notes")}</Label><textarea id="member-notes" name="notes" defaultValue={member.notes ?? ""} maxLength={2000} className="min-h-24 rounded-md border bg-background p-3" /></div>
		{failed ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{t("We could not update this member.")}</p> : null}
		<div className="sm:col-span-2"><Button disabled={pending}>{t(pending ? "Saving…" : "Save member")}</Button></div>
	</form>;
}

function Field({ label, name, defaultValue, required, type = "text" }: { label: string; name: string; defaultValue: string; required?: boolean; type?: string }) {
	return <div className="grid gap-2"><Label htmlFor={`member-${name}`}>{label}</Label><Input id={`member-${name}`} name={name} type={type} defaultValue={defaultValue} required={required} /></div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>; }

function EnrollmentSection({ memberId, memberBranchId, plans, enrollments, onChanged }: { memberId: string; memberBranchId: string; plans: Plan[]; enrollments: MemberDetail["enrollments"]; onChanged: () => void }) {
	const t = useT(); const shell = useAppShell();
	const availablePlans = plans.filter((plan) => plan.branchIds.includes(memberBranchId));
	const [selectedPlanId, setPlanId] = useState(availablePlans[0]?.id ?? ""); const planId = availablePlans.some((plan) => plan.id === selectedPlanId) ? selectedPlanId : availablePlans[0]?.id ?? ""; const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10)); const [pending, setPending] = useState(false); const [failed, setFailed] = useState(false);
	async function submit(event: FormEvent) { event.preventDefault(); setPending(true); setFailed(false); try { await controlMembersApi.addEnrollment(shell.organizationId, memberId, { planId, branchId: memberBranchId, startDate }); onChanged(); } catch { setFailed(true); } finally { setPending(false); } }
	async function status(id: string, value: string) { const reason = window.prompt(t("Reason for this change")); if (!reason?.trim()) return; await controlMembersApi.updateEnrollment(shell.organizationId, id, { status: value, reason }); onChanged(); }
	async function editTerms(item: MemberDetail["enrollments"][number]) { const amount = window.prompt(t("Agreed monthly amount ({currency})", { currency: item.currency }), String(item.agreedAmountMinor / 100)); if (amount === null) return; const dueDay = window.prompt(t("Due day from 1 to 28"), String(item.dueDay)); if (dueDay === null) return; const discount = window.prompt(t("Monthly discount ({currency})", { currency: item.currency }), String(item.discountMinor / 100)); if (discount === null) return; const reason = window.prompt(t("Reason for this change")); if (!reason?.trim()) return; await controlMembersApi.updateEnrollment(shell.organizationId, item.id, { agreedAmountMinor: Math.round(Number(amount) * 100), dueDay: Number(dueDay), discountMinor: Math.round(Number(discount) * 100), reason }); onChanged(); }
	return <section className="space-y-4 rounded-xl border bg-card p-4"><div><h2 className="font-semibold">{t("Enrollments")}</h2><p className="text-sm text-muted-foreground">{t("Plans currently or previously assigned to this member.")}</p></div>{enrollments.length ? <ul className="grid gap-2">{enrollments.map((item) => <li key={item.id} className="rounded-lg bg-muted/50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{item.planName}</strong><span className="text-sm">{t(item.status === "active" ? "Active" : item.status === "paused" ? "Paused" : "Ended")}</span></div><p className="text-sm text-muted-foreground">{t("Started {date} · due day {day}", { date: item.startDate, day: item.dueDay })}</p>{item.status !== "ended" ? <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void editTerms(item)}>{t("Edit future terms")}</Button>{item.status === "active" ? <Button size="sm" variant="outline" onClick={() => void status(item.id, "paused")}>{t("Pause")}</Button> : <Button size="sm" variant="outline" onClick={() => void status(item.id, "active")}>{t("Resume")}</Button>}<Button size="sm" variant="outline" onClick={() => void status(item.id, "ended")}>{t("End")}</Button></div> : null}</li>)}</ul> : <p className="text-sm text-muted-foreground">{t("No enrollments yet.")}</p>}
		<form onSubmit={submit} className="grid gap-3 border-t pt-4"><h3 className="font-medium">{t("Add enrollment")}</h3><div className="grid gap-2"><Label htmlFor="enrollment-plan">{t("Plan")}</Label><select id="enrollment-plan" className="h-10 rounded-md border bg-background px-3" value={planId} onChange={(event) => setPlanId(event.target.value)}><option value="">{t("Choose a plan")}</option>{availablePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select>{availablePlans.length === 0 ? <p className="text-sm text-muted-foreground">{t("No active plans are available at this member's branch.")}</p> : null}</div><div className="grid gap-2"><Label htmlFor="enrollment-start">{t("Start date")}</Label><Input id="enrollment-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div>{failed ? <p role="alert" className="text-sm">{t("We could not add the enrollment.")}</p> : null}<div><Button disabled={pending || !planId}>{t(pending ? "Saving…" : "Add enrollment")}</Button></div></form>
	</section>;
}

function PaymentSection({ memberId, branchId, payments, currency, onChanged }: { memberId: string; branchId: string; payments: MemberDetail["payments"]; currency: string; onChanged: () => void }) {
	const t = useT(); const shell = useAppShell();
	const [amount, setAmount] = useState(""); const [method, setMethod] = useState("cash"); const [pending, setPending] = useState(false); const [failed, setFailed] = useState(false); const [receipt, setReceipt] = useState<string | null>(null); const [previewState, setPreview] = useState<{ amountMinor: number; allocations: Array<{ chargeId: string; amountMinor: number; dueDate: string; planName: string }>; allocatedMinor: number; creditMinor: number } | null>(null); const currentAmountMinor = Math.round(Number(amount) * 100); const preview = previewState?.amountMinor === currentAmountMinor ? previewState : null;
	useEffect(() => { const amountMinor = Math.round(Number(amount) * 100); if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return; const timer = window.setTimeout(() => { void controlMembersApi.paymentPreview(shell.organizationId, memberId, amountMinor).then((result) => setPreview({ amountMinor, ...result })).catch(() => setPreview(null)); }, 250); return () => window.clearTimeout(timer); }, [amount, memberId, shell.organizationId]);
	function changeAllocation(chargeId: string, value: string) { if (!preview) return; const allocations = preview.allocations.map((item) => item.chargeId === chargeId ? { ...item, amountMinor: Math.max(0, Math.round(Number(value) * 100) || 0) } : item); const allocatedMinor = allocations.reduce((sum, item) => sum + item.amountMinor, 0); setPreview({ ...preview, allocations, allocatedMinor, creditMinor: Math.max(0, preview.amountMinor - allocatedMinor) }); }
	async function submit(event: FormEvent) { event.preventDefault(); const amountMinor = Math.round(Number(amount) * 100); if (!preview || preview.allocatedMinor > amountMinor || !window.confirm(t("Record this payment with the allocation shown below?"))) return; setPending(true); setFailed(false); try { const result = await controlMembersApi.createPayment(shell.organizationId, { memberId, branchId, amountMinor, method, paidAt: new Date().toISOString(), allocations: preview.allocations.filter((item) => item.amountMinor > 0).map(({ chargeId, amountMinor: allocated }) => ({ chargeId, amountMinor: allocated })), idempotencyKey: crypto.randomUUID() }); setReceipt(result.receiptNumber); setAmount(""); onChanged(); } catch { setFailed(true); } finally { setPending(false); } }
	return <section className="space-y-4 rounded-xl border bg-card p-4"><div><h2 className="font-semibold">{t("Record payment")}</h2><p className="text-sm text-muted-foreground">{t("Payments are applied to the oldest outstanding charges first. You can adjust the distribution before saving.")}</p></div><form onSubmit={submit} className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="payment-amount">{t("Amount ({currency})", { currency })}</Label><Input id="payment-amount" type="number" min="0.01" step="0.01" value={amount} required onChange={(event) => setAmount(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="payment-method">{t("Payment method")}</Label><select id="payment-method" className="h-10 rounded-md border bg-background px-3" value={method} onChange={(event) => setMethod(event.target.value)}><option value="cash">{t("Cash")}</option><option value="bank_transfer">{t("Bank transfer")}</option><option value="card">{t("Card")}</option><option value="other">{t("Other")}</option></select></div>{preview ? <div className="rounded-lg bg-muted/60 p-3 text-sm sm:col-span-2"><p className="font-medium">{t("Allocation preview")}</p>{preview.allocations.length ? <ul className="mt-2 grid gap-2">{preview.allocations.map((item) => <li key={item.chargeId} className="grid gap-2 sm:grid-cols-[1fr_8rem] sm:items-center"><span>{item.planName} · {item.dueDate}</span><Input aria-label={t("Amount applied to {plan}", { plan: item.planName })} type="number" min="0" step="0.01" value={item.amountMinor / 100} onChange={(event) => changeAllocation(item.chargeId, event.target.value)} /></li>)}</ul> : <p className="mt-1 text-muted-foreground">{t("No open charges. The payment will remain as credit.")}</p>}{preview.allocatedMinor > preview.amountMinor ? <p role="alert" className="mt-2 text-destructive">{t("Allocated amount cannot exceed the payment.")}</p> : null}{preview.creditMinor > 0 ? <p className="mt-2">{t("Credit after payment: {amount}", { amount: new Intl.NumberFormat(undefined, { style: "currency", currency }).format(preview.creditMinor / 100) })}</p> : null}</div> : null}{failed ? <p role="alert" className="text-sm sm:col-span-2">{t("We could not record the payment. Reload balances and try again.")}</p> : null}{receipt ? <p role="status" className="text-sm sm:col-span-2">{t("Payment recorded. Receipt: {receipt}", { receipt })}</p> : null}<div className="sm:col-span-2"><Button disabled={pending || !amount || !preview || preview.allocatedMinor > preview.amountMinor}>{t(pending ? "Recording…" : "Review and record payment")}</Button></div></form>{payments.length ? <div className="border-t pt-3"><h3 className="text-sm font-medium">{t("Recent payments")}</h3><ul className="mt-2 grid gap-2">{payments.slice(0, 5).map((item) => <li key={item.id} className="flex justify-between text-sm"><span>{item.receiptNumber}</span><span>{item.status === "reversed" ? t("Reversed") : t("Posted")}</span></li>)}</ul></div> : null}</section>;
}

function ContactSection({ memberId, contacts, onChanged }: { memberId: string; contacts: MemberDetail["contacts"]; onChanged: () => void }) {
	const t = useT(); const shell = useAppShell(); const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [relationship, setRelationship] = useState(""); const [pending, setPending] = useState(false); const [failed, setFailed] = useState(false);
	async function submit(event: FormEvent) { event.preventDefault(); setPending(true); setFailed(false); try { await controlMembersApi.addContact(shell.organizationId, memberId, { displayName: name, phoneE164: phone, relationship, isPrimary: contacts.length === 0, isBillingContact: true }); setName(""); setPhone(""); setRelationship(""); onChanged(); } catch { setFailed(true); } finally { setPending(false); } }
	async function update(item: MemberDetail["contacts"][number], input: Record<string, unknown>) { setFailed(false); try { await controlMembersApi.updateContact(shell.organizationId, memberId, item.relationshipId, input); onChanged(); } catch { setFailed(true); } }
	async function unlink(item: MemberDetail["contacts"][number]) { if (!window.confirm(t("Unlink {name} from this member? The contact record will be preserved.", { name: item.displayName }))) return; try { await controlMembersApi.unlinkContact(shell.organizationId, memberId, item.relationshipId); onChanged(); } catch { setFailed(true); } }
	return <section className="space-y-4 rounded-xl border bg-card p-4"><h2 className="font-semibold">{t("Contacts")}</h2>{contacts.length ? <ul className="grid gap-2">{contacts.map((item) => <li key={item.relationshipId} className="rounded-lg bg-muted/50 p-3"><strong>{item.displayName}</strong><p className="text-sm text-muted-foreground">{item.relationship} · {item.phoneE164 || item.email || t("No contact information")}</p><div className="mt-2 flex flex-wrap items-center gap-2">{item.isPrimary ? <span className="text-xs font-medium">{t("Primary contact")}</span> : <Button size="sm" variant="outline" onClick={() => void update(item, { isPrimary: true })}>{t("Make primary")}</Button>}{item.isBillingContact ? <span className="text-xs font-medium">{t("Billing contact")}</span> : <Button size="sm" variant="outline" onClick={() => void update(item, { isBillingContact: true })}>{t("Make billing contact")}</Button>}<Button size="sm" variant="outline" onClick={() => void unlink(item)}>{t("Unlink")}</Button></div></li>)}</ul> : <p className="text-sm text-muted-foreground">{t("No contacts yet.")}</p>}<form onSubmit={submit} className="grid gap-3 border-t pt-4"><h3 className="font-medium">{t("Add contact")}</h3><Input aria-label={t("Contact name")} placeholder={t("Contact name")} value={name} required onChange={(event) => setName(event.target.value)} /><Input aria-label={t("Relationship")} placeholder={t("Relationship, for example: mother")} value={relationship} required onChange={(event) => setRelationship(event.target.value)} /><Input aria-label={t("Contact phone")} placeholder="+57 300 000 0000" value={phone} onChange={(event) => setPhone(event.target.value)} />{failed ? <p role="alert" className="text-sm">{t("We could not update contacts.")}</p> : null}<div><Button disabled={pending || !name.trim() || !relationship.trim()}>{t(pending ? "Saving…" : "Add contact")}</Button></div></form></section>;
}

function FinancialSection({ detail, money }: { detail: MemberDetail; money: (value: number) => string }) {
	const t = useT();
	return <section className="space-y-4 rounded-xl border bg-card p-4"><h2 className="font-semibold">{t("Financial activity")}</h2>{detail.charges.length ? <ul className="grid gap-2">{detail.charges.map((item) => <li key={item.id} className="rounded-lg border p-3"><div className="flex justify-between gap-3"><strong>{item.planName} · {item.billingPeriod}</strong><span>{money(item.outstandingMinor)}</span></div><p className="text-sm text-muted-foreground">{t("Due {date}", { date: item.dueDate })}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">{t("No charges yet.")}</p>}</section>;
}
