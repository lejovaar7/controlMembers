import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CenteredDialog, type DialogReturnFocus } from "@/components/centered-dialog";
import { LoadingButton } from "@/components/loading-button";
import { Loader } from "@/components/loader";
import { ListSkeleton } from "@/components/content-skeleton";
import { MoneyInput } from "@/components/money-input";
import { SelectField } from "@/components/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppShell } from "@/hooks/use-app-shell";
import { usePagedDirectory } from "@/hooks/use-paged-directory";
import { paymentMethodLabel, usePaymentMethods } from "@/hooks/use-payment-methods";
import { billingSetupApi } from "@/lib/billing-setup";
import { controlMembersApi, ProductApiError, type MemberDetail, type Payment, type PaymentPreview } from "@/lib/controlmembers";
import { memberPaymentDefault } from "@/lib/member-payment-default";
import { createIdempotencyKey } from "@/lib/idempotency-key";
import { pendingPaymentAttempts, paymentAttemptScope, type PaymentAttempt } from "@/lib/payment-attempt";
import { useI18n } from "@/lib/i18n";
import { formatDate, formatMoney, type MessageKey } from "../../shared/i18n";

type Props = { memberId?: string; chargeId?: string; returnFocus?: DialogReturnFocus; onClose: () => void; onSaved: (payment: Payment) => void };

export function PaymentDialog(props: Props) {
	const [memberId, setMemberId] = useState(props.memberId ?? null);
	return memberId ? <PaymentLoader key={memberId} {...props} memberId={memberId} onChangeMember={props.memberId ? undefined : () => setMemberId(null)} /> : <MemberChooser {...props} onSelect={setMemberId} />;
}

function MemberChooser({ returnFocus, onClose, onSelect }: Props & { onSelect: (id: string) => void }) {
	const shell = useAppShell(); const { t } = useI18n(); const [search, setSearch] = useState("");
	const load = useCallback(async (offset: number, signal: AbortSignal) => { const result = await controlMembersApi.members(shell.organizationId, search, "", offset, signal); return { rows: result.members, nextOffset: result.nextOffset }; }, [shell.organizationId, search]);
	const list = usePagedDirectory(load);
	return <CenteredDialog open title={t("Record payment")} description={t("Choose a member to record a payment.")} returnFocus={returnFocus} onClose={onClose}>
		<div className="space-y-4 p-5 sm:p-7"><Label htmlFor="payer-search">{t("Search member")}</Label><Input id="payer-search" value={search} placeholder={t("Search by name or ID number")} onChange={(event) => setSearch(event.target.value)} />
			<p className="text-xs text-muted-foreground">{shell.activeBranch?.name}</p>
			{list.loading ? <ListSkeleton label={t("Loading members…")} /> : list.failed ? <div role="alert"><p>{t("We could not load members.")}</p><Button onClick={list.reload}>{t("Try again")}</Button></div> : <ul className="divide-y rounded-xl border">{list.rows.map((member) => <li key={member.id}><button className="flex min-h-14 w-full flex-col gap-1 px-4 py-3 text-left hover:bg-muted/50" onClick={() => onSelect(member.id)}><span className="font-medium break-words">{member.displayName}</span><span className="text-xs text-muted-foreground">{member.documentNumber}</span></button></li>)}</ul>}
			{!list.loading && !list.failed && !list.rows.length ? <p>{t("No members match your search.")}</p> : null}
			{list.moreFailed ? <p role="alert">{t("We could not load the next results.")}</p> : null}
			{list.nextOffset !== null ? <LoadingButton loading={list.morePending} variant="outline" onClick={() => void list.loadMore()}>{t("Load more")}</LoadingButton> : null}
		</div>
	</CenteredDialog>;
}

function PaymentLoader(props: Props & { memberId: string; onChangeMember?: () => void }) {
	const shell = useAppShell(); const { t } = useI18n();
	const [loaded, setLoaded] = useState<{ detail: MemberDetail; currency: string } | null>(null); const [failed, setFailed] = useState(false); const [revision, setRevision] = useState(0);
	useEffect(() => { const controller = new AbortController(); void Promise.all([controlMembersApi.member(shell.organizationId, props.memberId, controller.signal), billingSetupApi.settings(shell.organizationId)]).then(([detail, settings]) => { if (!controller.signal.aborted) { if (!settings.currency) throw new Error("Billing not configured"); setLoaded({ detail, currency: settings.currency }); setFailed(false); } }).catch(() => { if (!controller.signal.aborted) setFailed(true); }); return () => controller.abort(); }, [shell.organizationId, props.memberId, revision]);
	if (loaded) return <PaymentComposer {...props} {...loaded} />;
	return <CenteredDialog open title={t("Record payment")} description={t("Review the member, branch and amounts before confirming.")} onClose={props.onClose} returnFocus={props.returnFocus}><div className="space-y-4 p-5 sm:p-7">{failed ? <div role="alert"><p>{t("We could not prepare this payment. Please try again.")}</p><Button onClick={() => { setFailed(false); setRevision((value) => value + 1); }}>{t("Try again")}</Button></div> : <Loader label={t("Preparing payment…")} />}</div></CenteredDialog>;
}

function PaymentComposer({ detail, currency, chargeId, returnFocus, onClose, onSaved, onChangeMember }: Props & { detail: MemberDetail; currency: string; onChangeMember?: () => void }) {
	const shell = useAppShell(); const { t, locale } = useI18n(); const memberId = detail.member.id; const branchId = shell.activeBranch?.id ?? detail.member.primaryBranchId;
	const methods = usePaymentMethods(shell.organizationId); const scope = paymentAttemptScope(shell.organizationId, branchId, memberId);
	const target = detail.charges.find((charge) => charge.id === chargeId && charge.branchId === branchId && charge.lifecycle === "open" && charge.outstandingMinor > 0);
	const initial = chargeId ? target?.outstandingMinor ?? 0 : memberPaymentDefault(detail, branchId);
	const [amount, setAmount] = useState(initial > 0 ? String(initial / 100) : ""); const [method, setMethod] = useState("cash"); const [destination, setDestination] = useState(chargeId ?? "oldest");
	const [preview, setPreview] = useState<PaymentPreview | null>(null); const [previewFailed, setPreviewFailed] = useState(false); const [previewRevision, setPreviewRevision] = useState(0);
	const [attempt, setAttempt] = useState<PaymentAttempt | null>(() => pendingPaymentAttempts.get(scope) ?? null);
	const [uncertain, setUncertain] = useState(() => pendingPaymentAttempts.has(scope)); const [pending, setPending] = useState(false); const lock = useRef(false);
	const [error, setError] = useState<MessageKey | null>(null);
	const amountMinor = Math.round(Number(amount) * 100); const validAmount = Number.isSafeInteger(amountMinor) && amountMinor > 0;
	const validMethod = methods.methods.some((entry) => entry.id === method && entry.isActive) && !methods.failed && !methods.loading;
	const money = (value: number) => formatMoney(locale, value, currency);
	useEffect(() => {
		if (!validAmount || attempt) return;
		const controller = new AbortController();
		const timer = window.setTimeout(() => { void controlMembersApi.paymentPreview(shell.organizationId, memberId, amountMinor, destination === "oldest" ? undefined : destination, controller.signal).then((result) => { if (!controller.signal.aborted) { setPreview(result); setPreviewFailed(false); } }).catch((failure: unknown) => { if (!controller.signal.aborted) { setPreviewFailed(true); if (failure instanceof ProductApiError && (failure.status === 404 || failure.code === "CHARGE_NOT_PAYABLE")) setError("This fee is no longer available for payment."); } }); }, 250);
		return () => { controller.abort(); window.clearTimeout(timer); };
	}, [amountMinor, validAmount, attempt, destination, shell.organizationId, memberId, previewRevision]);
	function resetPreview() { setPreview(null); setPreviewFailed(false); setError(null); }
	function changeAllocation(id: string, value: string) {
		if (!preview) return;
		const allocations = preview.allocations.map((item) => item.chargeId === id ? { ...item, amountMinor: Math.max(0, Math.round(Number(value) * 100) || 0) } : item);
		const allocatedMinor = allocations.reduce((sum, item) => sum + item.amountMinor, 0);
		setPreview({ ...preview, allocations, allocatedMinor, creditMinor: Math.max(0, amountMinor - allocatedMinor) });
	}
	const validPreview = preview && preview.allocatedMinor <= amountMinor && preview.allocations.every((item) => Number.isSafeInteger(item.amountMinor) && item.amountMinor <= item.outstandingMinor);
	function review(event: FormEvent) {
		event.preventDefault(); if (!preview || !validPreview || !validAmount || !validMethod) return;
		setError(null); setAttempt({ input: { memberId, branchId, amountMinor, method, paidAt: new Date().toISOString(), allocations: preview.allocations.filter((item) => item.amountMinor > 0).map(({ chargeId: id, amountMinor: allocated }) => ({ chargeId: id, amountMinor: allocated })), idempotencyKey: createIdempotencyKey() }, preview, methodName: paymentMethodLabel(methods.methods.find((entry) => entry.id === method)!, t) });
	}
	async function confirm() {
		if (!attempt || lock.current) return;
		lock.current = true; setPending(true); setError(null); pendingPaymentAttempts.set(scope, attempt);
		try { const result = await controlMembersApi.createPayment(shell.organizationId, attempt.input); pendingPaymentAttempts.delete(scope); onSaved(result); }
		catch (failure) {
			if (!(failure instanceof ProductApiError) || failure.status >= 500) { setUncertain(true); setError("We could not confirm the result. Retry this same payment before starting another."); }
			else {
				pendingPaymentAttempts.delete(scope); setUncertain(false); setAttempt(null); setPreview(null); setPreviewFailed(false); setPreviewRevision((value) => value + 1);
				setError(failure.code === "ALLOCATION_CONFLICT" ? "The balance changed. Review the updated amounts before confirming again." : failure.code === "PAYMENT_METHOD_UNAVAILABLE" ? "Payment method is no longer available. Choose another method." : "We could not save this payment. Review the details and try again.");
				methods.reload();
			}
		} finally { lock.current = false; setPending(false); }
	}
	const displayed = attempt?.preview ?? preview;
	return <CenteredDialog open wide focusKey={attempt ? "review" : "entry"} title={t(attempt ? "Review payment" : "Record payment")} description={t("Review the member, branch and amounts before confirming.")} pending={pending} onClose={onClose} returnFocus={returnFocus}>
		<form onSubmit={attempt ? (event) => { event.preventDefault(); void confirm(); } : review} className="space-y-5 p-5 sm:p-7">
			<div className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-muted/40 p-4"><div className="min-w-0"><p className="font-semibold break-words">{detail.member.displayName}</p><p className="mt-1 text-sm text-muted-foreground">{shell.activeBranch?.name}</p></div>{onChangeMember && !attempt ? <Button type="button" variant="ghost" onClick={onChangeMember}>{t("Change member")}</Button> : null}</div>
			{attempt ? <div className="space-y-1"><p className="text-2xl font-semibold tabular-nums">{money(attempt.input.amountMinor)}</p><p className="text-sm text-muted-foreground">{attempt.methodName}</p></div> : <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
				<div className="grid gap-2"><Label htmlFor="payment-amount">{t("Amount")}</Label><MoneyInput id="payment-amount" min={0.01} value={amount} required onValueChange={(value) => { setAmount(value); resetPreview(); }} /></div>
				<div className="grid gap-2"><Label htmlFor="payment-method">{t("Payment method")}</Label><SelectField id="payment-method" value={method} onValueChange={setMethod} disabled={methods.loading || methods.failed} options={methods.loading || methods.failed ? [{ value: "cash", label: t("Cash") }] : methods.methods.map((entry) => ({ value: entry.id, label: paymentMethodLabel(entry, t) }))} /></div>
				{chargeId ? <div className="grid gap-2 sm:col-span-2"><Label htmlFor="payment-destination">{t("Payment destination")}</Label><SelectField id="payment-destination" value={destination} onValueChange={(value) => { setDestination(value); resetPreview(); }} options={[{ value: chargeId, label: t("Selected monthly fee") }, { value: "oldest", label: t("Oldest pending fees") }]} /></div> : <p className="text-xs text-muted-foreground sm:col-span-2">{t("Payments are applied to the oldest outstanding charges first. You can adjust the distribution before saving.")}</p>}
			</fieldset>}
			{!attempt && methods.failed ? <div role="alert"><p>{t("We could not load payment methods.")}</p><Button type="button" variant="outline" onClick={methods.reload}>{t("Try again")}</Button></div> : null}
			{displayed ? <div className="space-y-3 rounded-xl border p-4"><p className="text-sm font-medium">{t("How this payment will be used")}</p>{displayed.allocations.map((item) => <div key={item.chargeId} className="grid gap-2 text-sm sm:grid-cols-[1fr_9rem] sm:items-center"><div className="min-w-0"><p className="break-words">{item.planName}</p><p className="text-xs text-muted-foreground">{formatDate(locale, new Date(`${item.billingPeriod}-01T12:00:00Z`), { month: "long", year: "numeric", timeZone: "UTC" })} · {t("Due {date}", { date: formatDate(locale, new Date(`${item.dueDate}T12:00:00Z`), { dateStyle: "medium", timeZone: "UTC" }) })}</p></div>{attempt ? <strong className="tabular-nums sm:text-right">{money(item.amountMinor)}</strong> : <MoneyInput aria-label={t("Amount applied to {plan}", { plan: item.planName })} value={item.amountMinor / 100} min={0} max={item.outstandingMinor / 100} onValueChange={(value) => changeAllocation(item.chargeId, value)} />}</div>)}{!displayed.allocations.length ? <p className="text-sm text-muted-foreground">{t("No outstanding fees. This payment will remain as available credit.")}</p> : null}{displayed.creditMinor > 0 ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t("Credit after payment: {amount}", { amount: money(displayed.creditMinor) })}</p> : null}</div> : validAmount && !previewFailed ? <Loader label={t("Preparing payment…")} /> : null}
			{previewFailed && !attempt ? <div role="alert"><p>{t("We could not prepare this payment. Please try again.")}</p><Button type="button" variant="outline" onClick={() => { resetPreview(); setPreviewRevision((value) => value + 1); }}>{t("Try again")}</Button></div> : null}
			{error || uncertain ? <p role="alert" className="text-sm text-destructive">{t(error ?? "We could not confirm the result. Retry this same payment before starting another.")}</p> : null}
			{preview && !validPreview && !attempt ? <p role="alert" className="text-sm text-destructive">{t("Selected amount exceeds the current balance.")}</p> : null}
			<div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={pending} onClick={onClose}>{t("Cancel")}</Button>{attempt && !uncertain ? <Button type="button" variant="outline" disabled={pending} onClick={() => { setAttempt(null); resetPreview(); }}>{t("Back to payment")}</Button> : null}<LoadingButton type="submit" loading={pending} loadingLabel={t("Recording…")} disabled={!attempt && (!validAmount || !validPreview || !validMethod)}>{t(attempt ? uncertain ? "Retry same payment" : "Confirm payment" : "Review payment")}</LoadingButton></div>
		</form>
	</CenteredDialog>;
}
