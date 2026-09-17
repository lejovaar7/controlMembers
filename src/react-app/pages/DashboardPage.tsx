import { CurrencyLabel } from "@/components/currency-label";
import { formatMoney } from "../../shared/i18n";
import { DashboardSkeleton } from "@/components/content-skeleton";
import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarClock, CircleCheckBig, Clock3, Plus, UsersRound, WalletCards } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
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
 const [result, setResult] = useState<{ period: string; organizationId: string; metrics: Metrics } | null>(null);
 const [failed, setFailed] = useState(false);
 const [revision, setRevision] = useState(0);
 useEffect(() => {
  if (!shell.canViewReports) return;
  let cancelled = false;
  void controlMembersApi.dashboard(shell.organizationId, period).then((metrics) => {
   if (!cancelled) { setResult({ period, organizationId: shell.organizationId, metrics }); setFailed(false); }
  }).catch(() => { if (!cancelled) setFailed(true); });
  return () => { cancelled = true; };
 }, [period, shell.organizationId, shell.canViewReports, revision]);
 if (!shell.canViewReports) return <Navigate to="/app/customer-members" replace />;
 const metrics = result?.period === period && result.organizationId === shell.organizationId ? result.metrics : null;
 const money = (value: number) => formatMoney(locale, value, metrics?.currency ?? "COP");
 const amount = money;
 const rate = metrics?.collectionRate;
 const percent = rate == null ? "—" : new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(rate);
 return <PageContainer className="space-y-6">
  <PageHeader title={t("Dashboard")} description={t("A clear view of monthly collections and outstanding balances.")} actions={<div className="grid gap-1.5"><Label htmlFor="dashboard-period">{t("Period")}</Label><Input className="w-60 max-w-full" id="dashboard-period" type="month" required value={period} onChange={(event) => { if (event.target.value) { setFailed(false); setPeriod(event.target.value); } }} /></div>} />
  {failed ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3">{t("We could not load the dashboard.")}<Button variant="outline" onClick={() => { setFailed(false); setRevision((value) => value + 1); }}>{t("Try again")}</Button></div> : null}
  {!metrics && !failed ? <DashboardSkeleton label={t("Loading dashboard…")} /> : null}
  {metrics && !failed ? <>
   <CurrencyLabel currency={metrics.currency} />
   <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
    <Metric icon={<CalendarClock />} label={t("Total to collect")} value={amount(metrics.expectedMinor)} to={`/app/charges?period=${period}`} tone="blue" />
    <Metric icon={<ArrowDownLeft />} label={t("Collected")} value={amount(metrics.collectedMinor)} to="/app/payments" tone="green" />
    <Metric icon={<WalletCards />} label={t("Outstanding")} value={amount(metrics.outstandingMinor)} to={`/app/charges?period=${period}`} tone="amber" />
    <Metric icon={<UsersRound />} label={t("Overdue members")} value={String(metrics.overdueMembers)} to={`/app/charges?period=${period}&state=overdue`} tone="rose" />
   </div>
   <div className="grid items-stretch gap-6 xl:grid-cols-[1.5fr_1fr]">
    <section className="rounded-2xl border bg-card p-5 sm:p-7">
     <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{t("Collection overview")}</h2><span className="rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">{period}</span></div>
     <div className="my-7 flex flex-col items-center gap-7 sm:flex-row">
      <div role="img" aria-label={`${t("Percentage paid")}: ${percent}`} className="relative grid size-40 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(var(--primary) ${Math.max(0, Math.min(1, rate ?? 0)) * 360}deg, var(--muted) 0)` }}><div className="absolute inset-3 rounded-full bg-card" /><div className="relative text-center"><p className="text-3xl font-semibold tracking-tight tabular-nums">{percent}</p><p className="mt-1 text-xs text-muted-foreground">{t("Percentage paid")}</p></div></div>
      <dl className="grid w-full gap-5"><div><dt className="flex items-center gap-2 text-sm text-muted-foreground"><span className="size-2 rounded-full bg-primary" />{t("Payments applied to this month")}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{money(metrics.allocatedMinor)}</dd></div><div><dt className="flex items-center gap-2 text-sm text-muted-foreground"><span className="size-2 rounded-full bg-amber-500" />{t("Outstanding")}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{money(metrics.outstandingMinor)}</dd></div></dl>
     </div>
     <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-sm"><span className="text-muted-foreground">{t("Total to collect")}</span><span className="font-semibold tabular-nums">{money(metrics.expectedMinor)}</span></div>
    </section>
    <section className="flex flex-col rounded-2xl border bg-card p-5 sm:p-7">
     <div className="mb-5 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><CalendarClock className="size-5" /></span><h2 className="font-semibold">{t("Upcoming due in 7 days")}</h2></div>
     <p className="text-3xl font-semibold tracking-tight tabular-nums">{money(metrics.upcomingDueMinor)}</p><p className="mt-2 text-sm text-muted-foreground">{t("{count} charges", { count: metrics.upcomingDueCount })}</p>
     <div className="mt-auto pt-7"><Link to={`/app/charges?period=${period}`} className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-muted px-4 text-sm font-medium hover:bg-accent">{t("Go to charges")}<ArrowRight className="size-4" /></Link></div>
    </section>
   </div>
   <section className="rounded-2xl border bg-card p-5 sm:p-6"><h2 className="mb-4 font-semibold">{t("Quick actions")}</h2><div className="grid gap-3 sm:grid-cols-3"><QuickLink to="/app/customer-members" icon={<Plus />} label={t("Manage members")} /><QuickLink to="/app/payments" icon={<CircleCheckBig />} label={t("View payments")} /><QuickLink to="/app/reports" icon={<ArrowUpRight />} label={t("View reports")} /></div></section>
   {metrics.expectedMinor === 0 ? <div className="rounded-2xl border border-dashed p-6 text-center"><h2 className="font-semibold">{t("No charges in this period")}</h2><p className="mt-2 text-sm text-muted-foreground">{t("Create members and enrollments, then generate monthly charges.")}</p><Button className="mt-5" nativeButton={false} render={<Link to="/app/charges" />}>{t("Go to charges")}<ArrowRight /></Button></div> : null}
   <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><Clock3 className="mt-0.5 size-3.5 shrink-0" />{t(metrics.scope === "all" ? "All accessible branches · updated {date}" : "Assigned branches only · updated {date}", { date: new Date(metrics.asOf).toLocaleString(locale) })}</p>
  </> : null}
 </PageContainer>;
}
const tones = { blue: "bg-blue-50 text-blue-700", green: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", rose: "bg-rose-50 text-rose-700" };
function Metric({ icon, label, value, to, tone }: { icon: ReactNode; label: string; value: string; to: string; tone: keyof typeof tones }) {
 return <Link to={to} className="group min-w-0 rounded-2xl border bg-card p-4 transition-colors sm:p-5 hover:border-primary/40"><div className="mb-4 flex items-center justify-between"><span className={`grid size-10 place-items-center rounded-xl [&_svg]:size-5 ${tones[tone]}`}>{icon}</span><ArrowUpRight className="size-4 text-muted-foreground/60 group-hover:text-primary" /></div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 break-words text-lg sm:text-2xl xl:text-xl 2xl:text-2xl font-semibold tracking-tight tabular-nums">{value}</p></Link>;
}
function QuickLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
 return <Link to={to} className="flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors hover:border-primary/30 hover:bg-accent"><span className="text-primary [&_svg]:size-4">{icon}</span>{label}<ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground" /></Link>;
}
