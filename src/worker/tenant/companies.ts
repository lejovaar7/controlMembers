import { and, asc, eq } from "drizzle-orm";
import { getAuth } from "../auth";
import { AuthError, requireAuth } from "../auth/session";
import { getDb } from "../db";
import { member, organization } from "../db/auth-schema";
import { RequestError } from "../http";

/** Only active memberships may appear in the workspace selector. */
export async function listCompanies(env: Env, request: Request) {
	const session = await requireAuth(env, request);
	return getDb(env).select({ id: organization.id, name: organization.name })
		.from(member).innerJoin(organization, eq(organization.id, member.organizationId))
		.where(and(eq(member.userId, session.user.id), eq(member.isActive, true)))
		.orderBy(asc(organization.name), asc(organization.id));
}

/** Identity remains usable in other companies after a membership is disabled. */
export async function selectCompany(env: Env, request: Request, body: Record<string, unknown>) {
	if (Object.keys(body).some((key) => key !== "organizationId") ||
		(typeof body.organizationId !== "string" && body.organizationId !== null)) {
		throw new RequestError(400, "INVALID_INPUT");
	}
	const session = await requireAuth(env, request);
	if (body.organizationId !== null) {
		const [membership] = await getDb(env).select({ id: member.id }).from(member)
			.where(and(eq(member.organizationId, body.organizationId), eq(member.userId, session.user.id), eq(member.isActive, true)));
		if (!membership) throw new AuthError(403, "COMPANY_ACCESS_DENIED");
	}
	const auth = getAuth(env);
	await auth.api.setActiveTeam({ headers: request.headers, body: { teamId: null } });
	await auth.api.setActiveOrganization({ headers: request.headers, body: { organizationId: body.organizationId } });
	return { organizationId: body.organizationId };
}
