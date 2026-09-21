import { billingDateInMonth, defaultFirstDueDate } from "../../shared/billing-dates";
import { inWorkspace, requireWorkspaceTenant } from "./workspace";
import { and, eq, sql } from "drizzle-orm";
import { AuthError } from "../auth/session";
import { getTenantDb } from "../db";
import { auditEvent, enrollment, plan, planBranch } from "../db/schema";
import { RequestError } from "../http";
import { details, now, readDate, readString, requireAccessibleBranch, requireConfiguredBilling } from "./domain";
import { loadMember } from "./members";

const STATUSES = new Set(["active", "paused", "ended"]);

export async function createEnrollment(env: Env, request: Request, memberId: string, body: Record<string, unknown>) {
	const tenant = await requireWorkspaceTenant(env, request);
	requireConfiguredBilling(tenant);
	// An authorized explicit enrollment can make a Member available in another Branch.
	const member = await loadMember(env, { ...tenant, activeBranchId: null }, memberId);
	if (member.status !== "active") throw new RequestError(409, "MEMBER_NOT_ACTIVE");
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
	if (firstDueDate <= startDate || !Number.isInteger(recurringDay) || recurringDay < 1 || recurringDay > 31 || billingDateInMonth(firstDueDate.slice(0, 7), recurringDay) !== firstDueDate) throw new RequestError(400, "INVALID_INPUT");
	const endDate = readDate(body.endDate);
	if (endDate && endDate < startDate) throw new RequestError(400, "INVALID_INPUT");
	const id = crypto.randomUUID();
	const [overlap] = await db.select({ id: enrollment.id }).from(enrollment).where(and(
		eq(enrollment.organizationId, tenant.organizationId), eq(enrollment.memberId, memberId),
		eq(enrollment.planId, planId), eq(enrollment.branchId, branch.branchId),
		sql`${enrollment.status} != 'ended'`,
	)).limit(1);
	if (overlap) throw new RequestError(409, "ENROLLMENT_ALREADY_EXISTS");
	await db.batch([
		db.insert(enrollment).values({ id, organizationId: tenant.organizationId, memberId, planId, branchId: branch.branchId, startDate, firstDueDate, recurringDay, endDate, status: "active", agreedAmountMinor, currency: selectedPlan.plan.currency, dueDay, discountMinor, createdByUserId: tenant.userId }),
		db.insert(auditEvent).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, eventType: "enrollment.created", actorUserId: tenant.userId, subjectType: "enrollment", subjectId: id, branchId: branch.branchId, detailsJson: details({ memberId, planId, startDate, firstDueDate, recurringDay, agreedAmountMinor, dueDay: recurringDay, discountMinor }) }),
	]);
	return { id, memberId, planId, planName: selectedPlan.plan.name, branchId: branch.branchId, startDate, firstDueDate, recurringDay, endDate, status: "active", agreedAmountMinor, currency: selectedPlan.plan.currency, dueDay: recurringDay, discountMinor };
}

export async function updateEnrollment(env: Env, request: Request, id: string, body: Record<string, unknown>) {
	const tenant = await requireWorkspaceTenant(env, request);
	const db = getTenantDb(env, tenant.organizationId);
	const [current] = await db.select().from(enrollment).where(and(eq(enrollment.id, id), eq(enrollment.organizationId, tenant.organizationId))).limit(1);
	if (!current || !inWorkspace(tenant, current.branchId)) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	const status = body.status === undefined ? current.status : body.status;
	if (typeof status !== "string" || !STATUSES.has(status) || (current.status === "ended" && status !== "ended")) throw new RequestError(400, "INVALID_INPUT");
	const agreedAmountMinor = body.agreedAmountMinor === undefined ? current.agreedAmountMinor : Number(body.agreedAmountMinor);
	const dueDay = body.dueDay === undefined ? current.recurringDay ?? current.dueDay : Number(body.dueDay);
	const discountMinor = body.discountMinor === undefined ? current.discountMinor : Number(body.discountMinor);
	const endDate = body.endDate === undefined ? current.endDate : readDate(body.endDate);
	if (!Number.isSafeInteger(agreedAmountMinor) || agreedAmountMinor <= 0 || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > (current.firstDueDate ? 31 : 28) || !Number.isSafeInteger(discountMinor) || discountMinor < 0 || discountMinor > agreedAmountMinor || (endDate && endDate < current.startDate)) throw new RequestError(400, "INVALID_INPUT");
	const reason = readString(body.reason, 500, true)!;
	const finalEndDate = status === "ended" ? (endDate ?? new Date().toISOString().slice(0, 10)) : endDate;
	await db.batch([
		db.update(enrollment).set({ status, agreedAmountMinor, dueDay: current.firstDueDate ? current.dueDay : dueDay, recurringDay: current.firstDueDate ? dueDay : null, discountMinor, endDate: finalEndDate, updatedAt: now() }).where(and(eq(enrollment.id, id), eq(enrollment.organizationId, tenant.organizationId))),
		db.insert(auditEvent).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, eventType: "enrollment.updated", actorUserId: tenant.userId, subjectType: "enrollment", subjectId: id, branchId: current.branchId, detailsJson: details({ before: { status: current.status, agreedAmountMinor: current.agreedAmountMinor, dueDay: current.recurringDay ?? current.dueDay, discountMinor: current.discountMinor }, after: { status, agreedAmountMinor, dueDay, discountMinor, endDate: finalEndDate }, reason }) }),
	]);
	return { ...current, status, agreedAmountMinor, dueDay, recurringDay: current.firstDueDate ? dueDay : null, discountMinor, endDate: finalEndDate };
}
