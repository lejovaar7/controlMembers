import { and, eq, isNotNull } from "drizzle-orm";
import { getAuth } from "../auth";
import { ensureProvisionedUser, sendAccountSetup } from "../auth/provisioning";
import { AuthError } from "../auth/session";
import { getTenantDb } from "../db";
import { account, member, team, teamMember, user } from "../db/auth-schema";
import { RequestError } from "../http";
import type { TenantContext } from ".";

export type MemberSummary = {
	membershipId: string;
	user: { id: string; name: string; email: string; };
	role: string;
	setupRequired: boolean;
	canManage: boolean;
	branchAccess: { kind: "all-branches"; } | { kind: "assigned-branches"; branchIds: string[]; };
};

/** Called only after the active Organization administration guard. */
export async function listMembers(env: Env, tenant: TenantContext): Promise<MemberSummary[]> {
	const db = getTenantDb(env, tenant.organizationId);
	const rows = await db.select({
		membershipId: member.id, role: member.role, emailVerified: user.emailVerified,
		user: { id: user.id, name: user.name, email: user.email },
	}).from(member).innerJoin(user, eq(user.id, member.userId))
		.where(eq(member.organizationId, tenant.organizationId)).orderBy(user.name, member.id);
	const assignments = await db.select({ userId: teamMember.userId, branchId: team.id })
		.from(teamMember).innerJoin(team, eq(team.id, teamMember.teamId))
		.where(eq(team.organizationId, tenant.organizationId));
	const credentials = await db.select({ userId: account.userId }).from(account)
		.innerJoin(member, eq(member.userId, account.userId))
		.where(and(eq(member.organizationId, tenant.organizationId), eq(account.providerId, "credential"), isNotNull(account.password)));
	return rows.map(({ emailVerified, ...row }) => ({
		...row,
		setupRequired: !emailVerified || !credentials.some((credential) => credential.userId === row.user.id),
		canManage: canManageMember(tenant, row.role),
		branchAccess: row.role === "owner" || row.role === "admin"
			? { kind: "all-branches" }
			: { kind: "assigned-branches", branchIds: assignments.filter((a) => a.userId === row.user.id).map((a) => a.branchId) },
	}));
}

export function canManageMember(tenant: TenantContext, role: string) {
	return (tenant.organizationRole === "owner" && ["admin", "member"].includes(role)) ||
		(tenant.organizationRole === "admin" && role === "member");
}

async function findMembership(env: Env, tenant: TenantContext, userId: string) {
	const [row] = await getTenantDb(env, tenant.organizationId).select().from(member)
		.where(and(eq(member.organizationId, tenant.organizationId), eq(member.userId, userId))).limit(1);
	return row ?? null;
}

export async function requireManageableMember(env: Env, tenant: TenantContext, membershipId: string) {
	const [row] = await getTenantDb(env, tenant.organizationId).select({ id: member.id, userId: user.id, email: user.email, role: member.role })
		.from(member).innerJoin(user, eq(user.id, member.userId))
		.where(and(eq(member.id, membershipId), eq(member.organizationId, tenant.organizationId))).limit(1);
	if (!row || !canManageMember(tenant, row.role)) throw new AuthError(404, "MEMBER_NOT_FOUND");
	return row;
}

export type AccessInput = { role: "admin" | "member"; branchIds: string[]; };

export async function validateAccessInput(env: Env, tenant: TenantContext, body: Record<string, unknown>): Promise<AccessInput> {
	if (body.role !== "admin" && body.role !== "member") throw new RequestError(400, "INVALID_ROLE");
	if (!Array.isArray(body.branchIds) || body.branchIds.length > 1000 || !body.branchIds.every((id) => typeof id === "string" && id.length > 0 && id.length <= 128)) {
		throw new RequestError(400, "INVALID_BRANCHES");
	}
	const branchIds = [...new Set(body.branchIds as string[])];
	if (body.role === "admin") {
		if (branchIds.length) throw new RequestError(400, "INVALID_BRANCHES");
	} else {
		if (!branchIds.length) throw new RequestError(400, "BRANCH_REQUIRED");
		const branches = await getTenantDb(env, tenant.organizationId).select({ id: team.id }).from(team)
			.where(eq(team.organizationId, tenant.organizationId));
		const validIds = new Set(branches.map((branch) => branch.id));
		if (!branchIds.every((id) => validIds.has(id))) throw new RequestError(400, "INVALID_BRANCHES");
	}
	return { role: body.role, branchIds };
}

export async function provisionMember(env: Env, request: Request, tenant: TenantContext, body: Record<string, unknown>) {
	if (Object.keys(body).some((key) => !["name", "email", "role", "branchIds"].includes(key))) throw new RequestError(400, "INVALID_INPUT");
	const access = await validateAccessInput(env, tenant, body);
	const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
	const name = typeof body.name === "string" ? body.name.trim() : "";
	if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || name.length > 200) throw new RequestError(400, "INVALID_INPUT");
	const identity = await ensureProvisionedUser(env, email, name);
	const auth = getAuth(env);
	let membership = await findMembership(env, tenant, identity.id);
	const alreadyMember = Boolean(membership);
	if (!membership) {
		try {
			// Server-only API; tenant authorization has already been established.
			await auth.api.addMember({ body: { userId: identity.id, organizationId: tenant.organizationId, role: access.role, ...(access.role === "member" ? { teamId: access.branchIds[0] } : {}) } });
		} catch (error) {
			if (!await findMembership(env, tenant, identity.id)) throw error;
		}
		membership = await findMembership(env, tenant, identity.id);
	}
	if (!membership) throw new Error("Membership provisioning failed");
	// POST never changes an existing role or removes access. Use the PATCH policy.
	if (membership.role !== access.role) throw new RequestError(409, "MEMBER_ALREADY_EXISTS");
	if (access.role === "member") {
		for (const branchId of access.branchIds) {
			await auth.api.addTeamMember({ headers: request.headers, body: { organizationId: tenant.organizationId, teamId: branchId, userId: identity.id } });
		}
	}
	return { membershipId: membership.id, alreadyMember, setupEmailStatus: await sendAccountSetup(env, email) };
}

export async function resendMemberSetup(env: Env, tenant: TenantContext, membershipId: string) {
	const target = await requireManageableMember(env, tenant, membershipId);
	return { setupEmailStatus: await sendAccountSetup(env, target.email) };
}

export async function updateMemberAccess(env: Env, request: Request, tenant: TenantContext, membershipId: string, body: Record<string, unknown>) {
	const target = await requireManageableMember(env, tenant, membershipId);
	if (Object.keys(body).some((key) => !["role", "branchIds"].includes(key))) throw new RequestError(400, "INVALID_INPUT");
	const access = await validateAccessInput(env, tenant, body);
	const auth = getAuth(env);
	if (access.role === "member") {
		const db = getTenantDb(env, tenant.organizationId);
		const previous = await db.select({ teamId: team.id }).from(teamMember)
			.innerJoin(team, eq(team.id, teamMember.teamId))
			.where(and(eq(team.organizationId, tenant.organizationId), eq(teamMember.userId, target.userId)));
		const add = async (teamId: string) => auth.api.addTeamMember({ headers: request.headers, body: { organizationId: tenant.organizationId, teamId, userId: target.userId } });
		// Validate everything, then add before removing. Downgrades keep the old
		// admin role until a nonempty member scope is ready. A failed call is retryable.
		for (const teamId of access.branchIds) await add(teamId);
		for (const { teamId } of previous) {
			if (access.branchIds.includes(teamId)) continue;
			try {
				await auth.api.removeTeamMember({ headers: request.headers, body: { organizationId: tenant.organizationId, teamId, userId: target.userId } });
			} catch (error) {
				// An identical concurrent request may already have removed this row.
				const [remaining] = await db.select({ id: teamMember.id }).from(teamMember).where(and(eq(teamMember.teamId, teamId), eq(teamMember.userId, target.userId))).limit(1);
				if (remaining) throw error;
			}
		}
		// Reaffirm desired access if overlapping edits removed a desired row.
		for (const teamId of access.branchIds) await add(teamId);
	}
	if (target.role !== access.role) await auth.api.updateMemberRole({ headers: request.headers, body: { organizationId: tenant.organizationId, memberId: target.id, role: access.role } });
	return { membershipId: target.id };
}
