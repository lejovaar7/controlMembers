import { ListSkeleton } from "@/components/content-skeleton";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { Link } from "react-router";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, ChevronRight, Plus } from "lucide-react";
import { platformRequest, type CompanyDirectory } from "@/lib/platform";

export function PlatformHomePage() {
 const t = useT();
 const [search, setSearch] = useState("");
 const [offset, setOffset] = useState(0);
 const [retry, setRetry] = useState(0);
 const query = new URLSearchParams({ search: search.trim(), offset: String(offset) }).toString();
 const key = `${query}:${retry}`;
 const [result, setResult] = useState<{ key: string; data?: CompanyDirectory; error?: boolean }>();
 useEffect(() => {
  const controller = new AbortController();
  const timer = setTimeout(() => {
   void platformRequest<CompanyDirectory>(`organizations?${query}`, { signal: controller.signal })
    .then((data) => { if (!controller.signal.aborted) setResult({ key, data }); })
    .catch(() => { if (!controller.signal.aborted) setResult({ key, error: true }); });
  }, 250);
  return () => { clearTimeout(timer); controller.abort(); };
 }, [query, key]);
 const current = result?.key === key ? result : undefined;
 return <PageContainer>
  <PageHeader title={t("Companies")} description={t("Manage companies, owners and access from one place.")}
   actions={<Button nativeButton={false} render={<Link to="/platform/organizations/new" />}><Plus />{t("Create company")}</Button>} />
  <section className="overflow-hidden rounded-2xl border bg-card">
   <div className="border-b p-4 sm:p-6">
    <label htmlFor="company-search" className="mb-2 block text-sm font-medium">{t("Search companies")}</label>
    <Input id="company-search" type="search" value={search} maxLength={120} placeholder={t("Company name or owner email")}
     onChange={(event) => { setSearch(event.target.value); setOffset(0); }} className="max-w-xl" />
   </div>
   {!current ? <ListSkeleton label={t("Loading companies…")} /> : current.error ? (
    <div className="space-y-4 p-6" role="alert"><p>{t("We could not load companies.")}</p><Button variant="outline" onClick={() => setRetry(retry + 1)}>{t("Try again")}</Button></div>
   ) : current.data && <>
    <div className="border-b px-4 py-3 text-sm text-muted-foreground sm:px-6" role="status">{t("{count} companies", { count: current.data.total })}</div>
    {current.data.organizations.length === 0 ? <p className="p-8 text-center text-muted-foreground">{t("No companies found.")}</p> : (
     <ul className="divide-y">{current.data.organizations.map((company) => (
      <li key={company.id}><Link to={`/platform/organizations/${company.id}`} className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-primary sm:p-6">
       <span className="hidden size-12 shrink-0 place-items-center rounded-xl bg-secondary text-primary sm:grid"><Building2 /></span>
       <div className="min-w-0 flex-1"><h2 className="break-words font-semibold">{company.name}</h2><p className="mt-1 break-all text-sm text-muted-foreground">{company.owners.map((owner) => owner.email).join(", ") || t("No owners assigned")}</p>
        <p className="mt-2 text-xs text-muted-foreground">{t("{count} branches", { count: company.branchCount })} · {t("{count} active users", { count: company.activeUserCount })}</p></div>
       <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </Link></li>
     ))}</ul>
    )}
    {(offset > 0 || current.data.nextOffset !== null) && <div className="flex justify-between gap-3 border-t p-4">
     <Button variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>{t("Previous")}</Button>
     <Button variant="outline" disabled={current.data.nextOffset === null} onClick={() => setOffset(current.data!.nextOffset!)}>{t("Next")}</Button>
    </div>}
   </>}
  </section>
 </PageContainer>;
}
