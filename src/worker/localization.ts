import { and, eq } from "drizzle-orm";
import { DEFAULT_LOCALE, isLocale, normalizeLocale, type Locale, type LocalePreferences } from "../shared/i18n";
import { requireAuth } from "./auth/session";
import { getDb } from "./db";
import { member, organization, user } from "./db/auth-schema";
import { RequestError } from "./http";
import { requireOrganizationAdmin } from "./tenant";

/** Strict writes; legacy/unsupported stored values are handled only on reads. */
export function readLocale(value: unknown): Locale | null {
	if (value === null || isLocale(value)) return value;
	throw new RequestError(400, "INVALID_LOCALE");
}

export function readRequiredLocale(value: unknown): Locale {
	if (isLocale(value)) return value;
	throw new RequestError(400, "INVALID_LOCALE");
}

function readPreference(body: Record<string, unknown>) {
	if (Object.keys(body).length !== 1 || !("locale" in body)) throw new RequestError(400, "INVALID_INPUT");
	return readLocale(body.locale);
}

export async function getLocalePreferences(env: Env, request: Request): Promise<LocalePreferences> {
	const session = await requireAuth(env, request);
	const db = getDb(env);
	const [account] = await db.select({ locale: user.locale }).from(user).where(eq(user.id, session.user.id)).limit(1);
	const activeId = session.session.activeOrganizationId;
	const [company] = activeId ? await db.select({ id: organization.id, locale: organization.locale, role: member.role })
		.from(member).innerJoin(organization, eq(organization.id, member.organizationId))
		.where(and(eq(member.userId, session.user.id), eq(member.organizationId, activeId), eq(member.isActive, true))).limit(1) : [];
	return {
		userLocale: normalizeLocale(account?.locale),
		organization: company ? { id: company.id, locale: normalizeLocale(company.locale) ?? DEFAULT_LOCALE, canEdit: company.role === "owner" || company.role === "admin" } : null,
	};
}

export async function updateUserLocale(env: Env, request: Request, body: Record<string, unknown>) {
	const session = await requireAuth(env, request);
	const locale = readPreference(body);
	await getDb(env).update(user).set({ locale, updatedAt: new Date() }).where(eq(user.id, session.user.id));
	return { locale };
}

export async function updateCompanyLocale(env: Env, request: Request, body: Record<string, unknown>) {
	const tenant = await requireOrganizationAdmin(env, request);
	if (Object.keys(body).length !== 1 || !("locale" in body)) throw new RequestError(400, "INVALID_INPUT");
	const locale = readRequiredLocale(body.locale);
	// A stale tab may share a session whose active company changed elsewhere.
	// This is a concurrency precondition, never a source of tenant authority.
	const expectedCompany = request.headers.get("X-Company-Context");
	if (expectedCompany !== null && expectedCompany !== tenant.organizationId) throw new RequestError(409, "WORKSPACE_CHANGED");
	// The active session + live membership supplies the tenant, never the body.
	await getDb(env).update(organization).set({ locale }).where(eq(organization.id, tenant.organizationId));
	return { organizationId: tenant.organizationId, locale };
}
