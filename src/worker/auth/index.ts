import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins/organization";
import { getDb } from "../db";
import * as authSchema from "../db/auth-schema";
import { getEmailService } from "../email";
import {
	organizationInvitationEmail,
	passwordResetEmail,
	verificationEmail,
} from "../email/messages";

/** Only the part of the Worker ExecutionContext this module needs. */
type BackgroundScheduler = {
	waitUntil(promise: Promise<unknown>): void;
};

/** Optional settings every tenant may configure. */
const organizationSettingsFields = {
	locale: { type: "string", required: false },
	timezone: { type: "string", required: false },
	currency: { type: "string", required: false },
} as const;

/**
 * Better Auth runs on top of the existing Drizzle layer rather than the
 * built-in D1 adapter, so Drizzle stays the only schema/migration authority.
 * Bindings are per-request, so the instance is built per request.
 *
 * An organization is a tenant and a team is a branch. See CLAUDE.md.
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
		plugins: [
			organization({
				teams: { enabled: true, defaultTeam: { enabled: false } },
				requireEmailVerificationOnInvitation: true,
				schema: {
					organization: { additionalFields: organizationSettingsFields },
				},
				sendInvitationEmail: async (data) => {
					const url = `${env.APP_URL}/accept-invitation?invitationId=${data.id}`;
					await email.send({
						to: data.email,
						...organizationInvitationEmail(
							data.organization.name,
							data.inviter.user.name || data.inviter.user.email,
							url,
						),
					});
				},
			}),
		],
		...(ctx && {
			advanced: {
				backgroundTasks: { handler: (promise) => ctx.waitUntil(promise) },
			},
		}),
	});
}
