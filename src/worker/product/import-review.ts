import { and, eq, or } from "drizzle-orm";
import { IMPORT_ROW_LIMIT, type ImportDraft, type ImportReview, type ImportRowResult } from "../../shared/member-import";
import { getTenantDb } from "../db";
import { auditEvent, contact, customerMember, importBatch, memberContact } from "../db/schema";
import { RequestError } from "../http";
import type { TenantContext } from "../tenant";
import { details, normalizeText, readDate, readEmail, readPhone, readString, requireAccessibleBranch } from "./domain";
import { prepareEnrollment } from "./enrollment-write";
import { inWorkspace, requireWorkspaceTenant } from "./workspace";

async function digest(value: unknown) {
	return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value))))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readDrafts(body: Record<string, unknown>) {
	if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > IMPORT_ROW_LIMIT) throw new RequestError(400, "INVALID_IMPORT");
	const rows = body.rows as ImportDraft[];
	const ids = new Set<number>();
	for (const row of rows) {
		if (!row || typeof row !== "object" || !Number.isSafeInteger(row.row) || row.row < 2 || ids.has(row.row)) throw new RequestError(400, "INVALID_IMPORT");
		ids.add(row.row);
	}
	return rows;
}

async function context(env: Env, request: Request, body: Record<string, unknown>) {
	const tenant = await requireWorkspaceTenant(env, request);
	const branch = await requireAccessibleBranch(env, tenant, body.branchId);
	if (!inWorkspace(tenant, branch.branchId)) throw new RequestError(403, "BRANCH_ACCESS_DENIED");
	return { tenant, branchId: branch.branchId, rows: readDrafts(body) };
}

async function prepare(env: Env, tenant: TenantContext, branchId: string, drafts: ImportDraft[]) {
	const db = getTenantDb(env, tenant.organizationId);
	const rows: ImportRowResult[] = [];
	const entries = [];
	for (const raw of drafts) {
		const errors: string[] = [];
		const read = <T>(code: string, parse: () => T): T | null => { try { return parse(); } catch { errors.push(code); return null; } };
		const displayName = read("INVALID_MEMBER_NAME", () => readString(raw.memberName, 200, true));
		const documentType = read("INVALID_DOCUMENT", () => readString(raw.documentType, 40));
		const documentNumber = read("INVALID_DOCUMENT", () => readString(raw.documentNumber, 80));
		const externalReference = read("INVALID_REFERENCE", () => readString(raw.externalReference, 100));
		const email = read("INVALID_EMAIL", () => readEmail(raw.email));
		const phoneE164 = read("INVALID_PHONE", () => readPhone(raw.phone));
		if (typeof raw.whatsappSameAsPhone !== "boolean") errors.push("INVALID_WHATSAPP");
		const whatsappE164 = raw.whatsappSameAsPhone ? null : read("INVALID_WHATSAPP", () => readPhone(raw.whatsapp));
		const status = read("INVALID_STATUS", () => readString(raw.status, 20, true));
		if (!["active", "paused", "inactive"].includes(status ?? "")) errors.push("INVALID_STATUS");
		const contactName = read("INVALID_CONTACT", () => readString(raw.contactName, 200));
		const contactEmail = read("INVALID_CONTACT_EMAIL", () => readEmail(raw.contactEmail));
		const contactPhone = read("INVALID_CONTACT_PHONE", () => readPhone(raw.contactPhone));
		const relationship = read("INVALID_CONTACT", () => readString(raw.relationship, 80));
		if ((!contactName && (contactEmail || contactPhone || relationship || raw.billingContact)) || typeof raw.billingContact !== "boolean") errors.push("INVALID_CONTACT");
		const normalizedDocument = documentNumber ? normalizeText(documentNumber).replace(/\s/g, "") : null;
		if (normalizedDocument || externalReference) {
			const [duplicate] = await db.select({ id: customerMember.id }).from(customerMember).where(and(eq(customerMember.organizationId, tenant.organizationId), or(normalizedDocument ? eq(customerMember.normalizedDocument, normalizedDocument) : undefined, externalReference ? eq(customerMember.externalReference, externalReference) : undefined))).limit(1);
			if (duplicate) errors.push("MEMBER_IDENTIFIER_EXISTS");
		}
		const id = crypto.randomUUID();
		let signup: Awaited<ReturnType<typeof prepareEnrollment>> | null = null;
		if (raw.planId !== null) {
			if (typeof raw.planId !== "string" || !raw.planId.trim()) errors.push("PLAN_REQUIRED");
			else if (status !== "active") errors.push("IMPORT_INACTIVE_PLAN");
			else {
				const startDate = read("INVALID_START_DATE", () => readDate(raw.startDate, true));
				const firstDueDate = read("INVALID_DUE_DATE", () => readDate(raw.firstDueDate, true));
				if (startDate && firstDueDate && firstDueDate < startDate) errors.push("INVALID_DUE_DATE");
				if (!errors.length) {
					try { signup = await prepareEnrollment(env, tenant, { id, displayName: displayName!, primaryBranchId: branchId }, { planId: raw.planId, branchId, startDate, firstDueDate }); }
					catch (error) { if (error instanceof Error && "code" in error) errors.push(error.code === "BILLING_SETTINGS_REQUIRED" ? "BILLING_SETTINGS_REQUIRED" : "INVALID_PLAN"); else throw error; }
				}
			}
		}
		rows.push({ row: raw.row, errors: [...new Set(errors)], planName: signup?.result.planName ?? null, amountMinor: signup?.result.agreedAmountMinor ?? 0, currency: signup?.result.currency ?? null, createsCharge: !!signup?.result.firstChargeId });
		entries.push({ id, displayName, documentType, documentNumber, normalizedDocument, externalReference, email, phoneE164, whatsappSameAsPhone: raw.whatsappSameAsPhone, whatsappE164, status, contactName, contactEmail, contactPhone, relationship, billingContact: raw.billingContact, signup });
	}
	for (const key of ["normalizedDocument", "externalReference"] as const) {
		const seen = new Map<string, number[]>();
		entries.forEach((entry, index) => { if (entry[key]) seen.set(entry[key], [...(seen.get(entry[key]) ?? []), index]); });
		for (const indexes of seen.values()) if (indexes.length > 1) for (const index of indexes) if (!rows[index]!.errors.includes("DUPLICATE_IN_FILE")) rows[index]!.errors.push("DUPLICATE_IN_FILE");
	}
	// Fingerprint includes current prices and validation, so catalog changes require review again.
	const reviewToken = await digest({ branchId, drafts, rows });
	const review: ImportReview = { rows, validCount: rows.filter((row) => !row.errors.length).length, invalidCount: rows.filter((row) => row.errors.length).length, reviewToken };
	return { review, entries };
}

export async function reviewMemberDrafts(env: Env, request: Request, body: Record<string, unknown>) {
	const { tenant, branchId, rows } = await context(env, request, body);
	return (await prepare(env, tenant, branchId, rows)).review;
}

export async function saveMemberDrafts(env: Env, request: Request, body: Record<string, unknown>) {
	const { tenant, branchId, rows } = await context(env, request, body);
	const idempotencyKey = readString(body.idempotencyKey, 100, true)!;
	const reviewToken = readString(body.reviewToken, 64, true)!;
	const fingerprint = await digest({ branchId, rows, reviewToken });
	const db = getTenantDb(env, tenant.organizationId);
	const existingBatch = async () => {
		const [existing] = await db.select().from(importBatch).where(and(eq(importBatch.organizationId, tenant.organizationId), eq(importBatch.idempotencyKey, idempotencyKey))).limit(1);
		if (existing && existing.payloadFingerprint !== fingerprint) throw new RequestError(409, "IDEMPOTENCY_CONFLICT");
		return existing ? { batchId: existing.id, created: existing.createdCount, skipped: existing.skippedCount, failed: existing.failedCount } : null;
	};
	const existing = await existingBatch();
	if (existing) return existing;
	const { review, entries } = await prepare(env, tenant, branchId, rows);
	if (review.invalidCount || review.reviewToken !== reviewToken) {
		const completedWhileReviewing = await existingBatch();
		if (completedWhileReviewing) return completedWhileReviewing;
		throw new RequestError(409, "IMPORT_REVIEW_CHANGED");
	}
	const commands = [];
	for (const entry of entries) {
		commands.push(db.insert(customerMember).values({ id: entry.id, organizationId: tenant.organizationId, primaryBranchId: branchId, displayName: entry.displayName!, normalizedName: normalizeText(entry.displayName!), documentType: entry.documentType, documentNumber: entry.documentNumber, normalizedDocument: entry.normalizedDocument, email: entry.email, phoneE164: entry.phoneE164, whatsappSameAsPhone: entry.whatsappSameAsPhone, whatsappE164: entry.whatsappE164, status: entry.status!, externalReference: entry.externalReference, createdByUserId: tenant.userId }));
		if (entry.signup) commands.push(...entry.signup.statements);
		if (entry.contactName) {
			const contactId = crypto.randomUUID();
			commands.push(db.insert(contact).values({ id: contactId, organizationId: tenant.organizationId, displayName: entry.contactName, email: entry.contactEmail, phoneE164: entry.contactPhone, createdByUserId: tenant.userId }));
			commands.push(db.insert(memberContact).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, memberId: entry.id, contactId, relationship: entry.relationship || "other", isPrimary: true, isBillingContact: entry.billingContact }));
		}
	}
	const batchId = crypto.randomUUID();
	try {
		await db.batch([db.insert(importBatch).values({ id: batchId, organizationId: tenant.organizationId, idempotencyKey, payloadFingerprint: fingerprint, createdCount: entries.length, skippedCount: 0, failedCount: 0, createdByUserId: tenant.userId }), ...commands,
			db.insert(auditEvent).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, eventType: "members.imported", actorUserId: tenant.userId, subjectType: "import_batch", subjectId: batchId, branchId, detailsJson: details({ created: entries.length, skipped: 0, enrollments: entries.filter((entry) => entry.signup).length }) })]);
	} catch (error) { const retry = await existingBatch(); if (retry) return retry; throw error; }
	return { batchId, created: entries.length, skipped: 0, failed: 0 };
}
