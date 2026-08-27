import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { getDb } from "../db";
import * as authSchema from "../db/auth-schema";
import { getEmailService } from "../email";
import { passwordResetEmail, verificationEmail } from "../email/messages";

/** Only the part of the Worker ExecutionContext this module needs. */
type BackgroundScheduler = {
	waitUntil(promise: Promise<unknown>): void;
};

/**
 * Better Auth runs on top of the existing Drizzle layer rather than the
 * built-in D1 adapter, so Drizzle stays the only schema/migration authority.
 * Bindings are per-request, so the instance is built per request.
 *
 * Passing the request's ExecutionContext lets Better Auth send email after the
 * response via waitUntil. Without it Better Auth awaits the send instead of
 * dropping it.
 */
export function getAuth(env: Env, ctx?: BackgroundScheduler) {
	const email = getEmailService(env);

	return betterAuth({
		baseURL: env.APP_URL,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(getDb(env), {
			provider: "sqlite",
			schema: authSchema,
		}),
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: true,
			sendResetPassword: async ({ user, url }) => {
				await email.send({ to: user.email, ...passwordResetEmail(url) });
			},
		},
		emailVerification: {
			sendOnSignUp: true,
			sendVerificationEmail: async ({ user, url }) => {
				await email.send({ to: user.email, ...verificationEmail(url) });
			},
		},
		...(ctx && {
			advanced: {
				backgroundTasks: { handler: (promise) => ctx.waitUntil(promise) },
			},
		}),
	});
}
