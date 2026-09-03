import { authClient } from "@/lib/auth-client";

/**
 * Makes a branch the active one.
 *
 * Better Auth's setActiveTeam requires a team_member row even for an owner,
 * while our access rules give owners/unrestricted admins every company branch
 * without one. So when activation is refused we add the membership Better Auth
 * expects and retry. The row grants nothing the existing scope did not allow, and
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
