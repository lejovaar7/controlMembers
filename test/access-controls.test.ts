import { env } from "cloudflare:test";
import { and, eq, inArray } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getAuth } from "../src/worker/auth";
import { getDb } from "../src/worker/db";
import { account, member, teamMember, user } from "../src/worker/db/auth-schema";
import { requireTenant } from "../src/worker/tenant";
import { requireBranch } from "../src/worker/tenant/branch";
import type { MemberSummary } from "../src/worker/tenant/members";
import { companySelection } from "../src/react-app/lib/companies";
import { callApi, createActor, TEST_PASSWORD, type Actor } from "./helpers";

let owner: Actor;
let general: Actor;
let scoped: Actor;
let delegated: Actor;
let employee: Actor;
let shared: Actor;
let outside: Actor;
let otherOwner: Actor;
let multi: Actor;
let orgId: string;
let otherId: string;
let north: string;
let south: string;
let otherBranch: string;

async function membership(actor: Actor, companyId = orgId) {
	const [row] = await getDb(env).select().from(member).where(and(eq(member.userId, actor.userId), eq(member.organizationId, companyId)));
	if (!row) throw new Error("Missing test membership");
	return row;
}

async function directory(actor = owner) {
	const response = await callApi("/api/members", actor);
	expect(response.status).toBe(200);
	return (await response.json() as { members: MemberSummary[] }).members;
}

function createInput(email: string, role: "admin" | "member" = "member", branchIds = [north]) {
	return { name: email, email, role, allBranches: role === "admin" && branchIds.length === 0, branchIds };
}

beforeAll(async () => {
	[owner, general, scoped, delegated, employee, shared, outside, otherOwner, multi] = await Promise.all(
		["owner", "general", "scoped", "delegated", "employee", "shared", "outside", "other-owner", "multi"].map((name) => createActor(`access-${name}@test.invalid`)),
	);
	const auth = getAuth(env);
	orgId = (await auth.api.createOrganization({ body: { name: "Access A", slug: "access-a", userId: owner.userId } }))!.id;
	otherId = (await auth.api.createOrganization({ body: { name: "Access B", slug: "access-b", userId: otherOwner.userId } }))!.id;
	north = (await auth.api.createTeam({ body: { name: "North", organizationId: orgId } })).id;
	south = (await auth.api.createTeam({ body: { name: "South", organizationId: orgId } })).id;
	otherBranch = (await auth.api.createTeam({ body: { name: "Other branch", organizationId: otherId } })).id;
	for (const actor of [general, scoped, delegated, employee, shared, outside, multi]) {
		await auth.api.addMember({ body: {
			userId: actor.userId, organizationId: orgId,
			role: [general, scoped, delegated].includes(actor) ? "admin" : "member",
			allBranches: actor === general, canAppointAdmins: actor === delegated,
			teamId: actor === outside ? south : north,
		} });
	}
	await auth.api.addMember({ body: { userId: multi.userId, organizationId: otherId, role: "member", teamId: otherBranch } });
	await auth.api.addTeamMember({ headers: owner.headers, body: { organizationId: orgId, userId: shared.userId, teamId: south } });
});

beforeEach(async () => {
	const auth = getAuth(env);
	await getDb(env).update(member).set({ isActive: true }).where(inArray(member.organizationId, [orgId, otherId]));
	for (const actor of [general, scoped, delegated]) {
		await getDb(env).update(member).set({ role: "admin", allBranches: actor === general, canAppointAdmins: actor === delegated })
			.where(and(eq(member.userId, actor.userId), eq(member.organizationId, orgId)));
	}
	for (const actor of [owner, general, scoped, delegated, employee, shared, outside, multi]) {
		await auth.api.setActiveOrganization({ headers: actor.headers, body: { organizationId: orgId } });
	}
	await auth.api.setActiveOrganization({ headers: otherOwner.headers, body: { organizationId: otherId } });
});

describe("owner-controlled administrator appointment", () => {
	it("denies appointment by default before creating any identity", async () => {
		const input = createInput("denied-admin@test.invalid", "admin", []);
		expect((await callApi("/api/members", general, input)).status).toBe(403);
		expect(await getDb(env).select().from(user).where(eq(user.email, input.email))).toHaveLength(0);
		expect((await membership(general)).canAppointAdmins).toBe(false);
	});
	it("lets only the owner grant and revoke the permission, effective on the next request", async () => {
		const target = await membership(general);
		const access = { role: "admin", branchIds: [], allBranches: true, canAppointAdmins: true };
		expect((await callApi(`/api/members/${target.id}`, owner, access, "PATCH")).status).toBe(200);
		const response = await callApi("/api/members", general, createInput("delegated-created@test.invalid", "admin", []));
		expect(response.status).toBe(200);
		const created = (await directory()).find((entry) => entry.user.email === "delegated-created@test.invalid")!;
		expect(created.canAppointAdmins).toBe(false);
		expect((await callApi(`/api/members/${target.id}`, owner, { ...access, canAppointAdmins: false }, "PATCH")).status).toBe(200);
		expect((await callApi("/api/members", general, createInput("revoked-created@test.invalid", "admin", []))).status).toBe(403);
	});
	it("prevents self delegation, delegation to peers, and editing peer admins", async () => {
		const self = await membership(delegated);
		const peer = await membership(scoped);
		const input = { role: "admin", branchIds: [north], allBranches: false, canAppointAdmins: true };
		for (const target of [self, peer]) expect((await callApi(`/api/members/${target.id}`, delegated, input, "PATCH")).status).toBe(404);
		expect((await callApi("/api/members", delegated, { ...createInput("cannot-delegate@test.invalid", "admin"), canAppointAdmins: true })).status).toBe(403);
	});
	it("allows promotion only with delegation and never passes the delegation permission on", async () => {
		const target = await createActor("promotion-target@test.invalid");
		expect((await callApi("/api/members", owner, createInput(target.email))).status).toBe(200);
		const row = await membership(target);
		const input = { role: "admin", allBranches: false, branchIds: [north] };
		expect((await callApi(`/api/members/${row.id}`, scoped, input, "PATCH")).status).toBe(403);
		expect((await callApi(`/api/members/${row.id}`, delegated, input, "PATCH")).status).toBe(200);
		expect(await membership(target)).toMatchObject({ role: "admin", allBranches: false, canAppointAdmins: false });
		expect((await callApi(`/api/members/${row.id}`, delegated, { role: "member", branchIds: [north] }, "PATCH")).status).toBe(404);
	});
	it("does not carry delegated authority into another company", async () => {
		await getAuth(env).api.addMember({ body: { userId: delegated.userId, organizationId: otherId, role: "admin" } });
		expect((await callApi("/api/companies/active", delegated, { organizationId: otherId })).status).toBe(200);
		expect((await callApi("/api/members", delegated, createInput("other-company-appointment@test.invalid", "admin", []))).status).toBe(403);
	});
	it("does not let a repeated provision expand a peer administrator's branches", async () => {
		await getDb(env).update(member).set({ canAppointAdmins: true }).where(eq(member.id, (await membership(general)).id));
		const send = vi.mocked(env.EMAIL.send);
		send.mockClear();
		expect((await callApi("/api/members", general, createInput(scoped.email, "admin", [north]))).status).toBe(409);
		expect((await callApi("/api/members", general, createInput(scoped.email, "admin", [north, south]))).status).toBe(409);
		expect(send).not.toHaveBeenCalled();
		expect(await getDb(env).select().from(teamMember).where(and(eq(teamMember.userId, scoped.userId), eq(teamMember.teamId, south)))).toHaveLength(0);
	});
	it("does not inherit a dormant admin-appointment flag when promoting a member", async () => {
		const target = await createActor("dormant-grant@test.invalid");
		expect((await callApi("/api/members", owner, createInput(target.email))).status).toBe(200);
		const row = await membership(target);
		await getDb(env).update(member).set({ canAppointAdmins: true }).where(eq(member.id, row.id));
		expect((await callApi(`/api/members/${row.id}`, delegated, { role: "admin", allBranches: false, branchIds: [north] }, "PATCH")).status).toBe(200);
		expect((await membership(target)).canAppointAdmins).toBe(false);
	});
	it("validates permission flags and rejects native member-write bypasses", async () => {
		for (const extra of [{ canAppointAdmins: "true" }, { allBranches: "false" }, { isActive: true }, { canAppointAdmins: true }]) {
			expect((await callApi("/api/members", owner, { ...createInput("invalid-permissions@test.invalid"), ...extra })).status).toBe(400);
		}
		for (const path of ["add-member", "update-member-role"]) {
			expect((await callApi(`/api/auth/organization/${path}`, delegated, { userId: scoped.userId, role: "admin", allBranches: true, canAppointAdmins: true })).status).toBe(404);
		}
	});
});

describe("administrator Branch scope", () => {
	it("shows scoped admins only assigned branches and permits renaming only those", async () => {
		const body = await (await callApi("/api/branches", scoped)).json() as { branches: { id: string }[]; permissions: { allBranches: boolean } };
		expect(body.branches.map((branch) => branch.id)).toEqual([north]);
		expect(body.permissions.allBranches).toBe(false);
		expect((await callApi("/api/auth/organization/update-team", scoped, { teamId: north, data: { name: "North updated" } })).status).toBe(200);
		for (const teamId of [south, otherBranch]) expect((await callApi("/api/auth/organization/update-team", scoped, { teamId, data: { name: "Not allowed" } })).status).toBe(403);
		expect((await callApi("/api/auth/organization/create-team", scoped, { name: "New branch", organizationId: orgId })).status).toBe(403);
	});
	it("does not permit activating or self-assigning an unauthorized branch", async () => {
		for (const teamId of [south, otherBranch]) {
			expect((await callApi("/api/auth/organization/set-active-team", scoped, { teamId })).status).toBe(403);
			expect((await callApi("/api/auth/organization/add-team-member", scoped, { teamId, userId: scoped.userId, organizationId: orgId })).status).toBe(403);
		}
		expect((await callApi("/api/auth/organization/set-active-team", scoped, { teamId: north })).status).toBe(200);
	});
	it("creates scoped admins atomically and cannot grant all-branch or wider access", async () => {
		const input = createInput("new-scoped-admin@test.invalid", "admin");
		expect((await callApi("/api/members", delegated, input)).status).toBe(200);
		expect((await callApi("/api/members", delegated, input)).status).toBe(409);
		const entry = (await directory()).find((row) => row.user.email === input.email)!;
		expect(entry.branchAccess).toEqual({ kind: "assigned-branches", branchIds: [north] });
		expect(entry.canAppointAdmins).toBe(false);
		for (const ids of [[], [south], [north, south]]) expect((await callApi("/api/members", delegated, createInput("wider-admin@test.invalid", "admin", ids))).status).toBe(403);
		expect(await getDb(env).select().from(user).where(eq(user.email, "wider-admin@test.invalid"))).toHaveLength(0);
	});
	it("allows employee provisioning within scope, rejects wider scope before identity creation", async () => {
		expect((await callApi("/api/members", scoped, createInput("local-scope-member@test.invalid"))).status).toBe(200);
		for (const ids of [[south], [north, south]]) expect((await callApi("/api/members", scoped, createInput("wider-member@test.invalid", "member", ids))).status).toBe(403);
		expect(await getDb(env).select().from(user).where(eq(user.email, "wider-member@test.invalid"))).toHaveLength(0);
	});
	it("redacts out-of-scope assignments and makes shared employees read-only", async () => {
		const rows = await directory(scoped);
		expect(rows.some((entry) => entry.user.id === outside.userId)).toBe(false);
		expect(rows.some((entry) => entry.user.id === owner.userId)).toBe(false);
		const sharedRow = rows.find((entry) => entry.user.id === shared.userId)!;
		expect(sharedRow).toMatchObject({ canManage: false, scopeRestricted: true, branchAccess: { kind: "assigned-branches", branchIds: [north] } });
		expect(JSON.stringify(rows)).not.toContain(south);
		for (const actor of [shared, outside]) {
			const target = await membership(actor);
			expect((await callApi(`/api/members/${target.id}`, scoped, { role: "member", branchIds: [north] }, "PATCH")).status).toBe(404);
			expect((await callApi(`/api/members/${target.id}/status`, scoped, { isActive: false }, "PATCH")).status).toBe(404);
			expect((await callApi(`/api/members/${target.id}/setup/resend`, scoped, {})).status).toBe(404);
		}
		expect((await callApi("/api/members", scoped, createInput(shared.email))).status).toBe(403);
	});
	it("restricts an existing admin without trusting stale active-team state", async () => {
		const auth = getAuth(env);
		await auth.api.addTeamMember({ headers: owner.headers, body: { organizationId: orgId, userId: general.userId, teamId: south } });
		await auth.api.setActiveTeam({ headers: general.headers, body: { teamId: south } });
		const row = await membership(general);
		expect((await callApi(`/api/members/${row.id}`, owner, { role: "admin", allBranches: false, branchIds: [north] }, "PATCH")).status).toBe(200);
		await expect(requireBranch(env, new Request("http://localhost/api/test", { headers: general.headers }))).rejects.toMatchObject({ status: 403 });
		expect((await callApi("/api/auth/organization/set-active-team", general, { teamId: south })).status).toBe(403);
	});
	it("all-branch access includes future branches while selected access does not", async () => {
		const created = await getAuth(env).api.createTeam({ headers: owner.headers, body: { organizationId: orgId, name: "Future branch" } });
		for (const [actor, allowed] of [[general, true], [scoped, false]] as const) {
			const body = await (await callApi("/api/branches", actor)).json() as { branches: { id: string }[] };
			expect(body.branches.some((branch) => branch.id === created.id)).toBe(allowed);
		}
	});
});

describe("company-only deactivation", () => {
	it("denies an existing session in one company while preserving account, history and the other company", async () => {
		const row = await membership(multi);
		const db = getDb(env);
		const beforeUser = await db.select().from(user).where(eq(user.id, multi.userId));
		const beforeAccounts = await db.select().from(account).where(eq(account.userId, multi.userId));
		const beforeAssignments = await db.select().from(teamMember).where(eq(teamMember.userId, multi.userId));
		const beforeOther = await membership(multi, otherId);
		for (let attempt = 0; attempt < 2; attempt++) expect((await callApi(`/api/members/${row.id}/status`, owner, { isActive: false }, "PATCH")).status).toBe(200);
		expect((await callApi("/api/branches", multi)).status).toBe(403);
		await expect(requireTenant(env, new Request("http://localhost/api/test", { headers: multi.headers }))).rejects.toMatchObject({ status: 403 });
		expect((await callApi("/api/auth/organization/set-active-team", multi, { teamId: north })).status).toBe(403);
		expect((await callApi("/api/companies/active", multi, { organizationId: orgId })).status).toBe(403);
		for (const path of ["get-organization", "get-active-member", "list"]) expect((await callApi(`/api/auth/organization/${path}?organizationId=${orgId}`, multi)).status).toBe(404);
		expect(await (await callApi("/api/companies", multi)).json()).toEqual({ companies: [{ id: otherId, name: "Access B" }] });
		expect((await callApi("/api/companies/active", multi, { organizationId: otherId })).status).toBe(200);
		expect((await callApi("/api/branches", multi)).status).toBe(200);
		expect(await db.select().from(user).where(eq(user.id, multi.userId))).toEqual(beforeUser);
		expect(await db.select().from(account).where(eq(account.userId, multi.userId))).toEqual(beforeAccounts);
		expect(await db.select().from(teamMember).where(eq(teamMember.userId, multi.userId))).toEqual(beforeAssignments);
		expect(await membership(multi, otherId)).toEqual(beforeOther);
		expect((await directory()).find((entry) => entry.user.id === multi.userId)?.isActive).toBe(false);
	});
	it("does not let a new login restore disabled company access", async () => {
		const row = await membership(employee);
		expect((await callApi(`/api/members/${row.id}/status`, owner, { isActive: false }, "PATCH")).status).toBe(200);
		const login = await getAuth(env).api.signInEmail({ body: { email: employee.email, password: TEST_PASSWORD }, asResponse: true });
		expect(login.status).toBe(200);
		const signedIn = { ...employee, headers: new Headers({ cookie: login.headers.get("set-cookie")! }) };
		expect(await (await callApi("/api/companies", signedIn)).json()).toEqual({ companies: [] });
		expect((await callApi("/api/companies/active", signedIn, { organizationId: orgId })).status).toBe(403);
	});
	it("reactivates without changing the saved role, scope or identity", async () => {
		const row = await membership(employee);
		const send = vi.mocked(env.EMAIL.send);
		send.mockClear();
		for (const isActive of [false, true, true]) expect((await callApi(`/api/members/${row.id}/status`, scoped, { isActive }, "PATCH")).status).toBe(200);
		expect(await membership(employee)).toEqual(row);
		expect((await callApi("/api/branches", employee)).status).toBe(200);
		expect(send).not.toHaveBeenCalled();
	});
	it("does not reactivate through provisioning, setup resend or access editing", async () => {
		const row = await membership(employee);
		expect((await callApi(`/api/members/${row.id}/status`, owner, { isActive: false }, "PATCH")).status).toBe(200);
		expect((await callApi("/api/members", owner, createInput(employee.email))).status).toBe(409);
		expect((await callApi(`/api/members/${row.id}/setup/resend`, owner, {})).status).toBe(409);
		expect((await callApi(`/api/members/${row.id}`, owner, { role: "member", branchIds: [north] }, "PATCH")).status).toBe(200);
		expect((await membership(employee)).isActive).toBe(false);
	});
	it("protects owner, self, admins, foreign memberships and unknown status fields", async () => {
		for (const [actor, target] of [[owner, await membership(owner)], [scoped, await membership(scoped)], [general, await membership(scoped)], [owner, await membership(otherOwner, otherId)]] as const) {
			expect((await callApi(`/api/members/${target.id}/status`, actor, { isActive: false }, "PATCH")).status).toBe(404);
		}
		const row = await membership(employee);
		for (const body of [{}, { isActive: "false" }, { isActive: false, role: "admin" }]) expect((await callApi(`/api/members/${row.id}/status`, owner, body, "PATCH")).status).toBe(400);
		for (const actor of [employee, undefined]) expect((await callApi(`/api/members/${row.id}/status`, actor, { isActive: false }, "PATCH")).status).toBe(actor ? 403 : 401);
	});
	it("a disabled admin cannot perform tenant or native Team management", async () => {
		const row = await membership(general);
		expect((await callApi(`/api/members/${row.id}/status`, owner, { isActive: false }, "PATCH")).status).toBe(200);
		for (const path of ["/api/branches", "/api/members"]) expect((await callApi(path, general)).status).toBe(403);
		expect((await callApi("/api/auth/organization/create-team", general, { name: "Forbidden", organizationId: orgId })).status).toBe(403);
		expect((await callApi("/api/auth/organization/update-team", general, { teamId: north, data: { name: "Forbidden" } })).status).toBe(403);
	});
});

describe("company selection", () => {
	it("lists only the caller's active companies without choosing one", async () => {
		await getAuth(env).api.setActiveOrganization({ headers: multi.headers, body: { organizationId: null } });
		expect(await (await callApi("/api/companies", multi)).json()).toEqual({ companies: [{ id: orgId, name: "Access A" }, { id: otherId, name: "Access B" }] });
		expect((await getAuth(env).api.getSession({ headers: multi.headers }))!.session.activeOrganizationId).toBeNull();
		expect((await callApi("/api/companies")).status).toBe(401);
	});
	it("checks target membership and clears the previous Branch when switching", async () => {
		await getAuth(env).api.setActiveTeam({ headers: multi.headers, body: { teamId: north } });
		expect((await callApi("/api/companies/active", multi, { organizationId: otherId })).status).toBe(200);
		expect((await getAuth(env).api.getSession({ headers: multi.headers }))!.session).toMatchObject({ activeOrganizationId: otherId, activeTeamId: null });
		expect((await callApi("/api/companies/active", employee, { organizationId: otherId })).status).toBe(403);
		for (const body of [{}, { organizationId: 12 }, { organizationId: orgId, userId: owner.userId }]) expect((await callApi("/api/companies/active", multi, body)).status).toBe(400);
		for (const path of ["list", "set-active", "get-active-member"]) expect((await callApi(`/api/auth/organization/${path}`, multi, { organizationId: orgId })).status).toBe(404);
	});
	it.each([
		[[], null, "none"],
		[[{ id: "a", name: "A" }], null, "activate"],
		[[{ id: "a", name: "A" }], "disabled", "activate"],
		[[{ id: "a", name: "A" }, { id: "b", name: "B" }], null, "choose"],
		[[{ id: "a", name: "A" }, { id: "b", name: "B" }], "disabled", "choose"],
		[[{ id: "a", name: "A" }, { id: "b", name: "B" }], "b", "active"],
	] as const)("resolves %j with active %s as %s", (companies, activeId, expected) => {
		expect(companySelection([...companies], activeId).kind).toBe(expected);
	});
});
