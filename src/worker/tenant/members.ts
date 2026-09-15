import { and, eq, isNotNull } from "drizzle-orm";
import { getAuth } from "../auth";
import { ensureProvisionedUser, sendAccountSetup } from "../auth/provisioning";
import { AuthError } from "../auth/session";
import { getTenantDb } from "../db";
import { account, member, team, teamMember, user } from "../db/auth-schema";
import { auditEvent } from "../db/schema";
import { RequestError } from "../http";
import { details } from "../product/domain";
import type { TenantContext } from ".";

type Membership = typeof member.$inferSelect;
export type MemberSummary = {
	membershipId: string;
	user: { id: string; name: string; email: string };
	role: string;
	isActive: boolean;
	canAppointAdmins: boolean;
	canReversePayments: boolean;
	canAdjustCharges: boolean;
	canViewReports: boolean;
	canExportFinancialData: boolean;
	setupRequired: boolean;
	canManage: boolean;
	scopeRestricted: boolean;
	branchAccess: { kind: "all-branches" } | { kind: "assigned-branches"; branchIds: string[] };
};

function hasAllBranches(target: Pick<Membership, "role" | "allBranches">) {
	return target.role === "owner" || (target.role === "admin" && target.allBranches);
}

/** Appointing an admin does not grant authority to edit peer admins or oneself. */
export function canManageMember(tenant: TenantContext, role: string) {
	return (tenant.organizationRole === "owner" && ["admin", "member"].includes(role)) ||
		(tenant.organizationRole === "admin" && role === "member");
}

function fullyWithinScope(tenant: TenantContext, target: Pick<Membership, "role" | "allBranches">, branchIds: string[]) {
	return tenant.allBranches || (!hasAllBranches(target) && branchIds.length > 0 && branchIds.every((id) => tenant.branchIds.includes(id)));
}

async function assignmentIds(env: Env, tenant: TenantContext, userId: string) {
	return (await getTenantDb(env, tenant.organizationId).select({ id: team.id }).from(team)
		.innerJoin(teamMember, eq(teamMember.teamId, team.id))
		.where(and(eq(team.organizationId, tenant.organizationId), eq(teamMember.userId, userId))))
		.map((row) => row.id);
}

/** Shared employees are read-only to scoped admins; foreign Branch IDs never leave the server. */
export async function listMembers(env: Env, tenant: TenantContext): Promise<MemberSummary[]> {
	const db = getTenantDb(env, tenant.organizationId);
	const rows = await db.select({
		membershipId: member.id, role: member.role, isActive: member.isActive,
		allBranches: member.allBranches, canAppointAdmins: member.canAppointAdmins,
		canReversePayments: member.canReversePayments, canAdjustCharges: member.canAdjustCharges,
		canViewReports: member.canViewReports, canExportFinancialData: member.canExportFinancialData,
		emailVerified: user.emailVerified, user: { id: user.id, name: user.name, email: user.email },
	}).from(member).innerJoin(user, eq(user.id, member.userId))
		.where(eq(member.organizationId, tenant.organizationId)).orderBy(user.name, member.id);
	const assignments = await db.select({ userId: teamMember.userId, branchId: team.id })
		.from(teamMember).innerJoin(team, eq(team.id, teamMember.teamId))
		.where(eq(team.organizationId, tenant.organizationId));
	const credentials = await db.select({ userId: account.userId }).from(account)
		.innerJoin(member, eq(member.userId, account.userId))
		.where(and(eq(member.organizationId, tenant.organizationId), eq(account.providerId, "credential"), isNotNull(account.password)));
	return rows.flatMap(({ emailVerified, allBranches, ...row }) => {
		const ids = assignments.filter((a) => a.userId === row.user.id).map((a) => a.branchId);
		const target = { role: row.role, allBranches };
		const visibleIds = tenant.allBranches ? ids : ids.filter((id) => tenant.branchIds.includes(id));
		if (!tenant.allBranches && row.user.id !== tenant.userId && (hasAllBranches(target) || visibleIds.length === 0)) return [];
		const scopeRestricted = !fullyWithinScope(tenant, target, ids);
		return [{
			...row,
			canAppointAdmins: row.role === "admin" && row.canAppointAdmins,
			canReversePayments: row.canReversePayments,
			canAdjustCharges: row.canAdjustCharges,
			canViewReports: row.canViewReports,
			canExportFinancialData: row.canExportFinancialData,
			setupRequired: !emailVerified || !credentials.some((credential) => credential.userId === row.user.id),
			canManage: row.user.id !== tenant.userId && canManageMember(tenant, row.role) && !scopeRestricted,
			scopeRestricted,
			branchAccess: hasAllBranches(target) ? { kind: "all-branches" as const } : { kind: "assigned-branches" as const, branchIds: visibleIds },
		}];
	});
}

async function findMembership(env: Env, tenant: TenantContext, userId: string) {
	const [row] = await getTenantDb(env, tenant.organizationId).select().from(member)
		.where(and(eq(member.organizationId, tenant.organizationId), eq(member.userId, userId))).limit(1);
	return row ?? null;
}

export async function requireManageableMember(env: Env, tenant: TenantContext, membershipId: string) {
	const [row] = await getTenantDb(env, tenant.organizationId).select({ membership: member, email: user.email })
		.from(member).innerJoin(user, eq(user.id, member.userId))
		.where(and(eq(member.id, membershipId), eq(member.organizationId, tenant.organizationId))).limit(1);
	if (!row || row.membership.userId === tenant.userId || !canManageMember(tenant, row.membership.role)) throw new AuthError(404, "MEMBER_NOT_FOUND");
	const branchIds = await assignmentIds(env, tenant, row.membership.userId);
	if (!fullyWithinScope(tenant, row.membership, branchIds)) throw new AuthError(404, "MEMBER_NOT_FOUND");
	return { ...row.membership, email: row.email, branchIds };
}

export type AccessInput = { role: "admin" | "member"; branchIds: string[]; allBranches: boolean; canAppointAdmins?: boolean; canReversePayments?: boolean; canAdjustCharges?: boolean; canViewReports?: boolean; canExportFinancialData?: boolean };

export async function validateAccessInput(env: Env, tenant: TenantContext, body: Record<string, unknown>): Promise<AccessInput> {
	if (body.role !== "admin" && body.role !== "member") throw new RequestError(400, "INVALID_ROLE");
	if (!Array.isArray(body.branchIds) || body.branchIds.length > 1000 || !body.branchIds.every((id) => typeof id === "string" && id.length > 0 && id.length <= 128)) throw new RequestError(400, "INVALID_BRANCHES");
	const optionalGrants = ["canReversePayments", "canAdjustCharges", "canViewReports", "canExportFinancialData"] as const;
	for (const key of ["allBranches", "canAppointAdmins", ...optionalGrants]) {
		if (key in body && typeof body[key] !== "boolean") throw new RequestError(400, "INVALID_INPUT");
	}
	const branchIds = [...new Set(body.branchIds as string[])];
	const allBranches = body.role === "admin" && (body.allBranches ?? true) === true;
	if (body.role === "member" && (body.allBranches === true || body.canAppointAdmins === true)) throw new RequestError(400, "INVALID_INPUT");
	if ("canAppointAdmins" in body && tenant.organizationRole !== "owner") throw new AuthError(403, "OWNER_PERMISSION_REQUIRED");
	if (optionalGrants.some((key) => key in body) && tenant.organizationRole !== "owner") throw new AuthError(403, "OWNER_PERMISSION_REQUIRED");
	if (body.role === "admin" && !tenant.canAppointAdmins) throw new AuthError(403, "ADMIN_APPOINTMENT_DENIED");
	if (allBranches) {
		if (branchIds.length) throw new RequestError(400, "INVALID_BRANCHES");
		if (!tenant.allBranches) throw new AuthError(403, "BRANCH_ACCESS_DENIED");
	} else {
		if (!branchIds.length) throw new RequestError(400, "BRANCH_REQUIRED");
		const branches = await getTenantDb(env, tenant.organizationId).select({ id: team.id }).from(team).where(eq(team.organizationId, tenant.organizationId));
		const validIds = new Set(branches.map((branch) => branch.id));
		if (!branchIds.every((id) => validIds.has(id))) throw new RequestError(400, "INVALID_BRANCHES");
		if (!tenant.allBranches && !branchIds.every((id) => tenant.branchIds.includes(id))) throw new AuthError(403, "BRANCH_ACCESS_DENIED");
	}
	return { role: body.role, branchIds, allBranches,
		...(typeof body.canAppointAdmins === "boolean" ? { canAppointAdmins: body.canAppointAdmins } : {}),
		...Object.fromEntries(optionalGrants.filter((key) => typeof body[key] === "boolean").map((key) => [key, body[key]])),
	};
}

export async function provisionMember(env: Env, request: Request, tenant: TenantContext, body: Record<string, unknown>) {
	if (Object.keys(body).some((key) => !["name", "email", "role", "branchIds", "allBranches", "canAppointAdmins", "canReversePayments", "canAdjustCharges", "canViewReports", "canExportFinancialData"].includes(key))) throw new RequestError(400, "INVALID_INPUT");
	const access = await validateAccessInput(env, tenant, body);
	const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
	const name = typeof body.name === "string" ? body.name.trim() : "";
	if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || name.length > 200) throw new RequestError(400, "INVALID_INPUT");
	const identity = await ensureProvisionedUser(env, email, name);
	const auth = getAuth(env);
	let membership = await findMembership(env, tenant, identity.id);
	let alreadyMember = Boolean(membership);
	if (!membership) {
		try {
			// Scope is inserted with the role; a new scoped admin is never briefly unrestricted.
			await auth.api.addMember({ body: {
				organizationId: tenant.organizationId, userId: identity.id, role: access.role,
				allBranches: access.allBranches, canAppointAdmins: access.canAppointAdmins ?? false,
				canReversePayments: access.canReversePayments ?? false, canAdjustCharges: access.canAdjustCharges ?? false,
				canViewReports: access.canViewReports ?? false, canExportFinancialData: access.canExportFinancialData ?? false,
				...(!access.allBranches ? { teamId: access.branchIds[0] } : {}),
			} });
		} catch (error) {
			if (!await findMembership(env, tenant, identity.id)) throw error;
			alreadyMember = true;
		}
		membership = await findMembership(env, tenant, identity.id);
	}
	if (!membership) throw new Error("Membership provisioning failed");
	if (!membership.isActive) throw new RequestError(409, "MEMBER_INACTIVE");
	if (identity.id === tenant.userId) throw new AuthError(403, "SELF_ACCESS_CHANGE_DENIED");
	if (membership.role !== access.role || hasAllBranches(membership) !== access.allBranches ||
		(access.canAppointAdmins !== undefined && membership.canAppointAdmins !== access.canAppointAdmins)) throw new RequestError(409, "MEMBER_ALREADY_EXISTS");
	const existingIds = await assignmentIds(env, tenant, identity.id);
	if (!fullyWithinScope(tenant, membership, existingIds)) throw new AuthError(403, "BRANCH_ACCESS_DENIED");
	if (alreadyMember && !canManageMember(tenant, membership.role)) {
		throw new RequestError(409, "MEMBER_ALREADY_EXISTS");
	}
	for (const teamId of access.branchIds) {
		await auth.api.addTeamMember({ headers: request.headers, body: { organizationId: tenant.organizationId, teamId, userId: identity.id } });
	}
	return { membershipId: membership.id, alreadyMember, setupEmailStatus: await sendAccountSetup(env, email, tenant.organizationId) };
}

export async function resendMemberSetup(env: Env, tenant: TenantContext, membershipId: string) {
	const target = await requireManageableMember(env, tenant, membershipId);
	if (!target.isActive) throw new RequestError(409, "MEMBER_INACTIVE");
	return { setupEmailStatus: await sendAccountSetup(env, target.email, tenant.organizationId) };
}

export async function updateMemberAccess(env: Env, request: Request, tenant: TenantContext, membershipId: string, body: Record<string, unknown>) {
	const target = await requireManageableMember(env, tenant, membershipId);
	if (Object.keys(body).some((key) => !["role", "branchIds", "allBranches", "canAppointAdmins", "canReversePayments", "canAdjustCharges", "canViewReports", "canExportFinancialData"].includes(key))) throw new RequestError(400, "INVALID_INPUT");
	const access = await validateAccessInput(env, tenant, body);
	const auth = getAuth(env);
	const db = getTenantDb(env, tenant.organizationId);
	if (!access.allBranches) {
		const add = async (teamId: string) => auth.api.addTeamMember({ headers: request.headers, body: { organizationId: tenant.organizationId, teamId, userId: target.userId } });
		for (const teamId of access.branchIds) await add(teamId);
		for (const teamId of target.branchIds) {
			if (access.branchIds.includes(teamId)) continue;
			try { await auth.api.removeTeamMember({ headers: request.headers, body: { organizationId: tenant.organizationId, teamId, userId: target.userId } }); }
			catch (error) {
				const [remaining] = await db.select({ id: teamMember.id }).from(teamMember).where(and(eq(teamMember.teamId, teamId), eq(teamMember.userId, target.userId)));
				if (remaining) throw error;
			}
		}
		for (const teamId of access.branchIds) await add(teamId);
	}
	await db.update(member).set({
		allBranches: access.allBranches,
		canAppointAdmins: access.role === "admin" ? access.canAppointAdmins ?? (target.role === "admin" && target.canAppointAdmins) : false,
		canReversePayments: access.canReversePayments ?? target.canReversePayments,
		canAdjustCharges: access.canAdjustCharges ?? target.canAdjustCharges,
		canViewReports: access.canViewReports ?? target.canViewReports,
		canExportFinancialData: access.canExportFinancialData ?? target.canExportFinancialData,
	}).where(and(eq(member.id, target.id), eq(member.organizationId, tenant.organizationId)));
	if (target.role !== access.role) await auth.api.updateMemberRole({ headers: request.headers, body: { organizationId: tenant.organizationId, memberId: target.id, role: access.role } });
	await db.insert(auditEvent).values({
		id: crypto.randomUUID(), organizationId: tenant.organizationId, eventType: "user.permissions_changed",
		actorUserId: tenant.userId, subjectType: "organization_member", subjectId: target.id,
		detailsJson: details({
			before: { role: target.role, allBranches: target.allBranches, branchIds: target.branchIds, canAppointAdmins: target.canAppointAdmins, canReversePayments: target.canReversePayments, canAdjustCharges: target.canAdjustCharges, canViewReports: target.canViewReports, canExportFinancialData: target.canExportFinancialData },
			after: { ...access, canAppointAdmins: access.role === "admin" ? access.canAppointAdmins ?? target.canAppointAdmins : false, canReversePayments: access.canReversePayments ?? target.canReversePayments, canAdjustCharges: access.canAdjustCharges ?? target.canAdjustCharges, canViewReports: access.canViewReports ?? target.canViewReports, canExportFinancialData: access.canExportFinancialData ?? target.canExportFinancialData },
		}),
	});
	return { membershipId: target.id };
}

/** No global ban, account deletion, session deletion or implicit reactivation. */
export async function updateMemberStatus(env: Env, tenant: TenantContext, membershipId: string, body: Record<string, unknown>) {
	const target = await requireManageableMember(env, tenant, membershipId);
	if (Object.keys(body).some((key) => key !== "isActive") || typeof body.isActive !== "boolean") throw new RequestError(400, "INVALID_INPUT");
	if (body.isActive && !hasAllBranches(target) && !target.branchIds.length) throw new RequestError(400, "BRANCH_REQUIRED");
	await getTenantDb(env, tenant.organizationId).update(member).set({ isActive: body.isActive })
		.where(and(eq(member.id, target.id), eq(member.organizationId, tenant.organizationId)));
	return { membershipId: target.id, isActive: body.isActive };
}
