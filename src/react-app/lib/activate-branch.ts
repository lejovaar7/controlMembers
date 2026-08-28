import { authClient } from "@/lib/auth-client";

/**
 * Makes a branch the active one.
 *
 * Better Auth's setActiveTeam requires a team_member row even for an owner,
 * while our access rules give owner/admin every branch in their organization
 * without one. So when activation is refused we add the membership Better Auth
 * expects and retry. The row grants nothing the role did not already allow, and
 * the backend still decides whether the call is permitted.
 */
export async function activateBranch(
	branchId: string,
	userId: string,
): Promise<boolean> {
	const first = await authClient.organization.setActiveTeam({
		teamId: branchId,
	});
	if (!first.error) return true;

	const added = await authClient.organization.addTeamMember({
		teamId: branchId,
		userId,
	});
	if (added.error) return false;

	const retry = await authClient.organization.setActiveTeam({
		teamId: branchId,
	});
	return !retry.error;
}
