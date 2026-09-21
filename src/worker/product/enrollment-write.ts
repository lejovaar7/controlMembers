import { defaultFirstDueDate } from "../../shared/billing-dates";
import { inWorkspace } from "./workspace";
import { and, eq, sql } from "drizzle-orm";
import { AuthError } from "../auth/session";
import { getTenantDb } from "../db";
import { auditEvent, charge, enrollment, plan, planBranch } from "../db/schema";
import { RequestError } from "../http";
import type { TenantContext } from "../tenant";
import { details, readDate, readString, requireAccessibleBranch, requireConfiguredBilling } from "./domain";

/** Prepare enrollment writes so signup can include the Member in the same transaction. */
export async function prepareEnrollment(env: Env, tenant: TenantContext, member: { id: string; displayName: string; primaryBranchId: string }, body: Record<string, unknown>) {
	const memberId = member.id;
	requireConfiguredBilling(tenant);
	const planId = readString(body.planId, 100, true)!;
	const branch = await requireAccessibleBranch(env, tenant, body.branchId ?? member.primaryBranchId);
	if (!inWorkspace(tenant, branch.branchId)) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	const db = getTenantDb(env, tenant.organizationId);
	const [selectedPlan] = await db.select().from(plan).innerJoin(planBranch, and(eq(planBranch.planId, plan.id), eq(planBranch.branchId, branch.branchId)))
		.where(and(eq(plan.id, planId), eq(plan.organizationId, tenant.organizationId), eq(plan.isActive, true))).limit(1);
	if (!selectedPlan) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	const agreedAmountMinor = body.agreedAmountMinor === undefined ? selectedPlan.plan.amountMinor : Number(body.agreedAmountMinor);
	// Keep the legacy default for older readers; new schedules use recurringDay.
	const dueDay = selectedPlan.plan.defaultDueDay;
	const discountMinor = body.discountMinor === undefined ? 0 : Number(body.discountMinor);
	if (!Number.isSafeInteger(agreedAmountMinor) || agreedAmountMinor <= 0 || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28 || !Number.isSafeInteger(discountMinor) || discountMinor < 0 || discountMinor > agreedAmountMinor) throw new RequestError(400, "INVALID_INPUT");
	const startDate = readDate(body.startDate, true)!;
	const suggestedDate = defaultFirstDueDate(startDate);
	const firstDueDate = readDate(body.firstDueDate === undefined ? suggestedDate : body.firstDueDate, true)!;
	const recurringDay = body.recurringDay === undefined
		? Number((firstDueDate === suggestedDate ? startDate : firstDueDate).slice(8, 10)) : Number(body.recurringDay);
	if (firstDueDate < startDate || !Number.isInteger(recurringDay) || recurringDay < 1 || recurringDay > 31) throw new RequestError(400, "INVALID_INPUT");
	const endDate = readDate(body.endDate);
	if (endDate && endDate < startDate) throw new RequestError(400, "INVALID_INPUT");
	const id = crypto.randomUUID();
	const [overlap] = await db.select({ id: enrollment.id }).from(enrollment).where(and(
		eq(enrollment.organizationId, tenant.organizationId), eq(enrollment.memberId, memberId),
		eq(enrollment.planId, planId), eq(enrollment.branchId, branch.branchId),
		sql`${enrollment.status} != 'ended'`,
	)).limit(1);
	if (overlap) throw new RequestError(409, "ENROLLMENT_ALREADY_EXISTS");
	// The signup fee and enrollment commit together. Money is recorded separately.
	const firstChargeId = firstDueDate === startDate ? crypto.randomUUID() : null;
	const statements = [
		db.insert(enrollment).values({ id, organizationId: tenant.organizationId, memberId, planId, branchId: branch.branchId, startDate, firstDueDate, recurringDay, endDate, status: "active", agreedAmountMinor, currency: selectedPlan.plan.currency, dueDay, discountMinor, createdByUserId: tenant.userId }),
		...(firstChargeId ? [db.insert(charge).values({
			id: firstChargeId, organizationId: tenant.organizationId, enrollmentId: id, memberId, planId, branchId: branch.branchId,
			billingPeriod: firstDueDate.slice(0, 7), dueDate: firstDueDate, subtotalMinor: agreedAmountMinor, discountMinor,
			adjustmentMinor: 0, totalMinor: agreedAmountMinor - discountMinor, currency: selectedPlan.plan.currency,
			memberNameSnapshot: member.displayName, planNameSnapshot: selectedPlan.plan.name, branchNameSnapshot: branch.name,
			createdByUserId: tenant.userId,
		}), db.insert(auditEvent).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, eventType: "charge.created", actorUserId: tenant.userId, subjectType: "charge", subjectId: firstChargeId, branchId: branch.branchId, detailsJson: details({ enrollmentId: id, source: "enrollment", dueDate: firstDueDate, totalMinor: agreedAmountMinor - discountMinor }) })] : []),
		db.insert(auditEvent).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, eventType: "enrollment.created", actorUserId: tenant.userId, subjectType: "enrollment", subjectId: id, branchId: branch.branchId, detailsJson: details({ memberId, planId, startDate, firstDueDate, recurringDay, agreedAmountMinor, dueDay: recurringDay, discountMinor }) }),
	] as const;
	return { statements, result: { id, memberId, planId, planName: selectedPlan.plan.name, branchId: branch.branchId, startDate, firstDueDate, recurringDay, endDate, status: "active", agreedAmountMinor, currency: selectedPlan.plan.currency, dueDay: recurringDay, discountMinor, firstChargeId } };
}
