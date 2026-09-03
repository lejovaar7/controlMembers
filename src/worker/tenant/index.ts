import { and, eq } from "drizzle-orm";
import { AuthError, requireAuth } from "../auth/session";
import { getDb } from "../db";
import { member, organization, team, teamMember } from "../db/auth-schema";

/** Administration is independent from the administrator's Branch scope. */
const ORGANIZATION_ADMIN_ROLES = new Set(["owner", "admin"]);

/**
 * A validated tenant. An organization is the tenant.
 *
 * Only ever produced from a Better Auth session's activeOrganizationId after
 * confirming membership — never from client-supplied input.
 */
export type TenantContext = {
	userId: string;
	organizationId: string;
	organizationName: string;
	organizationRole: string;
	membershipId: string;
	allBranches: boolean;
	canAppointAdmins: boolean;
	branchIds: string[];
	locale: string | null;
	timezone: string | null;
	currency: string | null;
};

export function isOrganizationAdmin(context: TenantContext) {
	return ORGANIZATION_ADMIN_ROLES.has(context.organizationRole);
}

/**
 * Resolves the active organization for the request, or null when the user has
 * no active organization selected or is no longer a member of it.
 */
export async function getCurrentTenant(
	env: Env,
	request: Request,
): Promise<TenantContext | null> {
	const session = await requireAuth(env, request);
	const organizationId = session.session.activeOrganizationId;
	if (!organizationId) return null;

	const db = getDb(env);
	const [row] = await db
		.select({
			membershipId: member.id,
			name: organization.name,
			role: member.role,
			allBranches: member.allBranches,
			canAppointAdmins: member.canAppointAdmins,
			locale: organization.locale,
			timezone: organization.timezone,
			currency: organization.currency,
		})
		.from(member)
		.innerJoin(organization, eq(organization.id, member.organizationId))
		.where(
			and(
				eq(member.organizationId, organizationId),
				eq(member.userId, session.user.id),
				eq(member.isActive, true),
			),
		)
		.limit(1);

	// Membership may have been revoked after the organization became active.
	if (!row) return null;
	const allBranches = row.role === "owner" || (row.role === "admin" && row.allBranches);
	const assignments = allBranches ? [] : await db.select({ id: team.id }).from(team)
		.innerJoin(teamMember, eq(teamMember.teamId, team.id))
		.where(and(eq(team.organizationId, organizationId), eq(teamMember.userId, session.user.id)));

	return {
		userId: session.user.id,
		organizationId,
		organizationName: row.name,
		organizationRole: row.role,
		membershipId: row.membershipId,
		allBranches,
		canAppointAdmins: row.role === "owner" || (row.role === "admin" && row.canAppointAdmins),
		branchIds: assignments.map((branch) => branch.id),
		locale: row.locale,
		timezone: row.timezone,
		currency: row.currency,
	};
}

/** Requires a validated active organization. */
export async function requireTenant(
	env: Env,
	request: Request,
): Promise<TenantContext> {
	const tenant = await getCurrentTenant(env, request);
	if (!tenant) throw new AuthError(403, "NO_ACTIVE_ORGANIZATION");
	return tenant;
}

/** Organization administration is unrelated to platform user.role. */
export async function requireOrganizationAdmin(env: Env, request: Request) {
	const tenant = await requireTenant(env, request);
	if (!isOrganizationAdmin(tenant)) throw new AuthError(403, "NOT_ORGANIZATION_ADMIN");
	return tenant;
}
