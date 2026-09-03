import { and, eq } from "drizzle-orm";
import { DEFAULT_LOCALE, normalizeLocale, type Locale } from "../../shared/i18n";
import { getDb } from "../db";
import { member, organization, user } from "../db/auth-schema";

/** Company context is supplied by guarded server workflows, never request metadata. */
export type EmailLocaleContext = { organizationId?: string; fallbackLocale?: unknown };

export async function resolveEmailLocale(env: Env, email: string, context: EmailLocaleContext = {}): Promise<Locale> {
	const db = getDb(env);
	const [recipient] = await db.select({ id: user.id, locale: user.locale }).from(user)
		.where(eq(user.email, email.trim().toLowerCase())).limit(1);
	const preference = normalizeLocale(recipient?.locale);
	if (preference) return preference;
	if (recipient) {
		const companies = await db.select({ locale: organization.locale }).from(member)
			.innerJoin(organization, eq(organization.id, member.organizationId))
			.where(and(eq(member.userId, recipient.id), eq(member.isActive, true),
				context.organizationId ? eq(member.organizationId, context.organizationId) : undefined)).limit(2);
		// Without an explicit context, selecting an arbitrary tenant would be wrong.
		if (companies.length === 1) return normalizeLocale(companies[0].locale) ?? DEFAULT_LOCALE;
	}
	return normalizeLocale(context.fallbackLocale) ?? DEFAULT_LOCALE;
}

/** Invitations precede membership; Better Auth has already authorized this company. */
export async function resolveInvitationLocale(env: Env, email: string, companyId: string): Promise<Locale> {
	const [recipient] = await getDb(env).select({ locale: user.locale }).from(user)
		.where(eq(user.email, email.trim().toLowerCase())).limit(1);
	const [company] = await getDb(env).select({ locale: organization.locale }).from(organization).where(eq(organization.id, companyId)).limit(1);
	return normalizeLocale(recipient?.locale) ?? normalizeLocale(company?.locale) ?? DEFAULT_LOCALE;
}

/** Carry presentation language through Better Auth's own callback; never alter tokens. */
export function localizedAuthUrl(value: string, locale: Locale): string {
	const url = new URL(value);
	for (const key of ["callbackURL", "newUserCallbackURL", "errorCallbackURL"]) {
		const callback = url.searchParams.get(key);
		if (!callback) continue;
		const target = new URL(callback, url.origin);
		if (target.origin !== url.origin) continue;
		target.searchParams.set("lang", locale);
		url.searchParams.set(key, target.toString());
	}
	return url.toString();
}
