import { drizzle } from "drizzle-orm/d1";
import * as authSchema from "./auth-schema";
import * as schema from "./schema";

/** The single place where a D1 binding becomes a Drizzle instance. */
export function getDb(env: Env) {
	return drizzle(env.DB, { schema: { ...schema, ...authSchema } });
}

/**
 * Future abstraction point for per-tenant database routing.
 * Today every tenant shares the same D1 database.
 */
export function getTenantDb(env: Env) {
	return getDb(env);
}
