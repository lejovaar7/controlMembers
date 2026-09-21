import { Menu } from "@base-ui/react/menu";
import { ChevronDown, Download } from "lucide-react";
import { MonthPicker } from "@/components/date-picker";
import { formatMoney } from "../../shared/i18n";
import { useEffect, useState } from "react";
import { DashboardSkeleton } from "@/components/content-skeleton";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAppShell } from "@/hooks/use-app-shell";
import { controlMembersApi, currentPeriod } from "@/lib/controlmembers";
import { useI18n, useT } from "@/lib/i18n";

type Summary = Awaited<ReturnType<typeof controlMembersApi.financialReports>>;

export function ReportsPage() {
	const t = useT(); const { locale } = useI18n(); const shell = useAppShell();
	const [period, setPeriod] = useState(currentPeriod());
	const [rows, setRows] = useState<Array<{ id: string; displayName: string; branchName: string; status: string; outstandingMinor: number; creditMinor: number; netMinor: number }>>([]);
	const [summary, setSummary] = useState<Summary | null>(null); const [currency, setCurrency] = useState("COP");
	const key = `${shell.organizationId}:${period}`;
	const [loadedKey, setLoadedKey] = useState<string | null>(null);
	const [failedKey, setFailedKey] = useState<string | null>(null);
	const failed = failedKey === key;
	const loading = loadedKey !== key && !failed;
	useEffect(() => {
		let cancelled = false;
		void Promise.all([controlMembersApi.balances(shell.organizationId), controlMembersApi.financialReports(shell.organizationId, period)])
			.then(([balances, reports]) => { if (cancelled) return; setRows(balances.balances); setCurrency(reports.currency || balances.currency); setSummary(reports); setLoadedKey(key); setFailedKey(null); })
			.catch(() => { if (!cancelled) setFailedKey(key); });
		return () => { cancelled = true; };
	}, [shell.organizationId, period, key]);
	const money = (value: number) => formatMoney(locale, value, currency);
	const download = (kind: string) => window.open(`/api/exports/${kind}${["receivables", "payments"].includes(kind) ? `?period=${encodeURIComponent(period)}` : ""}`, "_blank", "noopener,noreferrer");
	return <PageContainer className="reports-page space-y-5 sm:space-y-6">
		<PageHeader title={t("Reports")} description={t("Review balances and export lists of members, charges and payments.")} />
		<div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3 sm:p-5">
			<div className="grid min-w-0 flex-1 gap-1.5 sm:w-56 sm:flex-none"><Label htmlFor="report-period">{t("Period")}</Label><MonthPicker className="w-full text-sm" id="report-period" label={t("Period")} value={period} onChange={setPeriod} /></div>
			{shell.canExportFinancialData ? <Menu.Root>
				<Menu.Trigger render={<Button type="button" variant="outline" className="px-3 min-[400px]:px-4" />} aria-label={t("Export")} title={t("Export")}><Download className="size-4" aria-hidden="true" /><span className="hidden min-[400px]:inline">{t("Export")}</span><ChevronDown className="hidden size-3.5 min-[400px]:block" aria-hidden="true" /></Menu.Trigger>
				<Menu.Portal><Menu.Positioner align="end" sideOffset={6} className="z-50"><Menu.Popup className="min-w-56 max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg outline-none">
					{([['members', 'Export members'], ['member-balances', 'Export balances'], ['receivables', 'Export receivables'], ['payments', 'Export payments']] as const).map(([kind, label]) => <Menu.Item key={kind} className="flex min-h-11 cursor-default items-center rounded-md px-3 py-2 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground" onClick={() => download(kind)}>{t(label)}</Menu.Item>)}
				</Menu.Popup></Menu.Positioner></Menu.Portal>
			</Menu.Root> : null}
		</div>
		{failed ? <p role="alert">{t("We could not load reports.")}</p> : null}
		{loading ? <DashboardSkeleton label={t("Loading reports…")} /> : null}
		{!loading && !failed && summary ? <>

			<section className="space-y-3"><div><h2 className="font-semibold">{t("Balances by days overdue")}</h2><p className="text-sm text-muted-foreground">{t("Outstanding balances grouped by days past due.")}</p></div><div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 2xl:grid-cols-5"><Metric label={t("Current")} value={money(summary.aging.current)} /><Metric label={t("1–30 days")} value={money(summary.aging.days1To30)} /><Metric label={t("31–60 days")} value={money(summary.aging.days31To60)} /><Metric label={t("61–90 days")} value={money(summary.aging.days61To90)} /><Metric label={t("90+ days")} value={money(summary.aging.days90Plus)} /></div></section>
			<SummaryTable title={t("Period charges by plan")} rows={summary.plans} money={money} />
			<SummaryTable title={t("Branch summary")} rows={summary.branches} money={money} />
		<section className="space-y-3"><h2 className="font-semibold">{t("Member balances")}</h2><div className="overflow-hidden rounded-xl border"><table className="data-table reports-table reports-balances-table" role="table"><thead className="bg-muted/50" role="rowgroup"><tr role="row"><th role="columnheader" scope="col">{t("Member")}</th><th role="columnheader" scope="col">{t("Branch")}</th><th role="columnheader" scope="col" className="table-number">{t("Outstanding")}</th><th role="columnheader" scope="col" className="table-number">{t("Credit")}</th><th role="columnheader" scope="col" className="table-number">{t("Net balance")}</th></tr></thead><tbody role="rowgroup">{rows.map((row) => <tr key={row.id} role="row" className="border-t"><td role="cell" data-label={t("Member")} className="font-medium">{row.displayName}</td><td role="cell" data-label={t("Branch")}>{row.branchName}</td><td role="cell" data-label={t("Outstanding")} className="sm:text-right">{money(row.outstandingMinor)}</td><td role="cell" data-label={t("Credit")} className="sm:text-right">{money(row.creditMinor)}</td><td role="cell" data-label={t("Net balance")} className="sm:text-right font-medium">{money(row.netMinor)}</td></tr>)}</tbody></table></div></section>
		</> : null}
	</PageContainer>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-xl border bg-card p-3 sm:p-4 max-sm:first:col-span-2 max-sm:first:flex max-sm:first:items-center max-sm:first:justify-between max-sm:first:gap-3"><p className="text-xs text-muted-foreground sm:text-sm">{label}</p><p className="mt-1 break-words text-sm font-semibold tabular-nums sm:mt-2 sm:text-lg">{value}</p></div>; }

function SummaryTable({ title, rows, money }: { title: string; rows: Array<{ id: string; name: string; expectedMinor: number; allocatedMinor: number; outstandingMinor: number }>; money: (value: number) => string }) {
	const t = useT();
	return <section className="space-y-3"><h2 className="font-semibold">{title}</h2>{rows.length ? <div className="overflow-x-auto rounded-xl border"><table className="data-table reports-table reports-summary-table" role="table"><thead className="bg-muted/50" role="rowgroup"><tr role="row"><th role="columnheader" scope="col">{t("Name")}</th><th role="columnheader" scope="col" className="table-number">{t("Total to collect")}</th><th role="columnheader" scope="col" className="table-number">{t("Applied payments")}</th><th role="columnheader" scope="col" className="table-number">{t("Outstanding")}</th></tr></thead><tbody role="rowgroup">{rows.map((row) => <tr key={row.id} role="row" className="border-t"><td role="cell" data-label={t("Name")} className="font-medium">{row.name}</td><td role="cell" data-label={t("Total to collect")} className="sm:text-right">{money(row.expectedMinor)}</td><td role="cell" data-label={t("Applied payments")} className="sm:text-right">{money(row.allocatedMinor)}</td><td role="cell" data-label={t("Outstanding")} className="sm:text-right">{money(row.outstandingMinor)}</td></tr>)}</tbody></table></div> : <p className="text-sm text-muted-foreground">{t("No charges in this period.")}</p>}</section>;
}
