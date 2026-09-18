import { SelectField } from "@/components/select-field";
import { CenteredDialog, type DialogReturnFocus } from "@/components/centered-dialog";
import { MembersTable } from "@/components/members-table";
import { LoadingButton } from "@/components/loading-button";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, Search, Upload } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppShell } from "@/hooks/use-app-shell";
import { createIdempotencyKey } from "@/lib/idempotency-key";
import { controlMembersApi, type CustomerMember } from "@/lib/controlmembers";
import { useT } from "@/lib/i18n";

export function CustomerMembersPage() {
	const createButtonRef = useRef<HTMLButtonElement>(null);
	const t = useT();
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
		<PageHeader title={t("Members")} description={t("People enrolled in your academy and their current balances.")} actions={<><Button variant="outline" onClick={() => setImporting((value) => !value)}><Upload />{t(importing ? "Close import" : "Import CSV")}</Button><Button ref={createButtonRef} onClick={() => setCreating(true)}><Plus />{t("Add member")}</Button></>} />
		{creating ? <CreateMemberForm returnFocus={createButtonRef} onCancel={() => setCreating(false)} onCreated={() => { setCreating(false); setRevision((value) => value + 1); }} /> : null}
		{importing ? <ImportMembers onDone={() => { setImporting(false); setRevision((value) => value + 1); }} /> : null}
		<div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[1fr_12rem]">
			<div className="grid gap-2"><Label htmlFor="member-search">{t("Search members")}</Label><div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" /><Input className="pl-10" id="member-search" value={search} placeholder={t("Name, ID, email or phone")} onChange={(event) => setSearch(event.target.value)} /></div></div>
			<div className="grid gap-2"><Label htmlFor="member-status">{t("Status")}</Label><SelectField id="member-status" className="h-11 rounded-md border bg-background px-3" value={status} onValueChange={(value) => setStatus(value)} options={[{ value: "", label: t("All statuses") }, { value: "active", label: t("Active") }, { value: "paused", label: t("Paused") }, { value: "inactive", label: t("Inactive") }]} /></div>
		</div>
		{failed ? <p role="alert">{t("We could not load members.")}</p> : null}
		{loading ? <MembersTable members={[]} currency={currency} loading /> : null}
		{!loading && !failed && !members.length ? <div className="rounded-xl border border-dashed p-8 text-center"><h2 className="font-semibold">{t("No members found")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("Add your first member to begin tracking monthly payments.")}</p></div> : null}

		{!loading && !failed && members.length ? <MembersTable members={members} currency={currency} /> : null}
		{nextOffset !== null && !loading ? <Button variant="outline" onClick={() => void loadMore()}>{t("Load more")}</Button> : null}
	</PageContainer>;
}

function CreateMemberForm({ onCreated, onCancel, returnFocus }: { onCreated: () => void; onCancel: () => void; returnFocus: DialogReturnFocus }) {
	const t = useT();
	const shell = useAppShell();
	const [name, setName] = useState("");
	const [documentNumber, setDocumentNumber] = useState("");
	const [email, setEmail] = useState("");
	const [phone, setPhone] = useState("");
	const [branchId, setBranchId] = useState(shell.activeBranch?.id ?? "");
	const [pending, setPending] = useState(false);
	const [failed, setFailed] = useState(false);
	async function submit(event: FormEvent) {
		event.preventDefault();
		if (pending || !name.trim() || !branchId) return;
		setPending(true); setFailed(false);
		try { await controlMembersApi.createMember(shell.organizationId, { displayName: name, primaryBranchId: branchId, documentNumber, email, phoneE164: phone }); onCreated(); }
		catch { setFailed(true); } finally { setPending(false); }
	}
	return <CenteredDialog open title={t("Add member")} description={t("Only the name and branch are required. You can complete the profile later.")} pending={pending} onClose={onCancel} returnFocus={returnFocus} wide>
		<form onSubmit={submit} className="space-y-5 px-5 pt-5 sm:px-7" aria-label={t("New member")} aria-busy={pending}>
		<fieldset disabled={pending}>
		<div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="customer-name">{t("Full name")}</Label><Input id="customer-name" value={name} maxLength={200} required onChange={(event) => setName(event.target.value)} /></div>{shell.branches.length > 1 ? <div className="grid gap-2"><Label htmlFor="customer-branch">{t("Branch")}</Label><SelectField id="customer-branch" className="h-11 rounded-md border bg-background px-3" value={branchId} onValueChange={(value) => setBranchId(value)} options={[...shell.branches.map((branch) => ({ value: branch.id, label: branch.name }))]} /></div> : null}<div className="grid gap-2"><Label htmlFor="customer-document">{t("Document (optional)")}</Label><Input id="customer-document" value={documentNumber} maxLength={80} onChange={(event) => setDocumentNumber(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="customer-email">{t("Email (optional)")}</Label><Input id="customer-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="customer-phone">{t("Phone with country code (optional)")}</Label><Input id="customer-phone" value={phone} placeholder="+57 300 000 0000" onChange={(event) => setPhone(event.target.value)} /></div></div>
		</fieldset>
		{failed ? <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{t("We could not save the member. Check the information and try again.")}</p> : null}
		<div className="-mx-5 flex flex-col-reverse gap-2 border-t bg-muted/30 px-5 py-4 sm:-mx-7 sm:flex-row sm:justify-end sm:px-7"><Button type="button" variant="outline" disabled={pending} onClick={onCancel}>{t("Cancel")}</Button><LoadingButton type="submit" loading={pending} loadingLabel={t("Saving…")} disabled={pending || !name.trim() || !branchId}>{t("Save member")}</LoadingButton></div>
		</form>
	</CenteredDialog>;
}

function ImportMembers({ onDone }: { onDone: () => void }) {
	const t = useT();
	const shell = useAppShell();
	const [csv, setCsv] = useState("");
	const [preview, setPreview] = useState<{ validCount: number; invalidCount: number; warningCount: number } | null>(null);
	const [pending, setPending] = useState(false);
	const [failed, setFailed] = useState<"read" | "save" | null>(null);
	async function loadFile(file?: File) { if (file) { setCsv(await file.text()); setPreview(null); } }
	async function runPreview() { setPending(true); setFailed(null); try { setPreview(await controlMembersApi.previewImport(shell.organizationId, csv)); } catch { setFailed("read"); } finally { setPending(false); } }
	async function confirm() { setPending(true); setFailed(null); try { await controlMembersApi.confirmImport(shell.organizationId, csv, createIdempotencyKey()); onDone(); } catch { setFailed("save"); } finally { setPending(false); } }
	return <section className="space-y-4 rounded-xl border bg-card p-4"><div><h2 className="font-semibold">{t("Import members")}</h2><p className="text-sm text-muted-foreground">{t("Download the template, add up to 50 members and review the file before saving.")}</p></div><a className="text-sm font-medium underline" href="/api/imports/members/template">{t("Download CSV template")}</a><div className="grid gap-2"><Label htmlFor="member-csv">{t("CSV file")}</Label><Input id="member-csv" aria-describedby="member-file-help" type="file" accept=".csv,text/csv" onChange={(event) => void loadFile(event.target.files?.[0])} /><p id="member-file-help" className="text-sm leading-6 text-muted-foreground">{t("Open the template in Excel or Google Sheets. Keep its column names and save it as CSV (comma-separated, .csv), not as an Excel workbook (.xlsx).")}</p></div>{preview ? <p role="status" className="text-sm">{t("Ready to add: {valid}. With warnings: {warnings}. Need corrections: {invalid}.", { valid: preview.validCount, warnings: preview.warningCount, invalid: preview.invalidCount })}</p> : null}{failed ? <p role="alert" className="text-sm">{t(failed === "save" ? "We could not add the members. Please try again." : "We could not read this file. Use the template and save it as a comma-separated CSV file (.csv).")}</p> : null}<div className="flex flex-wrap gap-2"><LoadingButton loading={pending} type="button" variant="outline" disabled={pending || !csv} onClick={() => void runPreview()}>{t("Preview import")}</LoadingButton>{preview && preview.validCount > 0 ? <LoadingButton loading={pending} type="button" disabled={pending} onClick={() => void confirm()}>{t("Import valid rows")}</LoadingButton> : null}</div></section>;
}
