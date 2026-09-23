import { useEffect, useRef, useState } from "react";
import { Check, Download, Pencil, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/select-field";
import { DatePicker } from "@/components/date-picker";
import { CenteredDialog } from "@/components/centered-dialog";
import { LoadingButton } from "@/components/loading-button";
import { Loader } from "@/components/loader";
import { MemberPhoneFields } from "@/components/member-phone-fields";
import { useAppShell } from "@/hooks/use-app-shell";
import { useI18n } from "@/lib/i18n";
import { billingSetupApi, type Plan } from "@/lib/billing-setup";
import { controlMembersApi, ProductApiError } from "@/lib/controlmembers";
import { parseDate } from "@/lib/calendar-dates";
import { createIdempotencyKey } from "@/lib/idempotency-key";
import { formatDate, formatMoney, type MessageKey } from "../../shared/i18n";
import { buildImportDrafts, IMPORT_FILE_LIMIT, memberFormImportMapping, parseImportFile, suggestImportMapping, type ImportDraft, type MemberFormImportField, type ImportMapping, type ImportReview } from "../../shared/member-import";

const labels: Record<MemberFormImportField, MessageKey> = {
	memberName: "Full name", documentNumber: "Document (optional)", email: "Email (optional)", phone: "Phone", whatsapp: "WhatsApp number", plan: "Plan", startDate: "Start date", firstDueDate: "First due date",
};
const basicFields: MemberFormImportField[] = ["memberName", "documentNumber", "email", "phone", "whatsapp"];
const errors: Record<string, MessageKey> = {
	INVALID_MEMBER_NAME: "Enter the member's name.", INVALID_DOCUMENT: "Check the document fields.", INVALID_REFERENCE: "Check the external reference.", INVALID_EMAIL: "Check the email address.", INVALID_PHONE: "Check the phone number and its country code.", INVALID_WHATSAPP: "Check the WhatsApp number and its country code.", INVALID_STATUS: "Choose active, paused or inactive.", INVALID_CONTACT: "Enter the contact's name or clear their other details.", INVALID_CONTACT_EMAIL: "Check the contact's email address.", INVALID_CONTACT_PHONE: "Check the contact's phone number.", MEMBER_IDENTIFIER_EXISTS: "A member with this document already exists.", DUPLICATE_IN_FILE: "This document is repeated in the members you selected.", PLAN_REQUIRED: "Choose a plan or explicitly import without enrollment.", IMPORT_INACTIVE_PLAN: "Paused or inactive members must be imported without enrollment.", INVALID_START_DATE: "Choose a valid enrollment start date.", INVALID_DUE_DATE: "The first due date must be on or after the start date.", INVALID_PLAN: "This plan is no longer active or available in this branch.", BILLING_SETTINGS_REQUIRED: "Configure the company currency and timezone first.",
};
const fileErrors: Record<string, MessageKey> = {
	EMPTY_FILE: "This file is empty. Add column headings and at least one member, then select it again.",
	NO_DATA_ROWS: "This file only contains column headings. Add members below them, save the CSV and select it again.",
	FILE_TOO_LARGE: "This file exceeds 100 KB. Split it into smaller CSV files.",
	TOO_MANY_ROWS: "This file contains more than 50 members. Split it into files with up to 50 members each.",
	INVALID_HEADERS: "Check the first row: every column needs a heading, with no more than 50 columns.",
	INCONSISTENT_COLUMNS: "Some rows have a different number of columns. Check the cells and save the file as CSV again.",
	INVALID_CSV: "We could not read the CSV format. Check the quotation marks or save it as CSV again.",
};

export function ImportMembers({ onDone }: { onDone: () => void }) {
	const { t, locale } = useI18n();
	const shell = useAppShell();
	const [step, setStep] = useState<"file" | "columns" | "review">("file");
	const [file, setFile] = useState<ReturnType<typeof parseImportFile> | null>(null);
	const [fileName, setFileName] = useState("");
	const [mapping, setMapping] = useState<ImportMapping>({});
	const countryCode = "+57";
	const [dateOrder, setDateOrder] = useState<"dmy" | "mdy">("dmy");

	const [defaultPlan, setDefaultPlan] = useState("");
	const [startDate, setStartDate] = useState("");
	const [firstDueDate, setFirstDueDate] = useState("");
	const [plans, setPlans] = useState<Plan[] | null>(null);
	const [catalogRevision, setCatalogRevision] = useState(0);
	const [catalogFailed, setCatalogFailed] = useState(false);
	const [rows, setRows] = useState<ImportDraft[]>([]);
	const [excluded, setExcluded] = useState<Set<number>>(new Set());
	const [review, setReview] = useState<ImportReview | null>(null);
	const [editing, setEditing] = useState<ImportDraft | null>(null);
	const [bulkPlan, setBulkPlan] = useState("");
	const [pending, setPending] = useState(false);
	const [failed, setFailed] = useState<MessageKey | null>(null);
	const [created, setCreated] = useState<number | null>(null);
	const [attempt, setAttempt] = useState<{ rows: ImportDraft[]; token: string; key: string } | null>(null);
	const requestLock = useRef(false);
	const fileInput = useRef<HTMLInputElement | null>(null);
	const fileRead = useRef(0);
	const editingTrigger = useRef<HTMLButtonElement | null>(null);
	const branchId = shell.activeBranch?.id ?? "";
	useEffect(() => {
		let cancelled = false;
		void Promise.all([billingSetupApi.plans(shell.organizationId), billingSetupApi.settings(shell.organizationId)]).then(([catalog, settings]) => {
			if (cancelled) return;
			setPlans(catalog.plans.filter((plan) => plan.isActive && plan.branchIds.includes(branchId))); setCatalogFailed(false);
			const parts = new Intl.DateTimeFormat("en-CA", { timeZone: settings.timezone ?? "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
			const get = (kind: string) => parts.find((part) => part.type === kind)?.value;
			const today = `${get("year")}-${get("month")}-${get("day")}`;
			setStartDate((value) => value || today); setFirstDueDate((value) => value || today);
		}).catch(() => { if (!cancelled) setCatalogFailed(true); });
		return () => { cancelled = true; };
	}, [shell.organizationId, branchId, catalogRevision]);
	const planOptions = [{ value: "", label: t("Choose a plan") }, { value: "__none", label: t("Only member details (no enrollment)") }, ...(plans ?? []).map((plan) => ({ value: plan.id, label: `${plan.name} · ${formatMoney(locale, plan.amountMinor, plan.currency)}` }))];
	const selected = rows.filter((row) => !excluded.has(row.row));
	const invalidate = () => { setReview(null); setFailed(null); };
	function clearFile() {
		fileRead.current++;
		if (fileInput.current) fileInput.current.value = "";
		setFile(null); setFileName(""); setMapping({}); setRows([]); setExcluded(new Set());
		setReview(null); setEditing(null); setFailed(null); setStep("file"); setBulkPlan(""); setDefaultPlan("");
	}
	async function loadFile(upload?: File) {
		if (!upload) return;
		clearFile();
		const read = fileRead.current;
		setFileName(upload.name);
		try {
			if (upload.size > IMPORT_FILE_LIMIT) throw new Error("FILE_TOO_LARGE");
			const parsed = parseImportFile(await upload.text());
			if (read !== fileRead.current) return;
			setFile(parsed); setMapping(memberFormImportMapping(suggestImportMapping(parsed.headers))); setStep("columns");
		} catch (error) {
			if (read === fileRead.current) setFailed(fileErrors[error instanceof Error ? error.message : ""] ?? "We could not read this file. Select it again or choose another CSV.");
		}
	}
	async function validate(drafts = selected) {
		if (requestLock.current || !drafts.length) return;
		requestLock.current = true; setPending(true); setFailed(null); setReview(null);
		try { setReview(await controlMembersApi.reviewImport(shell.organizationId, { branchId, rows: drafts })); }
		catch { setFailed("We could not validate the import. Your changes are still here; try again."); }
		finally { setPending(false); requestLock.current = false; }
	}
	function buildReview() {
		if (!file || !plans) return;
		const drafts = buildImportDrafts(file.records, memberFormImportMapping(mapping), { countryCode, dateOrder, defaultPlan, startDate, firstDueDate, plans });
		setRows(drafts); setExcluded(new Set()); setStep("review"); void validate(drafts);
	}
	async function save() {
		if (requestLock.current || (!attempt && (!review || review.invalidCount || !selected.length))) return;
		const submission = attempt ?? { rows: selected, token: review!.reviewToken, key: createIdempotencyKey() };
		setAttempt(submission); requestLock.current = true; setPending(true); setFailed(null);
		try { const result = await controlMembersApi.saveImport(shell.organizationId, { branchId, rows: submission.rows }, submission.token, submission.key); setCreated(result.created); }
		catch (error) {
			if (error instanceof ProductApiError && [400, 403, 409, 413].includes(error.status)) { setAttempt(null); setReview(null); setCatalogRevision((value) => value + 1); setFailed("The data or available plans changed. Validate the rows again before saving."); }
			else setFailed("We could not confirm the result. Retry this same import to avoid duplicates.");
		} finally { setPending(false); requestLock.current = false; }
	}
	function mappingField(field: MemberFormImportField) {
		if (!file) return null;
		const column = mapping[field];
		const examples = column === undefined ? [] : file.records.map((row) => row[column]).filter(Boolean).slice(0, 2);
		return <div key={field} className="min-w-0 space-y-2">
			<div className="flex items-center gap-2"><Label htmlFor={`map-${field}`}>{t(labels[field])}</Label>{field === "memberName" ? <span className="text-xs text-muted-foreground">{t("Required for import")}</span> : null}</div>

			<SelectField id={`map-${field}`} value={column?.toString() ?? ""} onValueChange={(value) => setMapping((current) => ({ ...current, [field]: value === "" ? undefined : Number(value) }))} options={[
				{ value: "", label: t(field === "memberName" ? "Choose the column with the names" : field === "whatsapp" ? "Use the phone number" : "Not in my file") },
				...file.headers.map((header, index) => ({ value: String(index), label: `${index + 1}. ${header}` })),
			]} />
			<p className="break-words text-sm text-muted-foreground">{examples.length ? t("Example from your file: {example}", { example: examples.join(" · ") }) : t(column !== undefined ? "This column has no filled values." : field === "memberName" ? "Choose a column to continue. The other details are optional." : field === "whatsapp" ? "We will use each member's phone for WhatsApp." : "You can add this later.")}</p>
		</div>;
	}
	const hasEnrollment = (mapping.plan !== undefined && !!file?.records.some((row) => row[mapping.plan!]?.trim())) || (defaultPlan !== "__none" && defaultPlan !== "");

	if (created !== null) return <section className="space-y-4 rounded-2xl border bg-card p-6" role="status"><Check aria-hidden="true" className="size-8 text-emerald-600" /><h2 className="text-xl font-semibold">{t("Imported {count} members.", { count: created })}</h2><p>{t("Their details and selected enrollments are now saved. No payments were recorded.")}</p><Button onClick={onDone}>{t("View members")}</Button></section>;
	return <section className="space-y-6 rounded-2xl border bg-card p-4 shadow-sm sm:p-6" aria-busy={pending}>
		<div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{t("Import members")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("Import into {branch}. Nothing is saved until you confirm.", { branch: shell.activeBranch?.name ?? "" })}</p></div><ol className="flex flex-wrap gap-2 text-sm" aria-label={t("Import steps")}>{(["file", "columns", "review"] as const).map((item, index) => <li key={item} aria-current={step === item ? "step" : undefined} className={`rounded-full px-3 py-1.5 ${step === item ? "bg-primary/10 font-semibold text-primary" : "bg-muted text-muted-foreground"}`}>{index + 1}{". "}{t(item === "file" ? "File" : item === "columns" ? "Check details" : "Review members")}</li>)}</ol></div>
		{failed && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{t(failed)}</p>}
		{catalogFailed ? <div role="alert"><p>{t("We could not load plans. Try again before creating the member.")}</p><Button variant="outline" onClick={() => setCatalogRevision((value) => value + 1)}>{t("Try again")}</Button></div> : null}
		{fileName ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4"><span className="min-w-0 break-all text-sm font-medium">{fileName}</span><Button type="button" variant="outline" size="sm" disabled={pending || !!attempt} onClick={clearFile}><X aria-hidden="true" />{t("Remove file")}</Button></div> : null}
		{step === "file" ? <div className="space-y-5"><p className="text-sm text-muted-foreground">{t("Use your own column names. We will suggest matches and let you correct every member before saving.")}</p><a className={buttonVariants({ variant: "outline" })} href="/api/imports/members/template" download><Download aria-hidden="true" />{t("Download CSV template")}</a><div className="rounded-xl border border-dashed p-5"><Label htmlFor="member-import-file">{t("CSV file")}</Label><Input ref={fileInput} className="mt-2" id="member-import-file" type="file" accept=".csv,text/csv,text/tab-separated-values" onChange={(event) => void loadFile(event.target.files?.[0])} /><p className="mt-2 text-sm text-muted-foreground">{t("Use a CSV with a header and up to 50 rows (100 KB). Commas, semicolons and tabs are supported.")}</p></div></div> : null}
		{step === "columns" && file ? <fieldset className="space-y-6" disabled={pending}>
			<div className="space-y-2">
				<h3 className="text-lg font-semibold">{t("Member details")}</h3>
				<p className="text-sm text-muted-foreground">{t("Use the same details as Add member. Choose where each detail is in your file and check the examples.")}</p>
				<p className="text-sm text-muted-foreground">{t("New members will be active in {branch}. Only the fields shown here will be imported.", { branch: shell.activeBranch?.name ?? "" })}</p>
			</div>
			<div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">{basicFields.map(mappingField)}</div>
			<p className="text-sm text-muted-foreground">{t("For phone numbers outside Colombia, include + and the country code.")}</p>
			<div className="space-y-4 border-t pt-5">
				<h3 className="font-semibold">{t("Plan")}</h3>
				<div className="grid gap-5 sm:grid-cols-2">
					{mappingField("plan")}
					<div className="space-y-2"><Label htmlFor="import-default-plan">{t(mapping.plan !== undefined ? "For members without a plan in the file" : "Plan for these members")}</Label><SelectField id="import-default-plan" value={defaultPlan} disabled={!plans || catalogFailed} onValueChange={setDefaultPlan} options={[{ value: "", label: t("Choose individually in the review") }, { value: "__none", label: t("Assign later (only add members)") }, ...planOptions.filter((option) => option.value && option.value !== "__none")]} /></div>
				</div>
				<p className="text-sm text-muted-foreground">{t("Plans in your file are matched to this branch and their current prices. Missing or unrecognized plans need your choice before saving.")}</p>
				{hasEnrollment ? <>
					<div className="grid gap-5 sm:grid-cols-2">
						<div className="space-y-3">{mappingField("startDate")}{mapping.startDate === undefined || file.records.some((row) => !row[mapping.startDate!]?.trim()) ? <div className="space-y-2"><Label htmlFor="import-start">{t("If the start date is missing")}</Label><DatePicker id="import-start" label={t("Start date")} value={startDate} onChange={(value) => { setStartDate(value); setFirstDueDate(value); }} /></div> : null}</div>
						<div className="space-y-3">{mappingField("firstDueDate")}{mapping.firstDueDate === undefined || file.records.some((row) => !row[mapping.firstDueDate!]?.trim()) ? <div className="space-y-2"><Label htmlFor="import-due">{t("If the first due date is missing")}</Label><DatePicker id="import-due" label={t("First due date")} value={firstDueDate} onChange={setFirstDueDate} /></div> : null}</div>
					</div>
					{[mapping.startDate, mapping.firstDueDate].some((column) => column !== undefined && file.records.some((row) => /^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(row[column] ?? ""))) ? <div className="max-w-sm space-y-2"><Label htmlFor="import-date-order">{t("Dates in the file")}</Label><SelectField id="import-date-order" value={dateOrder} onValueChange={(value) => setDateOrder(value as "dmy" | "mdy")} options={[{ value: "dmy", label: t("Day / month / year") }, { value: "mdy", label: t("Month / day / year") }]} /></div> : null}
					<p className="text-sm text-muted-foreground">{t("If both dates are the same, the first monthly fee will be created as unpaid. No payment is recorded by importing.")}</p>
				</> : defaultPlan === "__none" ? <p className="text-sm text-muted-foreground">{t("Only personal details will be saved. No enrollments or monthly fees will be created.")}</p> : null}
			</div>
			<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="text-sm text-muted-foreground">{t(mapping.memberName === undefined ? "Choose the column with the names to continue." : "Next, you can edit every member before saving.")}</p><Button disabled={mapping.memberName === undefined || !plans || catalogFailed || !branchId} onClick={buildReview}>{t("Continue to review")}</Button></div>
		</fieldset> : null}
		{step === "review" ? <>
			<fieldset className="space-y-5" disabled={pending || !!attempt}>
				<div className="flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1 space-y-2"><Label htmlFor="import-bulk-plan">{t("Set a plan for selected members")}</Label><SelectField id="import-bulk-plan" value={bulkPlan} options={planOptions} onValueChange={setBulkPlan} /></div><Button variant="outline" disabled={!bulkPlan || !selected.length} onClick={() => { invalidate(); setRows((current) => current.map((row) => excluded.has(row.row) ? row : { ...row, planId: bulkPlan === "__none" ? null : bulkPlan })); }}>{t("Apply to selected")}</Button></div>
				<p className="text-sm text-muted-foreground">{t("Review names, numbers, plans and dates. Edit a row or uncheck it to leave it out.")}</p>
				<div className="member-directory rounded-2xl border"><table className="members-table import-members-table"><caption className="sr-only">{t("Review members")}</caption><thead><tr>{["Include", "Member", "Phone / WhatsApp", "Plan and dates", "Review", "Actions"].map((label) => <th key={label} scope="col">{t(label as MessageKey)}</th>)}</tr></thead><tbody>{rows.map((row) => {
					const result = review?.rows.find((item) => item.row === row.row); const plan = plans?.find((item) => item.id === row.planId);
					return <tr key={row.row} className={excluded.has(row.row) ? "opacity-60" : undefined}>
						<td data-label={t("Include")}><input type="checkbox" checked={!excluded.has(row.row)} aria-label={t("Include row {row}", { row: row.row })} onChange={(event) => { invalidate(); setExcluded((current) => { const next = new Set(current); if (event.target.checked) next.delete(row.row); else next.add(row.row); return next; }); }} /></td>
						<td data-label={t("Member")}><strong className="block break-words">{row.memberName || t("Missing name")}</strong><span className="block text-xs text-muted-foreground">{t("Row {row}", { row: row.row })}</span><span className="block break-all text-sm text-muted-foreground">{row.email || row.documentNumber}</span></td>
						<td data-label={t("Phone / WhatsApp")}><span className="block tabular-nums">{row.phone || t("Not provided")}</span><span className="block text-xs text-muted-foreground">{row.whatsappSameAsPhone ? t("WhatsApp uses this phone") : t("WhatsApp: {number}", { number: row.whatsapp || t("Not provided") })}</span></td>
						<td data-label={t("Plan and dates")}>
							<div className="space-y-2">
								<SelectField aria-label={t("Plan for {name}", { name: row.memberName || t("Row {row}", { row: row.row }) })} aria-invalid={row.planId !== null && !plan} disabled={pending || !!attempt || excluded.has(row.row)} value={row.planId ?? "__none"} options={planOptions} onValueChange={(value) => { invalidate(); setRows((current) => current.map((item) => item.row === row.row ? { ...item, planId: value === "__none" ? null : value } : item)); }} />
								{row.planId !== null && !plan ? <p className="text-xs text-destructive">{row.sourcePlan ? t("We could not match “{plan}” in this branch. Choose a plan.", { plan: row.sourcePlan }) : t("No plan in the file. Choose one or select only member details.")}</p> : null}
								{plan ? <div><span className="block text-sm font-medium">{formatMoney(locale, result?.currency ? result.amountMinor : plan.amountMinor, result?.currency || plan.currency)}</span><span className="block text-xs text-muted-foreground">{t("Start: {date}", { date: parseDate(row.startDate) ? formatDate(locale, parseDate(row.startDate)!, { dateStyle: "medium" }) : row.startDate })}</span><span className="block text-xs text-muted-foreground">{t("First due: {date}", { date: parseDate(row.firstDueDate) ? formatDate(locale, parseDate(row.firstDueDate)!, { dateStyle: "medium" }) : row.firstDueDate })}</span></div> : null}
							</div>
						</td>
						<td data-label={t("Review")} className="text-sm">{excluded.has(row.row) ? t("Not included") : result ? result.errors.length ? <ul className="space-y-1 text-destructive">{result.errors.map((code) => <li key={code}>{t(errors[code] ?? "Check this row before importing.")}</li>)}</ul> : <span className="text-emerald-700">{t(result.createsCharge ? "Ready · first fee will be created" : "Ready to import")}</span> : t("Needs validation")}</td>
						<td data-label={t("Actions")}><Button variant="outline" size="sm" aria-label={t("Edit row {row}", { row: row.row })} onClick={(event) => { editingTrigger.current = event.currentTarget; setEditing({ ...row }); }}><Pencil />{t("Edit")}</Button></td>
					</tr>;
				})}</tbody></table></div>
			</fieldset>
			{pending && !attempt ? <Loader size="inline" label={t("Validating members…")} /> : null}
			{review ? <p role="status" className="text-sm">{t("{valid} ready. {invalid} need corrections.", { valid: review.validCount, invalid: review.invalidCount })}</p> : <p className="text-sm text-muted-foreground">{t("Validate the selected rows after making changes.")}</p>}
			<div className="flex flex-wrap justify-between gap-3 border-t pt-4"><Button variant="outline" disabled={pending || !!attempt} onClick={() => { invalidate(); setStep("columns"); }}>{t("Back to details")}</Button><div className="flex flex-wrap gap-3"><LoadingButton variant="outline" loading={pending && !attempt} disabled={pending || !!attempt || !selected.length} onClick={() => void validate()}>{t("Validate changes")}</LoadingButton><LoadingButton loading={pending && !!attempt} disabled={pending || (!attempt && (!review || review.invalidCount > 0 || !selected.length))} onClick={() => void save()}>{attempt && !pending ? t("Retry same import") : t("Save {count} members", { count: selected.length })}</LoadingButton></div></div>
		</> : null}
		{editing ? <EditImportRow row={editing} options={planOptions} returnFocus={editingTrigger} onCancel={() => setEditing(null)} onSave={(value) => { invalidate(); setRows((current) => current.map((row) => row.row === value.row ? value : row)); setEditing(null); }} /> : null}
	</section>;
}

function EditImportRow({ row, options, returnFocus, onCancel, onSave }: { row: ImportDraft; options: Array<{ value: string; label: string }>; returnFocus: { current: HTMLButtonElement | null }; onCancel: () => void; onSave: (row: ImportDraft) => void }) {
	const { t } = useI18n();
	const shell = useAppShell();
	const [draft, setDraft] = useState(row);
	const update = <K extends keyof ImportDraft>(field: K, value: ImportDraft[K]) => setDraft((current) => ({ ...current, [field]: value }));
	return <CenteredDialog open wide title={t("Edit imported member")} description={t("These changes only affect the preview. Save the full import when everyone is ready.")} onClose={onCancel} returnFocus={returnFocus}>
		<form className="space-y-5 p-5 sm:p-7" onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-2"><Label htmlFor="edit-import-name">{t("Full name")}</Label><Input id="edit-import-name" value={draft.memberName} maxLength={200} required onChange={(event) => update("memberName", event.target.value)} /></div>
				<div className="space-y-2"><Label htmlFor="edit-import-branch">{t("Branch")}</Label><Input id="edit-import-branch" value={shell.activeBranch?.name ?? ""} readOnly /></div>
				<div className="space-y-2 sm:col-span-2"><Label htmlFor="edit-import-plan">{t("Plan")}</Label><SelectField id="edit-import-plan" value={draft.planId ?? "__none"} options={options} onValueChange={(value) => update("planId", value === "__none" ? null : value)} /></div>
				{draft.planId !== null ? <>
					<div className="space-y-2"><Label htmlFor="edit-import-start">{t("Start date")}</Label><DatePicker id="edit-import-start" label={t("Start date")} value={draft.startDate} onChange={(value) => update("startDate", value)} /></div>
					<div className="space-y-2"><Label htmlFor="edit-import-due">{t("First due date")}</Label><DatePicker id="edit-import-due" label={t("First due date")} value={draft.firstDueDate} onChange={(value) => update("firstDueDate", value)} /></div>
				</> : null}
				<div className="space-y-2"><Label htmlFor="edit-import-document">{t("Document (optional)")}</Label><Input id="edit-import-document" value={draft.documentNumber} maxLength={80} onChange={(event) => update("documentNumber", event.target.value)} /></div>
				<div className="space-y-2"><Label htmlFor="edit-import-email">{t("Email (optional)")}</Label><Input id="edit-import-email" type="email" value={draft.email} maxLength={254} onChange={(event) => update("email", event.target.value)} /></div>
				<MemberPhoneFields prefix="edit-import" phone={draft.phone} onPhoneChange={(value) => update("phone", value)} sameAsPhone={draft.whatsappSameAsPhone} onSameAsPhoneChange={(value) => update("whatsappSameAsPhone", value)} whatsapp={draft.whatsapp} onWhatsappChange={(value) => update("whatsapp", value)} />
			</div>
			<div className="flex flex-wrap justify-end gap-3 border-t pt-4"><Button type="button" variant="outline" onClick={onCancel}>{t("Cancel")}</Button><Button type="submit">{t("Keep these changes")}</Button></div>
		</form>
	</CenteredDialog>;
}
