import { and, eq, isNotNull } from "drizzle-orm";
import { getAuth } from ".";
import { getDb } from "../db";
import { account, member, user } from "../db/auth-schema";
import { RequestError } from "../http";

export type SetupEmailStatus = "sent" | "not-required" | "failed";

export async function findUserByEmail(env: Env, email: string) {
	const [row] = await getDb(env).select({ id: user.id, email: user.email, emailVerified: user.emailVerified })
		.from(user).where(eq(user.email, email.trim().toLowerCase())).limit(1);
	return row ?? null;
}

/** A credential means a password account, not any unrelated provider row. */
export async function hasCredentialAccount(env: Env, userId: string): Promise<boolean> {
	const [row] = await getDb(env).select({ id: account.id }).from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, "credential"), isNotNull(account.password))).limit(1);
	return Boolean(row);
}

export async function ensureProvisionedUser(env: Env, email: string, name: string) {
	const normalized = email.trim().toLowerCase();
	const existing = await findUserByEmail(env, normalized);
	if (existing) return existing;
	if (!name.trim()) throw new RequestError(400, "NAME_REQUIRED");
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	const provisional = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
	try {
		await getAuth(env).api.createUser({ body: { email: normalized, name: name.trim(), password: provisional } });
	} catch (error) {
		const raced = await findUserByEmail(env, normalized);
		if (raced) return raced;
		throw error;
	}
	const created = await findUserByEmail(env, normalized);
	if (!created) throw new Error("Account provisioning failed");
	return created;
}

/** Includes interrupted setup: verified mailbox but no chosen password yet. */
export async function resendAccountSetup(env: Env, email: string, organizationId?: string): Promise<boolean> {
	const existing = await findUserByEmail(env, email);
	if (!existing || (existing.emailVerified && await hasCredentialAccount(env, existing.id))) return false;
	if (organizationId) {
		const [membership] = await getDb(env).select({ id: member.id }).from(member)
			.where(and(eq(member.userId, existing.id), eq(member.organizationId, organizationId), eq(member.isActive, true))).limit(1);
		if (!membership) return false;
	}
	await getAuth(env, undefined, { organizationId }).api.signInMagicLink({ body: { email: existing.email, callbackURL: "/setup-account" }, headers: new Headers() });
	return true;
}

/** Email failure does not roll back valid identity/access records. */
export async function sendAccountSetup(env: Env, email: string, organizationId?: string): Promise<SetupEmailStatus> {
	try { return await resendAccountSetup(env, email, organizationId) ? "sent" : "not-required"; }
	catch { return "failed"; }
}
