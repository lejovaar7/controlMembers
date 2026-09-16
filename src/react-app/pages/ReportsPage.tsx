import { useEffect, useState } from "react";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppShell } from "@/hooks/use-app-shell";
import { controlMembersApi, currentPeriod } from "@/lib/controlmembers";
import { useI18n, useT } from "@/lib/i18n";

type Summary = Awaited<ReturnType<typeof controlMembersApi.financialReports>>;

export function ReportsPage() {
	const t = useT(); const { locale } = useI18n(); const shell = useAppShell();
	const [period, setPeriod] = useState(currentPeriod());
	const [rows, setRows] = useState<Array<{ id: string; displayName: string; branchName: string; status: string; outstandingMinor: number; creditMinor: number; netMinor: number }>>([]);
	const [summary, setSummary] = useState<Summary | null>(null); const [currency, setCurrency] = useState("COP"); const [failed, setFailed] = useState(false);
	useEffect(() => {
		void Promise.all([controlMembersApi.balances(shell.organizationId), controlMembersApi.financialReports(shell.organizationId, period)])
			.then(([balances, reports]) => { setRows(balances.balances); setCurrency(reports.currency || balances.currency); setSummary(reports); setFailed(false); })
			.catch(() => setFailed(true));
	}, [shell.organizationId, period]);
	const money = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency }).format(value / 100);
	const download = (kind: string) => window.open(`/api/exports/${kind}${["receivables", "payments"].includes(kind) ? `?period=${encodeURIComponent(period)}` : ""}`, "_blank", "noopener,noreferrer");
	return <PageContainer className="space-y-6">
		<PageHeader title={t("Reports")} description={t("Balances and exports that reconcile with charges and payments.")} />
		<div className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-5"><div className="grid gap-2"><Label htmlFor="report-period">{t("Period")}</Label><Input id="report-period" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></div>{shell.canExportFinancialData ? <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => download("members")}>{t("Export members")}</Button><Button variant="outline" onClick={() => download("member-balances")}>{t("Export balances")}</Button><Button variant="outline" onClick={() => download("receivables")}>{t("Export receivables")}</Button><Button variant="outline" onClick={() => download("payments")}>{t("Export payments")}</Button></div> : null}</div>
		{failed ? <p role="alert">{t("We could not load reports.")}</p> : null}
		{summary ? <>
			<section className="space-y-3"><div><h2 className="font-semibold">{t("Receivables aging")}</h2><p className="text-sm text-muted-foreground">{t("Outstanding balances grouped by days past due.")}</p></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5"><Metric label={t("Current")} value={money(summary.aging.current)} /><Metric label={t("1–30 days")} value={money(summary.aging.days1To30)} /><Metric label={t("31–60 days")} value={money(summary.aging.days31To60)} /><Metric label={t("61–90 days")} value={money(summary.aging.days61To90)} /><Metric label={t("90+ days")} value={money(summary.aging.days90Plus)} /></div></section>
			<SummaryTable title={t("Period charges by plan")} rows={summary.plans} money={money} />
			<SummaryTable title={t("Branch summary")} rows={summary.branches} money={money} />
		</> : null}
		<section className="space-y-3"><h2 className="font-semibold">{t("Member balances")}</h2><div className="overflow-hidden rounded-xl border"><table className="data-table"><thead className="bg-muted/50 text-left"><tr><th scope="col" className="p-3">{t("Member")}</th><th scope="col" className="p-3">{t("Branch")}</th><th scope="col" className="p-3 text-right">{t("Outstanding")}</th><th scope="col" className="p-3 text-right">{t("Credit")}</th><th scope="col" className="p-3 text-right">{t("Net balance")}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t"><td data-label={t("Member")} className="p-3 font-medium">{row.displayName}</td><td data-label={t("Branch")} className="p-3">{row.branchName}</td><td data-label={t("Outstanding")} className="p-3 text-right">{money(row.outstandingMinor)}</td><td data-label={t("Credit")} className="p-3 text-right">{money(row.creditMinor)}</td><td data-label={t("Net balance")} className="p-3 text-right font-medium">{money(row.netMinor)}</td></tr>)}</tbody></table></div></section>
	</PageContainer>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 break-words text-base font-semibold tabular-nums sm:text-lg">{value}</p></div>; }

function SummaryTable({ title, rows, money }: { title: string; rows: Array<{ id: string; name: string; expectedMinor: number; allocatedMinor: number; outstandingMinor: number }>; money: (value: number) => string }) {
	const t = useT();
	return <section className="space-y-3"><h2 className="font-semibold">{title}</h2>{rows.length ? <div className="overflow-x-auto rounded-xl border"><table className="data-table"><thead className="bg-muted/50 text-left"><tr><th scope="col" className="p-3">{t("Name")}</th><th scope="col" className="p-3 text-right">{t("Expected")}</th><th scope="col" className="p-3 text-right">{t("Allocated")}</th><th scope="col" className="p-3 text-right">{t("Outstanding")}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t"><td data-label={t("Name")} className="p-3 font-medium">{row.name}</td><td data-label={t("Expected")} className="p-3 text-right">{money(row.expectedMinor)}</td><td data-label={t("Allocated")} className="p-3 text-right">{money(row.allocatedMinor)}</td><td data-label={t("Outstanding")} className="p-3 text-right">{money(row.outstandingMinor)}</td></tr>)}</tbody></table></div> : <p className="text-sm text-muted-foreground">{t("No charges in this period.")}</p>}</section>;
}
