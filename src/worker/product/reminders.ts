import { and, asc, eq, sql } from "drizzle-orm";
import { AuthError } from "../auth/session";
import { getTenantDb } from "../db";
import { allocation, charge, contact, customerMember, memberContact, payment } from "../db/schema";
import { inWorkspace, requireWorkspaceTenant } from "./workspace";
import { localDate } from "./domain";

/** Read-only facts for a manually reviewed WhatsApp draft; this never sends. */
export async function previewReminder(env: Env, request: Request, chargeId: string) {
	const tenant = await requireWorkspaceTenant(env, request);
	const db = getTenantDb(env, tenant.organizationId);
	const [target] = await db.select().from(charge).where(and(eq(charge.id, chargeId), eq(charge.organizationId, tenant.organizationId))).limit(1);
	if (!target || !inWorkspace(tenant, target.branchId)) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	const [member] = await db.select().from(customerMember).where(and(eq(customerMember.id, target.memberId), eq(customerMember.organizationId, tenant.organizationId))).limit(1);
	if (!member) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	const rows = await db.select({ id: charge.id, dueDate: charge.dueDate, totalMinor: charge.totalMinor, status: charge.status,
		paidMinor: sql<number>`coalesce(sum(case when ${payment.status} = 'posted' then ${allocation.amountMinor} else 0 end), 0)` })
		.from(charge).leftJoin(allocation, eq(allocation.chargeId, charge.id)).leftJoin(payment, eq(payment.id, allocation.paymentId))
		.where(and(eq(charge.organizationId, tenant.organizationId), eq(charge.memberId, member.id), eq(charge.branchId, target.branchId)))
		.groupBy(charge.id).orderBy(asc(charge.dueDate), asc(charge.id));
	const today = localDate(tenant.timezone);
	const overdue = rows.filter((row) => row.status === "open" && row.dueDate < today && row.totalMinor > Number(row.paidMinor));
	const overdueMinor = overdue.reduce((sum, row) => sum + row.totalMinor - Number(row.paidMinor), 0);
	const credits = await db.select({ amountMinor: payment.amountMinor, allocatedMinor: sql<number>`coalesce(sum(${allocation.amountMinor}), 0)` })
		.from(payment).leftJoin(allocation, eq(allocation.paymentId, payment.id))
		.where(and(eq(payment.organizationId, tenant.organizationId), eq(payment.memberId, member.id), eq(payment.branchId, target.branchId), eq(payment.status, "posted")))
		.groupBy(payment.id);
	const creditMinor = credits.reduce((sum, row) => sum + Math.max(0, row.amountMinor - Number(row.allocatedMinor)), 0);
	const amountMinor = Math.max(0, overdueMinor - creditMinor);
	const contacts = await db.select({ id: contact.id, name: contact.displayName, phone: contact.phoneE164, relationship: memberContact.relationship, billing: memberContact.isBillingContact, primary: memberContact.isPrimary })
		.from(memberContact).innerJoin(contact, and(eq(contact.id, memberContact.contactId), eq(contact.organizationId, tenant.organizationId)))
		.where(and(eq(memberContact.memberId, member.id), eq(memberContact.organizationId, tenant.organizationId))).orderBy(asc(contact.id));
	const recipients = [
		...contacts.filter((item) => item.billing || item.primary).map((item) => ({ id: `contact:${item.id}`, name: item.name, phone: item.phone, kind: "contact" as const, relationship: item.relationship })),
		{ id: `member:${member.id}`, name: member.displayName, phone: member.whatsappSameAsPhone ? member.phoneE164 : member.whatsappE164, kind: "member" as const, relationship: "" },
	].filter((item): item is typeof item & { phone: string } => !!item.phone && /^\+[1-9]\d{7,14}$/.test(item.phone));
	return { memberName: member.displayName, companyName: tenant.organizationName, branchName: target.branchNameSnapshot,
		currency: target.currency, overdueMinor, creditMinor, amountMinor, overdueCount: overdue.length,
		oldestDueDate: overdue[0]?.dueDate ?? null, recipients,
		blockedReason: !overdue.some((item) => item.id === target.id) ? "not_overdue" : amountMinor === 0 ? "credit_covers_debt" : null };
}
