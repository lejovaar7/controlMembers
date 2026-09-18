import { inWorkspace, requireWorkspaceTenant, workspaceCondition } from "./workspace";
import { memberWorkspaceCondition } from "./members";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { AuthError } from "../auth/session";
import { getTenantDb } from "../db";
import { team } from "../db/auth-schema";
import { allocation, auditEvent, charge, customerMember, payment } from "../db/schema";
import { csvCell, details, localDate, zonedMidnight, readPeriod, requireExport, requireReports } from "./domain";

function addMonth(period: string) {
	const [year, month] = period.split("-").map(Number);
	return new Date(Date.UTC(year!, month!, 1)).toISOString().slice(0, 7);
}




export async function getDashboard(env: Env, request: Request) {
	const tenant = await requireWorkspaceTenant(env, request);
	requireReports(tenant);
	const url = new URL(request.url);
	const period = readPeriod(url.searchParams.get("period") ?? localDate(tenant.timezone).slice(0, 7));
	const branchId = url.searchParams.get("branchId");
	if (branchId && !inWorkspace(tenant, branchId)) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	const db = getTenantDb(env, tenant.organizationId);
	const chargeWhere = and(eq(charge.organizationId, tenant.organizationId), eq(charge.billingPeriod, period), branchId ? eq(charge.branchId, branchId) : workspaceCondition(tenant, charge.branchId));
	const periodCharges = await db.select({ id: charge.id, memberId: charge.memberId, totalMinor: charge.totalMinor, dueDate: charge.dueDate, status: charge.status }).from(charge).where(chargeWhere);
	const chargeIds = periodCharges.map((item) => item.id);
	const allocatedRows = chargeIds.length ? await db.select({ chargeId: allocation.chargeId, amount: sql<number>`coalesce(sum(${allocation.amountMinor}), 0)` })
		.from(allocation).innerJoin(payment, eq(payment.id, allocation.paymentId))
		.where(and(eq(allocation.organizationId, tenant.organizationId), eq(payment.status, "posted"), inArray(allocation.chargeId, chargeIds))).groupBy(allocation.chargeId) : [];
	const allocatedByCharge = new Map(allocatedRows.map((item) => [item.chargeId, Number(item.amount)]));
	const [collected] = await db.select({ amount: sql<number>`coalesce(sum(${payment.amountMinor}), 0)` }).from(payment).where(and(
		eq(payment.organizationId, tenant.organizationId), eq(payment.status, "posted"),
		gte(payment.paidAt, zonedMidnight(`${period}-01`, tenant.timezone)),
		lt(payment.paidAt, zonedMidnight(`${addMonth(period)}-01`, tenant.timezone)),
		branchId ? eq(payment.branchId, branchId) : workspaceCondition(tenant, payment.branchId),
	));
	const today = localDate(tenant.timezone);
	const activeCharges = periodCharges.filter((item) => item.status === "open");
	const expectedMinor = activeCharges.reduce((sum, item) => sum + item.totalMinor, 0);
	const allocatedMinor = activeCharges.reduce((sum, item) => sum + (allocatedByCharge.get(item.id) ?? 0), 0);
	const overdueMembers = new Set(activeCharges.filter((item) => item.dueDate < today && item.totalMinor > (allocatedByCharge.get(item.id) ?? 0)).map((item) => item.memberId)).size;
	const inSevenDays = new Date(`${today}T00:00:00Z`); inSevenDays.setUTCDate(inSevenDays.getUTCDate() + 7);
	const upcomingLimit = inSevenDays.toISOString().slice(0, 10);
	const upcoming = activeCharges.filter((item) => item.dueDate >= today && item.dueDate <= upcomingLimit && item.totalMinor > (allocatedByCharge.get(item.id) ?? 0));
	return { period, currency: tenant.currency ?? "COP", expectedMinor, collectedMinor: Number(collected?.amount ?? 0), allocatedMinor, outstandingMinor: Math.max(0, expectedMinor - allocatedMinor), overdueMembers, upcomingDueCount: upcoming.length, upcomingDueMinor: upcoming.reduce((sum, item) => sum + Math.max(0, item.totalMinor - (allocatedByCharge.get(item.id) ?? 0)), 0), collectionRate: expectedMinor ? allocatedMinor / expectedMinor : null, asOf: new Date().toISOString(), scope: tenant.activeBranchId ? "branch" : tenant.allBranches ? "all" : "assigned" };
}

export async function getMemberBalances(env: Env, request: Request) {
	const tenant = await requireWorkspaceTenant(env, request);
	requireReports(tenant);
	const db = getTenantDb(env, tenant.organizationId);
	const members = await db.select({ id: customerMember.id, displayName: customerMember.displayName, branchId: team.id, branchName: team.name, status: customerMember.status })
		.from(customerMember).innerJoin(team, eq(team.id, tenant.activeBranchId ?? customerMember.primaryBranchId)).where(and(eq(customerMember.organizationId, tenant.organizationId), memberWorkspaceCondition(env, tenant)));
	const memberIds = members.map((item) => item.id);
	const charges = memberIds.length ? await db.select({ id: charge.id, memberId: charge.memberId, totalMinor: charge.totalMinor }).from(charge).where(and(eq(charge.organizationId, tenant.organizationId), eq(charge.status, "open"), inArray(charge.memberId, memberIds), workspaceCondition(tenant, charge.branchId))) : [];
	const chargeIds = charges.map((item) => item.id);
	const allocationRows = chargeIds.length ? await db.select({ chargeId: allocation.chargeId, amount: sql<number>`coalesce(sum(${allocation.amountMinor}), 0)` }).from(allocation).innerJoin(payment, eq(payment.id, allocation.paymentId)).where(and(eq(payment.status, "posted"), inArray(allocation.chargeId, chargeIds))).groupBy(allocation.chargeId) : [];
	const allocationByCharge = new Map(allocationRows.map((item) => [item.chargeId, Number(item.amount)]));
	const postedPayments = memberIds.length ? await db.select({ id: payment.id, memberId: payment.memberId, amountMinor: payment.amountMinor }).from(payment).where(and(eq(payment.organizationId, tenant.organizationId), eq(payment.status, "posted"), inArray(payment.memberId, memberIds), workspaceCondition(tenant, payment.branchId))) : [];
	const paymentIds = postedPayments.map((item) => item.id);
	const paymentAllocations = paymentIds.length ? await db.select({ paymentId: allocation.paymentId, amount: sql<number>`coalesce(sum(${allocation.amountMinor}), 0)` }).from(allocation).where(inArray(allocation.paymentId, paymentIds)).groupBy(allocation.paymentId) : [];
	const allocationByPayment = new Map(paymentAllocations.map((item) => [item.paymentId, Number(item.amount)]));
	const rows = members.map((member) => {
		const outstandingMinor = charges.filter((item) => item.memberId === member.id).reduce((sum, item) => sum + Math.max(0, item.totalMinor - (allocationByCharge.get(item.id) ?? 0)), 0);
		const creditMinor = postedPayments.filter((item) => item.memberId === member.id).reduce((sum, item) => sum + Math.max(0, item.amountMinor - (allocationByPayment.get(item.id) ?? 0)), 0);
		return { ...member, outstandingMinor, creditMinor, netMinor: outstandingMinor - creditMinor };
	});
	return { balances: rows, currency: tenant.currency ?? "COP", asOf: new Date().toISOString() };
}

export async function getFinancialReports(env: Env, request: Request) {
	const tenant = await requireWorkspaceTenant(env, request);
	requireReports(tenant);
	const url = new URL(request.url);
	const period = readPeriod(url.searchParams.get("period") ?? localDate(tenant.timezone).slice(0, 7));
	const db = getTenantDb(env, tenant.organizationId);
	const charges = await db.select({
		id: charge.id, planId: charge.planId, planName: charge.planNameSnapshot,
		branchId: charge.branchId, branchName: charge.branchNameSnapshot,
		billingPeriod: charge.billingPeriod, dueDate: charge.dueDate, totalMinor: charge.totalMinor,
	}).from(charge).where(and(eq(charge.organizationId, tenant.organizationId), eq(charge.status, "open"), workspaceCondition(tenant, charge.branchId)));
	const chargeIds = charges.map((item) => item.id);
	const allocatedRows = chargeIds.length ? await db.select({ chargeId: allocation.chargeId, amount: sql<number>`coalesce(sum(${allocation.amountMinor}), 0)` })
		.from(allocation).innerJoin(payment, eq(payment.id, allocation.paymentId))
		.where(and(eq(allocation.organizationId, tenant.organizationId), eq(payment.status, "posted"), inArray(allocation.chargeId, chargeIds))).groupBy(allocation.chargeId) : [];
	const allocated = new Map(allocatedRows.map((item) => [item.chargeId, Number(item.amount)]));
	const today = localDate(tenant.timezone);
	const todayMs = Date.parse(`${today}T00:00:00Z`);
	const aging = { current: 0, days1To30: 0, days31To60: 0, days61To90: 0, days90Plus: 0 };
	for (const item of charges) {
		const outstanding = Math.max(0, item.totalMinor - (allocated.get(item.id) ?? 0));
		if (!outstanding) continue;
		const days = Math.floor((todayMs - Date.parse(`${item.dueDate}T00:00:00Z`)) / 86_400_000);
		if (days <= 0) aging.current += outstanding;
		else if (days <= 30) aging.days1To30 += outstanding;
		else if (days <= 60) aging.days31To60 += outstanding;
		else if (days <= 90) aging.days61To90 += outstanding;
		else aging.days90Plus += outstanding;
	}
	const periodCharges = charges.filter((item) => item.billingPeriod === period);
	const group = <T extends { id: string; name: string }>(selector: (charge: typeof periodCharges[number]) => T) => {
		const map = new Map<string, { id: string; name: string; expectedMinor: number; allocatedMinor: number; outstandingMinor: number }>();
		for (const item of periodCharges) {
			const key = selector(item);
			const current = map.get(key.id) ?? { ...key, expectedMinor: 0, allocatedMinor: 0, outstandingMinor: 0 };
			const paid = Math.min(item.totalMinor, allocated.get(item.id) ?? 0);
			current.expectedMinor += item.totalMinor; current.allocatedMinor += paid; current.outstandingMinor += Math.max(0, item.totalMinor - paid);
			map.set(key.id, current);
		}
		return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
	};
	return {
		period, currency: tenant.currency ?? "COP", asOf: new Date().toISOString(),
		aging,
		plans: group((item) => ({ id: item.planId, name: item.planName })),
		branches: group((item) => ({ id: item.branchId, name: item.branchName })),
		scope: tenant.activeBranchId ? "branch" : tenant.allBranches ? "all" : "assigned",
	};
}

export async function exportCsv(env: Env, request: Request, kind: string) {
	const tenant = await requireWorkspaceTenant(env, request);
	requireExport(tenant);
	const db = getTenantDb(env, tenant.organizationId);
	const url = new URL(request.url);
	const period = url.searchParams.get("period") ? readPeriod(url.searchParams.get("period")) : null;
	let headers: string[];
	let rows: unknown[][];
	if (kind === "members") {
		headers = ["member_id", "name", "status", "branch", "document", "email", "phone", "external_reference"];
		rows = (await db.select({ member: customerMember, branchName: team.name }).from(customerMember).innerJoin(team, eq(team.id, tenant.activeBranchId ?? customerMember.primaryBranchId)).where(and(eq(customerMember.organizationId, tenant.organizationId), memberWorkspaceCondition(env, tenant)))).map(({ member, branchName }) => [member.id, member.displayName, member.status, branchName, member.documentNumber, member.email, member.phoneE164, member.externalReference]);
	} else if (kind === "payments") {
		headers = ["receipt", "paid_at", "member", "branch", "method", "amount_minor", "currency", "status"];
		rows = (await db.select({ payment, memberName: customerMember.displayName, branchName: team.name }).from(payment).innerJoin(customerMember, eq(customerMember.id, payment.memberId)).innerJoin(team, eq(team.id, payment.branchId)).where(and(eq(payment.organizationId, tenant.organizationId), workspaceCondition(tenant, payment.branchId), period ? gte(payment.paidAt, zonedMidnight(`${period}-01`, tenant.timezone)) : undefined, period ? lt(payment.paidAt, zonedMidnight(`${addMonth(period)}-01`, tenant.timezone)) : undefined))).map((item) => [item.payment.receiptNumber, item.payment.paidAt.toISOString(), item.memberName, item.branchName, item.payment.methodName ?? item.payment.method, item.payment.amountMinor, item.payment.currency, item.payment.status]);
	} else if (kind === "receivables") {
		headers = ["charge_id", "period", "due_date", "member", "plan", "branch", "total_minor", "currency", "lifecycle"];
		rows = (await db.select().from(charge).where(and(eq(charge.organizationId, tenant.organizationId), workspaceCondition(tenant, charge.branchId), period ? eq(charge.billingPeriod, period) : undefined))).map((item) => [item.id, item.billingPeriod, item.dueDate, item.memberNameSnapshot, item.planNameSnapshot, item.branchNameSnapshot, item.totalMinor, item.currency, item.status]);
	} else if (kind === "member-balances") {
		headers = ["member_id", "name", "branch", "status", "outstanding_minor", "credit_minor", "net_minor", "currency", "as_of"];
		const result = await getMemberBalances(env, request);
		rows = result.balances.map((item) => [item.id, item.displayName, item.branchName, item.status, item.outstandingMinor, item.creditMinor, item.netMinor, result.currency, result.asOf]);
	} else throw new AuthError(404, "RESOURCE_NOT_FOUND");
	const auditId = crypto.randomUUID();
	await db.insert(auditEvent).values({ id: auditId, organizationId: tenant.organizationId, eventType: "data.exported", actorUserId: tenant.userId, subjectType: "export", subjectId: auditId, detailsJson: details({ kind, period, count: rows.length }) });
	const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
	return new Response(`\uFEFF${csv}\r\n`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="controlmembers-${kind}.csv"`, "Cache-Control": "no-store" } });
}
