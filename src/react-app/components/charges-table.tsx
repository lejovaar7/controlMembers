import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import type { Charge } from "@/lib/controlmembers";
import { useI18n } from "@/lib/i18n";
import { formatDate, formatMoney } from "../../shared/i18n";

export function ChargesTable({ charges, loading = false, canAdjust, onAdjust, onVoid, onPay }: {
	charges: Charge[];
	loading?: boolean;
	canAdjust: boolean;
	onAdjust: (charge: Charge) => void;
	onVoid: (charge: Charge) => void;
	onPay?: (charge: Charge, trigger: HTMLElement) => void;
}) {
	const { locale, t } = useI18n();
	const navigate = useNavigate();
	const hasActions = canAdjust || Boolean(onPay);
	const headers = [t("Member"), t("Plan"), t("Month"), t("Payment status"), t("Due date"), t("Outstanding"), ...(hasActions ? [t("Actions")] : [])];
	const labels = { paid: "Paid", partial: "Partially paid", overdue: "Overdue", pending: "Pending", void: "Void" } as const;
	return <div className="member-directory rounded-2xl border bg-card shadow-sm" aria-busy={loading}>
		{loading ? <span role="status" className="sr-only">{t("Loading charges…")}</span> : null}
		<table className={`members-table charges-table${hasActions ? " charges-table-actions" : ""}`} role="table">
			<caption className="sr-only">{t("Charges")}</caption>
			<thead role="rowgroup"><tr role="row">{headers.map((label, index) => <th key={label} scope="col" role="columnheader" className={index === 3 ? "table-status" : index === 5 ? "member-balance" : index === 6 ? "charge-actions" : undefined}>{label}</th>)}</tr></thead>
			<tbody role="rowgroup">
				{loading ? [0, 1, 2, 3].map((row) => <tr key={row} role="row" aria-hidden="true">{headers.map((label, column) => <td key={label} role="cell" data-label={label} className={column === 3 ? "table-status" : column === 5 ? "member-balance" : column === 6 ? "charge-actions" : undefined}><Skeleton className={column === 0 ? "h-4 w-40 max-w-full" : "h-4 w-20 max-w-full"} /></td>)}</tr>) : charges.map((charge) => <tr key={charge.id} role="row" className="member-clickable-row" onClick={(event) => {
					// Preserve native links, action buttons, and selecting/copying row text.
					if (event.target instanceof Element && event.target.closest("a, button")) return;
					const selection = window.getSelection();
					if (selection && !selection.isCollapsed && selection.containsNode(event.currentTarget, true)) return;
					navigate("/app/customer-members/" + charge.memberId);
				}}>
					<td role="cell" data-label={headers[0]} className="member-name"><Link to={`/app/customer-members/${charge.memberId}`} className="member-name-link">{charge.memberName}</Link></td>
					<td role="cell" data-label={headers[1]}><span>{charge.planName}</span></td>
					<td role="cell" data-label={headers[2]}><time dateTime={charge.billingPeriod}>{formatDate(locale, new Date(`${charge.billingPeriod}-01T12:00:00Z`), { month: "short", year: "numeric", timeZone: "UTC" })}</time></td>
					<td role="cell" data-label={headers[3]} className="table-status"><StatusBadge tone={charge.paymentState === "paid" ? "success" : charge.paymentState === "overdue" ? "danger" : charge.paymentState === "partial" ? "warning" : "neutral"}>{t(labels[charge.paymentState])}</StatusBadge></td>
					<td role="cell" data-label={headers[4]}><time dateTime={charge.dueDate} className="text-muted-foreground">{formatDate(locale, new Date(charge.dueDate), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</time></td>
					<td role="cell" data-label={headers[5]} className="member-balance"><div className="space-y-1 tabular-nums"><p className="font-semibold">{formatMoney(locale, charge.outstandingMinor, charge.currency)}</p><p className="text-xs text-muted-foreground">{t("of {total}", { total: formatMoney(locale, charge.totalMinor, charge.currency) })}</p></div></td>
					{hasActions ? <td role="cell" data-label={headers[6]} className="charge-actions"><div className="table-action-buttons flex flex-wrap gap-2">
						{onPay && charge.lifecycle === "open" && charge.outstandingMinor > 0 ? <Button size="sm" aria-label={t("Pay fee for {name} · {period}", { name: charge.memberName, period: charge.billingPeriod })} onClick={(event) => onPay(charge, event.currentTarget)}>{t("Record payment")}</Button> : null}
						{canAdjust && charge.lifecycle === "open" && charge.paidMinor === 0 ? <><Button size="sm" variant="ghost" onClick={() => onAdjust(charge)}>{t("Adjust")}</Button><Button size="sm" variant="ghost" onClick={() => onVoid(charge)}>{t("Void charge")}</Button></> : null}
					</div></td> : null}
				</tr>)}
			</tbody>
		</table>
	</div>;
}
