import { useState } from "react";
import { Link } from "react-router";
import { ReceiptText } from "lucide-react";
import { CenteredDialog } from "@/components/centered-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentApplicationDetails, PaymentReceiptStatus } from "@/components/payment-application-details";
import { paymentMethodLabel } from "@/hooks/use-payment-methods";
import type { Payment } from "@/lib/controlmembers";
import { useI18n } from "@/lib/i18n";
import { formatDate, formatMoney } from "../../shared/i18n";

export function PaymentsTable({ payments, loading = false, canReverse, onReverse }: {
	payments: Payment[];
	loading?: boolean;
	canReverse: boolean;
	onReverse: (payment: Payment) => void;
}) {
	const { locale, t } = useI18n();
	const [receipt, setReceipt] = useState<{ id: string; trigger: HTMLElement } | null>(null);
	const selected = receipt ? payments.find((payment) => payment.id === receipt.id) : undefined;
	const headers = [t("Member"), t("Payment date"), t("Payment method"), t("Status"), t("Amount paid"), t("Actions")];
	return <><div className="member-directory rounded-xl border bg-card shadow-sm" aria-busy={loading}>
		{loading ? <span role="status" className="sr-only">{t("Loading payments…")}</span> : null}
		<table className="members-table payments-table" role="table">
			<caption className="sr-only">{t("Payments")}</caption>
			<thead role="rowgroup"><tr role="row">{headers.map((label, index) => <th key={label} scope="col" role="columnheader" className={index === 3 ? "table-status" : index === 4 ? "member-balance" : index === 5 ? "payment-actions" : undefined}>{label}</th>)}</tr></thead>
			<tbody role="rowgroup">
				{loading ? [0, 1, 2, 3].map((row) => <tr key={row} role="row" aria-hidden="true">{headers.map((label, column) => <td key={label} role="cell" data-label={label} className={column === 3 ? "table-status" : column === 4 ? "member-balance" : column === 5 ? "payment-actions" : undefined}><Skeleton className={column === 0 ? "h-4 w-40 max-w-full" : "h-4 w-20 max-w-full"} /></td>)}</tr>) : payments.map((payment) => <tr key={payment.id} role="row" className="member-clickable-row" onClick={(event) => {
					// Preserve links, action buttons, and selecting/copying receipt details.
					if (event.target instanceof Element && event.target.closest("a, button")) return;
					const selection = window.getSelection();
					if (selection && !selection.isCollapsed && selection.containsNode(event.currentTarget, true)) return;
					const trigger = event.currentTarget.querySelector<HTMLButtonElement>("button");
					if (trigger) setReceipt({ id: payment.id, trigger });
				}}>
					<td role="cell" data-label={headers[0]} className="member-name"><div className="min-w-0 space-y-1"><Link to={`/app/customer-members/${payment.memberId}`} className="member-name-link" title={payment.memberName}>{payment.memberName}</Link><p className="truncate text-xs text-muted-foreground tabular-nums" title={payment.receiptNumber}>{payment.receiptNumber}</p></div></td>
					<td role="cell" data-label={headers[1]}><time dateTime={payment.paidAt} className="text-muted-foreground">{formatDate(locale, new Date(payment.paidAt), { day: "numeric", month: "short", year: "numeric" })}</time></td>
					<td role="cell" data-label={headers[2]}><span className="block truncate" title={paymentMethodLabel({ id: payment.method, name: payment.methodName }, t)}>{paymentMethodLabel({ id: payment.method, name: payment.methodName }, t)}</span></td>
					<td role="cell" data-label={headers[3]} className="table-status"><PaymentReceiptStatus payment={payment} compact /></td>
					<td role="cell" data-label={headers[4]} className="member-balance"><div className="space-y-1 tabular-nums"><p className="font-semibold">{formatMoney(locale, payment.amountMinor, payment.currency)}</p>{payment.creditMinor > 0 ? <p className="text-xs text-muted-foreground">{t("Credit: {amount}", { amount: formatMoney(locale, payment.creditMinor, payment.currency) })}</p> : null}</div></td>
					<td role="cell" data-label={headers[5]} className="payment-actions"><Button type="button" size="sm" variant="ghost" className="gap-1.5 text-primary" aria-label={t("View receipt {receipt}", { receipt: payment.receiptNumber })} onClick={(event) => setReceipt({ id: payment.id, trigger: event.currentTarget })}><ReceiptText aria-hidden="true" className="size-4" />{t("View receipt")}</Button></td>
				</tr>)}
			</tbody>
		</table>
	</div>
		{selected && receipt ? <CenteredDialog open title={t("Payment receipt")} description={t("Receipt: {receipt}", { receipt: selected.receiptNumber })} returnFocus={receipt.trigger} onClose={() => setReceipt(null)}>
			<div className="space-y-5 p-5 sm:p-7">
				<div className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-muted/40 p-4"><div><p className="mb-1 text-xs text-muted-foreground">{t("Amount paid")}</p><p className="text-2xl font-semibold tracking-tight tabular-nums">{formatMoney(locale, selected.amountMinor, selected.currency)}</p></div><PaymentReceiptStatus payment={selected} /></div>
				<dl className="grid grid-cols-2 gap-4 text-sm"><div className="col-span-2"><dt className="text-xs text-muted-foreground">{t("Member")}</dt><dd className="mt-1 font-medium"><Link className="text-primary hover:underline" to={`/app/customer-members/${selected.memberId}`}>{selected.memberName}</Link></dd></div><div><dt className="text-xs text-muted-foreground">{t("Payment date")}</dt><dd className="mt-1">{formatDate(locale, new Date(selected.paidAt), { dateStyle: "medium", timeStyle: "short" })}</dd></div><div><dt className="text-xs text-muted-foreground">{t("Payment method")}</dt><dd className="mt-1 break-words">{paymentMethodLabel({ id: selected.method, name: selected.methodName }, t)}</dd></div></dl>
				<div className="border-t pt-4"><PaymentApplicationDetails payment={selected} /></div>
				<div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">{canReverse && selected.status === "posted" ? <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { setReceipt(null); onReverse(selected); }}>{t("Cancel payment")}</Button> : <span />}<Button type="button" variant="outline" onClick={() => setReceipt(null)}>{t("Close")}</Button></div>
			</div>
		</CenteredDialog> : null}
	</>;
}
