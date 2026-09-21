import { enrollmentDueDate } from "./enrollment-due-date";
import { inWorkspace, requireWorkspaceTenant, workspaceCondition } from "./workspace";
import { and, asc, desc, eq, inArray, like, ne, or, sql } from "drizzle-orm";
import { AuthError } from "../auth/session";
import { getTenantDb } from "../db";
import { allocation, auditEvent, charge, contact, customerMember, enrollment, memberContact, payment, plan } from "../db/schema";
import { RequestError } from "../http";
import type { TenantContext } from "../tenant";
import { details, localDate, normalizeText, now, readDate, readEmail, readPhone, readString, requireAccessibleBranch } from "./domain";

const MEMBER_STATUSES = new Set(["active", "paused", "inactive"]);

function allowedMember(tenant: TenantContext, branchId: string) {
	return inWorkspace(tenant, branchId);
}

/** A recorded Enrollment keeps the Member reachable in its Branch, including history. */
export function memberWorkspaceCondition(env: Env, tenant: TenantContext) {
	if (!tenant.activeBranchId) return workspaceCondition(tenant, customerMember.primaryBranchId);
	return or(
		eq(customerMember.primaryBranchId, tenant.activeBranchId),
		inArray(customerMember.id, getTenantDb(env, tenant.organizationId)
			.select({ memberId: enrollment.memberId }).from(enrollment)
			.where(and(eq(enrollment.organizationId, tenant.organizationId), eq(enrollment.branchId, tenant.activeBranchId)))),
	);
}

async function loadMember(env: Env, tenant: TenantContext, id: string) {
	const [row] = await getTenantDb(env, tenant.organizationId).select().from(customerMember)
		.where(and(eq(customerMember.id, id), eq(customerMember.organizationId, tenant.organizationId), memberWorkspaceCondition(env, tenant))).limit(1);
	if (!row) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	return row;
}

function readMemberInput(body: Record<string, unknown>, current?: typeof customerMember.$inferSelect) {
	const displayName = body.displayName === undefined && current ? current.displayName : readString(body.displayName, 200, true)!;
	const documentType = body.documentType === undefined && current ? current.documentType : readString(body.documentType, 40);
	const documentNumber = body.documentNumber === undefined && current ? current.documentNumber : readString(body.documentNumber, 80);
	const birthDate = body.birthDate === undefined && current ? current.birthDate : readDate(body.birthDate);
	const email = body.email === undefined && current ? current.email : readEmail(body.email);
	const phoneE164 = body.phoneE164 === undefined && current ? current.phoneE164 : readPhone(body.phoneE164);
	const notes = body.notes === undefined && current ? current.notes : readString(body.notes, 2000);
	const externalReference = body.externalReference === undefined && current ? current.externalReference : readString(body.externalReference, 100);
	return {
		displayName,
		normalizedName: normalizeText(displayName),
		documentType,
		documentNumber,
		normalizedDocument: documentNumber ? normalizeText(documentNumber).replace(/\s/g, "") : null,
		birthDate,
		email,
		phoneE164,
		notes,
		externalReference,
	};
}

function pageSize(value: string | null) {
	const parsed = Number(value ?? "25");
	return Number.isInteger(parsed) && parsed >= 1 && parsed <= 50 ? parsed : 25;
}

async function requireUniqueMemberIdentifiers(env: Env, organizationId: string, values: { normalizedDocument: string | null; externalReference: string | null }, exceptId?: string) {
	const duplicate = or(
		values.normalizedDocument ? eq(customerMember.normalizedDocument, values.normalizedDocument) : undefined,
		values.externalReference ? eq(customerMember.externalReference, values.externalReference) : undefined,
	);
	if (!duplicate) return;
	const [existing] = await getTenantDb(env, organizationId).select({ id: customerMember.id }).from(customerMember)
		.where(and(eq(customerMember.organizationId, organizationId), duplicate, exceptId ? ne(customerMember.id, exceptId) : undefined)).limit(1);
	if (existing) throw new RequestError(409, "MEMBER_IDENTIFIER_EXISTS");
}

export async function listCustomerMembers(env: Env, request: Request) {
	const tenant = await requireWorkspaceTenant(env, request);
	const url = new URL(request.url);
	const search = normalizeText(url.searchParams.get("search") ?? "");
	const status = url.searchParams.get("status");
	if (status && !MEMBER_STATUSES.has(status)) throw new RequestError(400, "INVALID_INPUT");
	const requestedBranch = url.searchParams.get("branchId");
	if (requestedBranch && !allowedMember(tenant, requestedBranch)) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	const limit = pageSize(url.searchParams.get("limit"));
	const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
	const db = getTenantDb(env, tenant.organizationId);
	const conditions = [
		eq(customerMember.organizationId, tenant.organizationId),
		memberWorkspaceCondition(env, requestedBranch ? { ...tenant, activeBranchId: requestedBranch } : tenant),
		status ? eq(customerMember.status, status) : undefined,
		search ? or(like(customerMember.normalizedName, `%${search}%`), like(customerMember.normalizedDocument, `%${search}%`), like(customerMember.email, `%${search}%`), like(customerMember.phoneE164, `%${search}%`)) : undefined,
	];
	const rows = await db.select().from(customerMember).where(and(...conditions)).orderBy(asc(customerMember.displayName)).limit(limit + 1).offset(offset);
	const visible = rows.slice(0, limit);
	const ids = visible.map((row) => row.id);
	const balances = ids.length ? await db.select({
		memberId: charge.memberId,
		totalMinor: charge.totalMinor,
		paidMinor: sql<number>`coalesce(sum(case when ${payment.status} = 'posted' then ${allocation.amountMinor} else 0 end), 0)`,
	}).from(charge)
		.leftJoin(allocation, eq(allocation.chargeId, charge.id))
		.leftJoin(payment, eq(payment.id, allocation.paymentId))
		.where(and(eq(charge.organizationId, tenant.organizationId), inArray(charge.memberId, ids), workspaceCondition(tenant, charge.branchId), eq(charge.status, "open")))
		.groupBy(charge.id, charge.memberId, charge.totalMinor) : [];
	// Aggregate each charge first so multiple allocations do not multiply its total.
	const byMember = new Map<string, number>();
	for (const row of balances) {
		const outstandingMinor = Math.max(0, row.totalMinor - Number(row.paidMinor));
		byMember.set(row.memberId, (byMember.get(row.memberId) ?? 0) + outstandingMinor);
	}
	return { members: visible.map((row) => ({ ...row, outstandingMinor: byMember.get(row.id) ?? 0 })), nextOffset: rows.length > limit ? offset + limit : null, currency: tenant.currency };
}

export async function createCustomerMember(env: Env, request: Request, body: Record<string, unknown>) {
	const tenant = await requireWorkspaceTenant(env, request);
	const branch = await requireAccessibleBranch(env, tenant, body.primaryBranchId);
	const values = readMemberInput(body);
	await requireUniqueMemberIdentifiers(env, tenant.organizationId, values);
	const id = crypto.randomUUID();
	const db = getTenantDb(env, tenant.organizationId);
	await db.batch([
		db.insert(customerMember).values({ id, organizationId: tenant.organizationId, primaryBranchId: branch.branchId, ...values, status: "active", createdByUserId: tenant.userId }),
		db.insert(auditEvent).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, eventType: "member.created", actorUserId: tenant.userId, subjectType: "member", subjectId: id, branchId: branch.branchId, detailsJson: details({ version: 1 }) }),
	]);
	return { id, organizationId: tenant.organizationId, primaryBranchId: branch.branchId, ...values, status: "active", outstandingMinor: 0 };
}

export async function getCustomerMember(env: Env, request: Request, id: string) {
	const tenant = await requireWorkspaceTenant(env, request);
	const row = await loadMember(env, tenant, id);
	const db = getTenantDb(env, tenant.organizationId);
	const contacts = await db.select({ id: contact.id, displayName: contact.displayName, email: contact.email, phoneE164: contact.phoneE164, relationshipId: memberContact.id, relationship: memberContact.relationship, isPrimary: memberContact.isPrimary, isBillingContact: memberContact.isBillingContact, whatsappConsent: memberContact.whatsappConsent })
		.from(memberContact).innerJoin(contact, eq(contact.id, memberContact.contactId))
		.where(and(eq(memberContact.organizationId, tenant.organizationId), eq(memberContact.memberId, id))).orderBy(desc(memberContact.isPrimary), asc(contact.displayName));
	const enrollments = await db.select({ id: enrollment.id, planId: enrollment.planId, planName: plan.name, branchId: enrollment.branchId, status: enrollment.status, startDate: enrollment.startDate, firstDueDate: enrollment.firstDueDate, recurringDay: enrollment.recurringDay, endDate: enrollment.endDate, agreedAmountMinor: enrollment.agreedAmountMinor, currency: enrollment.currency, dueDay: enrollment.dueDay, discountMinor: enrollment.discountMinor })
		.from(enrollment).innerJoin(plan, eq(plan.id, enrollment.planId)).where(and(eq(enrollment.organizationId, tenant.organizationId), eq(enrollment.memberId, id), workspaceCondition(tenant, enrollment.branchId))).orderBy(desc(enrollment.createdAt));
	const charges = await db.select({ id: charge.id, enrollmentId: charge.enrollmentId, billingPeriod: charge.billingPeriod, dueDate: charge.dueDate, totalMinor: charge.totalMinor, currency: charge.currency, lifecycle: charge.status, planName: charge.planNameSnapshot, paidMinor: sql<number>`coalesce(sum(case when ${payment.status} = 'posted' then ${allocation.amountMinor} else 0 end), 0)` })
		.from(charge).leftJoin(allocation, eq(allocation.chargeId, charge.id)).leftJoin(payment, eq(payment.id, allocation.paymentId))
		.where(and(eq(charge.organizationId, tenant.organizationId), eq(charge.memberId, id), workspaceCondition(tenant, charge.branchId))).groupBy(charge.id).orderBy(desc(charge.dueDate));
	const payments = await db.select().from(payment).where(and(eq(payment.organizationId, tenant.organizationId), eq(payment.memberId, id), workspaceCondition(tenant, payment.branchId))).orderBy(desc(payment.paidAt)).limit(50);
	const normalizedCharges = charges.map((item) => ({ ...item, paidMinor: Number(item.paidMinor), outstandingMinor: item.lifecycle === "void" ? 0 : Math.max(0, item.totalMinor - Number(item.paidMinor)) }));
	const grossOutstandingMinor = normalizedCharges.reduce((sum, item) => sum + item.outstandingMinor, 0);
	const postedTotal = payments.filter((item) => item.status === "posted").reduce((sum, item) => sum + item.amountMinor, 0);
	const allocatedTotal = normalizedCharges.reduce((sum, item) => sum + item.paidMinor, 0);
	const creditMinor = Math.max(0, postedTotal - allocatedTotal);
	const today = localDate(tenant.timezone);
	const scheduledEnrollments = enrollments.map((item) => ({ ...item, dueDay: item.recurringDay ?? item.dueDay, paymentDue: enrollmentDueDate(item, normalizedCharges, today, row.status === "active") }));
	return { member: row, contacts, enrollments: scheduledEnrollments, charges: normalizedCharges, payments: payments.map((item) => ({ ...item, method: item.paymentMethodId ?? item.method })), summary: { grossOutstandingMinor, creditMinor, netMinor: grossOutstandingMinor - creditMinor } };
}

export async function updateCustomerMember(env: Env, request: Request, id: string, body: Record<string, unknown>) {
	const tenant = await requireWorkspaceTenant(env, request);
	const current = await loadMember(env, tenant, id);
	const branch = body.primaryBranchId === undefined ? { branchId: current.primaryBranchId } : await requireAccessibleBranch(env, tenant, body.primaryBranchId);
	const values = readMemberInput(body, current);
	await requireUniqueMemberIdentifiers(env, tenant.organizationId, values, id);
	await getTenantDb(env, tenant.organizationId).batch([
		getTenantDb(env, tenant.organizationId).update(customerMember).set({ ...values, primaryBranchId: branch.branchId, updatedAt: now() }).where(and(eq(customerMember.id, id), eq(customerMember.organizationId, tenant.organizationId))),
		getTenantDb(env, tenant.organizationId).insert(auditEvent).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, eventType: "member.updated", actorUserId: tenant.userId, subjectType: "member", subjectId: id, branchId: branch.branchId, detailsJson: details({ version: 1 }) }),
	]);
	return { ...current, ...values, primaryBranchId: branch.branchId };
}

export async function updateCustomerMemberStatus(env: Env, request: Request, id: string, body: Record<string, unknown>) {
	const tenant = await requireWorkspaceTenant(env, request);
	const current = await loadMember(env, tenant, id);
	const status = body.status;
	if (typeof status !== "string" || !MEMBER_STATUSES.has(status)) throw new RequestError(400, "INVALID_INPUT");
	const reason = readString(body.reason, 500, true)!;
	const db = getTenantDb(env, tenant.organizationId);
	await db.batch([
		db.update(customerMember).set({ status, updatedAt: now() }).where(and(eq(customerMember.id, id), eq(customerMember.organizationId, tenant.organizationId))),
		db.insert(auditEvent).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, eventType: "member.status_changed", actorUserId: tenant.userId, subjectType: "member", subjectId: id, branchId: current.primaryBranchId, detailsJson: details({ before: current.status, after: status, reason }) }),
	]);
	return { id, status };
}

export async function addMemberContact(env: Env, request: Request, memberId: string, body: Record<string, unknown>) {
	const tenant = await requireWorkspaceTenant(env, request);
	const member = await loadMember(env, tenant, memberId);
	const existingContactId = readString(body.contactId, 100);
	const displayName = existingContactId ? null : readString(body.displayName, 200, true)!;
	const email = existingContactId ? null : readEmail(body.email);
	const phoneE164 = existingContactId ? null : readPhone(body.phoneE164);
	const relationship = readString(body.relationship, 80, true)!;
	const isPrimary = body.isPrimary === true;
	const isBillingContact = body.isBillingContact === true;
	const whatsappConsent = body.whatsappConsent === "granted" ? "granted" : "none";
	const contactId = existingContactId ?? crypto.randomUUID();
	const relationshipId = crypto.randomUUID();
	const db = getTenantDb(env, tenant.organizationId);
	let existing: typeof contact.$inferSelect | undefined;
	if (existingContactId) {
		[existing] = await db.select().from(contact).where(and(eq(contact.id, existingContactId), eq(contact.organizationId, tenant.organizationId))).limit(1);
		if (!existing) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	}
	await db.batch([
		db.insert(contact).values({ id: contactId, organizationId: tenant.organizationId, displayName: existing?.displayName ?? displayName!, email: existing?.email ?? email, phoneE164: existing?.phoneE164 ?? phoneE164, createdByUserId: existing?.createdByUserId ?? tenant.userId }).onConflictDoNothing(),
		db.update(memberContact).set({ isPrimary: false }).where(isPrimary ? and(eq(memberContact.organizationId, tenant.organizationId), eq(memberContact.memberId, memberId), eq(memberContact.isPrimary, true)) : eq(memberContact.id, "")),
		db.update(memberContact).set({ isBillingContact: false }).where(isBillingContact ? and(eq(memberContact.organizationId, tenant.organizationId), eq(memberContact.memberId, memberId), eq(memberContact.isBillingContact, true)) : eq(memberContact.id, "")),
		db.insert(memberContact).values({ id: relationshipId, organizationId: tenant.organizationId, memberId, contactId, relationship, isPrimary, isBillingContact, whatsappConsent, consentCapturedAt: whatsappConsent === "granted" ? now() : null }),
		db.insert(auditEvent).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, eventType: "member.contact_added", actorUserId: tenant.userId, subjectType: "member", subjectId: memberId, branchId: member.primaryBranchId, detailsJson: details({ contactId, relationship, isPrimary, isBillingContact }) }),
	]);
	return { id: contactId, displayName: existing?.displayName ?? displayName, email: existing?.email ?? email, phoneE164: existing?.phoneE164 ?? phoneE164, relationshipId, relationship, isPrimary, isBillingContact, whatsappConsent };
}

async function loadRelationship(env: Env, tenant: TenantContext, memberId: string, relationshipId: string) {
	const member = await loadMember(env, tenant, memberId);
	const [row] = await getTenantDb(env, tenant.organizationId).select({ relationship: memberContact, contact })
		.from(memberContact).innerJoin(contact, eq(contact.id, memberContact.contactId))
		.where(and(eq(memberContact.id, relationshipId), eq(memberContact.memberId, memberId), eq(memberContact.organizationId, tenant.organizationId))).limit(1);
	if (!row) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	return { member, ...row };
}

export async function updateMemberContact(env: Env, request: Request, memberId: string, relationshipId: string, body: Record<string, unknown>) {
	const tenant = await requireWorkspaceTenant(env, request);
	const current = await loadRelationship(env, tenant, memberId, relationshipId);
	const relationship = body.relationship === undefined ? current.relationship.relationship : readString(body.relationship, 80, true)!;
	const isPrimary = body.isPrimary === undefined ? current.relationship.isPrimary : body.isPrimary === true;
	const isBillingContact = body.isBillingContact === undefined ? current.relationship.isBillingContact : body.isBillingContact === true;
	const whatsappConsent = body.whatsappConsent === undefined ? current.relationship.whatsappConsent : body.whatsappConsent === "granted" ? "granted" : "none";
	const db = getTenantDb(env, tenant.organizationId);
	await db.batch([
		db.update(memberContact).set({ isPrimary: false }).where(isPrimary ? and(eq(memberContact.organizationId, tenant.organizationId), eq(memberContact.memberId, memberId), eq(memberContact.isPrimary, true)) : eq(memberContact.id, "")),
		db.update(memberContact).set({ isBillingContact: false }).where(isBillingContact ? and(eq(memberContact.organizationId, tenant.organizationId), eq(memberContact.memberId, memberId), eq(memberContact.isBillingContact, true)) : eq(memberContact.id, "")),
		db.update(memberContact).set({ relationship, isPrimary, isBillingContact, whatsappConsent, consentCapturedAt: whatsappConsent === "granted" ? current.relationship.consentCapturedAt ?? now() : null, consentWithdrawnAt: current.relationship.whatsappConsent === "granted" && whatsappConsent === "none" ? now() : current.relationship.consentWithdrawnAt }).where(and(eq(memberContact.id, relationshipId), eq(memberContact.organizationId, tenant.organizationId))),
		db.insert(auditEvent).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, eventType: "member.contact_updated", actorUserId: tenant.userId, subjectType: "member", subjectId: memberId, branchId: current.member.primaryBranchId, detailsJson: details({ contactId: current.contact.id, relationshipId, before: { relationship: current.relationship.relationship, isPrimary: current.relationship.isPrimary, isBillingContact: current.relationship.isBillingContact, whatsappConsent: current.relationship.whatsappConsent }, after: { relationship, isPrimary, isBillingContact, whatsappConsent } }) }),
	]);
	return { id: current.contact.id, displayName: current.contact.displayName, email: current.contact.email, phoneE164: current.contact.phoneE164, relationshipId, relationship, isPrimary, isBillingContact, whatsappConsent };
}

export async function unlinkMemberContact(env: Env, request: Request, memberId: string, relationshipId: string) {
	const tenant = await requireWorkspaceTenant(env, request);
	const current = await loadRelationship(env, tenant, memberId, relationshipId);
	const db = getTenantDb(env, tenant.organizationId);
	await db.batch([
		db.delete(memberContact).where(and(eq(memberContact.id, relationshipId), eq(memberContact.organizationId, tenant.organizationId))),
		db.insert(auditEvent).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, eventType: "member.contact_unlinked", actorUserId: tenant.userId, subjectType: "member", subjectId: memberId, branchId: current.member.primaryBranchId, detailsJson: details({ contactId: current.contact.id, relationshipId }) }),
	]);
	return { relationshipId, unlinked: true };
}

export { loadMember };
