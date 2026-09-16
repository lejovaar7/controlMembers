import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router";
import { BadgeDollarSign, CalendarClock, CircleCheckBig, Clock3, Sparkles, TrendingUp, UsersRound, WalletCards } from "lucide-react";
import { PageContainer } from "@/components/page";
import { ProductBrand } from "@/components/product-brand";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppShell } from "@/hooks/use-app-shell";
import { controlMembersApi, currentPeriod } from "@/lib/controlmembers";
import { useI18n, useT } from "@/lib/i18n";

type Metrics = Awaited<ReturnType<typeof controlMembersApi.dashboard>>;

export function DashboardPage() {
	const t = useT();
	const { locale } = useI18n();
	const shell = useAppShell();
	const [period, setPeriod] = useState(currentPeriod());
	const [metrics, setMetrics] = useState<Metrics | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		if (!shell.canViewReports) return;
		void controlMembersApi.dashboard(shell.organizationId, period).then((result) => {
			setMetrics(result);
			setFailed(false);
		}).catch(() => setFailed(true));
	}, [period, shell.organizationId, shell.canViewReports]);

	if (!shell.canViewReports) return <Navigate to="/app/customer-members" replace />;
	const money = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: metrics?.currency ?? "COP" }).format(value / 100);

	return <PageContainer className="space-y-6">
		<section className="relative overflow-hidden rounded-3xl bg-[#26205c] px-6 py-7 text-white shadow-xl shadow-primary/15 sm:px-8 sm:py-9">
			<div className="absolute -right-20 -top-28 size-80 rounded-full bg-[#7567f4]/45 blur-2xl" />
			<div className="absolute -bottom-28 left-1/3 size-64 rounded-full bg-[#20b486]/12 blur-3xl" />
			<div className="relative flex flex-wrap items-center justify-between gap-7">
				<div className="max-w-2xl"><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#b9b2ff]"><Sparkles className="size-4" />{shell.organizationName}</div><h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">{t("Dashboard")}</h1><p className="mt-2 text-base text-white/70 sm:text-lg">{t("A clear view of monthly collections and outstanding balances.")}</p></div>
				<div className="flex items-end gap-4"><div className="grid gap-2 rounded-2xl bg-white/10 p-4 backdrop-blur"><Label className="text-white/70" htmlFor="dashboard-period">{t("Period")}</Label><Input className="w-48 border-white/20 bg-white text-foreground" id="dashboard-period" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></div><div className="hidden rounded-2xl bg-white p-3 shadow-xl xl:block"><ProductBrand className="h-16 w-64" /></div></div>
			</div>
		</section>
		{failed ? <div role="alert" className="rounded-2xl border border-destructive/20 bg-destructive/8 p-4 text-sm text-destructive">{t("We could not load the dashboard.")}</div> : null}
		{!metrics && !failed ? <DashboardSkeleton label={t("Loading dashboard…")} /> : null}
		{metrics ? <>
			<div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="size-4" />{t(metrics.scope === "all" ? "All accessible branches · updated {date}" : "Assigned branches only · updated {date}", { date: new Date(metrics.asOf).toLocaleString(locale) })}</div>
			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<Metric icon={<CalendarClock />} label={t("Expected")} value={money(metrics.expectedMinor)} to={`/app/charges?period=${period}`} tone="violet" />
				<Metric icon={<CircleCheckBig />} label={t("Collected")} value={money(metrics.collectedMinor)} to="/app/payments" tone="green" />
				<Metric icon={<WalletCards />} label={t("Outstanding")} value={money(metrics.outstandingMinor)} to={`/app/charges?period=${period}`} tone="amber" />
				<Metric icon={<UsersRound />} label={t("Overdue members")} value={String(metrics.overdueMembers)} to={`/app/charges?period=${period}&state=overdue`} tone="rose" />
			</div>
			<section className="grid gap-4 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-border sm:grid-cols-3 sm:p-6">
				<SecondaryMetric icon={<BadgeDollarSign />} label={t("Allocated to this period")} value={money(metrics.allocatedMinor)} />
				<SecondaryMetric icon={<TrendingUp />} label={t("Collection rate")} value={metrics.collectionRate === null ? "—" : new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(metrics.collectionRate)} />
				<SecondaryMetric icon={<CalendarClock />} label={t("Upcoming due in 7 days")} value={money(metrics.upcomingDueMinor)} detail={t("{count} charges", { count: metrics.upcomingDueCount })} />
			</section>
			{metrics.expectedMinor === 0 ? <div className="rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-7"><h2 className="text-lg font-bold">{t("No charges in this period")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("Create members and enrollments, then generate monthly charges.")}</p><Link to="/app/charges" className="mt-4 inline-flex font-semibold text-primary hover:underline">{t("Go to charges")}</Link></div> : null}
		</> : null}
	</PageContainer>;
}

const tones = { violet: "bg-violet-50 text-violet-700", green: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", rose: "bg-rose-50 text-rose-700" };

function Metric({ icon, label, value, to, tone }: { icon: ReactNode; label: string; value: string; to: string; tone: keyof typeof tones }) {
	return <Link to={to} className="group rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border transition-all hover:-translate-y-0.5 hover:shadow-md"><div className={`mb-4 grid size-11 place-items-center rounded-xl [&_svg]:size-5 ${tones[tone]}`}>{icon}</div><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tracking-tight">{value}</p></Link>;
}

function SecondaryMetric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail?: string }) {
	return <div className="flex gap-3 rounded-2xl bg-muted/55 p-4"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-primary shadow-xs [&_svg]:size-5">{icon}</div><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-0.5 text-xl font-bold">{value}</p>{detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}</div></div>;
}

function DashboardSkeleton({ label }: { label: string }) {
	return <div role="status" className="space-y-4"><span className="sr-only">{label}</span><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl bg-muted" />)}</div><div className="h-40 animate-pulse rounded-3xl bg-muted" /></div>;
}
