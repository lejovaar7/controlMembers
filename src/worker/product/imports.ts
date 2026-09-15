import { and, eq } from "drizzle-orm";
import { getTenantDb } from "../db";
import { auditEvent, contact, customerMember, importBatch, memberContact } from "../db/schema";
import { RequestError } from "../http";
import { requireTenant } from "../tenant";
import { listAccessibleBranches } from "../tenant/branch";
import { csvCell, details, normalizeText, readEmail, readPhone, readString } from "./domain";

const COLUMNS = ["member_name", "branch_id", "document_type", "document_number", "email", "phone", "status", "external_reference", "contact_name", "contact_email", "contact_phone", "relationship", "billing_contact"] as const;

function parseCsv(source: string) {
	const records: string[][] = [];
	let row: string[] = [];
	let value = "";
	let quoted = false;
	for (let index = 0; index < source.length; index += 1) {
		const character = source[index]!;
		if (quoted) {
			if (character === '"' && source[index + 1] === '"') { value += '"'; index += 1; }
			else if (character === '"') quoted = false;
			else value += character;
		} else if (character === '"') quoted = true;
		else if (character === ",") { row.push(value); value = ""; }
		else if (character === "\n") { row.push(value.replace(/\r$/, "")); records.push(row); row = []; value = ""; }
		else value += character;
	}
	if (quoted) throw new RequestError(400, "INVALID_CSV");
	if (value || row.length) { row.push(value.replace(/\r$/, "")); records.push(row); }
	return records.filter((item) => item.some((cell) => cell.trim()));
}

async function preview(env: Env, request: Request, csv: unknown) {
	const tenant = await requireTenant(env, request);
	if (typeof csv !== "string" || !csv.trim() || new TextEncoder().encode(csv).length > 12_000) throw new RequestError(400, "INVALID_CSV");
	const records = parseCsv(csv.replace(/^\uFEFF/, ""));
	if (records.length < 2 || records.length > 51) throw new RequestError(400, "INVALID_CSV");
	const headers = records[0]!.map((item) => item.trim());
	if (headers.length !== COLUMNS.length || headers.some((item, index) => item !== COLUMNS[index])) throw new RequestError(400, "INVALID_CSV_COLUMNS");
	const db = getTenantDb(env, tenant.organizationId);
	const accessibleBranches = new Set((await listAccessibleBranches(env, tenant)).map((branch) => branch.branchId));
	const parsed = [] as Array<Record<string, unknown>>;
	for (const [index, record] of records.slice(1).entries()) {
		const raw = Object.fromEntries(COLUMNS.map((column, columnIndex) => [column, record[columnIndex]?.trim() ?? ""]));
		const errors: string[] = [];
		const warnings: string[] = [];
		let memberName: string | null = null;
		let email: string | null = null;
		let phoneE164: string | null = null;
		try { memberName = readString(raw.member_name, 200, true); } catch { errors.push("INVALID_MEMBER_NAME"); }
		try { email = readEmail(raw.email); } catch { errors.push("INVALID_EMAIL"); }
		try { phoneE164 = readPhone(raw.phone); } catch { errors.push("INVALID_PHONE"); }
		const branchId = String(raw.branch_id);
		if (!branchId || !accessibleBranches.has(branchId)) errors.push("INVALID_BRANCH");
		const status = String(raw.status || "active");
		if (!new Set(["active", "paused", "inactive"]).has(status)) errors.push("INVALID_STATUS");
		const documentNumber = readString(raw.document_number, 80);
		const normalizedDocument = documentNumber ? normalizeText(documentNumber).replace(/\s/g, "") : null;
		const externalReference = readString(raw.external_reference, 100);
		if (normalizedDocument) {
			const [duplicate] = await db.select({ id: customerMember.id }).from(customerMember).where(and(eq(customerMember.organizationId, tenant.organizationId), eq(customerMember.normalizedDocument, normalizedDocument))).limit(1);
			if (duplicate) warnings.push("DUPLICATE_DOCUMENT");
		}
		if (externalReference) {
			const [duplicate] = await db.select({ id: customerMember.id }).from(customerMember).where(and(eq(customerMember.organizationId, tenant.organizationId), eq(customerMember.externalReference, externalReference))).limit(1);
			if (duplicate) warnings.push("DUPLICATE_EXTERNAL_REFERENCE");
		}
		parsed.push({ row: index + 2, memberName, branchId, documentType: readString(raw.document_type, 40), documentNumber, normalizedDocument, email, phoneE164, status, externalReference, contactName: readString(raw.contact_name, 200), contactEmail: readEmail(raw.contact_email), contactPhone: readPhone(raw.contact_phone), relationship: readString(raw.relationship, 80) ?? "other", billingContact: String(raw.billing_contact).toLocaleLowerCase("en") === "true", errors, warnings });
	}
	return { rows: parsed, validCount: parsed.filter((item) => (item.errors as string[]).length === 0 && (item.warnings as string[]).length === 0).length, warningCount: parsed.filter((item) => (item.warnings as string[]).length > 0).length, invalidCount: parsed.filter((item) => (item.errors as string[]).length > 0).length };
}

export function memberImportTemplate() {
	return new Response(`\uFEFF${COLUMNS.map(csvCell).join(",")}\r\n`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=controlmembers-member-import-v1.csv" } });
}

export async function previewMemberImport(env: Env, request: Request, body: Record<string, unknown>) {
	return await preview(env, request, body.csv);
}

export async function confirmMemberImport(env: Env, request: Request, body: Record<string, unknown>) {
	const tenant = await requireTenant(env, request);
	const idempotencyKey = readString(body.idempotencyKey, 100, true)!;
	if (typeof body.csv !== "string") throw new RequestError(400, "INVALID_CSV");
	const fingerprint = body.csv.replace(/\r\n/g, "\n");
	const db = getTenantDb(env, tenant.organizationId);
	const [existing] = await db.select().from(importBatch).where(and(eq(importBatch.organizationId, tenant.organizationId), eq(importBatch.idempotencyKey, idempotencyKey))).limit(1);
	if (existing) {
		if (existing.payloadFingerprint !== fingerprint) throw new RequestError(409, "IDEMPOTENCY_CONFLICT");
		return { batchId: existing.id, created: existing.createdCount, skipped: existing.skippedCount, failed: existing.failedCount };
	}
	const result = await preview(env, request, body.csv);
	const validRows = result.rows.filter((item) => (item.errors as string[]).length === 0 && (item.warnings as string[]).length === 0);
	const batchId = crypto.randomUUID();
	const commands = [];
	for (const row of validRows) {
		const memberId = crypto.randomUUID();
		commands.push(db.insert(customerMember).values({ id: memberId, organizationId: tenant.organizationId, primaryBranchId: row.branchId as string, displayName: row.memberName as string, normalizedName: normalizeText(row.memberName as string), status: row.status as string, documentType: row.documentType as string | null, documentNumber: row.documentNumber as string | null, normalizedDocument: row.normalizedDocument as string | null, email: row.email as string | null, phoneE164: row.phoneE164 as string | null, externalReference: row.externalReference as string | null, createdByUserId: tenant.userId }));
		if (row.contactName) {
			const contactId = crypto.randomUUID();
			commands.push(db.insert(contact).values({ id: contactId, organizationId: tenant.organizationId, displayName: row.contactName as string, email: row.contactEmail as string | null, phoneE164: row.contactPhone as string | null, createdByUserId: tenant.userId }));
			commands.push(db.insert(memberContact).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, memberId, contactId, relationship: row.relationship as string, isPrimary: true, isBillingContact: row.billingContact as boolean }));
		}
	}
	await db.batch([
		db.insert(importBatch).values({ id: batchId, organizationId: tenant.organizationId, idempotencyKey, payloadFingerprint: fingerprint, createdCount: validRows.length, skippedCount: result.rows.length - validRows.length, failedCount: 0, createdByUserId: tenant.userId }),
		...commands,
		db.insert(auditEvent).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, eventType: "members.imported", actorUserId: tenant.userId, subjectType: "import_batch", subjectId: batchId, detailsJson: details({ created: validRows.length, skipped: result.rows.length - validRows.length }) }),
	]);
	return { batchId, created: validRows.length, skipped: result.rows.length - validRows.length, failed: 0 };
}
