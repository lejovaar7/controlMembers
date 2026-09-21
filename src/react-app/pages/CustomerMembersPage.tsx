import { SelectField } from "@/components/select-field";
import { CreateCustomerMemberDialog } from "@/components/create-customer-member-dialog";
import { PaymentDialog } from "@/components/payment-dialog";
import { MembersTable } from "@/components/members-table";
import { LoadingButton } from "@/components/loading-button";
import { useEffect, useRef, useState } from "react";
import { Download, Plus, Search, Upload } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/page";
import { Button, buttonVariants } from "@/components/ui/button";
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
	const [paymentTarget, setPaymentTarget] = useState<{ memberId: string; chargeId: string } | null>(null);
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
		{creating ? <CreateCustomerMemberDialog key={`${shell.organizationId}:${shell.activeBranch?.id}`} returnFocus={createButtonRef} onCancel={() => setCreating(false)} onCreated={(member) => { setCreating(false); setRevision((value) => value + 1); if (member.firstChargeId) setPaymentTarget({ memberId: member.id, chargeId: member.firstChargeId }); }} /> : null}
		{paymentTarget ? <PaymentDialog {...paymentTarget} returnFocus={createButtonRef} onClose={() => setPaymentTarget(null)} onSaved={() => { setPaymentTarget(null); setRevision((value) => value + 1); }} /> : null}
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
	return <section className="space-y-4 rounded-xl border bg-card p-4"><div><h2 className="font-semibold">{t("Import members")}</h2><p className="text-sm text-muted-foreground">{t("Download the template, add up to 50 members and review the file before saving.")}</p></div><a className={buttonVariants({ variant: "outline", className: "w-full sm:w-auto" })} href="/api/imports/members/template" download><Download aria-hidden="true" />{t("Download CSV template")}</a><div className="grid gap-2"><Label htmlFor="member-csv">{t("CSV file")}</Label><Input id="member-csv" aria-describedby="member-file-help" type="file" accept=".csv,text/csv" onChange={(event) => void loadFile(event.target.files?.[0])} /><p id="member-file-help" className="text-sm leading-6 text-muted-foreground">{t("Open the template in Excel or Google Sheets. Keep its column names and save it as CSV (comma-separated, .csv), not as an Excel workbook (.xlsx).")}</p></div>{preview ? <p role="status" className="text-sm">{t("Ready to add: {valid}. With warnings: {warnings}. Need corrections: {invalid}.", { valid: preview.validCount, warnings: preview.warningCount, invalid: preview.invalidCount })}</p> : null}{failed ? <p role="alert" className="text-sm">{t(failed === "save" ? "We could not add the members. Please try again." : "We could not read this file. Use the template and save it as a comma-separated CSV file (.csv).")}</p> : null}<div className="flex flex-wrap gap-2"><LoadingButton loading={pending} type="button" variant="outline" disabled={pending || !csv} onClick={() => void runPreview()}>{t("Preview import")}</LoadingButton>{preview && preview.validCount > 0 ? <LoadingButton loading={pending} type="button" disabled={pending} onClick={() => void confirm()}>{t("Import valid rows")}</LoadingButton> : null}</div></section>;
}
