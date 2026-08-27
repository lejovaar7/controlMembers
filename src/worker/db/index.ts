import { drizzle } from "drizzle-orm/d1";
import * as authSchema from "./auth-schema";
import * as schema from "./schema";

/** The single place where a D1 binding becomes a Drizzle instance. */
export function getDb(env: Env) {
	return drizzle(env.DB, { schema: { ...schema, ...authSchema } });
}

/**
 * Database handle for one tenant.
 *
 * Every tenant shares one D1 database today, so this returns getDb(). The
 * organizationId is required so per-tenant routing can be introduced later
 * without touching call sites.
 *
 * Only ever call this with an organizationId from a validated TenantContext —
 * never with a value supplied by the client.
 */
export function getTenantDb(env: Env, organizationId: string) {
	void organizationId;
	return getDb(env);
}
