import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { getDb } from "../db";
import * as authSchema from "../db/auth-schema";

/**
 * Better Auth runs on top of the existing Drizzle layer rather than the
 * built-in D1 adapter, so Drizzle stays the only schema/migration authority.
 * Bindings are per-request, so the instance is built per request.
 */
export function getAuth(env: Env) {
	return betterAuth({
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(getDb(env), {
			provider: "sqlite",
			schema: authSchema,
		}),
		emailAndPassword: {
			enabled: true,
		},
	});
}
