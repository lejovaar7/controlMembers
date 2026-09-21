import { Link, useNavigate } from "react-router";
import { useRef } from "react";
import { Menu } from "@base-ui/react/menu";
import { Ban, Banknote, Ellipsis, MessageCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import type { Charge } from "@/lib/controlmembers";
import { useI18n } from "@/lib/i18n";
import { formatDate, formatMoney } from "../../shared/i18n";

type ChargeActions = {
	canAdjust: boolean;
	onAdjust: (charge: Charge) => void;
	onVoid: (charge: Charge) => void;
	onPay?: (charge: Charge, trigger: HTMLElement) => void;
	onRemind?: (charge: Charge, trigger: HTMLElement) => void;
};

const menuItemClassName = "flex min-h-10 cursor-default items-center gap-2.5 rounded-md px-3 py-2 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:cursor-not-allowed data-disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0";

function ChargeActionsMenu({ charge, canAdjust, onAdjust, onVoid, onPay, onRemind }: ChargeActions & { charge: Charge }) {
	const { t } = useI18n();
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const actionSelected = useRef(false);
	const cannotPay = charge.lifecycle !== "open" || charge.outstandingMinor <= 0;
	const cannotAdjust = charge.lifecycle !== "open" || charge.paidMinor !== 0;
	const paymentReason = cannotPay ? t("Payment is available only for an open fee with an outstanding balance.") : undefined;
	const reminderReason = !charge.isOverdue ? t("Reminders are available only for overdue fees with an outstanding balance.") : undefined;
	const adjustmentReason = cannotAdjust ? t("Adjusting or voiding requires an open fee without applied payments.") : undefined;
	function selectAction(action: (trigger: HTMLElement) => void) {
		if (!triggerRef.current) return;
		actionSelected.current = true;
		// Dialogs restore focus to the persistent trigger, not an unmounted menu item.
		triggerRef.current.focus();
		action(triggerRef.current);
	}
	return <Menu.Root modal={false} onOpenChange={(open) => { if (open) actionSelected.current = false; }}>
		<Menu.Trigger ref={triggerRef} render={<Button type="button" variant="outline" size="icon-sm" className="size-8 min-h-8 rounded-md p-0 shadow-none [@container(max-width:800px)]:size-11 [@container(max-width:800px)]:min-h-11" />} aria-label={`${t("Actions")}: ${charge.memberName} · ${charge.billingPeriod}`} title={t("Actions")}><Ellipsis className="size-4" aria-hidden="true" /></Menu.Trigger>
		<Menu.Portal>
			<Menu.Positioner align="end" sideOffset={6} className="z-50">
				<Menu.Popup aria-label={t("Actions")} finalFocus={() => actionSelected.current ? false : triggerRef.current} onClick={(event) => event.stopPropagation()} className="min-w-56 max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg outline-none">
					{onPay ? <Menu.Item className={menuItemClassName} disabled={cannotPay} title={paymentReason} aria-description={paymentReason} onClick={() => selectAction((trigger) => onPay(charge, trigger))}><Banknote aria-hidden="true" />{t("Record payment")}</Menu.Item> : null}
					{onRemind ? <Menu.Item className={menuItemClassName} disabled={!charge.isOverdue} title={reminderReason} aria-description={reminderReason} onClick={() => selectAction((trigger) => onRemind(charge, trigger))}><MessageCircle aria-hidden="true" />{t("Remind via WhatsApp")}</Menu.Item> : null}
					{canAdjust ? <>
						<Menu.Item className={menuItemClassName} disabled={cannotAdjust} title={adjustmentReason} aria-description={adjustmentReason} onClick={() => selectAction(() => onAdjust(charge))}><Pencil aria-hidden="true" />{t("Adjust")}</Menu.Item>
						<Menu.Item className={`${menuItemClassName} text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive`} disabled={cannotAdjust} title={adjustmentReason} aria-description={adjustmentReason} onClick={() => selectAction(() => onVoid(charge))}><Ban aria-hidden="true" />{t("Void charge")}</Menu.Item>
					</> : null}
				</Menu.Popup>
			</Menu.Positioner>
		</Menu.Portal>
	</Menu.Root>;
}

export function ChargesTable({ charges, loading = false, canAdjust, onAdjust, onVoid, onPay, onRemind }: ChargeActions & {
	charges: Charge[];
	loading?: boolean;
}) {
	const { locale, t } = useI18n();
	const navigate = useNavigate();
	const hasActions = canAdjust || Boolean(onPay) || Boolean(onRemind);
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
					if (event.target instanceof Element && event.target.closest("a, button, .charge-actions")) return;
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
					{hasActions ? <td role="cell" data-label={headers[6]} className="charge-actions"><ChargeActionsMenu charge={charge} canAdjust={canAdjust} onAdjust={onAdjust} onVoid={onVoid} onPay={onPay} onRemind={onRemind} /></td> : null}
				</tr>)}
			</tbody>
		</table>
	</div>;
}
