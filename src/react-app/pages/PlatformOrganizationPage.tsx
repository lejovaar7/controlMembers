import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, ArrowUpRight, Building2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { platformRequest, type CompanyDetail, type PlatformOwner } from "@/lib/platform";
import { activateCompany } from "@/lib/companies";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/list-skeleton";
import { StatusBadge } from "@/components/status-badge";
import type { MessageKey } from "../../shared/i18n";

function OwnerCard({ owner, companyId }: { owner: PlatformOwner; companyId: string }) {
 const t = useT();
 const [busy, setBusy] = useState(false);
 const [message, setMessage] = useState<MessageKey>();
 async function resend() {
  setBusy(true); setMessage(undefined);
  try {
   const result = await platformRequest<{ sent: boolean }>("account-setup/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: owner.email, organizationId: companyId }) });
   setMessage(result.sent ? "Account setup link sent again." : "That owner has already finished setting up.");
  } catch { setMessage("We could not send the link. Please try again."); }
  finally { setBusy(false); }
 }
 return <li className="space-y-3 py-4">
  <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-medium">{owner.name}</p><p className="break-all text-sm text-muted-foreground">{owner.email}</p></div>
   <StatusBadge tone={!owner.isActive ? "neutral" : owner.setupRequired ? "warning" : "success"}>{t(!owner.isActive ? "Inactive" : owner.setupRequired ? "Account setup pending" : "Active")}</StatusBadge></div>
  {owner.isActive && owner.setupRequired && <Button className="h-auto min-h-10 max-w-full whitespace-normal text-center" variant="outline" disabled={busy} onClick={resend}>{busy ? t("Sending…") : t("Resend setup link")}</Button>}
  {message && <p role="status" className="text-sm">{t(message)}</p>}
 </li>;
}

function CompanyView({ initial }: { initial: CompanyDetail }) {
 const t = useT();
 const [company, setCompany] = useState(initial);
 const [name, setName] = useState(initial.name);
 const [saving, setSaving] = useState(false);
 const [opening, setOpening] = useState(false);
 const [message, setMessage] = useState<MessageKey>();
 async function save(event: FormEvent) {
  event.preventDefault(); setSaving(true); setMessage(undefined);
  try {
   const updated = await platformRequest<{ name: string }>(`organizations/${company.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
   setCompany({ ...company, name: updated.name }); setName(updated.name); setMessage("Company name updated.");
  } catch { setMessage("We could not update this company."); }
  finally { setSaving(false); }
 }
 async function openWorkspace() {
  setOpening(true); setMessage(undefined);
  try { await activateCompany(company.id); window.location.assign("/app/dashboard"); }
  catch { setMessage("We could not open this company."); setOpening(false); }
 }
 return <>
  <PageHeader title={company.name} description={t("Company details and access")}
   actions={company.canOpenWorkspace && <Button disabled={opening} onClick={openWorkspace}><ArrowUpRight />{t("Open company")}</Button>} />
  {!company.canOpenWorkspace && <p className="mb-6 rounded-xl border bg-secondary p-4 text-sm leading-6">{t("To manage members, charges and payments, your account must have access to this company.")}</p>}
  <div className="grid items-start gap-6 lg:grid-cols-2">
   <section className="min-w-0 rounded-2xl border bg-card p-5 sm:p-6">
    <h2 className="mb-5 text-lg font-semibold">{t("Company information")}</h2>
    <form onSubmit={save} className="space-y-3"><label htmlFor="company-name" className="block text-sm font-medium">{t("Company name")}</label>
     <Input id="company-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={200} required />
     <Button type="submit" disabled={saving || !name.trim() || name.trim() === company.name}>{saving ? t("Saving…") : t("Save changes")}</Button>
    </form>
    {message && <p role="status" className="mt-3 text-sm">{t(message)}</p>}
    <dl className="mt-6 grid grid-cols-2 gap-4 border-t pt-5 text-sm">
     <div><dt className="text-muted-foreground">{t("Company language")}</dt><dd className="mt-1 font-medium">{company.locale === "es" ? "Español" : "English"}</dd></div>
     <div><dt className="text-muted-foreground">{t("Currency")}</dt><dd className="mt-1 font-medium">{company.currency || "—"}</dd></div>
     <div><dt className="text-muted-foreground">{t("Timezone")}</dt><dd className="mt-1 break-words font-medium">{company.timezone || "—"}</dd></div>
     <div><dt className="text-muted-foreground">{t("Active users")}</dt><dd className="mt-1 font-medium">{company.activeUserCount}</dd></div>
    </dl>
   </section>
   <section className="min-w-0 rounded-2xl border bg-card p-5 sm:p-6"><h2 className="text-lg font-semibold">{t("Company owners")}</h2>
    {company.owners.length ? <ul className="divide-y">{company.owners.map((owner) => <OwnerCard key={owner.id} owner={owner} companyId={company.id} />)}</ul> : <p className="mt-4 text-sm text-muted-foreground">{t("No owners assigned")}</p>}
   </section>
   <section className="rounded-2xl border bg-card p-5 sm:p-6 lg:col-span-2"><h2 className="mb-4 text-lg font-semibold">{t("Branches")} <span className="text-muted-foreground">({company.branchCount})</span></h2>
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{company.branches.map((branch) => <li key={branch.id} className="flex items-center gap-3 rounded-xl border p-4"><Building2 className="size-5 shrink-0 text-primary" /><span className="min-w-0 break-words text-sm font-medium">{branch.name}</span></li>)}</ul>
   </section>
  </div>
 </>;
}

export function PlatformOrganizationPage() {
 const { id = "" } = useParams();
 const t = useT();
 const [retry, setRetry] = useState(0);
 const key = `${id}:${retry}`;
 const [result, setResult] = useState<{ key: string; data?: CompanyDetail; missing?: boolean }>();
 useEffect(() => {
  const controller = new AbortController();
  void platformRequest<CompanyDetail>(`organizations/${encodeURIComponent(id)}`, { signal: controller.signal })
   .then((data) => { if (!controller.signal.aborted) setResult({ key, data }); })
   .catch((error: unknown) => { if (!controller.signal.aborted) setResult({ key, missing: error instanceof Error && error.message === "NOT_FOUND" }); });
  return () => controller.abort();
 }, [id, key]);
 const current = result?.key === key ? result : undefined;
 return <PageContainer>
  <Link to="/platform" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-primary"><ArrowLeft className="size-4" />{t("Back to companies")}</Link>
  {!current ? <ListSkeleton label={t("Loading company…")} /> : current.data ? <CompanyView key={id} initial={current.data} /> : <div className="space-y-4" role="alert"><p>{t(current.missing ? "Company not found." : "We could not load companies.")}</p>{!current.missing && <Button variant="outline" onClick={() => setRetry(retry + 1)}>{t("Try again")}</Button>}</div>}
 </PageContainer>;
}
