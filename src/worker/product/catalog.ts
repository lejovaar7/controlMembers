import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { AuthError } from "../auth/session";
import { getTenantDb } from "../db";
import { auditEvent, plan, planBranch, planTag, tag } from "../db/schema";
import { RequestError } from "../http";
import { getBranch } from "../tenant/branch";
import { requireTenant, type TenantContext } from "../tenant";
import { requireBillingSetupAdmin } from "./setup";
import { details } from "./domain";

const now = () => new Date();
const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");

function readName(value: unknown, maxLength = 120) {
	if (typeof value !== "string") throw new RequestError(400, "INVALID_INPUT");
	const name = value.trim().replace(/\s+/g, " ");
	if (!name || name.length > maxLength) throw new RequestError(400, "INVALID_INPUT");
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

function readTagNames(value: unknown) {
	if (value === undefined) return [];
	if (!Array.isArray(value) || value.length > 20) throw new RequestError(400, "INVALID_INPUT");
	const unique = new Map<string, string>();
	for (const item of value) {
		const name = readName(item, 40);
		unique.set(normalizeName(name), name);
	}
	return [...unique.values()];
}

async function validateBranches(env: Env, tenant: TenantContext, branchIds: string[]) {
	for (const branchId of branchIds) {
		if (!(await getBranch(env, tenant, branchId))) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	}
}

async function ensureActiveNameAvailable(env: Env, tenant: TenantContext, normalizedName: string, exceptId?: string) {
	const conditions = [eq(plan.organizationId, tenant.organizationId), eq(plan.normalizedName, normalizedName), eq(plan.isActive, true)];
	if (exceptId) conditions.push(ne(plan.id, exceptId));
	const [existing] = await getTenantDb(env, tenant.organizationId).select({ id: plan.id }).from(plan).where(and(...conditions)).limit(1);
	if (existing) throw new RequestError(409, "NAME_ALREADY_EXISTS");
}

async function resolveTags(env: Env, tenant: TenantContext, names: string[]) {
	if (!names.length) return [];
	const db = getTenantDb(env, tenant.organizationId);
	for (const name of names) {
		await db.insert(tag).values({
			id: crypto.randomUUID(),
			organizationId: tenant.organizationId,
			name,
			normalizedName: normalizeName(name),
			createdByUserId: tenant.userId,
		}).onConflictDoNothing();
	}
	const normalizedNames = names.map(normalizeName);
	const rows = await db.select({ id: tag.id, name: tag.name, normalizedName: tag.normalizedName })
		.from(tag)
		.where(and(eq(tag.organizationId, tenant.organizationId), inArray(tag.normalizedName, normalizedNames)));
	const byName = new Map(rows.map((row) => [row.normalizedName, row]));
	return normalizedNames.map((normalizedName) => byName.get(normalizedName)).filter((row): row is NonNullable<typeof row> => Boolean(row));
}

function readPlan(body: Record<string, unknown>, tenant: TenantContext, current?: typeof plan.$inferSelect, currentBranchIds: string[] = [], currentTagNames: string[] = []) {
	if (Object.keys(body).some((key) => !["name", "description", "amountMinor", "defaultDueDay", "branchIds", "tagNames", "isActive"].includes(key))) {
		throw new RequestError(400, "INVALID_INPUT");
	}
	const name = body.name === undefined && current ? current.name : readName(body.name);
	const description = body.description === undefined && current ? current.description : readDescription(body.description);
	const amountMinor = body.amountMinor === undefined && current ? current.amountMinor : body.amountMinor;
	const defaultDueDay = body.defaultDueDay === undefined && current ? current.defaultDueDay : body.defaultDueDay;
	if (!Number.isSafeInteger(amountMinor) || Number(amountMinor) <= 0 || !Number.isInteger(defaultDueDay) || Number(defaultDueDay) < 1 || Number(defaultDueDay) > 28) {
		throw new RequestError(400, "INVALID_INPUT");
	}
	if (!tenant.currency) throw new RequestError(409, "BILLING_SETTINGS_REQUIRED");
	return {
		name,
		normalizedName: normalizeName(name),
		description,
		amountMinor: Number(amountMinor),
		defaultDueDay: Number(defaultDueDay),
		branchIds: body.branchIds === undefined && current ? currentBranchIds : readBranchIds(body.branchIds),
		tagNames: body.tagNames === undefined && current ? currentTagNames : readTagNames(body.tagNames),
		isActive: readBoolean(body.isActive, current?.isActive ?? true),
		currency: tenant.currency,
	};
}

export async function listPlans(env: Env, request: Request) {
	const tenant = await requireTenant(env, request);
	const db = getTenantDb(env, tenant.organizationId);
	if (!tenant.allBranches && tenant.branchIds.length === 0) return { plans: [], tags: [] };
	const allowedBranches = tenant.allBranches ? undefined : tenant.branchIds;
	const branchLinks = await db.select({ planId: planBranch.planId, branchId: planBranch.branchId })
		.from(planBranch)
		.where(and(eq(planBranch.organizationId, tenant.organizationId), allowedBranches ? inArray(planBranch.branchId, allowedBranches) : undefined));
	const visibleIds = [...new Set(branchLinks.map((link) => link.planId))];
	const rows = await db.select().from(plan)
		.where(and(eq(plan.organizationId, tenant.organizationId), tenant.allBranches ? undefined : (visibleIds.length ? inArray(plan.id, visibleIds) : eq(plan.id, ""))))
		.orderBy(asc(plan.name));
	const planIds = rows.map((row) => row.id);
	const tagLinks = planIds.length
		? await db.select({ planId: planTag.planId, id: tag.id, name: tag.name })
			.from(planTag)
			.innerJoin(tag, eq(tag.id, planTag.tagId))
			.where(and(eq(planTag.organizationId, tenant.organizationId), inArray(planTag.planId, planIds)))
			.orderBy(asc(tag.name))
		: [];
	const tags = await db.select({ id: tag.id, name: tag.name }).from(tag)
		.where(eq(tag.organizationId, tenant.organizationId)).orderBy(asc(tag.name));
	return {
		plans: rows.map((row) => ({
			...row,
			branchIds: branchLinks.filter((link) => link.planId === row.id).map((link) => link.branchId),
			tags: tagLinks.filter((link) => link.planId === row.id).map(({ id, name }) => ({ id, name })),
		})),
		tags,
	};
}

export async function createPlan(env: Env, request: Request, body: Record<string, unknown>) {
	const tenant = await requireTenant(env, request);
	requireBillingSetupAdmin(tenant);
	const values = readPlan(body, tenant);
	await validateBranches(env, tenant, values.branchIds);
	await ensureActiveNameAvailable(env, tenant, values.normalizedName);
	const tags = await resolveTags(env, tenant, values.tagNames);
	const id = crypto.randomUUID();
	const db = getTenantDb(env, tenant.organizationId);
	await db.batch([
		db.insert(plan).values({
			id,
			organizationId: tenant.organizationId,
			name: values.name,
			normalizedName: values.normalizedName,
			description: values.description,
			amountMinor: values.amountMinor,
			currency: values.currency,
			frequency: "monthly",
			defaultDueDay: values.defaultDueDay,
			isActive: values.isActive,
			createdByUserId: tenant.userId,
		}),
		...values.branchIds.map((branchId) => db.insert(planBranch).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, planId: id, branchId })),
		...tags.map((resolvedTag) => db.insert(planTag).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, planId: id, tagId: resolvedTag.id })),
		db.insert(auditEvent).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, eventType: "plan.created", actorUserId: tenant.userId, subjectType: "plan", subjectId: id, detailsJson: details({ name: values.name, amountMinor: values.amountMinor, dueDay: values.defaultDueDay, branchIds: values.branchIds, tagNames: values.tagNames }) }),
	]);
	return { id, name: values.name, description: values.description, amountMinor: values.amountMinor, currency: values.currency, frequency: "monthly" as const, defaultDueDay: values.defaultDueDay, isActive: values.isActive, branchIds: values.branchIds, tags: tags.map(({ id: tagId, name }) => ({ id: tagId, name })) };
}

export async function updatePlan(env: Env, request: Request, id: string, body: Record<string, unknown>) {
	const tenant = await requireTenant(env, request);
	requireBillingSetupAdmin(tenant);
	const db = getTenantDb(env, tenant.organizationId);
	const [current] = await db.select().from(plan).where(and(eq(plan.id, id), eq(plan.organizationId, tenant.organizationId))).limit(1);
	if (!current) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	const currentTags = await db.select({ name: tag.name }).from(planTag).innerJoin(tag, eq(tag.id, planTag.tagId))
		.where(and(eq(planTag.organizationId, tenant.organizationId), eq(planTag.planId, id)));
	const currentBranches = await db.select({ id: planBranch.branchId }).from(planBranch)
		.where(and(eq(planBranch.organizationId, tenant.organizationId), eq(planBranch.planId, id)));
	const values = readPlan(body, tenant, current, currentBranches.map((row) => row.id), currentTags.map((row) => row.name));
	await validateBranches(env, tenant, values.branchIds);
	if (values.isActive) await ensureActiveNameAvailable(env, tenant, values.normalizedName, id);
	const tags = await resolveTags(env, tenant, values.tagNames);
	await db.batch([
		db.update(plan).set({ name: values.name, normalizedName: values.normalizedName, description: values.description, amountMinor: values.amountMinor, currency: values.currency, defaultDueDay: values.defaultDueDay, isActive: values.isActive, updatedAt: now() }).where(and(eq(plan.id, id), eq(plan.organizationId, tenant.organizationId))),
		db.delete(planBranch).where(and(eq(planBranch.planId, id), eq(planBranch.organizationId, tenant.organizationId))),
		db.delete(planTag).where(and(eq(planTag.planId, id), eq(planTag.organizationId, tenant.organizationId))),
		...values.branchIds.map((branchId) => db.insert(planBranch).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, planId: id, branchId })),
		...tags.map((resolvedTag) => db.insert(planTag).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, planId: id, tagId: resolvedTag.id })),
		db.insert(auditEvent).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, eventType: current.isActive !== values.isActive ? "plan.activation_changed" : "plan.updated", actorUserId: tenant.userId, subjectType: "plan", subjectId: id, detailsJson: details({ before: { name: current.name, amountMinor: current.amountMinor, dueDay: current.defaultDueDay, isActive: current.isActive, branchIds: currentBranches.map((row) => row.id), tagNames: currentTags.map((row) => row.name) }, after: { name: values.name, amountMinor: values.amountMinor, dueDay: values.defaultDueDay, isActive: values.isActive, branchIds: values.branchIds, tagNames: values.tagNames } }) }),
	]);
	return { id, name: values.name, description: values.description, amountMinor: values.amountMinor, currency: values.currency, frequency: "monthly" as const, defaultDueDay: values.defaultDueDay, isActive: values.isActive, branchIds: values.branchIds, tags: tags.map(({ id: tagId, name }) => ({ id: tagId, name })) };
}
