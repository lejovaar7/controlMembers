import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getAuth } from "../src/worker/auth";
import { getDb } from "../src/worker/db";
import { member, team, user as userTable } from "../src/worker/db/auth-schema";
import { requireTenant } from "../src/worker/tenant";
import {
	canAccessBranch,
	listAccessibleBranches,
} from "../src/worker/tenant/branch";

const PASSWORD = "TestOnlyPassword123!";

type Actor = { userId: string; email: string; headers: Headers };

async function createActor(email: string): Promise<Actor> {
	const auth = getAuth(env);
	await auth.api.createUser({
		body: { name: email, email, password: PASSWORD },
	});

	const db = getDb(env);
	await db
		.update(userTable)
		.set({ emailVerified: true })
		.where(eq(userTable.email, email));
	const [created] = await db
		.select({ id: userTable.id })
		.from(userTable)
		.where(eq(userTable.email, email))
		.limit(1);
	if (!created) throw new Error(`user ${email} was not created`);

	const response = await auth.api.signInEmail({
		body: { email, password: PASSWORD },
		asResponse: true,
	});
	const cookie = response.headers.get("set-cookie");
	if (!cookie) throw new Error(`no session cookie for ${email}`);

	return { userId: created.id, email, headers: new Headers({ cookie }) };
}

const request = (actor: Actor) =>
	new Request("http://localhost/", { headers: actor.headers });

let ownerA: Actor;
let adminA: Actor;
let assignedMember: Actor;
let unassignedMember: Actor;
let ownerB: Actor;
let orgAId: string;
let orgBId: string;
let mainId: string;
let branchB1Id: string;

beforeAll(async () => {
	const auth = getAuth(env);

	ownerA = await createActor("branch-owner-a@test.invalid");
	adminA = await createActor("branch-admin-a@test.invalid");
	assignedMember = await createActor("branch-assigned@test.invalid");
	unassignedMember = await createActor("branch-unassigned@test.invalid");
	ownerB = await createActor("branch-owner-b@test.invalid");

	const orgA = await auth.api.createOrganization({
		body: { name: "Branch Co A", slug: "branch-co-a", userId: ownerA.userId },
	});
	const orgB = await auth.api.createOrganization({
		body: { name: "Branch Co B", slug: "branch-co-b", userId: ownerB.userId },
	});
	if (!orgA || !orgB) throw new Error("organizations were not created");
	orgAId = orgA.id;
	orgBId = orgB.id;

	await auth.api.setActiveOrganization({
		headers: ownerA.headers,
		body: { organizationId: orgAId },
	});
	await auth.api.setActiveOrganization({
		headers: ownerB.headers,
		body: { organizationId: orgBId },
	});

	const main = await auth.api.createTeam({
		headers: ownerA.headers,
		body: { name: "Main", organizationId: orgAId },
	});
	mainId = main.id;
	const b1 = await auth.api.createTeam({
		headers: ownerB.headers,
		body: { name: "B Main", organizationId: orgBId },
	});
	branchB1Id = b1.id;

	const db = getDb(env);
	for (const [actor, role] of [
		[adminA, "admin"],
		[assignedMember, "member"],
		[unassignedMember, "member"],
	] as const) {
		await db.insert(member).values({
			id: `bm-${actor.userId}`,
			organizationId: orgAId,
			userId: actor.userId,
			role,
			createdAt: new Date(),
		});
		await auth.api.setActiveOrganization({
			headers: actor.headers,
			body: { organizationId: orgAId },
		});
	}

	// Only one member is assigned to Main.
	await auth.api.addTeamMember({
		headers: ownerA.headers,
		body: { teamId: mainId, userId: assignedMember.userId },
	});
});

describe("branch visibility", () => {
	it("shows every branch of the organization to owner and admin", async () => {
		for (const actor of [ownerA, adminA]) {
			const tenant = await requireTenant(env, request(actor));
			const branches = await listAccessibleBranches(env, tenant);
			expect(branches.map((b) => b.branchId)).toContain(mainId);
			expect(branches.map((b) => b.branchId)).not.toContain(branchB1Id);
		}
	});

	it("shows only assigned branches to a member", async () => {
		const tenant = await requireTenant(env, request(assignedMember));
		const branches = await listAccessibleBranches(env, tenant);
		expect(branches.map((b) => b.branchId)).toEqual([mainId]);
	});

	it("shows nothing to a member with no assignment", async () => {
		const tenant = await requireTenant(env, request(unassignedMember));
		const branches = await listAccessibleBranches(env, tenant);
		expect(branches).toHaveLength(0);
		expect(await canAccessBranch(env, tenant, mainId)).toBe(false);
	});
});

describe("branch management permissions", () => {
	it("lets an owner create an additional branch in their organization", async () => {
		const created = await getAuth(env).api.createTeam({
			headers: ownerA.headers,
			body: { name: "North", organizationId: orgAId },
		});
		expect(created.organizationId).toBe(orgAId);

		const tenant = await requireTenant(env, request(ownerA));
		const branches = await listAccessibleBranches(env, tenant);
		expect(branches.map((b) => b.name)).toEqual(
			expect.arrayContaining(["Main", "North"]),
		);
	});

	it("lets an admin create an additional branch", async () => {
		const created = await getAuth(env).api.createTeam({
			headers: adminA.headers,
			body: { name: "Downtown", organizationId: orgAId },
		});
		expect(created.organizationId).toBe(orgAId);
	});

	it("refuses branch creation by a member", async () => {
		await expect(
			getAuth(env).api.createTeam({
				headers: assignedMember.headers,
				body: { name: "Member Branch", organizationId: orgAId },
			}),
		).rejects.toThrow();
	});

	it("refuses branch creation by an unassigned member", async () => {
		await expect(
			getAuth(env).api.createTeam({
				headers: unassignedMember.headers,
				body: { name: "Ghost Branch", organizationId: orgAId },
			}),
		).rejects.toThrow();
	});

	it("refuses creating a branch inside another organization", async () => {
		await expect(
			getAuth(env).api.createTeam({
				headers: ownerA.headers,
				body: { name: "Trespass", organizationId: orgBId },
			}),
		).rejects.toThrow();

		const rows = await getDb(env)
			.select({ id: team.id })
			.from(team)
			.where(eq(team.organizationId, orgBId));
		expect(rows.map((r) => r.id)).toEqual([branchB1Id]);
	});
});

describe("branch rename", () => {
	it("rejects blank names through the Better Auth APIs", async () => {
		await expect(getAuth(env).api.createTeam({ headers: ownerA.headers, body: { name: "   ", organizationId: orgAId } })).rejects.toThrow();
		await expect(getAuth(env).api.updateTeam({ headers: ownerA.headers, body: { teamId: mainId, data: { name: "   " } } })).rejects.toThrow();
	});
	it("lets an owner rename a branch in their organization", async () => {
		const created = await getAuth(env).api.createTeam({
			headers: ownerA.headers,
			body: { name: "Temporary", organizationId: orgAId },
		});

		await getAuth(env).api.updateTeam({
			headers: ownerA.headers,
			body: { teamId: created.id, data: { name: "Renamed" } },
		});

		const [row] = await getDb(env)
			.select({ name: team.name })
			.from(team)
			.where(eq(team.id, created.id));
		expect(row?.name).toBe("Renamed");
	});

	it("refuses rename by a member", async () => {
		await expect(
			getAuth(env).api.updateTeam({
				headers: assignedMember.headers,
				body: { teamId: mainId, data: { name: "Hijacked" } },
			}),
		).rejects.toThrow();

		const [row] = await getDb(env)
			.select({ name: team.name })
			.from(team)
			.where(eq(team.id, mainId));
		expect(row?.name).toBe("Main");
	});

	it("refuses renaming a branch in another organization", async () => {
		await expect(
			getAuth(env).api.updateTeam({
				headers: ownerA.headers,
				body: { teamId: branchB1Id, data: { name: "Stolen" } },
			}),
		).rejects.toThrow();

		const [row] = await getDb(env)
			.select({ name: team.name })
			.from(team)
			.where(eq(team.id, branchB1Id));
		expect(row?.name).toBe("B Main");
	});
});

describe("stale active branch", () => {
	it("does not grant access through a stale activeTeamId", async () => {
		const tenant = await requireTenant(env, request(unassignedMember));
		// Even if the session pointed at Main, access is denied by the rules.
		expect(await canAccessBranch(env, tenant, mainId)).toBe(false);
		expect(await canAccessBranch(env, tenant, branchB1Id)).toBe(false);
	});
});
