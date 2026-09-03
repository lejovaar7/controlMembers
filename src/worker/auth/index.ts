import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { admin } from "better-auth/plugins/admin";
import { magicLink } from "better-auth/plugins/magic-link";
import { organization } from "better-auth/plugins/organization";
import { getDb } from "../db";
import * as authSchema from "../db/auth-schema";
import { getEmailService } from "../email";
import {
	accountSetupEmail,
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
	const emailService = getEmailService(env);

	return betterAuth({
		// Browser endpoints that bypass the starter's guarded access workflows.
		// Better Auth's server-only API remains available to authorized features.
		disabledPaths: [
			"/organization/get-full-organization", "/organization/list-members",
			"/organization/get-active-member-role",
			"/organization/list-teams", "/organization/list-team-members", "/organization/list-user-teams",
			"/organization/update-member-role", "/organization/remove-team-member",
			"/organization/remove-member", "/organization/leave", "/organization/remove-team",
			"/organization/delete", "/organization/invite-member", "/organization/accept-invitation",
			"/organization/reject-invitation", "/organization/cancel-invitation",
			"/organization/get-invitation", "/organization/list-invitations", "/organization/list-user-invitations",
			"/organization/update", // Settings editing is intentionally deferred.
		],
		baseURL: env.APP_URL,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(getDb(env), {
			provider: "sqlite",
			schema: authSchema,
		}),
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: true,
			// Closed SaaS: accounts are provisioned, never self-registered.
			disableSignUp: true,
			sendResetPassword: async ({ user, url }) => {
				await emailService.send({ to: user.email, ...passwordResetEmail(url) });
			},
		},
		emailVerification: {
			sendOnSignUp: true,
			sendVerificationEmail: async ({ user, url }) => {
				await emailService.send({ to: user.email, ...verificationEmail(url) });
			},
		},
		plugins: [
			// Platform scope. user.role === "admin" is a platform administrator,
			// which is unrelated to an organization's member.role.
			admin(),
			// Used only for controlled account activation. Signup is disabled, so
			// a link can never bring a brand new account into existence.
			magicLink({
				disableSignUp: true,
				sendMagicLink: async ({ email, url }) => {
					await emailService.send({ to: email, ...accountSetupEmail(url) });
				},
			}),
			organization({
				// Tenants are provisioned by a platform admin. The server-side
				// creation path (no session + userId) stays available.
				allowUserToCreateOrganization: false,
				teams: { enabled: true, defaultTeam: { enabled: false } },
				organizationHooks: {
					beforeCreateTeam: async ({ team }) => {
						const name = team.name.trim();
						if (!name || name.length > 100) throw new APIError("BAD_REQUEST", { message: "Invalid branch name" });
						return { data: { ...team, name } };
					},
					beforeUpdateTeam: async ({ updates }) => {
						const name = updates.name?.trim();
						if (!name || name.length > 100) throw new APIError("BAD_REQUEST", { message: "Invalid branch name" });
						return { data: { ...updates, name } };
					},
				},
				requireEmailVerificationOnInvitation: true,
				schema: {
					organization: { additionalFields: organizationSettingsFields },
				},
				sendInvitationEmail: async (data) => {
					const url = `${env.APP_URL}/accept-invitation?invitationId=${data.id}`;
					await emailService.send({
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
