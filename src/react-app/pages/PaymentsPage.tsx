import { paymentMethodLabel, usePaymentMethods } from "@/hooks/use-payment-methods";
import { SelectField } from "@/components/select-field";
import { useActionDialog } from "@/hooks/use-action-dialog";
import { DateRangePicker } from "@/components/date-picker";
import { PaymentsTable } from "@/components/payments-table";
import { useEffect, useMemo, useState } from "react";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppShell } from "@/hooks/use-app-shell";
import { controlMembersApi, type Payment } from "@/lib/controlmembers";
import { useT } from "@/lib/i18n";

export function PaymentsPage() {
	const { dialog, openDialog } = useActionDialog();
	const t = useT(); const shell = useAppShell(); const [payments, setPayments] = useState<Payment[]>([]); const [nextOffset, setNextOffset] = useState<number | null>(null); const [failed, setFailed] = useState(false); const [loading, setLoading] = useState(true); const [revision, setRevision] = useState(0); const [search, setSearch] = useState(""); const [method, setMethod] = useState(""); const [status, setStatus] = useState(""); const branchId = shell.activeBranch?.id ?? ""; const [dateFrom, setDateFrom] = useState(""); const [dateTo, setDateTo] = useState("");
	const paymentMethods = usePaymentMethods(shell.organizationId, "history");
	const filters = useMemo(() => ({ ...(search ? { search } : {}), ...(method ? { method } : {}), ...(status ? { status } : {}), ...(branchId ? { branchId } : {}), ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) }), [branchId, dateFrom, dateTo, method, search, status]);
	useEffect(() => { const timer = window.setTimeout(() => { void controlMembersApi.payments(shell.organizationId, 0, filters).then((result) => { setPayments(result.payments); setNextOffset(result.nextOffset); setFailed(false); }).catch(() => setFailed(true)).finally(() => setLoading(false)); }, 200); return () => window.clearTimeout(timer); }, [filters, revision, shell.organizationId]);
	async function loadMore() { if (nextOffset === null) return; const result = await controlMembersApi.payments(shell.organizationId, nextOffset, filters); setPayments((current) => [...current, ...result.payments]); setNextOffset(result.nextOffset); }
	function reverse(item: Payment) {
		openDialog({ title: t("Cancel payment"), description: t("Cancel this payment? It will stop counting toward paid charges and available credit. This does not refund money."), confirmLabel: t("Cancel payment"), destructive: true,
			fields: [{ name: "reason", label: t("Reason for cancelling payment {receipt}", { receipt: item.receiptNumber }), type: "textarea" }],
			onConfirm: async ({ reason }) => { await controlMembersApi.reversePayment(shell.organizationId, item.id, reason); setRevision((value) => value + 1); },
		});
	}
	return <PageContainer className="space-y-6">{dialog}<PageHeader title={t("Payments")} description={t("Review received payments, the charges they cover and cancelled payments.")} />{paymentMethods.failed ? <div role="alert"><p>{t("We could not load payment methods.")}</p><Button type="button" variant="outline" onClick={paymentMethods.reload}>{t("Try again")}</Button></div> : null}<div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 xl:grid-cols-3"><div className="grid gap-2"><Label htmlFor="payment-search">{t("Search member")}</Label><Input id="payment-search" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="payment-filter-method">{t("Payment method")}</Label><SelectField id="payment-filter-method" className="h-11 rounded-md border bg-background px-3" value={method} onValueChange={(value) => setMethod(value)} disabled={paymentMethods.loading || paymentMethods.failed} options={[{ value: "", label: t("All methods") }, ...paymentMethods.methods.map((item) => ({ value: item.id, label: paymentMethodLabel(item, t) }))]} /></div><div className="grid gap-2"><Label htmlFor="payment-filter-status">{t("Status")}</Label><SelectField id="payment-filter-status" className="h-11 rounded-md border bg-background px-3" value={status} onValueChange={(value) => setStatus(value)} options={[{ value: "", label: t("All statuses") }, { value: "posted", label: t("Posted") }, { value: "reversed", label: t("Cancelled") }]} /></div><div className="grid gap-2 sm:col-span-2"><Label htmlFor="payment-dates">{t("Date range")}</Label><DateRangePicker id="payment-dates" label={t("Date range")} from={dateFrom} to={dateTo} onChange={(from, to) => { setDateFrom(from); setDateTo(to); }} /></div></div>{failed ? <p role="alert">{t("We could not load payments.")}</p> : null}{loading ? <PaymentsTable payments={[]} loading canReverse={shell.canReversePayments} onReverse={reverse} /> : null}{!loading && !failed && !payments.length ? <div className="rounded-xl border border-dashed p-8 text-center"><h2 className="font-semibold">{t("No payments yet")}</h2><p className="text-sm text-muted-foreground">{t("Open a member to record the first payment.")}</p></div> : !loading && !failed ? <PaymentsTable payments={payments} canReverse={shell.canReversePayments} onReverse={reverse} /> : null}{nextOffset !== null && !loading ? <Button variant="outline" onClick={() => void loadMore()}>{t("Load more")}</Button> : null}</PageContainer>;
}
