import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { AuthError } from "../auth/session";
import { getTenantDb } from "../db";
import { program, programBranch, billingPlan } from "../db/schema";
import { RequestError } from "../http";
import { getBranch } from "../tenant/branch";
import { requireTenant, type TenantContext } from "../tenant";
import { requireBillingSetupAdmin } from "./setup";

const now = () => new Date();
const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");

function readName(value: unknown) {
	if (typeof value !== "string") throw new RequestError(400, "INVALID_INPUT");
	const name = value.trim().replace(/\s+/g, " ");
	if (!name || name.length > 120) throw new RequestError(400, "INVALID_INPUT");
	return name;
}

function readDescription(value: unknown) {
	if (value === undefined || value === null || value === "") return null;
	if (typeof value !== "string" || value.trim().length > 1000) throw new RequestError(400, "INVALID_INPUT");
	return value.trim();
}

function readBoolean(value: unknown, fallback: boolean) {
	if (value === undefined) return fallback;
	if (typeof value !== "boolean") throw new RequestError(400, "INVALID_INPUT");
	return value;
}

function readBranchIds(value: unknown) {
	if (!Array.isArray(value) || value.length === 0 || value.length > 100 || value.some((id) => typeof id !== "string" || !id.trim())) {
		throw new RequestError(400, "INVALID_BRANCHES");
	}
	const ids = [...new Set(value.map((id) => String(id).trim()))];
	if (ids.length !== value.length) throw new RequestError(400, "INVALID_BRANCHES");
	return ids;
}

async function validateBranches(env: Env, tenant: TenantContext, branchIds: string[]) {
	for (const branchId of branchIds) {
		if (!(await getBranch(env, tenant, branchId))) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	}
}

async function ensureActiveNameAvailable(env: Env, tenant: TenantContext, table: typeof program | typeof billingPlan, normalizedName: string, exceptId?: string) {
	const id = table === program ? program.id : billingPlan.id;
	const organizationId = table === program ? program.organizationId : billingPlan.organizationId;
	const normalized = table === program ? program.normalizedName : billingPlan.normalizedName;
	const active = table === program ? program.isActive : billingPlan.isActive;
	const conditions = [eq(organizationId, tenant.organizationId), eq(normalized, normalizedName), eq(active, true)];
	if (exceptId) conditions.push(ne(id, exceptId));
	const [existing] = await getTenantDb(env, tenant.organizationId).select({ id }).from(table as typeof program).where(and(...conditions)).limit(1);
	if (existing) throw new RequestError(409, "NAME_ALREADY_EXISTS");
}

export async function listPrograms(env: Env, request: Request) {
	const tenant = await requireTenant(env, request);
	const db = getTenantDb(env, tenant.organizationId);
	if (!tenant.allBranches && tenant.branchIds.length === 0) return { programs: [] };
	const allowedBranches = tenant.allBranches ? undefined : tenant.branchIds;
	const links = await db.select({ programId: programBranch.programId, branchId: programBranch.branchId })
		.from(programBranch)
		.where(and(eq(programBranch.organizationId, tenant.organizationId), allowedBranches ? inArray(programBranch.branchId, allowedBranches) : undefined));
	const visibleIds = [...new Set(links.map((link) => link.programId))];
	const rows = await db.select().from(program)
		.where(and(eq(program.organizationId, tenant.organizationId), allowedBranches ? (visibleIds.length ? inArray(program.id, visibleIds) : eq(program.id, "")) : undefined))
		.orderBy(asc(program.name));
	return { programs: rows.map((row) => ({ ...row, branchIds: links.filter((link) => link.programId === row.id).map((link) => link.branchId) })) };
}

export async function createProgram(env: Env, request: Request, body: Record<string, unknown>) {
	const tenant = await requireTenant(env, request);
	requireBillingSetupAdmin(tenant);
	const name = readName(body.name);
	const normalizedName = normalizeName(name);
	const description = readDescription(body.description);
	const branchIds = readBranchIds(body.branchIds);
	await validateBranches(env, tenant, branchIds);
	await ensureActiveNameAvailable(env, tenant, program, normalizedName);
	const id = crypto.randomUUID();
	const db = getTenantDb(env, tenant.organizationId);
	await db.batch([
		db.insert(program).values({ id, organizationId: tenant.organizationId, name, normalizedName, description, createdByUserId: tenant.userId }),
		...branchIds.map((branchId) => db.insert(programBranch).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, programId: id, branchId })),
	]);
	return { id, name, description, isActive: true, branchIds };
}

export async function updateProgram(env: Env, request: Request, id: string, body: Record<string, unknown>) {
	const tenant = await requireTenant(env, request);
	requireBillingSetupAdmin(tenant);
	const db = getTenantDb(env, tenant.organizationId);
	const [current] = await db.select().from(program).where(and(eq(program.id, id), eq(program.organizationId, tenant.organizationId))).limit(1);
	if (!current) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	const name = body.name === undefined ? current.name : readName(body.name);
	const normalizedName = normalizeName(name);
	const description = body.description === undefined ? current.description : readDescription(body.description);
	const isActive = readBoolean(body.isActive, current.isActive);
	const branchIds = body.branchIds === undefined
		? (await db.select({ id: programBranch.branchId }).from(programBranch).where(eq(programBranch.programId, id))).map((row) => row.id)
		: readBranchIds(body.branchIds);
	await validateBranches(env, tenant, branchIds);
	if (isActive) await ensureActiveNameAvailable(env, tenant, program, normalizedName, id);
	await db.batch([
		db.update(program).set({ name, normalizedName, description, isActive, updatedAt: now() }).where(and(eq(program.id, id), eq(program.organizationId, tenant.organizationId))),
		db.delete(programBranch).where(and(eq(programBranch.programId, id), eq(programBranch.organizationId, tenant.organizationId))),
		...branchIds.map((branchId) => db.insert(programBranch).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, programId: id, branchId })),
	]);
	return { id, name, description, isActive, branchIds };
}

function readPlan(body: Record<string, unknown>, tenant: TenantContext, current?: typeof billingPlan.$inferSelect) {
	const name = body.name === undefined && current ? current.name : readName(body.name);
	const amountMinor = body.amountMinor === undefined && current ? current.amountMinor : body.amountMinor;
	const defaultDueDay = body.defaultDueDay === undefined && current ? current.defaultDueDay : body.defaultDueDay;
	const programIdValue = body.programId === undefined && current ? current.programId : body.programId;
	if (!Number.isSafeInteger(amountMinor) || Number(amountMinor) <= 0 || !Number.isInteger(defaultDueDay) || Number(defaultDueDay) < 1 || Number(defaultDueDay) > 28) {
		throw new RequestError(400, "INVALID_INPUT");
	}
	if (programIdValue !== null && programIdValue !== undefined && (typeof programIdValue !== "string" || !programIdValue.trim())) throw new RequestError(400, "INVALID_INPUT");
	if (!tenant.currency) throw new RequestError(409, "BILLING_SETTINGS_REQUIRED");
	return {
		name,
		normalizedName: normalizeName(name),
		amountMinor: Number(amountMinor),
		defaultDueDay: Number(defaultDueDay),
		programId: typeof programIdValue === "string" ? programIdValue.trim() : null,
		isActive: readBoolean(body.isActive, current?.isActive ?? true),
		currency: tenant.currency,
	};
}

async function validatePlanProgram(env: Env, tenant: TenantContext, programId: string | null) {
	if (!programId) return;
	const [row] = await getTenantDb(env, tenant.organizationId).select({ id: program.id }).from(program)
		.where(and(eq(program.id, programId), eq(program.organizationId, tenant.organizationId), eq(program.isActive, true))).limit(1);
	if (!row) throw new AuthError(404, "RESOURCE_NOT_FOUND");
}

export async function listBillingPlans(env: Env, request: Request) {
	const tenant = await requireTenant(env, request);
	const plans = await getTenantDb(env, tenant.organizationId).select().from(billingPlan)
		.where(eq(billingPlan.organizationId, tenant.organizationId)).orderBy(asc(billingPlan.name));
	return { plans };
}

export async function createBillingPlan(env: Env, request: Request, body: Record<string, unknown>) {
	const tenant = await requireTenant(env, request);
	requireBillingSetupAdmin(tenant);
	const values = readPlan(body, tenant);
	await validatePlanProgram(env, tenant, values.programId);
	await ensureActiveNameAvailable(env, tenant, billingPlan, values.normalizedName);
	const id = crypto.randomUUID();
	await getTenantDb(env, tenant.organizationId).insert(billingPlan).values({ id, organizationId: tenant.organizationId, ...values, frequency: "monthly", createdByUserId: tenant.userId });
	return { id, ...values, frequency: "monthly" };
}

export async function updateBillingPlan(env: Env, request: Request, id: string, body: Record<string, unknown>) {
	const tenant = await requireTenant(env, request);
	requireBillingSetupAdmin(tenant);
	const db = getTenantDb(env, tenant.organizationId);
	const [current] = await db.select().from(billingPlan).where(and(eq(billingPlan.id, id), eq(billingPlan.organizationId, tenant.organizationId))).limit(1);
	if (!current) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	const values = readPlan(body, tenant, current);
	await validatePlanProgram(env, tenant, values.programId);
	if (values.isActive) await ensureActiveNameAvailable(env, tenant, billingPlan, values.normalizedName, id);
	await db.update(billingPlan).set({ ...values, updatedAt: now() }).where(and(eq(billingPlan.id, id), eq(billingPlan.organizationId, tenant.organizationId)));
	return { id, ...values, frequency: "monthly" };
}
