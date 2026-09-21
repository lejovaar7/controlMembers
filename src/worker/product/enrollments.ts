import { prepareEnrollment } from "./enrollment-write";
import { inWorkspace, requireWorkspaceTenant } from "./workspace";
import { and, eq } from "drizzle-orm";
import { AuthError } from "../auth/session";
import { getTenantDb } from "../db";
import { auditEvent, enrollment } from "../db/schema";
import { RequestError } from "../http";
import { details, now, readDate, readString } from "./domain";
import { loadMember } from "./members";

const STATUSES = new Set(["active", "paused", "ended"]);

export async function createEnrollment(env: Env, request: Request, memberId: string, body: Record<string, unknown>) {
	const tenant = await requireWorkspaceTenant(env, request);
	const member = await loadMember(env, { ...tenant, activeBranchId: null }, memberId);
	if (member.status !== "active") throw new RequestError(409, "MEMBER_NOT_ACTIVE");
	const prepared = await prepareEnrollment(env, tenant, member, body);
	await getTenantDb(env, tenant.organizationId).batch([...prepared.statements]);
	return prepared.result;
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
