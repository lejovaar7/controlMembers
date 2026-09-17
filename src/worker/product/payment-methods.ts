import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { AuthError } from "../auth/session";
import { getTenantDb } from "../db";
import { auditEvent, payment, paymentMethod } from "../db/schema";
import { RequestError } from "../http";
import { requireTenant } from "../tenant";
import { details, normalizeText, readString } from "./domain";
import { canManageBillingSetup, requireBillingSetupAdmin } from "./setup";

export async function listPaymentMethods(env: Env, request: Request) {
	const tenant = await requireTenant(env, request);
	const db = getTenantDb(env, tenant.organizationId);
	const params = new URL(request.url).searchParams;
	const history = params.get("history") === "1";
	const includeInactive = history || params.get("inactive") === "1";
	const custom = await db.select().from(paymentMethod).where(and(eq(paymentMethod.organizationId, tenant.organizationId), includeInactive ? undefined : eq(paymentMethod.isActive, true))).orderBy(asc(paymentMethod.name));
	const methods: Array<{ id: string; name: string | null; isActive: boolean; readOnly: boolean }> = [{ id: "cash", name: null, isActive: true, readOnly: true }, ...custom.map(({ id, name, isActive }) => ({ id, name, isActive, readOnly: false }))];
	if (history) {
		const legacy = await db.selectDistinct({ id: payment.method }).from(payment).where(and(eq(payment.organizationId, tenant.organizationId), isNull(payment.paymentMethodId), ne(payment.method, "cash"), !tenant.allBranches ? inArray(payment.branchId, tenant.branchIds) : undefined));
		methods.push(...legacy.map(({ id }) => ({ id, name: null, isActive: false, readOnly: true })));
	}
	return { methods, canManage: canManageBillingSetup(tenant) };
}

function readName(value: unknown) {
	const name = readString(value, 80, true)!;
	if (["cash", "efectivo"].includes(normalizeText(name))) throw new RequestError(409, "PAYMENT_METHOD_NAME_EXISTS");
	return name;
}

export async function createPaymentMethod(env: Env, request: Request, body: Record<string, unknown>) {
	const tenant = await requireTenant(env, request);
	requireBillingSetupAdmin(tenant);
	const name = readName(body.name);
	const db = getTenantDb(env, tenant.organizationId);
	const id = crypto.randomUUID();
	const [created] = await db.insert(paymentMethod).values({ id, organizationId: tenant.organizationId, name, normalizedName: normalizeText(name) }).onConflictDoNothing().returning();
	if (!created) throw new RequestError(409, "PAYMENT_METHOD_NAME_EXISTS");
	await db.insert(auditEvent).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, eventType: "payment_method.created", actorUserId: tenant.userId, subjectType: "payment_method", subjectId: id, detailsJson: details({ name }) });
	return created;
}

export async function updatePaymentMethod(env: Env, request: Request, id: string, body: Record<string, unknown>) {
	const tenant = await requireTenant(env, request);
	requireBillingSetupAdmin(tenant);
	const db = getTenantDb(env, tenant.organizationId);
	const where = and(eq(paymentMethod.id, id), eq(paymentMethod.organizationId, tenant.organizationId));
	const [current] = await db.select().from(paymentMethod).where(where).limit(1);
	if (!current) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	if (body.isActive !== undefined && typeof body.isActive !== "boolean") throw new RequestError(400, "INVALID_INPUT");
	const name = body.name === undefined ? current.name : readName(body.name);
	const normalizedName = normalizeText(name);
	const [duplicate] = await db.select({ id: paymentMethod.id }).from(paymentMethod).where(and(eq(paymentMethod.organizationId, tenant.organizationId), eq(paymentMethod.normalizedName, normalizedName), ne(paymentMethod.id, id))).limit(1);
	if (duplicate) throw new RequestError(409, "PAYMENT_METHOD_NAME_EXISTS");
	const isActive = typeof body.isActive === "boolean" ? body.isActive : current.isActive;
	const [updated] = await db.batch([
		db.update(paymentMethod).set({ name, normalizedName, isActive }).where(where).returning(),
		db.insert(auditEvent).values({ id: crypto.randomUUID(), organizationId: tenant.organizationId, eventType: "payment_method.updated", actorUserId: tenant.userId, subjectType: "payment_method", subjectId: id, detailsJson: details({ before: { name: current.name, isActive: current.isActive }, after: { name, isActive } }) }),
	]);
	return updated[0];
}
