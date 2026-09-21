import { createExecutionContext, env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import worker from "../src/worker";
import { getAuth } from "../src/worker/auth";
import { getDb } from "../src/worker/db";
import { user } from "../src/worker/db/auth-schema";
import { customerMember } from "../src/worker/db/schema";
import { requireTenant } from "../src/worker/tenant";
import { normalizeText } from "../src/worker/product/domain";

export const TEST_PASSWORD = "TestOnlyPassword123!";
export type Actor = { userId: string; email: string; headers: Headers };

/** Existing/imported member fixture without an enrollment; new manual signup requires a plan. */
export async function seedLegacyMember(actor: Actor, input: { displayName: string; primaryBranchId: string; phoneE164?: string | null }) {
	const tenant = await requireTenant(env, new Request("http://localhost:5173", { headers: actor.headers }));
	const id = crypto.randomUUID();
	await getDb(env).insert(customerMember).values({ ...input, id, organizationId: tenant.organizationId, normalizedName: normalizeText(input.displayName), createdByUserId: actor.userId });
	return { id };
}

export async function createActor(email: string, platformAdmin = false): Promise<Actor> {
	const auth = getAuth(env);
	await auth.api.createUser({ body: { email, name: email, password: TEST_PASSWORD, ...(platformAdmin ? { role: "admin" as const } : {}) } });
	await getDb(env).update(user).set({ emailVerified: true }).where(eq(user.email, email));
	const [row] = await getDb(env).select({ id: user.id }).from(user).where(eq(user.email, email));
	const response = await auth.api.signInEmail({ body: { email, password: TEST_PASSWORD }, asResponse: true });
	if (!row || !response.headers.get("set-cookie")) throw new Error("Test actor was not created");
	return { userId: row.id, email, headers: new Headers({ cookie: response.headers.get("set-cookie")! }) };
}

export function callApi(path: string, actor?: Actor, body?: unknown, method = body === undefined ? "GET" : "POST") {
	const headers = new Headers(actor?.headers);
	headers.set("Content-Type", "application/json");
	headers.set("Origin", "http://localhost:5173");
	return worker.fetch(new Request(`http://localhost:5173${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env, createExecutionContext());
}
