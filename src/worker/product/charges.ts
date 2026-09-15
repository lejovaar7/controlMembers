import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { AuthError } from "../auth/session";
import { getTenantDb } from "../db";
import { team } from "../db/auth-schema";
import { allocation, auditEvent, charge, customerMember, enrollment, payment, plan, planTag, tag } from "../db/schema";
import { RequestError } from "../http";
import { requireTenant, type TenantContext } from "../tenant";
import { details, localDate, readPeriod, readString, requireAccessibleBranch, requireAdjustCharges, requireConfiguredBilling, requireGenerateCharges } from "./domain";

function periodRange(period: string) {
	const [year, month] = period.split("-").map(Number);
	const lastDay = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
	return { start: `${period}-01`, end: `${period}-${String(lastDay).padStart(2, "0")}` };
}

function chargeState(item: { lifecycle: string; totalMinor: number; paidMinor: number; dueDate: string }, today: string) {
	if (item.lifecycle === "void") return "void";
	if (item.paidMinor >= item.totalMinor) return "paid";
	if (item.paidMinor > 0) return "partial";
	return item.dueDate < today ? "overdue" : "pending";
}

async function generationBranches(env: Env, tenant: TenantContext, value: unknown) {
	const requested = value === undefined ? null : value;
	if (requested !== null && (!Array.isArray(requested) || requested.some((id) => typeof id !== "string"))) throw new RequestError(400, "INVALID_INPUT");
	const branchIds = requested ? [...new Set(requested as string[])] : (tenant.allBranches ? null : tenant.branchIds);
	if (branchIds && branchIds.some((id) => !tenant.allBranches && !tenant.branchIds.includes(id))) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	if (branchIds) for (const branchId of branchIds) await requireAccessibleBranch(env, tenant, branchId);
	return branchIds;
}

async function generationCandidates(env: Env, tenant: TenantContext, period: string, branchIds: string[] | null) {
	const { start, end } = periodRange(period);
	const db = getTenantDb(env, tenant.organizationId);
	const eligible = await db.select({ enrollment, memberName: customerMember.displayName, memberStatus: customerMember.status, planName: plan.name, branchName: team.name })
		.from(enrollment)
		.innerJoin(customerMember, eq(customerMember.id, enrollment.memberId))
		.innerJoin(plan, eq(plan.id, enrollment.planId))
		.innerJoin(team, eq(team.id, enrollment.branchId))
		.where(and(
			eq(enrollment.organizationId, tenant.organizationId), eq(enrollment.status, "active"), eq(customerMember.status, "active"),
			sql`${enrollment.startDate} <= ${end}`,
			sql`(${enrollment.endDate} is null or ${enrollment.endDate} >= ${start})`,
			branchIds ? (branchIds.length ? inArray(enrollment.branchId, branchIds) : eq(enrollment.id, "")) : undefined,
		));
	const ids = eligible.map((item) => item.enrollment.id);
	const existing = ids.length ? await db.select({ enrollmentId: charge.enrollmentId }).from(charge).where(and(eq(charge.organizationId, tenant.organizationId), eq(charge.billingPeriod, period), inArray(charge.enrollmentId, ids))) : [];
	const existingIds = new Set(existing.map((item) => item.enrollmentId));
	return { eligible, existing, missing: eligible.filter((item) => !existingIds.has(item.enrollment.id)) };
}

export async function previewChargeGeneration(env: Env, request: Request, body: Record<string, unknown>) {
	const tenant = await requireTenant(env, request);
	requireGenerateCharges(tenant); requireConfiguredBilling(tenant);
	const period = readPeriod(body.period);
	const branchIds = await generationBranches(env, tenant, body.branchIds);
	const { eligible, existing, missing } = await generationCandidates(env, tenant, period, branchIds);
	return { period, eligible: eligible.length, willCreate: missing.length, alreadyExisting: existing.length, skipped: 0 };
}

export async function listCharges(env: Env, request: Request) {
	const tenant = await requireTenant(env, request);
	const url = new URL(request.url);
	const periodValue = url.searchParams.get("period");
	const period = periodValue ? readPeriod(periodValue) : null;
	const requestedBranch = url.searchParams.get("branchId");
	if (requestedBranch && !tenant.allBranches && !tenant.branchIds.includes(requestedBranch)) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	const search = (url.searchParams.get("search") ?? "").trim().toLocaleLowerCase("en");
	const requestedPlan = url.searchParams.get("planId");
	const requestedTag = (url.searchParams.get("tag") ?? "").trim().toLocaleLowerCase("en");
	const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "25", 10) || 25));
	const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
	const db = getTenantDb(env, tenant.organizationId);
	const taggedPlans = requestedTag ? await db.select({ id: planTag.planId }).from(planTag).innerJoin(tag, eq(tag.id, planTag.tagId)).where(and(eq(planTag.organizationId, tenant.organizationId), eq(tag.normalizedName, requestedTag))) : null;
	const taggedPlanIds = taggedPlans?.map((item) => item.id) ?? null;
	const rows = await db.select({
		id: charge.id, memberId: charge.memberId, memberName: charge.memberNameSnapshot,
		planName: charge.planNameSnapshot, branchId: charge.branchId, branchName: charge.branchNameSnapshot,
		billingPeriod: charge.billingPeriod, dueDate: charge.dueDate, subtotalMinor: charge.subtotalMinor,
		discountMinor: charge.discountMinor, adjustmentMinor: charge.adjustmentMinor, totalMinor: charge.totalMinor,
		currency: charge.currency, lifecycle: charge.status, voidReason: charge.voidReason,
		paidMinor: sql<number>`coalesce(sum(case when ${payment.status} = 'posted' then ${allocation.amountMinor} else 0 end), 0)`,
	}).from(charge).leftJoin(allocation, eq(allocation.chargeId, charge.id)).leftJoin(payment, eq(payment.id, allocation.paymentId))
		.where(and(
			eq(charge.organizationId, tenant.organizationId),
			period ? eq(charge.billingPeriod, period) : undefined,
			requestedBranch ? eq(charge.branchId, requestedBranch) : undefined,
			requestedPlan ? eq(charge.planId, requestedPlan) : undefined,
			taggedPlanIds ? (taggedPlanIds.length ? inArray(charge.planId, taggedPlanIds) : eq(charge.id, "")) : undefined,
			!tenant.allBranches ? (tenant.branchIds.length ? inArray(charge.branchId, tenant.branchIds) : eq(charge.id, "")) : undefined,
			search ? or(like(sql`lower(${charge.memberNameSnapshot})`, `%${search}%`), like(sql`lower(${charge.planNameSnapshot})`, `%${search}%`)) : undefined,
		)).groupBy(charge.id).orderBy(desc(charge.dueDate));
	const today = localDate(tenant.timezone);
	const normalized = rows.map((row) => {
		const paidMinor = Number(row.paidMinor);
		const outstandingMinor = row.lifecycle === "void" ? 0 : Math.max(0, row.totalMinor - paidMinor);
		return { ...row, paidMinor, outstandingMinor, paymentState: chargeState({ lifecycle: row.lifecycle, totalMinor: row.totalMinor, paidMinor, dueDate: row.dueDate }, today) };
	});
	const state = url.searchParams.get("state");
	const filtered = state ? normalized.filter((item) => item.paymentState === state) : normalized;
	return { charges: filtered.slice(offset, offset + limit), nextOffset: filtered.length > offset + limit ? offset + limit : null, asOf: new Date().toISOString(), appliedFilters: { period, branchId: requestedBranch, planId: requestedPlan, tag: requestedTag || null, search: search || null, state } };
}

export async function generateCharges(env: Env, request: Request, body: Record<string, unknown>) {
	const tenant = await requireTenant(env, request);
	requireGenerateCharges(tenant);
	requireConfiguredBilling(tenant);
	const period = readPeriod(body.period);
	const branchIds = await generationBranches(env, tenant, body.branchIds);
	const db = getTenantDb(env, tenant.organizationId);
	const { eligible, existing, missing } = await generationCandidates(env, tenant, period, branchIds);
	const batchId = crypto.randomUUID();
	await db.batch([
		db.insert(auditEvent).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, eventType: "charges.generated", actorUserId: tenant.userId, subjectType: "generation_batch", subjectId: batchId, detailsJson: details({ period, eligible: eligible.length, requested: missing.length }) }),
		...missing.map((item) => {
			const totalMinor = item.enrollment.agreedAmountMinor - item.enrollment.discountMinor;
			return db.insert(charge).values({
				id: crypto.randomUUID(), organizationId: tenant.organizationId, enrollmentId: item.enrollment.id,
				memberId: item.enrollment.memberId, planId: item.enrollment.planId, branchId: item.enrollment.branchId,
				billingPeriod: period, dueDate: `${period}-${String(item.enrollment.dueDay).padStart(2, "0")}`,
				subtotalMinor: item.enrollment.agreedAmountMinor, discountMinor: item.enrollment.discountMinor,
				adjustmentMinor: 0, totalMinor, currency: item.enrollment.currency,
				memberNameSnapshot: item.memberName, planNameSnapshot: item.planName, branchNameSnapshot: item.branchName,
				generationBatchId: batchId, createdByUserId: tenant.userId,
			}).onConflictDoNothing();
		}),
	]);
	const [created] = await db.select({ count: sql<number>`count(*)` }).from(charge).where(and(eq(charge.organizationId, tenant.organizationId), eq(charge.generationBatchId, batchId)));
	const createdCount = Number(created?.count ?? 0);
	return { batchId, period, created: createdCount, alreadyExisting: existing.length + missing.length - createdCount, skipped: 0, failed: 0 };
}

async function loadChargeWithPaid(env: Env, organizationId: string, id: string) {
	const [row] = await getTenantDb(env, organizationId).select({ charge, paidMinor: sql<number>`coalesce(sum(case when ${payment.status} = 'posted' then ${allocation.amountMinor} else 0 end), 0)` })
		.from(charge).leftJoin(allocation, eq(allocation.chargeId, charge.id)).leftJoin(payment, eq(payment.id, allocation.paymentId))
		.where(and(eq(charge.id, id), eq(charge.organizationId, organizationId))).groupBy(charge.id).limit(1);
	return row ? { ...row.charge, paidMinor: Number(row.paidMinor) } : null;
}

export async function adjustCharge(env: Env, request: Request, id: string, body: Record<string, unknown>) {
	const tenant = await requireTenant(env, request);
	requireAdjustCharges(tenant);
	const current = await loadChargeWithPaid(env, tenant.organizationId, id);
	if (!current || (!tenant.allBranches && !tenant.branchIds.includes(current.branchId))) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	if (current.status !== "open" || current.paidMinor > 0) throw new RequestError(409, "CHARGE_CANNOT_BE_ADJUSTED");
	const adjustmentMinor = Number(body.adjustmentMinor);
	const reason = readString(body.reason, 500, true)!;
	const totalMinor = current.subtotalMinor - current.discountMinor + adjustmentMinor;
	if (!Number.isSafeInteger(adjustmentMinor) || totalMinor < 0) throw new RequestError(400, "INVALID_INPUT");
	const db = getTenantDb(env, tenant.organizationId);
	await db.batch([
		db.update(charge).set({ adjustmentMinor, totalMinor, updatedAt: new Date() }).where(and(eq(charge.id, id), eq(charge.organizationId, tenant.organizationId))),
		db.insert(auditEvent).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, eventType: "charge.adjusted", actorUserId: tenant.userId, subjectType: "charge", subjectId: id, branchId: current.branchId, detailsJson: details({ before: current.adjustmentMinor, after: adjustmentMinor, reason }) }),
	]);
	return { id, adjustmentMinor, totalMinor };
}

export async function voidCharge(env: Env, request: Request, id: string, body: Record<string, unknown>) {
	const tenant = await requireTenant(env, request);
	requireAdjustCharges(tenant);
	const current = await loadChargeWithPaid(env, tenant.organizationId, id);
	if (!current || (!tenant.allBranches && !tenant.branchIds.includes(current.branchId))) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	const reason = readString(body.reason, 500, true)!;
	if (current.paidMinor > 0) throw new RequestError(409, "CHARGE_HAS_ALLOCATIONS");
	if (current.status === "void") return { id, status: "void", reason: current.voidReason };
	const db = getTenantDb(env, tenant.organizationId);
	await db.batch([
		db.update(charge).set({ status: "void", voidReason: reason, voidedByUserId: tenant.userId, voidedAt: new Date(), updatedAt: new Date() }).where(and(eq(charge.id, id), eq(charge.organizationId, tenant.organizationId))),
		db.insert(auditEvent).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, eventType: "charge.voided", actorUserId: tenant.userId, subjectType: "charge", subjectId: id, branchId: current.branchId, detailsJson: details({ reason }) }),
	]);
	return { id, status: "void", reason };
}
