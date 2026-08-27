import { env } from "cloudflare:test";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { getAuth } from "../src/worker/auth";
import { getDb } from "../src/worker/db";
import {
	member,
	organization,
	session as sessionTable,
	teamMember,
	user as userTable,
} from "../src/worker/db/auth-schema";
import { requireTenant } from "../src/worker/tenant";
import { canAccessBranch, requireBranch } from "../src/worker/tenant/branch";

const PASSWORD = "TestOnlyPassword123!";

type Actor = { userId: string; email: string; request: Request };

/** Signs up, marks the address verified, signs in, and keeps the cookie. */
async function createActor(email: string): Promise<Actor> {
	const auth = getAuth(env);
	const signUp = await auth.api.signUpEmail({
		body: { name: email, email, password: PASSWORD },
	});

	await getDb(env)
		.update(userTable)
		.set({ emailVerified: true })
		.where(eq(userTable.id, signUp.user.id));

	const response = await auth.api.signInEmail({
		body: { email, password: PASSWORD },
		asResponse: true,
	});
	const cookie = response.headers.get("set-cookie");
	if (!cookie) throw new Error(`no session cookie for ${email}`);

	return {
		userId: signUp.user.id,
		email,
		request: new Request("http://localhost/", { headers: { cookie } }),
	};
}

const headersOf = (actor: Actor) => actor.request.headers;

const setActiveOrganization = (actor: Actor, organizationId: string) =>
	getAuth(env).api.setActiveOrganization({
		headers: headersOf(actor),
		body: { organizationId },
	});

const setActiveBranch = (actor: Actor, teamId: string) =>
	getAuth(env).api.setActiveTeam({
		headers: headersOf(actor),
		body: { teamId },
	});

/** Invites an actor into an organization and accepts as that actor. */
async function joinOrganization(
	inviter: Actor,
	invitee: Actor,
	organizationId: string,
	role: "admin" | "member",
	teamId?: string,
) {
	const auth = getAuth(env);
	const invitation = await auth.api.createInvitation({
		headers: headersOf(inviter),
		body: { email: invitee.email, role, organizationId, teamId },
	});
	await auth.api.acceptInvitation({
		headers: headersOf(invitee),
		body: { invitationId: invitation.id },
	});
	return invitation;
}

// Organization A owns branches A1 and A2. Organization B owns branch B1.
let ownerA: Actor;
let adminA: Actor;
let memberA: Actor;
let strandedA: Actor;
let ownerB: Actor;
let orgAId: string;
let orgBId: string;
let branchA1Id: string;
let branchA2Id: string;
let branchB1Id: string;

beforeAll(async () => {
	const auth = getAuth(env);

	ownerA = await createActor("owner-a@test.invalid");
	adminA = await createActor("admin-a@test.invalid");
	memberA = await createActor("member-a@test.invalid");
	strandedA = await createActor("stranded-a@test.invalid");
	ownerB = await createActor("owner-b@test.invalid");

	const orgA = await auth.api.createOrganization({
		headers: headersOf(ownerA),
		body: { name: "Organization A", slug: "org-a" },
	});
	const orgB = await auth.api.createOrganization({
		headers: headersOf(ownerB),
		body: { name: "Organization B", slug: "org-b" },
	});
	if (!orgA || !orgB) throw new Error("organizations were not created");
	orgAId = orgA.id;
	orgBId = orgB.id;

	await setActiveOrganization(ownerA, orgAId);
	await setActiveOrganization(ownerB, orgBId);

	const branchA1 = await auth.api.createTeam({
		headers: headersOf(ownerA),
		body: { name: "Branch A1", organizationId: orgAId },
	});
	const branchA2 = await auth.api.createTeam({
		headers: headersOf(ownerA),
		body: { name: "Branch A2", organizationId: orgAId },
	});
	const branchB1 = await auth.api.createTeam({
		headers: headersOf(ownerB),
		body: { name: "Branch B1", organizationId: orgBId },
	});
	branchA1Id = branchA1.id;
	branchA2Id = branchA2.id;
	branchB1Id = branchB1.id;

	await joinOrganization(ownerA, adminA, orgAId, "admin");
	await joinOrganization(ownerA, memberA, orgAId, "member", branchA1Id);
	await joinOrganization(ownerA, strandedA, orgAId, "member");

	await setActiveOrganization(adminA, orgAId);
	await setActiveOrganization(memberA, orgAId);
	await setActiveOrganization(strandedA, orgAId);
});

describe("active organization", () => {
	it("cannot be set to an organization the user does not belong to", async () => {
		// Throwaway actors: this check deliberately destroys their session state.
		const insiderA = await createActor("outsider-a@test.invalid");
		await joinOrganization(ownerA, insiderA, orgAId, "member");
		await setActiveOrganization(insiderA, orgAId);
		await expect(requireTenant(env, insiderA.request)).resolves.toMatchObject({
			organizationId: orgAId,
		});

		// Better Auth rejects AND fails closed by clearing the active
		// organization, so a refused switch never leaves the old tenant active.
		await expect(setActiveOrganization(insiderA, orgBId)).rejects.toThrow();
		await expect(requireTenant(env, insiderA.request)).rejects.toThrow(
			"NO_ACTIVE_ORGANIZATION",
		);
	});

	it("cannot be set by a user with no membership anywhere", async () => {
		const stranger = await createActor("stranger@test.invalid");
		await expect(setActiveOrganization(stranger, orgAId)).rejects.toThrow();
		await expect(setActiveOrganization(stranger, orgBId)).rejects.toThrow();
		await expect(requireTenant(env, stranger.request)).rejects.toThrow(
			"NO_ACTIVE_ORGANIZATION",
		);
	});

	it("resolves the correct tenant and role for each user", async () => {
		await expect(requireTenant(env, ownerA.request)).resolves.toMatchObject({
			organizationId: orgAId,
			organizationRole: "owner",
		});
		await expect(requireTenant(env, adminA.request)).resolves.toMatchObject({
			organizationId: orgAId,
			organizationRole: "admin",
		});
		await expect(requireTenant(env, memberA.request)).resolves.toMatchObject({
			organizationId: orgAId,
			organizationRole: "member",
		});
	});

	it("rejects a user whose membership was revoked", async () => {
		const revoked = await createActor("revoked-a@test.invalid");
		await joinOrganization(ownerA, revoked, orgAId, "member");
		await setActiveOrganization(revoked, orgAId);
		await expect(requireTenant(env, revoked.request)).resolves.toBeTruthy();

		await getDb(env)
			.delete(member)
			.where(
				and(
					eq(member.organizationId, orgAId),
					eq(member.userId, revoked.userId),
				),
			);

		await expect(requireTenant(env, revoked.request)).rejects.toThrow(
			"NO_ACTIVE_ORGANIZATION",
		);
	});

	it("reports no active organization when none is selected", async () => {
		const fresh = await createActor("no-org@test.invalid");
		await expect(requireTenant(env, fresh.request)).rejects.toThrow(
			"NO_ACTIVE_ORGANIZATION",
		);
	});
});

describe("organization settings", () => {
	it("are exposed through the validated tenant context", async () => {
		await getDb(env)
			.update(organization)
			.set({ locale: "en-US", timezone: "UTC", currency: "USD" })
			.where(eq(organization.id, orgAId));

		await expect(requireTenant(env, ownerA.request)).resolves.toMatchObject({
			locale: "en-US",
			timezone: "UTC",
			currency: "USD",
		});
	});
});

describe("branch access", () => {
	const cases = [
		["owner", () => ownerA, true, true, false],
		["admin", () => adminA, true, true, false],
		["assigned member", () => memberA, true, false, false],
		["unassigned member", () => strandedA, false, false, false],
	] as const;

	for (const [label, get, a1, a2, b1] of cases) {
		it(`${label} reaches A1=${a1} A2=${a2} B1=${b1}`, async () => {
			const tenant = await requireTenant(env, get().request);
			expect(await canAccessBranch(env, tenant, branchA1Id)).toBe(a1);
			expect(await canAccessBranch(env, tenant, branchA2Id)).toBe(a2);
			expect(await canAccessBranch(env, tenant, branchB1Id)).toBe(b1);
		});
	}

	it("denies a branch id that does not exist", async () => {
		const tenant = await requireTenant(env, ownerA.request);
		expect(await canAccessBranch(env, tenant, "no-such-branch")).toBe(false);
	});
});

describe("requireBranch", () => {
	it("returns the active branch for an assigned member", async () => {
		await setActiveBranch(memberA, branchA1Id);
		await expect(requireBranch(env, memberA.request)).resolves.toMatchObject({
			branchId: branchA1Id,
			organizationId: orgAId,
			name: "Branch A1",
		});
	});

	it("stops a member activating a branch they are not assigned to", async () => {
		await expect(setActiveBranch(memberA, branchA2Id)).rejects.toThrow();
	});

	it("denies an unassigned branch even if the session is forged", async () => {
		const forged = await createActor("forged-branch@test.invalid");
		await joinOrganization(ownerA, forged, orgAId, "member", branchA1Id);
		await setActiveOrganization(forged, orgAId);

		await getDb(env)
			.update(sessionTable)
			.set({ activeTeamId: branchA2Id })
			.where(eq(sessionTable.userId, forged.userId));

		await expect(requireBranch(env, forged.request)).rejects.toThrow(
			"BRANCH_ACCESS_DENIED",
		);
	});

	it("never yields a branch owned by another organization", async () => {
		const crossTenant = await createActor("cross-tenant@test.invalid");
		await joinOrganization(ownerA, crossTenant, orgAId, "member", branchA1Id);
		await setActiveOrganization(crossTenant, orgAId);

		await getDb(env)
			.update(sessionTable)
			.set({ activeTeamId: branchB1Id })
			.where(eq(sessionTable.userId, crossTenant.userId));

		await expect(requireBranch(env, crossTenant.request)).rejects.toThrow(
			"BRANCH_ACCESS_DENIED",
		);
	});

	it("reports no active branch when none is selected", async () => {
		const noBranch = await createActor("no-branch@test.invalid");
		await joinOrganization(ownerA, noBranch, orgAId, "member");
		await setActiveOrganization(noBranch, orgAId);

		await expect(requireBranch(env, noBranch.request)).rejects.toThrow(
			"NO_ACTIVE_BRANCH",
		);
	});
});

describe("invitations", () => {
	it("records the organization and preserves the branch assignment", async () => {
		const invitee = await createActor("invited-a@test.invalid");
		const invitation = await joinOrganization(
			ownerA,
			invitee,
			orgAId,
			"member",
			branchA2Id,
		);

		expect(invitation.organizationId).toBe(orgAId);
		expect(invitation.teamId).toBe(branchA2Id);

		const [membership] = await getDb(env)
			.select({ role: member.role })
			.from(member)
			.where(
				and(
					eq(member.organizationId, orgAId),
					eq(member.userId, invitee.userId),
				),
			);
		expect(membership?.role).toBe("member");

		const [assignment] = await getDb(env)
			.select({ teamId: teamMember.teamId })
			.from(teamMember)
			.where(
				and(
					eq(teamMember.teamId, branchA2Id),
					eq(teamMember.userId, invitee.userId),
				),
			);
		expect(assignment?.teamId).toBe(branchA2Id);
	});

	it("sends the invitation through the EmailService", async () => {
		const send = vi.spyOn(env.EMAIL, "send");
		const invitee = await createActor("emailed-a@test.invalid");
		await getAuth(env).api.createInvitation({
			headers: headersOf(ownerA),
			body: { email: invitee.email, role: "member", organizationId: orgAId },
		});

		expect(send).toHaveBeenCalled();
		const message = send.mock.calls.at(-1)?.[0] as {
			to: string;
			subject: string;
			text: string;
			html: string;
		};
		expect(message.to).toBe(invitee.email);
		expect(message.subject).toContain("Organization A");
		expect(message.text).toContain("/accept-invitation?invitationId=");
		expect(message.html).toContain("/accept-invitation?invitationId=");
		send.mockRestore();
	});

	it("does not let a normal member invite others", async () => {
		await expect(
			getAuth(env).api.createInvitation({
				headers: headersOf(memberA),
				body: {
					email: "should-not-happen@test.invalid",
					role: "member",
					organizationId: orgAId,
				},
			}),
		).rejects.toThrow();
	});
});
