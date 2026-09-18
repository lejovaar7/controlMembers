import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
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
	const navigate = useNavigate();
	const headers = [t("Member"), t("Payment date"), t("Payment method"), t("Status"), t("Amount paid"), ...(canReverse ? [t("Actions")] : [])];
	return <div className="member-directory rounded-2xl border bg-card shadow-sm" aria-busy={loading}>
		{loading ? <span role="status" className="sr-only">{t("Loading payments…")}</span> : null}
		<table className={`members-table payments-table${canReverse ? " payments-table-actions" : ""}`} role="table">
			<caption className="sr-only">{t("Payments")}</caption>
			<thead role="rowgroup"><tr role="row">{headers.map((label, index) => <th key={label} scope="col" role="columnheader" className={index === 4 ? "member-balance" : index === 5 ? "payment-actions" : undefined}>{label}</th>)}</tr></thead>
			<tbody role="rowgroup">
				{loading ? [0, 1, 2, 3].map((row) => <tr key={row} role="row" aria-hidden="true">{headers.map((label, column) => <td key={label} role="cell" data-label={label}><Skeleton className={column === 0 ? "h-4 w-40 max-w-full" : "h-4 w-20 max-w-full"} /></td>)}</tr>) : payments.map((payment) => <tr key={payment.id} role="row" className="member-clickable-row" onClick={(event) => {
					// Preserve links, action buttons, and selecting/copying receipt details.
					if (event.target instanceof Element && event.target.closest("a, button")) return;
					const selection = window.getSelection();
					if (selection && !selection.isCollapsed && selection.containsNode(event.currentTarget, true)) return;
					navigate("/app/customer-members/" + payment.memberId);
				}}>
					<td role="cell" data-label={headers[0]} className="member-name"><div><Link to={`/app/customer-members/${payment.memberId}`} className="member-name-link">{payment.memberName}</Link><p className="text-xs text-muted-foreground tabular-nums">{t("Receipt: {receipt}", { receipt: payment.receiptNumber })}</p></div></td>
					<td role="cell" data-label={headers[1]}><time dateTime={payment.paidAt} className="text-muted-foreground">{formatDate(locale, new Date(payment.paidAt), { day: "numeric", month: "short", year: "numeric" })}</time></td>
					<td role="cell" data-label={headers[2]}><span>{paymentMethodLabel({ id: payment.method, name: payment.methodName }, t)}</span></td>
					<td role="cell" data-label={headers[3]}><StatusBadge tone={payment.status === "posted" ? "success" : "neutral"}>{t(payment.status === "posted" ? "Posted" : "Cancelled")}</StatusBadge></td>
					<td role="cell" data-label={headers[4]} className="member-balance"><div className="space-y-1 tabular-nums"><p className="font-semibold">{formatMoney(locale, payment.amountMinor, payment.currency)}</p>{payment.creditMinor > 0 ? <p className="text-xs text-muted-foreground">{t("Credit: {amount}", { amount: formatMoney(locale, payment.creditMinor, payment.currency) })}</p> : null}</div></td>
					{canReverse ? <td role="cell" data-label={headers[5]} className="payment-actions">{payment.status === "posted" ? <Button size="sm" variant="outline" className="h-auto min-h-10 max-w-full whitespace-normal py-2" onClick={() => onReverse(payment)}>{t("Cancel payment")}</Button> : <span className="text-muted-foreground">—</span>}</td> : null}
				</tr>)}
			</tbody>
		</table>
	</div>;
}
