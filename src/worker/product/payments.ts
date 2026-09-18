import { inWorkspace, requireWorkspaceTenant, workspaceCondition } from "./workspace";
import { and, asc, desc, eq, gte, inArray, isNull, like, lt, sql } from "drizzle-orm";
import { AuthError } from "../auth/session";
import { getTenantDb } from "../db";
import { allocation, auditEvent, charge, customerMember, payment, paymentMethod } from "../db/schema";
import { RequestError } from "../http";
import { details, readString, requireAccessibleBranch, requireConfiguredBilling, requireReversePayments } from "./domain";
import { loadMember } from "./members";

const LEGACY_METHODS = new Set(["cash", "bank_transfer", "card", "other"]);

function readPaidAt(value: unknown) {
	if (typeof value !== "string" || !value.trim()) throw new RequestError(400, "INVALID_INPUT");
	const date = new Date(value);
	if (Number.isNaN(date.valueOf())) throw new RequestError(400, "INVALID_INPUT");
	return date;
}

async function paymentResult(env: Env, organizationId: string, id: string) {
	const db = getTenantDb(env, organizationId);
	const [record] = await db.select().from(payment).where(and(eq(payment.id, id), eq(payment.organizationId, organizationId))).limit(1);
	if (!record) return null;
	const allocations = await db.select().from(allocation).where(and(eq(allocation.organizationId, organizationId), eq(allocation.paymentId, id)));
	const allocatedMinor = allocations.reduce((sum, item) => sum + item.amountMinor, 0);
	return { ...record, method: record.paymentMethodId ?? record.method, allocations, allocatedMinor, creditMinor: record.status === "posted" ? record.amountMinor - allocatedMinor : 0 };
}

export async function previewPaymentAllocation(env: Env, request: Request, memberId: string, amountMinor: number) {
	const tenant = await requireWorkspaceTenant(env, request);
	await loadMember(env, tenant, memberId);
	if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new RequestError(400, "INVALID_INPUT");
	const db = getTenantDb(env, tenant.organizationId);
	const rows = await db.select({ id: charge.id, dueDate: charge.dueDate, totalMinor: charge.totalMinor, planName: charge.planNameSnapshot, paidMinor: sql<number>`coalesce(sum(case when ${payment.status} = 'posted' then ${allocation.amountMinor} else 0 end), 0)` })
		.from(charge).leftJoin(allocation, eq(allocation.chargeId, charge.id)).leftJoin(payment, eq(payment.id, allocation.paymentId))
		.where(and(eq(charge.organizationId, tenant.organizationId), eq(charge.memberId, memberId), eq(charge.status, "open"), workspaceCondition(tenant, charge.branchId)))
		.groupBy(charge.id).orderBy(asc(charge.dueDate));
	let remaining = amountMinor;
	const allocations = [] as Array<{ chargeId: string; amountMinor: number; dueDate: string; planName: string }>;
	for (const row of rows) {
		const outstanding = Math.max(0, row.totalMinor - Number(row.paidMinor));
		const applied = Math.min(outstanding, remaining);
		if (applied > 0) allocations.push({ chargeId: row.id, amountMinor: applied, dueDate: row.dueDate, planName: row.planName });
		remaining -= applied;
		if (remaining === 0) break;
	}
	return { allocations, allocatedMinor: amountMinor - remaining, creditMinor: remaining };
}

export async function createPayment(env: Env, request: Request, body: Record<string, unknown>) {
	const tenant = await requireWorkspaceTenant(env, request);
	requireConfiguredBilling(tenant);
	const memberId = readString(body.memberId, 100, true)!;
	await loadMember(env, tenant, memberId);
	const branch = await requireAccessibleBranch(env, tenant, body.branchId);
	if (!inWorkspace(tenant, branch.branchId)) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	const amountMinor = Number(body.amountMinor);
	if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new RequestError(400, "INVALID_INPUT");
	const method = body.method;
	if (typeof method !== "string" || !method || method.length > 100) throw new RequestError(400, "INVALID_INPUT");
	const paidAt = readPaidAt(body.paidAt);
	const externalReference = readString(body.externalReference, 200);
	const note = readString(body.note, 1000);
	const idempotencyKey = readString(body.idempotencyKey, 100, true)!;
	const requested = body.allocations;
	if (requested !== undefined && (!Array.isArray(requested) || requested.length > 100)) throw new RequestError(400, "INVALID_INPUT");
	const fingerprint = JSON.stringify({ memberId, branchId: branch.branchId, amountMinor, method, paidAt: paidAt.toISOString(), externalReference, note, allocations: requested ?? null });
	const db = getTenantDb(env, tenant.organizationId);
	const [existing] = await db.select().from(payment).where(and(eq(payment.organizationId, tenant.organizationId), eq(payment.idempotencyKey, idempotencyKey))).limit(1);
	if (existing) {
		if (existing.payloadFingerprint !== fingerprint) throw new RequestError(409, "IDEMPOTENCY_CONFLICT");
		return await paymentResult(env, tenant.organizationId, existing.id);
	}
	const [customMethod] = method === "cash" ? [] : await db.select().from(paymentMethod).where(and(eq(paymentMethod.id, method), eq(paymentMethod.organizationId, tenant.organizationId), eq(paymentMethod.isActive, true))).limit(1);
	if (method !== "cash" && !customMethod) throw new RequestError(400, "PAYMENT_METHOD_UNAVAILABLE");
	let proposed: Array<{ chargeId: string; amountMinor: number }>;
	if (requested === undefined) {
		proposed = (await previewPaymentAllocation(env, request, memberId, amountMinor)).allocations;
	} else {
		proposed = requested.map((item) => {
			if (!item || typeof item !== "object" || Array.isArray(item)) throw new RequestError(400, "INVALID_INPUT");
			const value = item as Record<string, unknown>;
			const chargeId = readString(value.chargeId, 100, true)!;
			const allocated = Number(value.amountMinor);
			if (!Number.isSafeInteger(allocated) || allocated <= 0) throw new RequestError(400, "INVALID_INPUT");
			return { chargeId, amountMinor: allocated };
		});
	}
	if (new Set(proposed.map((item) => item.chargeId)).size !== proposed.length || proposed.reduce((sum, item) => sum + item.amountMinor, 0) > amountMinor) throw new RequestError(400, "INVALID_INPUT");
	const chargeIds = proposed.map((item) => item.chargeId);
	const chargeRows = chargeIds.length ? await db.select({ id: charge.id, memberId: charge.memberId, branchId: charge.branchId, totalMinor: charge.totalMinor, status: charge.status, paidMinor: sql<number>`coalesce(sum(case when ${payment.status} = 'posted' then ${allocation.amountMinor} else 0 end), 0)` })
		.from(charge).leftJoin(allocation, eq(allocation.chargeId, charge.id)).leftJoin(payment, eq(payment.id, allocation.paymentId))
		.where(and(eq(charge.organizationId, tenant.organizationId), inArray(charge.id, chargeIds))).groupBy(charge.id) : [];
	if (chargeRows.length !== chargeIds.length) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	for (const proposedItem of proposed) {
		const target = chargeRows.find((item) => item.id === proposedItem.chargeId)!;
		if (target.memberId !== memberId || target.status !== "open" || (!inWorkspace(tenant, target.branchId) || target.branchId !== branch.branchId)) throw new AuthError(404, "RESOURCE_NOT_FOUND");
		if (Number(target.paidMinor) + proposedItem.amountMinor > target.totalMinor) throw new RequestError(409, "ALLOCATION_CONFLICT");
	}
	const id = crypto.randomUUID();
	const receiptNumber = `R-${paidAt.toISOString().slice(0, 10).replace(/-/g, "")}-${id.slice(0, 8).toUpperCase()}`;
	await db.batch([
		db.insert(payment).values({ id, organizationId: tenant.organizationId, memberId, branchId: branch.branchId, amountMinor, currency: tenant.currency!, paidAt, method: customMethod ? "other" : "cash", paymentMethodId: customMethod?.id ?? null, methodName: customMethod?.name ?? null, externalReference, note, receiptNumber, idempotencyKey, payloadFingerprint: fingerprint, recordedByUserId: tenant.userId }),
		...proposed.map((item) => db.insert(allocation).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, paymentId: id, chargeId: item.chargeId, amountMinor: item.amountMinor })),
		db.insert(auditEvent).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, eventType: "payment.posted", actorUserId: tenant.userId, subjectType: "payment", subjectId: id, branchId: branch.branchId, detailsJson: details({ receiptNumber, memberId, amountMinor, method, allocations: proposed }) }),
	]);
	return await paymentResult(env, tenant.organizationId, id);
}

export async function listPayments(env: Env, request: Request) {
	const tenant = await requireWorkspaceTenant(env, request);
	const url = new URL(request.url);
	const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "25", 10) || 25));
	const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
	const method = url.searchParams.get("method"); const status = url.searchParams.get("status"); const branchId = url.searchParams.get("branchId"); const search = (url.searchParams.get("search") ?? "").trim().toLocaleLowerCase("en"); const dateFrom = url.searchParams.get("dateFrom"); const dateTo = url.searchParams.get("dateTo");
	if (method && method.length > 100) throw new RequestError(400, "INVALID_INPUT");
	if (status && !["posted", "reversed"].includes(status)) throw new RequestError(400, "INVALID_INPUT");
	if (branchId && !inWorkspace(tenant, branchId)) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	const start = dateFrom ? new Date(`${dateFrom}T00:00:00Z`) : null; const end = dateTo ? new Date(`${dateTo}T00:00:00Z`) : null; if ((start && Number.isNaN(start.valueOf())) || (end && Number.isNaN(end.valueOf()))) throw new RequestError(400, "INVALID_INPUT"); if (end) end.setUTCDate(end.getUTCDate() + 1);
	const rows = await getTenantDb(env, tenant.organizationId).select({ payment, memberName: customerMember.displayName, allocatedMinor: sql<number>`coalesce(sum(${allocation.amountMinor}), 0)` })
		.from(payment).innerJoin(customerMember, eq(customerMember.id, payment.memberId)).leftJoin(allocation, eq(allocation.paymentId, payment.id))
		.where(and(eq(payment.organizationId, tenant.organizationId), workspaceCondition(tenant, payment.branchId), branchId ? eq(payment.branchId, branchId) : undefined, url.searchParams.get("memberId") ? eq(payment.memberId, url.searchParams.get("memberId")!) : undefined, method ? (LEGACY_METHODS.has(method) ? and(eq(payment.method, method), isNull(payment.paymentMethodId)) : eq(payment.paymentMethodId, method)) : undefined, status ? eq(payment.status, status) : undefined, search ? like(customerMember.normalizedName, `%${search}%`) : undefined, start ? gte(payment.paidAt, start) : undefined, end ? lt(payment.paidAt, end) : undefined))
		.groupBy(payment.id).orderBy(desc(payment.paidAt)).limit(limit + 1).offset(offset);
	return { payments: rows.slice(0, limit).map((row) => ({ ...row.payment, method: row.payment.paymentMethodId ?? row.payment.method, memberName: row.memberName, allocatedMinor: Number(row.allocatedMinor), creditMinor: row.payment.status === "posted" ? row.payment.amountMinor - Number(row.allocatedMinor) : 0 })), nextOffset: rows.length > limit ? offset + limit : null };
}

export async function reversePayment(env: Env, request: Request, id: string, body: Record<string, unknown>) {
	const tenant = await requireWorkspaceTenant(env, request);
	requireReversePayments(tenant);
	const reason = readString(body.reason, 500, true)!;
	const db = getTenantDb(env, tenant.organizationId);
	const [current] = await db.select().from(payment).where(and(eq(payment.id, id), eq(payment.organizationId, tenant.organizationId))).limit(1);
	if (!current || !inWorkspace(tenant, current.branchId)) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	if (current.status === "reversed") {
		if (current.reversalReason !== reason) throw new RequestError(409, "REVERSAL_CONFLICT");
		return await paymentResult(env, tenant.organizationId, id);
	}
	await db.batch([
		db.update(payment).set({ status: "reversed", reversedByUserId: tenant.userId, reversedAt: new Date(), reversalReason: reason }).where(and(eq(payment.id, id), eq(payment.organizationId, tenant.organizationId))),
		db.insert(auditEvent).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, eventType: "payment.reversed", actorUserId: tenant.userId, subjectType: "payment", subjectId: id, branchId: current.branchId, detailsJson: details({ reason, receiptNumber: current.receiptNumber, amountMinor: current.amountMinor }) }),
	]);
	return await paymentResult(env, tenant.organizationId, id);
}
