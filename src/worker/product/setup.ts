import { and, eq } from "drizzle-orm";
import { AuthError } from "../auth/session";
import { getDb, getTenantDb } from "../db";
import { organization } from "../db/auth-schema";
import { charge, payment } from "../db/schema";
import { RequestError } from "../http";
import { requireTenant, type TenantContext } from "../tenant";

export function canManageBillingSetup(tenant: TenantContext) {
	return tenant.organizationRole === "owner" || (tenant.organizationRole === "admin" && tenant.allBranches);
}

export function requireBillingSetupAdmin(tenant: TenantContext) {
	if (!canManageBillingSetup(tenant)) throw new AuthError(403, "NOT_BILLING_SETUP_ADMIN");
}

function readCurrency(value: unknown) {
	if (typeof value !== "string") throw new RequestError(400, "INVALID_CURRENCY");
	const currency = value.trim().toUpperCase();
	if (!/^[A-Z]{3}$/.test(currency)) throw new RequestError(400, "INVALID_CURRENCY");
	try {
		new Intl.NumberFormat("en", { style: "currency", currency }).format(0);
	} catch {
		throw new RequestError(400, "INVALID_CURRENCY");
	}
	return currency;
}

function readTimezone(value: unknown) {
	if (typeof value !== "string" || !value.trim() || value.length > 100) throw new RequestError(400, "INVALID_TIMEZONE");
	const timezone = value.trim();
	try {
		new Intl.DateTimeFormat("en", { timeZone: timezone }).format(0);
	} catch {
		throw new RequestError(400, "INVALID_TIMEZONE");
	}
	return timezone;
}

export async function getBillingSettings(env: Env, request: Request) {
	const tenant = await requireTenant(env, request);
	return {
		organizationId: tenant.organizationId,
		currency: tenant.currency,
		timezone: tenant.timezone,
		canEdit: canManageBillingSetup(tenant),
	};
}

export async function updateBillingSettings(env: Env, request: Request, body: Record<string, unknown>) {
	const tenant = await requireTenant(env, request);
	requireBillingSetupAdmin(tenant);
	if (Object.keys(body).some((key) => !["currency", "timezone"].includes(key)) || !("currency" in body) || !("timezone" in body)) {
		throw new RequestError(400, "INVALID_INPUT");
	}
	const currency = readCurrency(body.currency);
	const timezone = readTimezone(body.timezone);
	const expectedCompany = request.headers.get("X-Company-Context");
	if (expectedCompany !== null && expectedCompany !== tenant.organizationId) throw new RequestError(409, "WORKSPACE_CHANGED");
	if (tenant.currency && currency !== tenant.currency) {
		const db = getTenantDb(env, tenant.organizationId);
		const [existingCharge] = await db.select({ id: charge.id }).from(charge).where(eq(charge.organizationId, tenant.organizationId)).limit(1);
		const [existingPayment] = await db.select({ id: payment.id }).from(payment).where(eq(payment.organizationId, tenant.organizationId)).limit(1);
		if (existingCharge || existingPayment) throw new RequestError(409, "CURRENCY_LOCKED");
	}
	await getDb(env).update(organization).set({ currency, timezone }).where(and(eq(organization.id, tenant.organizationId)));
	return { organizationId: tenant.organizationId, currency, timezone, canEdit: true };
}
