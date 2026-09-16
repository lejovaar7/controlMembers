import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { AuthError, requirePlatformAdmin } from "../auth/session";
import { getDb } from "../db";
import { member, organization, team, user } from "../db/auth-schema";
import { auditEvent } from "../db/schema";
import { RequestError } from "../http";

const PAGE_SIZE = 20;

function fields(userId: string) {
	return {
		id: organization.id, name: organization.name, slug: organization.slug,
		locale: organization.locale, currency: organization.currency, timezone: organization.timezone,
		createdAt: organization.createdAt,
		branchCount: sql<number>`(select count(*) from team where team.organization_id = "organization"."id")`.mapWith(Number),
		activeUserCount: sql<number>`(select count(*) from member where member.organization_id = "organization"."id" and member.is_active = 1)`.mapWith(Number),
		canOpenWorkspace: sql<number>`exists(select 1 from member where member.organization_id = "organization"."id" and member.user_id = ${userId} and member.is_active = 1)`.mapWith(Boolean),
	};
}

async function owners(env: Env, ids: string[]) {
	if (!ids.length) return [];
	return getDb(env).select({
		organizationId: member.organizationId, id: user.id, name: user.name, email: user.email,
		isActive: member.isActive,
		setupRequired: sql<number>`(${user.emailVerified} = 0 or not exists(select 1 from account where account.user_id = ${user.id} and account.provider_id = 'credential' and account.password is not null))`.mapWith(Boolean),
	}).from(member).innerJoin(user, eq(user.id, member.userId))
		.where(and(inArray(member.organizationId, ids), eq(member.role, "owner")))
		.orderBy(asc(user.name), asc(user.id));
}

/** Platform directory: organization metadata only, never tenant financial data. */
export async function listPlatformOrganizations(env: Env, request: Request) {
	const session = await requirePlatformAdmin(env, request);
	const query = new URL(request.url).searchParams;
	const search = (query.get("search") ?? "").trim();
	const offset = Number(query.get("offset") ?? 0);
	if (search.length > 120 || !Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) throw new RequestError(400, "INVALID_INPUT");
	// instr treats wildcard characters literally and all values stay bound.
	const where = search ? sql`(instr(lower(${organization.name}), lower(${search})) > 0 or instr(lower(${organization.slug}), lower(${search})) > 0 or exists(select 1 from member m join user u on u.id = m.user_id where m.organization_id = "organization"."id" and m.role = 'owner' and (instr(lower(u.name), lower(${search})) > 0 or instr(lower(u.email), lower(${search})) > 0)))` : undefined;
	const db = getDb(env);
	const [rows, totals] = await Promise.all([
		db.select(fields(session.user.id)).from(organization).where(where).orderBy(desc(organization.createdAt), asc(organization.id)).limit(PAGE_SIZE).offset(offset),
		db.select({ total: count() }).from(organization).where(where),
	]);
	const ownerRows = await owners(env, rows.map((row) => row.id));
	const total = totals[0]?.total ?? 0;
	return { organizations: rows.map((row) => ({ ...row, owners: ownerRows.filter((owner) => owner.organizationId === row.id) })), total, nextOffset: offset + rows.length < total ? offset + rows.length : null };
}

export async function getPlatformOrganization(env: Env, request: Request, id: string) {
	const session = await requirePlatformAdmin(env, request);
	const db = getDb(env);
	const [company] = await db.select(fields(session.user.id)).from(organization).where(eq(organization.id, id)).limit(1);
	if (!company) throw new AuthError(404, "ORGANIZATION_NOT_FOUND");
	const [ownerRows, branches] = await Promise.all([
		owners(env, [id]),
		db.select({ id: team.id, name: team.name }).from(team).where(eq(team.organizationId, id)).orderBy(asc(team.name), asc(team.id)),
	]);
	return { ...company, owners: ownerRows, branches };
}

export async function renamePlatformOrganization(env: Env, request: Request, id: string, input: Record<string, unknown>) {
	const session = await requirePlatformAdmin(env, request);
	const name = typeof input.name === "string" ? input.name.trim() : "";
	if (!name || name.length > 200 || Object.keys(input).some((key) => key !== "name")) throw new RequestError(400, "INVALID_INPUT");
	const db = getDb(env);
	const [existing] = await db.select({ id: organization.id }).from(organization).where(eq(organization.id, id)).limit(1);
	if (!existing) throw new AuthError(404, "ORGANIZATION_NOT_FOUND");
	await db.batch([
		db.update(organization).set({ name }).where(eq(organization.id, id)),
		db.insert(auditEvent).values({ id: crypto.randomUUID(), organizationId: id, actorUserId: session.user.id, eventType: "platform.organization.renamed", subjectType: "organization", subjectId: id, detailsJson: JSON.stringify({ name }) }),
	]);
	return { id, name };
}
