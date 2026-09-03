import { createExecutionContext, env } from "cloudflare:test";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import worker from "../src/worker";
import { getAuth } from "../src/worker/auth";
import { getDb } from "../src/worker/db";
import { account, member, teamMember, user } from "../src/worker/db/auth-schema";
import { requireTenant } from "../src/worker/tenant";
import { canAccessBranch, requireBranch } from "../src/worker/tenant/branch";
import type { MemberSummary } from "../src/worker/tenant/members";
import { callApi, createActor, type Actor } from "./helpers";

let owner: Actor;
let admin: Actor;
let employee: Actor;
let unassigned: Actor;
let foreign: Actor;
let platform: Actor;
let orgId: string;
let foreignOrgId: string;
let mainId: string;
let northId: string;
let foreignBranchId: string;

beforeAll(async () => {
	[owner, admin, employee, unassigned, foreign, platform] = await Promise.all([
		"owner", "admin", "employee", "unassigned", "foreign", "platform",
	].map((name) => createActor(`members-${name}@test.invalid`, name === "platform")));
	const auth = getAuth(env);
	const org = await auth.api.createOrganization({ body: { name: "Members A", slug: "members-a", userId: owner.userId } });
	const other = await auth.api.createOrganization({ body: { name: "Members B", slug: "members-b", userId: foreign.userId } });
	orgId = org!.id;
	foreignOrgId = other!.id;
	mainId = (await auth.api.createTeam({ body: { name: "Main", organizationId: orgId } })).id;
	northId = (await auth.api.createTeam({ body: { name: "North", organizationId: orgId } })).id;
	foreignBranchId = (await auth.api.createTeam({ body: { name: "Foreign", organizationId: foreignOrgId } })).id;
	for (const [actor, role] of [[admin, "admin"], [employee, "member"], [unassigned, "member"]] as const) {
		await auth.api.addMember({ body: { organizationId: orgId, userId: actor.userId, role, ...(actor !== unassigned ? { teamId: mainId } : {}) } });
	}
	for (const actor of [owner, admin, employee, unassigned]) {
		await auth.api.setActiveOrganization({ headers: actor.headers, body: { organizationId: orgId } });
	}
	await auth.api.setActiveOrganization({ headers: foreign.headers, body: { organizationId: foreignOrgId } });
});

async function membershipOf(actor: Actor, organizationId = orgId) {
	const [row] = await getDb(env).select().from(member).where(and(eq(member.userId, actor.userId), eq(member.organizationId, organizationId)));
	if (!row) throw new Error("Missing test membership");
	return row;
}

async function assignmentsOf(userId: string) {
	return (await getDb(env).select({ teamId: teamMember.teamId }).from(teamMember).where(eq(teamMember.userId, userId))).map((row) => row.teamId).sort();
}

describe("employee provisioning", () => {
	it("creates one normalized identity, membership and deduplicated assignment set on retries", async () => {
		const send = vi.mocked(env.EMAIL.send);
		send.mockClear();
		const input = { name: "New employee", email: "  New.Employee@TEST.INVALID  ", role: "member", branchIds: [mainId, northId, mainId] };
		const first = await callApi("/api/members", owner, input);
		expect(first.status).toBe(200);
		const result = await first.json() as { membershipId: string; setupEmailStatus: string; };
		expect(result.setupEmailStatus).toBe("sent");
		expect(send).toHaveBeenCalledTimes(1);
		const second = await (await callApi("/api/members", admin, input)).json() as { membershipId: string; alreadyMember: boolean; };
		expect(second).toMatchObject({ membershipId: result.membershipId, alreadyMember: true });
		const users = await getDb(env).select().from(user).where(eq(user.email, "new.employee@test.invalid"));
		expect(users).toHaveLength(1);
		expect(users[0].emailVerified).toBe(false);
		expect(users[0].role).not.toBe("admin");
		expect(await assignmentsOf(users[0].id)).toEqual([mainId, northId].sort());
		expect(await getDb(env).select().from(member).where(eq(member.userId, users[0].id))).toHaveLength(1);
		expect(JSON.stringify(result)).not.toMatch(/password|token|secret|[a-f0-9]{64}/i);
		expect(JSON.stringify(send.mock.calls)).not.toMatch(/[a-f0-9]{64}/);
	});
	it("requires appointment permission for admin creation and rejects owner or platform fields", async () => {
		expect((await callApi("/api/members", admin, { name: "New admin", email: "new-admin@test.invalid", role: "admin", branchIds: [] })).status).toBe(403);
		await getDb(env).update(member).set({ canAppointAdmins: true }).where(and(eq(member.userId, admin.userId), eq(member.organizationId, orgId)));
		const response = await callApi("/api/members", admin, { name: "New admin", email: "new-admin@test.invalid", role: "admin", branchIds: [] });
		expect(response.status).toBe(200);
		const body = await (await callApi("/api/members", owner)).json() as { members: MemberSummary[]; };
		await getDb(env).update(member).set({ canAppointAdmins: false }).where(and(eq(member.userId, admin.userId), eq(member.organizationId, orgId)));
		expect(body.members.find((row) => row.user.email === "new-admin@test.invalid")?.branchAccess).toEqual({ kind: "all-branches" });
		for (const extra of [{ role: "owner" }, { userId: owner.userId }, { organizationId: foreignOrgId }, { password: "NeverAllowed" }, { emailVerified: true }]) {
			expect((await callApi("/api/members", owner, { name: "Invalid", email: "invalid-extra@test.invalid", role: "member", branchIds: [mainId], ...extra })).status).toBe(400);
		}
	});
	it("allows the owner to create an admin with all-branch scope but not owner or platform fields", async () => {
		const response = await callApi("/api/members", owner, { name: "Owner-created admin", email: "owner-created-admin@test.invalid", role: "admin", branchIds: [] });
		expect(response.status).toBe(200);
		const body = await (await callApi("/api/members", owner)).json() as { members: MemberSummary[]; };
		expect(body.members.find((row) => row.user.email === "owner-created-admin@test.invalid")?.branchAccess).toEqual({ kind: "all-branches" });
		for (const extra of [{ role: "owner" }, { userId: owner.userId }, { organizationId: foreignOrgId }, { password: "NeverAllowed" }, { emailVerified: true }]) {
			expect((await callApi("/api/members", owner, { name: "Invalid", email: "owner-invalid-extra@test.invalid", role: "member", branchIds: [mainId], ...extra })).status).toBe(400);
		}
	});
	it("rejects invalid scope before creating an identity", async () => {
		for (const branchIds of [[], [foreignBranchId], ["missing"], [mainId, foreignBranchId], [123]]) {
			expect((await callApi("/api/members", owner, { name: "Invalid", email: "invalid-scope@test.invalid", role: "member", branchIds })).status).toBe(400);
		}
		expect(await getDb(env).select().from(user).where(eq(user.email, "invalid-scope@test.invalid"))).toHaveLength(0);
		expect((await callApi("/api/members", owner, { name: " ", email: "no-name@test.invalid", role: "member", branchIds: [mainId] })).status).toBe(400);
	});
	it("does not allow member, unassigned, platform-only or unauthenticated provisioning", async () => {
		for (const actor of [employee, unassigned, platform, undefined]) {
			expect((await callApi("/api/members", actor, { name: "Denied", email: "denied@test.invalid", role: "member", branchIds: [mainId] })).status).toBe(actor ? 403 : 401);
		}
		expect(await getDb(env).select().from(user).where(eq(user.email, "denied@test.invalid"))).toHaveLength(0);
	});
	it("reuses an established platform user across two companies without changing identity or credentials", async () => {
		const beforeUser = await getDb(env).select().from(user).where(eq(user.id, platform.userId));
		const beforeAccounts = await getDb(env).select().from(account).where(eq(account.userId, platform.userId));
		for (const [actor, branchId] of [[owner, mainId], [foreign, foreignBranchId]] as const) {
			const response = await callApi("/api/members", actor, { name: "Must not replace", email: platform.email.toUpperCase(), role: "member", branchIds: [branchId] });
			expect(response.status).toBe(200);
			expect(await response.json()).toMatchObject({ setupEmailStatus: "not-required" });
		}
		expect(await getDb(env).select().from(user).where(eq(user.id, platform.userId))).toEqual(beforeUser);
		expect(await getDb(env).select().from(account).where(eq(account.userId, platform.userId))).toEqual(beforeAccounts);
		expect(await getDb(env).select().from(member).where(eq(member.userId, platform.userId))).toHaveLength(2);
	});
	it("does not duplicate membership on concurrent identical provisioning", async () => {
		const existing = await createActor("concurrent-member@test.invalid");
		const input = { name: "Ignored", email: existing.email, role: "member", branchIds: [mainId] };
		const results = await Promise.all([callApi("/api/members", owner, input), callApi("/api/members", owner, input)]);
		expect(results.map((response) => response.status)).toEqual([200, 200]);
		expect(await getDb(env).select().from(member).where(eq(member.userId, existing.userId))).toHaveLength(1);
		expect(await assignmentsOf(existing.userId)).toEqual([mainId]);
	});
	it("keeps access on email failure and supports a scoped resend", async () => {
		vi.mocked(env.EMAIL.send).mockRejectedValueOnce(new Error("simulated transport failure"));
		const response = await callApi("/api/members", owner, { name: "Retry mail", email: "retry-mail@test.invalid", role: "member", branchIds: [mainId] });
		expect(response.status).toBe(200);
		const result = await response.json() as { membershipId: string; setupEmailStatus: string; };
		expect(result.setupEmailStatus).toBe("failed");
		const [row] = await getDb(env).select().from(member).where(eq(member.id, result.membershipId));
		expect(await assignmentsOf(row.userId)).toEqual([mainId]);
		expect(await (await callApi(`/api/members/${row.id}/setup/resend`, admin, {})).json()).toEqual({ setupEmailStatus: "sent" });
		expect((await callApi(`/api/members/${row.id}/setup/resend`, foreign, {})).status).toBe(404);
		expect((await callApi(`/api/members/${row.id}/setup/resend`, employee, {})).status).toBe(403);
	});
	it("resumes after failure adding the second branch without duplicate access", async () => {
		const prepare = env.DB.prepare.bind(env.DB);
		let inserts = 0;
		const failure = vi.spyOn(env.DB, "prepare").mockImplementation((query: string) => {
			if (/insert into "team_member"/i.test(query) && ++inserts === 2) throw new Error("simulated second assignment failure");
			return prepare(query);
		});
		const input = { name: "Partial member", email: "partial-member@test.invalid", role: "member", branchIds: [mainId, northId] };
		const response = await callApi("/api/members", owner, input);
		failure.mockRestore();
		expect(response.status).toBe(500);
		const [identity] = await getDb(env).select().from(user).where(eq(user.email, input.email));
		expect(await assignmentsOf(identity.id)).toEqual([mainId]);
		expect((await callApi("/api/members", owner, input)).status).toBe(200);
		expect(await assignmentsOf(identity.id)).toEqual([mainId, northId].sort());
		expect(await getDb(env).select().from(member).where(eq(member.userId, identity.id))).toHaveLength(1);
	});
	it("activates a new employee, revokes provisional credential and sets a password once", async () => {
		const send = vi.mocked(env.EMAIL.send);
		send.mockClear();
		const response = await callApi("/api/members", owner, { name: "Activate employee", email: "activate-employee@test.invalid", role: "member", branchIds: [northId] });
		const result = await response.json() as { membershipId: string; };
		const [identity] = await getDb(env).select().from(user).where(eq(user.email, "activate-employee@test.invalid"));
		expect(await getDb(env).select().from(account).where(eq(account.userId, identity.id))).toHaveLength(1);
		const message = send.mock.calls.at(-1)?.[0] as { text: string; };
		const url = message.text.match(/https?:\/\/\S+/)?.[0];
		if (!url) throw new Error("Missing setup link");
		const activation = await worker.fetch(new Request(url), env, createExecutionContext());
		const actor = { userId: identity.id, email: identity.email, headers: new Headers({ cookie: activation.headers.get("set-cookie")! }) };
		expect(await getDb(env).select().from(account).where(eq(account.userId, identity.id))).toHaveLength(0);
		// Interrupted setup remains resendable after mailbox verification.
		expect(await (await callApi(`/api/members/${result.membershipId}/setup/resend`, owner, {})).json()).toEqual({ setupEmailStatus: "sent" });
		expect((await callApi("/api/account/setup-password", actor, { newPassword: "EmployeeChosen123!" })).status).toBe(200);
		expect((await callApi("/api/account/setup-password", actor, { newPassword: "MustNeverReplace123!" })).status).toBe(409);
		expect(await (await callApi(`/api/members/${result.membershipId}/setup/resend`, owner, {})).json()).toEqual({ setupEmailStatus: "not-required" });
		await getAuth(env).api.setActiveOrganization({ headers: actor.headers, body: { organizationId: orgId } });
		const branches = await (await callApi("/api/branches", actor)).json() as { branches: { id: string; }[]; };
		expect(branches.branches.map((branch) => branch.id)).toEqual([northId]);
		expect((await callApi("/api/members", actor)).status).toBe(403);
	});
});

describe("member access updates", () => {
	it("protects owners, peer admins, foreign members and global roles", async () => {
		const ownerMembership = await membershipOf(owner);
		const adminMembership = await membershipOf(admin);
		const foreignMembership = await membershipOf(foreign, foreignOrgId);
		const access = { role: "member", branchIds: [mainId] };
		for (const [actor, target] of [[owner, ownerMembership], [admin, ownerMembership], [admin, adminMembership], [owner, foreignMembership]] as const) {
			expect((await callApi(`/api/members/${target.id}`, actor, access, "PATCH")).status).toBe(404);
		}
		expect((await callApi("/api/members/missing", owner, access, "PATCH")).status).toBe(404);
		for (const actor of [employee, undefined]) expect((await callApi(`/api/members/${adminMembership.id}`, actor, access, "PATCH")).status).toBe(actor ? 403 : 401);
		const target = await membershipOf(employee);
		for (const input of [{ ...access, role: "owner" }, { ...access, organizationId: foreignOrgId }, { ...access, branchIds: [] }, { ...access, branchIds: [foreignBranchId] }]) {
			expect((await callApi(`/api/members/${target.id}`, owner, input, "PATCH")).status).toBe(400);
		}
	});
	it("reconciles exactly, handles retries and denies removed active-branch access", async () => {
		const target = await membershipOf(employee);
		const before = await getDb(env).select().from(account).where(eq(account.userId, employee.userId));
		await getAuth(env).api.setActiveTeam({ headers: employee.headers, body: { teamId: mainId } });
		for (let index = 0; index < 2; index++) expect((await callApi(`/api/members/${target.id}`, admin, { role: "member", branchIds: [northId, northId] }, "PATCH")).status).toBe(200);
		expect(await assignmentsOf(employee.userId)).toEqual([northId]);
		const request = new Request("http://localhost:5173/api/test", { headers: employee.headers });
		const tenant = await requireTenant(env, request);
		expect(await canAccessBranch(env, tenant, mainId)).toBe(false);
		expect(await canAccessBranch(env, tenant, northId)).toBe(true);
		await expect(requireBranch(env, request)).rejects.toMatchObject({ status: 403 });
		expect(await getDb(env).select().from(account).where(eq(account.userId, employee.userId))).toEqual(before);
	});
	it("promotes members and downgrades admins only after creating their exact scope", async () => {
		const target = await membershipOf(admin);
		expect((await callApi(`/api/members/${target.id}`, owner, { role: "member", branchIds: [] }, "PATCH")).status).toBe(400);
		expect((await membershipOf(admin)).role).toBe("admin");
		expect((await callApi(`/api/members/${target.id}`, owner, { role: "member", branchIds: [northId] }, "PATCH")).status).toBe(200);
		expect(await assignmentsOf(admin.userId)).toEqual([northId]);
		expect((await callApi(`/api/members/${target.id}`, owner, { role: "admin", branchIds: [] }, "PATCH")).status).toBe(200);
		const result = await (await callApi("/api/branches", admin)).json() as { branches: { id: string; }[]; };
		expect(result.branches.map((branch) => branch.id).sort()).toEqual([mainId, northId].sort());
	});
	it("keeps at least one branch when reconciliation is interrupted and permits retry", async () => {
		const target = await membershipOf(employee);
		await getAuth(env).api.addTeamMember({ headers: owner.headers, body: { teamId: northId, userId: employee.userId, organizationId: orgId } });
		// Inject failure at the prepared statement boundary, preserving D1 for all reads/adds.
		const realPrepare = env.DB.prepare.bind(env.DB);
		const failing = vi.spyOn(env.DB, "prepare").mockImplementation((query: string) => {
			if (/delete from "team_member"/i.test(query)) throw new Error("simulated delete failure");
			return realPrepare(query);
		});
		const response = await callApi(`/api/members/${target.id}`, owner, { role: "member", branchIds: [mainId] }, "PATCH");
		failing.mockRestore();
		expect(response.status).toBe(500);
		expect((await assignmentsOf(employee.userId)).length).toBeGreaterThan(0);
		expect((await callApi(`/api/members/${target.id}`, owner, { role: "member", branchIds: [mainId] }, "PATCH")).status).toBe(200);
		expect(await assignmentsOf(employee.userId)).toEqual([mainId]);
	});
	it("blocks native HTTP bypasses while preserving authorized self activation", async () => {
		for (const path of ["update-member-role", "remove-team-member", "remove-member", "leave", "remove-team", "delete", "invite-member", "accept-invitation"]) {
			expect((await callApi(`/api/auth/organization/${path}`, owner, {})).status).toBe(404);
		}
		expect((await callApi("/api/auth/organization/add-team-member", admin, { teamId: mainId, userId: employee.userId, organizationId: orgId })).status).toBe(403);
		expect((await callApi("/api/auth/organization/add-team-member", employee, { teamId: northId, userId: employee.userId })).status).toBe(403);
		expect((await callApi("/api/auth/organization/create-team", owner, { name: "Foreign write", organizationId: foreignOrgId })).status).toBe(403);
		expect((await callApi("/api/auth/organization/add-team-member", owner, { teamId: mainId, userId: owner.userId, organizationId: orgId })).status).toBe(200);
	});
});

describe("member directory", () => {
	it("allows owner/admin and exposes only the safe active-tenant read model", async () => {
		for (const actor of [owner, admin]) {
			const response = await callApi(`/api/members?organizationId=${foreignOrgId}`, actor);
			expect(response.status).toBe(200);
			const body = await response.json() as { organizationId: string; members: MemberSummary[]; };
			expect(body.organizationId).toBe(orgId);
			expect(body.members.length).toBeGreaterThanOrEqual(4);
			expect(body.members.some((entry) => entry.user.id === foreign.userId)).toBe(false);
			for (const entry of body.members) expect(Object.keys(entry.user).sort()).toEqual(["email", "id", "name"]);
			expect(JSON.stringify(body)).not.toMatch(/password|token|banned|accountId/);
		}
	});
	it("does not interpret incidental admin Team rows as scoped permissions", async () => {
		const body = await (await callApi("/api/members", owner)).json() as { members: MemberSummary[]; };
		expect(body.members.find((entry) => entry.user.id === admin.userId)?.branchAccess).toEqual({ kind: "all-branches" });
		expect(body.members.find((entry) => entry.user.id === employee.userId)?.branchAccess).toEqual({ kind: "assigned-branches", branchIds: [mainId] });
		expect(body.members.find((entry) => entry.user.id === unassigned.userId)?.branchAccess).toEqual({ kind: "assigned-branches", branchIds: [] });
	});
	it("refuses members, unassigned members, and unauthenticated callers", async () => {
		for (const actor of [employee, unassigned, platform]) expect((await callApi("/api/members", actor)).status).toBe(403);
		expect((await callApi("/api/members")).status).toBe(401);
	});
	it("cannot leak directory or Branch data through native read endpoints", async () => {
		for (const path of ["list-members", "get-full-organization", "get-active-member-role", "list-teams", "list-team-members", "list-user-teams"]) {
			expect((await callApi(`/api/auth/organization/${path}?organizationId=${orgId}&teamId=${mainId}`, employee)).status).toBe(404);
		}
	});
	it("returns only safe shell metadata with the accessible Branch list", async () => {
		const body = await (await callApi("/api/branches", employee)).json() as { organization: { id: string; role: string; }; branches: { id: string; }[]; };
		expect(body.organization).toEqual({ id: orgId, name: "Members A", role: "member" });
		expect(body.branches.map((entry) => entry.id)).toEqual([mainId]);
		expect(body.branches.map((entry) => entry.id)).not.toContain(northId);
		expect(body.branches.map((entry) => entry.id)).not.toContain(foreignBranchId);
	});
});
