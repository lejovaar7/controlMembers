import { requireOrganizationAdmin, requireTenant } from "../tenant";
import { canAccessBranch } from "../tenant/branch";
import { AuthError, requireAuth } from "./session";
import { readJsonObject, RequestError } from "../http";

/** Native Team endpoints may not bypass the active-tenant/access workflow. */
export async function enforceAuthHttpPolicy(env: Env, request: Request) {
	let path: string;
	try { path = decodeURIComponent(new URL(request.url).pathname).replace(/\/+$/, ""); }
	catch { throw new RequestError(400, "INVALID_INPUT"); }
	if (path === "/api/auth/organization/set-active-team") {
		const body = await readJsonObject(request.clone());
		if (body.teamId === null) { await requireAuth(env, request); return; }
		const tenant = await requireTenant(env, request);
		if (typeof body.teamId !== "string" || !await canAccessBranch(env, tenant, body.teamId)) throw new AuthError(403, "BRANCH_ACCESS_DENIED");
		return;
	}
	if (!["/api/auth/organization/add-team-member", "/api/auth/organization/create-team", "/api/auth/organization/update-team"].includes(path)) return;
	const tenant = await requireOrganizationAdmin(env, request);
	const body = await readJsonObject(request.clone());
	const data = typeof body.data === "object" && body.data !== null ? body.data as Record<string, unknown> : {};
	if ((body.organizationId && body.organizationId !== tenant.organizationId) || (data.organizationId && data.organizationId !== tenant.organizationId)) throw new AuthError(403, "BRANCH_ACCESS_DENIED");
	if (path.endsWith("/create-team") && !tenant.allBranches) throw new AuthError(403, "BRANCH_ACCESS_DENIED");
	if (path.endsWith("/update-team") && (Object.keys(data).some((key) => key !== "name") || typeof body.teamId !== "string" || !await canAccessBranch(env, tenant, body.teamId))) {
		throw new AuthError(403, "BRANCH_ACCESS_DENIED");
	}
	if (path.endsWith("/add-team-member") && (body.userId !== tenant.userId || typeof body.teamId !== "string" || !await canAccessBranch(env, tenant, body.teamId))) {
		throw new AuthError(403, "BRANCH_ACCESS_DENIED");
	}
}
