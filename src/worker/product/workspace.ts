import { eq, inArray, type AnyColumn } from "drizzle-orm";
import { AuthError, requireAuth } from "../auth/session";
import { requireTenant, type TenantContext } from "../tenant";
import { getBranch } from "../tenant/branch";

/** Workspace selection narrows product data without changing administrative rights. */
export async function requireWorkspaceTenant(env: Env, request: Request): Promise<TenantContext> {
	const tenant = await requireTenant(env, request);
	const session = await requireAuth(env, request);
	const activeBranchId = session.session.activeTeamId ?? null;
	if (activeBranchId && !(await getBranch(env, tenant, activeBranchId))) {
		throw new AuthError(403, "BRANCH_ACCESS_DENIED");
	}
	return { ...tenant, activeBranchId };
}

export function inWorkspace(tenant: TenantContext, branchId: string) {
	return (!tenant.activeBranchId || tenant.activeBranchId === branchId)
		&& (tenant.allBranches || tenant.branchIds.includes(branchId));
}

export function workspaceCondition(tenant: TenantContext, column: AnyColumn) {
	if (tenant.activeBranchId) return eq(column, tenant.activeBranchId);
	return tenant.allBranches ? undefined : (tenant.branchIds.length ? inArray(column, tenant.branchIds) : eq(column, ""));
}
