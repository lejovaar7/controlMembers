import { paymentMethodLabel, usePaymentMethods } from "@/hooks/use-payment-methods";
import { SelectField } from "@/components/select-field";
import { useActionDialog } from "@/hooks/use-action-dialog";
import { DateRangePicker } from "@/components/date-picker";
import { PaymentsTable } from "@/components/payments-table";
import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { LoadingButton } from "@/components/loading-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppShell } from "@/hooks/use-app-shell";
import { usePagedDirectory } from "@/hooks/use-paged-directory";
import { controlMembersApi, type Payment } from "@/lib/controlmembers";
import { useT } from "@/lib/i18n";

export function PaymentsPage({ revision }: { revision: number }) {
	const { dialog, openDialog } = useActionDialog(); const t = useT(); const shell = useAppShell();
	const [params, setParams] = useSearchParams();
	const search = params.get("search") ?? ""; const method = params.get("method") ?? ""; const status = params.get("status") ?? "posted"; const dateFrom = params.get("dateFrom") ?? ""; const dateTo = params.get("dateTo") ?? "";
	const paymentMethods = usePaymentMethods(shell.organizationId, "history");
	const load = useCallback(async (offset: number, signal: AbortSignal) => {
		void revision;
		const result = await controlMembersApi.payments(shell.organizationId, offset, { search, method, status: status === "all" ? "" : status, dateFrom, dateTo, branchId: shell.activeBranch?.id }, signal);
		return { rows: result.payments, nextOffset: result.nextOffset };
	}, [shell.organizationId, shell.activeBranch?.id, search, method, status, dateFrom, dateTo, revision]);
	const list = usePagedDirectory(load);
	function syncUrl(next: Record<string, string>) { const query = new URLSearchParams(params); for (const [key, value] of Object.entries(next)) { if (value) query.set(key, value); else query.delete(key); } setParams(query, { replace: true }); }
	function reverse(item: Payment) {
		openDialog({ title: t("Cancel payment"), description: t("Cancel this payment? It will stop counting toward paid charges and available credit. This does not refund money."), confirmLabel: t("Cancel payment"), destructive: true,
			fields: [{ name: "reason", label: t("Reason for cancelling payment {receipt}", { receipt: item.receiptNumber }), type: "textarea" }],
			onConfirm: async ({ reason }) => { await controlMembersApi.reversePayment(shell.organizationId, item.id, reason); list.reload(); },
		});
	}
	return <div className="space-y-5">{dialog}
		{paymentMethods.failed ? <div role="alert"><p>{t("We could not load payment methods.")}</p><Button variant="outline" onClick={paymentMethods.reload}>{t("Try again")}</Button></div> : null}
		<div className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2 xl:grid-cols-3">
			<div className="grid gap-2"><Label htmlFor="payment-search">{t("Search member")}</Label><Input id="payment-search" value={search} onChange={(event) => syncUrl({ search: event.target.value })} /></div>
			<div className="grid gap-2"><Label htmlFor="payment-filter-method">{t("Payment method")}</Label><SelectField id="payment-filter-method" value={method} onValueChange={(value) => syncUrl({ method: value })} disabled={paymentMethods.loading || paymentMethods.failed} options={[{ value: "", label: t("All methods") }, ...paymentMethods.methods.map((item) => ({ value: item.id, label: paymentMethodLabel(item, t) }))]} /></div>
			<div className="grid gap-2"><Label htmlFor="payment-filter-status">{t("Status")}</Label><SelectField id="payment-filter-status" value={status} onValueChange={(value) => syncUrl({ status: value })} options={[{ value: "all", label: t("All statuses") }, { value: "posted", label: t("Posted") }, { value: "reversed", label: t("Cancelled") }]} /></div>
			<div className="grid gap-2 sm:col-span-2"><Label htmlFor="payment-dates">{t("Date range")}</Label><DateRangePicker id="payment-dates" label={t("Date range")} from={dateFrom} to={dateTo} onChange={(from, to) => syncUrl({ dateFrom: from, dateTo: to })} /></div>
		</div>
		{list.failed ? <div role="alert" className="flex flex-wrap items-center gap-3"><p>{t("We could not load payments.")}</p><Button variant="outline" onClick={list.reload}>{t("Try again")}</Button></div> : list.loading || list.rows.length ? <PaymentsTable payments={list.rows} loading={list.loading} canReverse={shell.canReversePayments} onReverse={reverse} /> : <div className="rounded-2xl border border-dashed p-8 text-center"><p>{t("No payments match these filters.")}</p><Button className="mt-3" variant="outline" onClick={() => setParams({ status: "all" })}>{t("Clear filters")}</Button></div>}
		{list.moreFailed ? <p role="alert">{t("We could not load the next results.")}</p> : null}
		{list.nextOffset !== null ? <LoadingButton variant="outline" loading={list.morePending} onClick={() => void list.loadMore()}>{t("Load more")}</LoadingButton> : null}
	</div>;
}
