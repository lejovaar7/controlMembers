import type { Payment } from "@/lib/controlmembers";
import { useI18n } from "@/lib/i18n";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatMoney } from "../../shared/i18n";

export function PaymentReceiptStatus({ payment, compact = false }: { payment: Payment; compact?: boolean }) {
	const { t } = useI18n();
	const credit = payment.creditMinor > 0;
	return <StatusBadge tone={payment.status === "reversed" ? "neutral" : credit ? "warning" : "success"}>{t(payment.status === "reversed" ? "Cancelled" : credit ? payment.allocatedMinor > 0 ? "Payment and advance" : compact ? "Advance" : "Advance payment" : compact ? "Applied" : "Applied to fees")}</StatusBadge>;
}

export function PaymentApplicationDetails({ payment }: { payment: Payment }) {
	const { locale, t } = useI18n();
	const applications = payment.applications ?? [];
	return <div className="space-y-2 text-sm">
		{applications.length ? <><p className="text-xs font-medium text-muted-foreground">{t(payment.status === "reversed" ? "Previous application (payment cancelled)" : "Monthly fees covered by this payment")}</p><ul className="space-y-2">{applications.map((item) => <li key={item.chargeId} className="flex flex-wrap justify-between gap-x-4 gap-y-1"><span className="min-w-0 break-words">{item.planName} · {formatDate(locale, new Date(`${item.billingPeriod}-01T12:00:00Z`), { month: "long", year: "numeric", timeZone: "UTC" })}</span><span className="font-medium tabular-nums">{formatMoney(locale, item.amountMinor, payment.currency)}</span></li>)}</ul></> : <p className="text-muted-foreground">{t("Not assigned to a monthly fee.")}</p>}
		{payment.status === "posted" && payment.creditMinor > 0 ? <p className="text-amber-800 dark:text-amber-300">{t("Advance available: {amount}", { amount: formatMoney(locale, payment.creditMinor, payment.currency) })}</p> : null}
	</div>;
}
