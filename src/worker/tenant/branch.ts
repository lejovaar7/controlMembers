import { and, eq } from "drizzle-orm";
import { AuthError, requireAuth } from "../auth/session";
import { getDb } from "../db";
import { team, teamMember } from "../db/auth-schema";
import { requireTenant, type TenantContext } from ".";

/**
 * A validated branch. A Better Auth team is a branch.
 *
 * Only ever produced from a session's activeTeamId after confirming the team
 * belongs to the active organization and the user may access it.
 */
export type BranchContext = {
	branchId: string;
	organizationId: string;
	name: string;
};

type BranchRow = {
	id: string;
	organizationId: string;
	name: string;
};

async function loadBranch(
	env: Env,
	branchId: string,
): Promise<BranchRow | null> {
	const [row] = await getDb(env)
		.select({
			id: team.id,
			organizationId: team.organizationId,
			name: team.name,
		})
		.from(team)
		.where(eq(team.id, branchId))
		.limit(1);

	return row ?? null;
}

/**
 * - a branch in another organization is never accessible
 * - owners and unrestricted admins reach every branch in their organization
 * - scoped admins and members reach only assigned branches
 */
async function isAccessible(
	env: Env,
	tenant: TenantContext,
	branch: BranchRow,
): Promise<boolean> {
	if (branch.organizationId !== tenant.organizationId) return false;
	if (tenant.allBranches) return true;

	const [assignment] = await getDb(env)
		.select({ id: teamMember.id })
		.from(teamMember)
		.where(
			and(eq(teamMember.teamId, branch.id), eq(teamMember.userId, tenant.userId)),
		)
		.limit(1);

	return Boolean(assignment);
}

/**
 * Branches the tenant may actually use.
 *
 * Better Auth's own endpoints do not match these semantics: listing an
 * organization's teams ignores assignment, and listing a user's teams ignores
 * the organization-wide reach of owner/admin. So this is derived here.
 */
export async function listAccessibleBranches(
	env: Env,
	tenant: TenantContext,
): Promise<BranchContext[]> {
	const db = getDb(env);

	const rows = tenant.allBranches
		? await db
				.select({
					id: team.id,
					organizationId: team.organizationId,
					name: team.name,
				})
				.from(team)
				.where(eq(team.organizationId, tenant.organizationId))
		: await db
				.select({
					id: team.id,
					organizationId: team.organizationId,
					name: team.name,
				})
				.from(team)
				.innerJoin(teamMember, eq(teamMember.teamId, team.id))
				.where(
					and(
						eq(team.organizationId, tenant.organizationId),
						eq(teamMember.userId, tenant.userId),
					),
				);

	return rows.map((row) => ({
		branchId: row.id,
		organizationId: row.organizationId,
		name: row.name,
	}));
}

/** The single source of truth for branch authorization. */
export async function canAccessBranch(
	env: Env,
	tenant: TenantContext,
	branchId: string,
): Promise<boolean> {
	const branch = await loadBranch(env, branchId);
	return branch ? await isAccessible(env, tenant, branch) : false;
}

/** Loads a branch the tenant is allowed to see, or null. */
export async function getBranch(
	env: Env,
	tenant: TenantContext,
	branchId: string,
): Promise<BranchContext | null> {
	const branch = await loadBranch(env, branchId);
	if (!branch || !(await isAccessible(env, tenant, branch))) return null;

	return {
		branchId: branch.id,
		organizationId: branch.organizationId,
		name: branch.name,
	};
}

/**
 * Resolves the active branch and verifies access. Every failure after
 * authentication reports the same way, so branches in other organizations are
 * never revealed.
 */
export async function requireBranch(
	env: Env,
	request: Request,
): Promise<BranchContext> {
	const session = await requireAuth(env, request);
	const tenant = await requireTenant(env, request);

	const branchId = session.session.activeTeamId;
	if (!branchId) throw new AuthError(403, "NO_ACTIVE_BRANCH");

	const branch = await getBranch(env, tenant, branchId);
	if (!branch) throw new AuthError(403, "BRANCH_ACCESS_DENIED");

	return branch;
}
