import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppShell } from "@/hooks/use-app-shell";
import { controlMembersApi, type CustomerMember } from "@/lib/controlmembers";
import { useI18n, useT } from "@/lib/i18n";

export function CustomerMembersPage() {
	const t = useT();
	const { locale } = useI18n();
	const shell = useAppShell();
	const [members, setMembers] = useState<CustomerMember[]>([]);
	const [currency, setCurrency] = useState("COP");
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState("");
	const [loading, setLoading] = useState(true);
	const [failed, setFailed] = useState(false);
	const [creating, setCreating] = useState(false);
	const [importing, setImporting] = useState(false);
	const [revision, setRevision] = useState(0);
	const [nextOffset, setNextOffset] = useState<number | null>(null);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			setLoading(true); setFailed(false);
			void controlMembersApi.members(shell.organizationId, search, status)
				.then((result) => { setMembers(result.members); setNextOffset(result.nextOffset); setCurrency(result.currency ?? "COP"); })
				.catch(() => setFailed(true)).finally(() => setLoading(false));
		}, 250);
		return () => window.clearTimeout(timer);
	}, [shell.organizationId, search, status, revision]);
	async function loadMore() { if (nextOffset === null) return; const result = await controlMembersApi.members(shell.organizationId, search, status, nextOffset); setMembers((current) => [...current, ...result.members]); setNextOffset(result.nextOffset); }

	return <PageContainer className="space-y-6">
		<PageHeader title={t("Members")} description={t("People enrolled in your academy and their current balances.")} />
		<div className="flex flex-wrap gap-2"><Button onClick={() => setCreating((value) => !value)}>{t(creating ? "Close form" : "Add member")}</Button><Button variant="outline" onClick={() => setImporting((value) => !value)}>{t(importing ? "Close import" : "Import CSV")}</Button></div>
		{creating ? <CreateMemberForm onCreated={() => { setCreating(false); setRevision((value) => value + 1); }} /> : null}
		{importing ? <ImportMembers onDone={() => { setImporting(false); setRevision((value) => value + 1); }} /> : null}
		<div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[1fr_12rem]">
			<div className="grid gap-2"><Label htmlFor="member-search">{t("Search members")}</Label><Input id="member-search" value={search} placeholder={t("Name, ID, email or phone")} onChange={(event) => setSearch(event.target.value)} /></div>
			<div className="grid gap-2"><Label htmlFor="member-status">{t("Status")}</Label><select id="member-status" className="h-10 rounded-md border bg-background px-3" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{t("All statuses")}</option><option value="active">{t("Active")}</option><option value="paused">{t("Paused")}</option><option value="inactive">{t("Inactive")}</option></select></div>
		</div>
		{failed ? <p role="alert">{t("We could not load members.")}</p> : null}
		{loading ? <p role="status" className="text-muted-foreground">{t("Loading members…")}</p> : null}
		{!loading && !failed && !members.length ? <div className="rounded-xl border border-dashed p-8 text-center"><h2 className="font-semibold">{t("No members found")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("Add your first member to begin tracking monthly payments.")}</p></div> : null}
		{!loading && members.length ? <ul className="grid gap-3">{members.map((member) => <li key={member.id}><Link to={`/app/customer-members/${member.id}`} className="grid gap-2 rounded-xl border bg-card p-4 transition-colors hover:bg-accent sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{member.displayName}</h2><Status value={member.status} /></div><p className="mt-1 text-sm text-muted-foreground">{member.documentNumber || member.email || member.phoneE164 || t("No contact information")}</p></div><div className="sm:text-right"><p className="text-xs text-muted-foreground">{t("Outstanding")}</p><p className="font-semibold">{new Intl.NumberFormat(locale, { style: "currency", currency }).format(member.outstandingMinor / 100)}</p></div></Link></li>)}</ul> : null}
		{nextOffset !== null && !loading ? <Button variant="outline" onClick={() => void loadMore()}>{t("Load more")}</Button> : null}
	</PageContainer>;
}

function Status({ value }: { value: string }) {
	const t = useT();
	return <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{t(value === "active" ? "Active" : value === "paused" ? "Paused" : "Inactive")}</span>;
}

function CreateMemberForm({ onCreated }: { onCreated: () => void }) {
	const t = useT();
	const shell = useAppShell();
	const [name, setName] = useState("");
	const [documentNumber, setDocumentNumber] = useState("");
	const [email, setEmail] = useState("");
	const [phone, setPhone] = useState("");
	const [branchId, setBranchId] = useState(shell.branches[0]?.id ?? "");
	const [pending, setPending] = useState(false);
	const [failed, setFailed] = useState(false);
	async function submit(event: FormEvent) {
		event.preventDefault(); setPending(true); setFailed(false);
		try { await controlMembersApi.createMember(shell.organizationId, { displayName: name, primaryBranchId: branchId, documentNumber, email, phoneE164: phone }); onCreated(); }
		catch { setFailed(true); } finally { setPending(false); }
	}
	return <form onSubmit={submit} className="grid gap-4 rounded-xl border bg-card p-4">
		<div><h2 className="font-semibold">{t("New member")}</h2><p className="text-sm text-muted-foreground">{t("Only the name and branch are required. You can complete the profile later.")}</p></div>
		<div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="customer-name">{t("Full name")}</Label><Input id="customer-name" value={name} maxLength={200} required onChange={(event) => setName(event.target.value)} /></div>{shell.branches.length > 1 ? <div className="grid gap-2"><Label htmlFor="customer-branch">{t("Branch")}</Label><select id="customer-branch" className="h-10 rounded-md border bg-background px-3" value={branchId} onChange={(event) => setBranchId(event.target.value)}>{shell.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div> : null}<div className="grid gap-2"><Label htmlFor="customer-document">{t("Document (optional)")}</Label><Input id="customer-document" value={documentNumber} maxLength={80} onChange={(event) => setDocumentNumber(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="customer-email">{t("Email (optional)")}</Label><Input id="customer-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="customer-phone">{t("Phone with country code (optional)")}</Label><Input id="customer-phone" value={phone} placeholder="+57 300 000 0000" onChange={(event) => setPhone(event.target.value)} /></div></div>
		{failed ? <p role="alert" className="text-sm">{t("We could not save the member. Check the information and try again.")}</p> : null}<div><Button disabled={pending || !name.trim() || !branchId}>{t(pending ? "Saving…" : "Save member")}</Button></div>
	</form>;
}

function ImportMembers({ onDone }: { onDone: () => void }) {
	const t = useT();
	const shell = useAppShell();
	const [csv, setCsv] = useState("");
	const [preview, setPreview] = useState<{ validCount: number; invalidCount: number; warningCount: number } | null>(null);
	const [pending, setPending] = useState(false);
	const [failed, setFailed] = useState(false);
	async function loadFile(file?: File) { if (file) { setCsv(await file.text()); setPreview(null); } }
	async function runPreview() { setPending(true); setFailed(false); try { setPreview(await controlMembersApi.previewImport(shell.organizationId, csv)); } catch { setFailed(true); } finally { setPending(false); } }
	async function confirm() { setPending(true); setFailed(false); try { await controlMembersApi.confirmImport(shell.organizationId, csv, crypto.randomUUID()); onDone(); } catch { setFailed(true); } finally { setPending(false); } }
	return <section className="space-y-4 rounded-xl border bg-card p-4"><div><h2 className="font-semibold">{t("Import members")}</h2><p className="text-sm text-muted-foreground">{t("Download the template, fill up to 50 rows and preview before importing.")}</p></div><a className="text-sm font-medium underline" href="/api/imports/members/template">{t("Download CSV template")}</a><div className="grid gap-2"><Label htmlFor="member-csv">{t("CSV file")}</Label><Input id="member-csv" type="file" accept=".csv,text/csv" onChange={(event) => void loadFile(event.target.files?.[0])} /></div>{preview ? <p role="status" className="text-sm">{t("Valid: {valid}. With warnings: {warnings}. Invalid: {invalid}.", { valid: preview.validCount, warnings: preview.warningCount, invalid: preview.invalidCount })}</p> : null}{failed ? <p role="alert" className="text-sm">{t("We could not process this CSV.")}</p> : null}<div className="flex gap-2"><Button type="button" variant="outline" disabled={pending || !csv} onClick={() => void runPreview()}>{t("Preview import")}</Button>{preview && preview.validCount > 0 ? <Button type="button" disabled={pending} onClick={() => void confirm()}>{t("Import valid rows")}</Button> : null}</div></section>;
}
