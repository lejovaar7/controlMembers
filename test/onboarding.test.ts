import { createExecutionContext, env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import worker from "../src/worker";
import { getAuth } from "../src/worker/auth";
import { getDb } from "../src/worker/db";
import { member, user as userTable } from "../src/worker/db/auth-schema";
import { requireTenant } from "../src/worker/tenant";
import { listAccessibleBranches } from "../src/worker/tenant/branch";

const PASSWORD = "TestOnlyPassword123!";

type Actor = { userId: string; email: string; headers: Headers };

async function createActor(email: string): Promise<Actor> {
	const auth = getAuth(env);
	// Public signup is disabled, so test users are provisioned through the
	// Admin API exactly as the platform does.
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

/** Calls the real Worker route, so guards and error mapping are exercised. */
function callBranches(actor?: Actor) {
	return worker.fetch(
		new Request("http://localhost/api/branches", {
			headers: actor ? actor.headers : undefined,
		}),
		env,
		createExecutionContext(),
	);
}

let ownerA: Actor;
let memberA: Actor;
let ownerB: Actor;
let orgAId: string;
let orgBId: string;
let branchA1Id: string;
let branchA2Id: string;
let branchB1Id: string;

beforeAll(async () => {
	const auth = getAuth(env);

	ownerA = await createActor("onboard-owner-a@test.invalid");
	memberA = await createActor("onboard-member-a@test.invalid");
	ownerB = await createActor("onboard-owner-b@test.invalid");

	// Organizations are provisioned server-side (no session + userId).
	const orgA = await auth.api.createOrganization({
		body: { name: "Onboard A", slug: "onboard-a", userId: ownerA.userId },
	});
	const orgB = await auth.api.createOrganization({
		body: { name: "Onboard B", slug: "onboard-b", userId: ownerB.userId },
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

	const a1 = await auth.api.createTeam({
		headers: ownerA.headers,
		body: { name: "Branch A1", organizationId: orgAId },
	});
	const a2 = await auth.api.createTeam({
		headers: ownerA.headers,
		body: { name: "Branch A2", organizationId: orgAId },
	});
	const b1 = await auth.api.createTeam({
		headers: ownerB.headers,
		body: { name: "Branch B1", organizationId: orgBId },
	});
	branchA1Id = a1.id;
	branchA2Id = a2.id;
	branchB1Id = b1.id;

	const invitation = await auth.api.createInvitation({
		headers: ownerA.headers,
		body: {
			email: memberA.email,
			role: "member",
			organizationId: orgAId,
			teamId: branchA1Id,
		},
	});
	await auth.api.acceptInvitation({
		headers: memberA.headers,
		body: { invitationId: invitation.id },
	});
	await auth.api.setActiveOrganization({
		headers: memberA.headers,
		body: { organizationId: orgAId },
	});
});

describe("onboarding state", () => {
	it("a brand new user has no organization and no tenant", async () => {
		const fresh = await createActor("onboard-fresh@test.invalid");
		const organizations = await getDb(env)
			.select({ id: member.id })
			.from(member)
			.where(eq(member.userId, fresh.userId));

		expect(organizations).toHaveLength(0);
		await expect(requireTenant(env, request(fresh))).rejects.toThrow(
			"NO_ACTIVE_ORGANIZATION",
		);
	});

	it("makes the creator an owner", async () => {
		const tenant = await requireTenant(env, request(ownerA));
		expect(tenant.organizationRole).toBe("owner");
		expect(tenant.organizationId).toBe(orgAId);
	});

	it("creates the first branch inside the creating organization", async () => {
		const tenant = await requireTenant(env, request(ownerA));
		const branches = await listAccessibleBranches(env, tenant);
		expect(branches.every((b) => b.organizationId === orgAId)).toBe(true);
		expect(branches.map((b) => b.branchId).sort()).toEqual(
			[branchA1Id, branchA2Id].sort(),
		);
	});

	it("persists active organization and branch on the session", async () => {
		const auth = getAuth(env);
		// Better Auth requires a team_member row before a team can be activated,
		// even for an owner, so onboarding adds it explicitly.
		await auth.api.addTeamMember({
			headers: ownerA.headers,
			body: { teamId: branchA1Id, userId: ownerA.userId },
		});
		await auth.api.setActiveTeam({
			headers: ownerA.headers,
			body: { teamId: branchA1Id },
		});
		const session = await auth.api.getSession({ headers: ownerA.headers });
		expect(session?.session.activeOrganizationId).toBe(orgAId);
		expect(session?.session.activeTeamId).toBe(branchA1Id);
	});
});

describe("GET /api/branches", () => {
	it("rejects an unauthenticated caller", async () => {
		const response = await callBranches();
		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({
			error: "UNAUTHENTICATED",
		});
	});

	it("rejects a user with no active organization", async () => {
		const fresh = await createActor("onboard-no-org@test.invalid");
		const response = await callBranches(fresh);
		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toEqual({
			error: "NO_ACTIVE_ORGANIZATION",
		});
	});

	it("returns every branch of the organization to an owner", async () => {
		const response = await callBranches(ownerA);
		expect(response.status).toBe(200);
		const body = (await response.json()) as { branches: { id: string }[] };
		expect(body.branches.map((b) => b.id).sort()).toEqual(
			[branchA1Id, branchA2Id].sort(),
		);
	});

	it("returns only assigned branches to a member", async () => {
		const response = await callBranches(memberA);
		const body = (await response.json()) as { branches: { id: string }[] };
		expect(body.branches.map((b) => b.id)).toEqual([branchA1Id]);
	});

	it("never leaks another organization's branches", async () => {
		for (const actor of [ownerA, memberA]) {
			const response = await callBranches(actor);
			const body = (await response.json()) as { branches: { id: string }[] };
			expect(body.branches.map((b) => b.id)).not.toContain(branchB1Id);
		}
	});
});

describe("organization switching", () => {
	it("cannot switch to a foreign organization", async () => {
		const auth = getAuth(env);
		await expect(
			auth.api.setActiveOrganization({
				headers: ownerB.headers,
				body: { organizationId: orgAId },
			}),
		).rejects.toThrow();
	});

	it("cannot activate a foreign branch", async () => {
		const auth = getAuth(env);
		await expect(
			auth.api.setActiveTeam({
				headers: ownerA.headers,
				body: { teamId: branchB1Id },
			}),
		).rejects.toThrow();
		// Nor by trying to join it first.
		await expect(
			auth.api.addTeamMember({
				headers: ownerA.headers,
				body: { teamId: branchB1Id, userId: ownerA.userId },
			}),
		).rejects.toThrow();
	});

	it("does not carry a previous organization's branch into a new one", async () => {
		const auth = getAuth(env);
		const mover = await createActor("onboard-mover@test.invalid");

		const first = await auth.api.createOrganization({
			body: { name: "Mover One", slug: "mover-one", userId: mover.userId },
		});
		const second = await auth.api.createOrganization({
			body: { name: "Mover Two", slug: "mover-two", userId: mover.userId },
		});
		if (!first || !second) throw new Error("organizations were not created");

		await auth.api.setActiveOrganization({
			headers: mover.headers,
			body: { organizationId: first.id },
		});
		const firstBranch = await auth.api.createTeam({
			headers: mover.headers,
			body: { name: "One Main", organizationId: first.id },
		});
		await auth.api.addTeamMember({
			headers: mover.headers,
			body: { teamId: firstBranch.id, userId: mover.userId },
		});
		await auth.api.setActiveTeam({
			headers: mover.headers,
			body: { teamId: firstBranch.id },
		});

		await auth.api.setActiveOrganization({
			headers: mover.headers,
			body: { organizationId: second.id },
		});

		// The stale branch must not be usable under the new organization.
		const tenant = await requireTenant(env, request(mover));
		expect(tenant.organizationId).toBe(second.id);
		const branches = await listAccessibleBranches(env, tenant);
		expect(branches.map((b) => b.branchId)).not.toContain(firstBranch.id);
		expect(branches).toHaveLength(0);
	});
});
