import { LoadingButton } from "@/components/loading-button";
import { useT } from "@/lib/i18n";
import { Link } from "react-router";
import { PageContainer } from "@/components/page";
import { useSession } from "@/lib/auth-client";
import { authenticatedStartPath } from "@/lib/session-routing";
import { ArrowRight, Check, ChartNoAxesCombined, UsersRound, WalletCards } from "lucide-react";

export function HomePage() {
 const t = useT();
 const { data: session, isPending } = useSession();
 const features = [
  { icon: UsersRound, title: "Organize your members", detail: "People enrolled in your academy and their current balances." },
  { icon: WalletCards, title: "Stay on top of payments", detail: "Review received payments, the charges they cover and cancelled payments." },
  { icon: ChartNoAxesCombined, title: "Know where you stand", detail: "A clear view of monthly collections and outstanding balances." },
 ] as const;
 return <PageContainer className="max-w-7xl">
  <div className="grid items-center gap-12 py-8 lg:min-h-[65svh] lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-16">
   <div className="max-w-2xl">
    <p className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-primary"><span className="size-1.5 rounded-full bg-primary" />{t("Your workspace, in order.")}</p>
    <h1 className="text-4xl font-semibold leading-[1.1] tracking-[-0.045em] sm:text-5xl xl:text-6xl">{t("Less admin. More time for your members.")}</h1>
    <p className="mt-6 max-w-md text-lg leading-8 text-muted-foreground">{t("Members, payments and balances. Everything in one place.")}</p>
    <LoadingButton loading={isPending} className="mt-8" size="lg" disabled={isPending} nativeButton={false} render={<Link to={session ? authenticatedStartPath(null, (session.user as { role?: unknown }).role) : "/login"} />}>{t(session ? "Open app" : "Sign in")}<ArrowRight /></LoadingButton>
   </div>
   <section className="relative overflow-hidden rounded-3xl bg-[var(--brand-panel)] p-6 text-white sm:p-10">
    <div aria-hidden="true" className="absolute -right-20 -top-20 size-72 rounded-full border-[40px] border-white/5" />
    <p className="relative mb-10 max-w-72 text-2xl font-medium leading-8 tracking-tight">{t("Keep your academy moving.")}</p>
    <div className="relative space-y-3">{features.map(({ icon: Icon, title }, index) => <div key={title} className="flex items-center gap-4 rounded-xl border border-white/15 bg-white/5 p-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10"><Icon className="size-5 text-sky-200" /></span><div className="flex-1"><p className="mb-1 text-[10px] font-medium tracking-widest text-sky-200">0{index + 1}</p><h2 className="text-sm font-medium">{t(title)}</h2></div><Check className="size-4 shrink-0 text-emerald-300" /></div>)}</div>
    <p className="relative mt-8 text-sm text-slate-300">{t("A simpler day starts here.")}</p>
   </section>
  </div>
  <div className="grid gap-8 border-t py-8 sm:grid-cols-3">{features.map(({ icon: Icon, title, detail }) => <section key={title}><Icon className="mb-4 size-5 text-primary" /><h2 className="mb-2 text-sm font-semibold">{t(title)}</h2><p className="max-w-sm text-sm leading-6 text-muted-foreground">{t(detail)}</p></section>)}</div>
 </PageContainer>;
}
