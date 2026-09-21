import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { MemberDetail } from "@/lib/controlmembers";
import { formatMoney } from "../../shared/i18n";

/** Explain the existing ledger totals without presenting credit as negative debt. */
export function MemberBalanceSummary({ summary, currency }: { summary: MemberDetail["summary"]; currency: string }) {
	const { locale, t } = useI18n();
	const toPay = Math.max(0, summary.netMinor);
	const money = (amount: number) => formatMoney(locale, amount, currency);
	const explanation = summary.grossOutstandingMinor === 0 ? t("There are no outstanding fees.")
		: toPay === 0 ? t("Available credit is enough to cover the outstanding fees.")
		: summary.creditMinor > 0 ? t("What remains after taking available credit into account.")
		: t("This is the amount still to be paid.");
	return <section aria-label={t("Member balance summary")} className="grid grid-cols-2 gap-3 lg:grid-cols-3">
		<div className={cn("col-span-2 rounded-2xl border p-5 sm:p-6 lg:col-span-1", toPay > 0 ? "border-primary/20 bg-primary/5" : "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20")}>
			<p className="text-sm font-medium text-muted-foreground">{t("Amount still to pay")}</p>
			<p className={cn("mt-2 text-3xl font-semibold tracking-tight tabular-nums break-words sm:text-4xl", toPay === 0 && "text-emerald-800 dark:text-emerald-300")}>{money(toPay)}</p>
			<p className="mt-3 text-sm leading-5 text-muted-foreground">{explanation}</p>
		</div>
		{([
			{ label: "Unpaid monthly fees", amount: summary.grossOutstandingMinor, description: "Monthly fees that still need to be covered." },
			{ label: "Available credit", amount: summary.creditMinor, description: "Money received that has not yet been assigned to a monthly fee." },
		] as const).map((item) => <div key={item.label} className="min-w-0 rounded-2xl border bg-card p-4 sm:p-6">
			<p className="text-sm font-medium text-muted-foreground">{t(item.label)}</p>
			<p className="mt-2 text-xl font-semibold tracking-tight tabular-nums break-words sm:text-3xl">{money(item.amount)}</p>
			<p className="mt-3 text-sm leading-5 text-muted-foreground">{t(item.description)}</p>
		</div>)}
	</section>;
}
