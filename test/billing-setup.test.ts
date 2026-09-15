import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getAuth } from "../src/worker/auth";
import { getDb } from "../src/worker/db";
import { member, organization } from "../src/worker/db/auth-schema";
import { billingPlan, program, programBranch } from "../src/worker/db/schema";
import { callApi, createActor, type Actor } from "./helpers";

let ownerA: Actor;
let ownerB: Actor;
let limitedAdmin: Actor;
let orgAId: string;
let orgBId: string;
let branchAId: string;
let branchBId: string;

beforeAll(async () => {
	ownerA = await createActor("billing-owner-a@test.invalid");
	ownerB = await createActor("billing-owner-b@test.invalid");
	limitedAdmin = await createActor("billing-limited-admin@test.invalid");
	const auth = getAuth(env);
	const orgA = await auth.api.createOrganization({ body: { name: "Billing A", slug: "billing-a", userId: ownerA.userId } });
	const orgB = await auth.api.createOrganization({ body: { name: "Billing B", slug: "billing-b", userId: ownerB.userId } });
	if (!orgA || !orgB) throw new Error("organizations missing");
	orgAId = orgA.id;
	orgBId = orgB.id;
	await auth.api.setActiveOrganization({ headers: ownerA.headers, body: { organizationId: orgAId } });
	await auth.api.setActiveOrganization({ headers: ownerB.headers, body: { organizationId: orgBId } });
	const branchA = await auth.api.createTeam({ headers: ownerA.headers, body: { name: "A Main", organizationId: orgAId } });
	const branchB = await auth.api.createTeam({ headers: ownerB.headers, body: { name: "B Main", organizationId: orgBId } });
	branchAId = branchA.id;
	branchBId = branchB.id;
	await getDb(env).insert(member).values({
		id: `limited-${limitedAdmin.userId}`,
		organizationId: orgAId,
		userId: limitedAdmin.userId,
		role: "admin",
		allBranches: false,
		createdAt: new Date(),
	});
	await auth.api.addTeamMember({ headers: ownerA.headers, body: { teamId: branchAId, userId: limitedAdmin.userId } });
	await auth.api.setActiveOrganization({ headers: limitedAdmin.headers, body: { organizationId: orgAId } });
});

describe("billing settings", () => {
	it("lets an owner save validated currency and timezone", async () => {
		const response = await callApi("/api/product/settings", ownerA, { currency: "cop", timezone: "America/Bogota" }, "PATCH");
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({ currency: "COP", timezone: "America/Bogota", canEdit: true });
		const [row] = await getDb(env).select({ currency: organization.currency, timezone: organization.timezone }).from(organization).where(eq(organization.id, orgAId));
		expect(row).toEqual({ currency: "COP", timezone: "America/Bogota" });
	});

	it("rejects invalid values and a scoped administrator", async () => {
		const invalid = await callApi("/api/product/settings", ownerA, { currency: "12", timezone: "Nowhere/Invalid" }, "PATCH");
		expect(invalid.status).toBe(400);
		const denied = await callApi("/api/product/settings", limitedAdmin, { currency: "USD", timezone: "UTC" }, "PATCH");
		expect(denied.status).toBe(403);
	});
});

describe("Programs and Plans", () => {
	let programId: string;

	it("creates a Branch-scoped Program", async () => {
		const response = await callApi("/api/programs", ownerA, { name: "Football", description: "Youth football", branchIds: [branchAId] });
		expect(response.status).toBe(201);
		const result = await response.json() as { id: string; branchIds: string[] };
		programId = result.id;
		expect(result.branchIds).toEqual([branchAId]);
		const [stored] = await getDb(env).select().from(program).where(eq(program.id, programId));
		expect(stored?.organizationId).toBe(orgAId);
		const links = await getDb(env).select().from(programBranch).where(eq(programBranch.programId, programId));
		expect(links.map((link) => link.branchId)).toEqual([branchAId]);
	});

	it("rejects foreign Branches, duplicates, and limited setup administration", async () => {
		const foreign = await callApi("/api/programs", ownerA, { name: "Swimming", branchIds: [branchBId] });
		expect(foreign.status).toBe(404);
		const duplicate = await callApi("/api/programs", ownerA, { name: " football ", branchIds: [branchAId] });
		expect(duplicate.status).toBe(409);
		const denied = await callApi("/api/programs", limitedAdmin, { name: "Music", branchIds: [branchAId] });
		expect(denied.status).toBe(403);
	});

	it("creates a monthly Plan with an immutable currency snapshot", async () => {
		const response = await callApi("/api/billing-plans", ownerA, { name: "Monthly", programId, amountMinor: 120000, defaultDueDay: 5 });
		expect(response.status).toBe(201);
		const result = await response.json() as { id: string; currency: string; frequency: string };
		expect(result).toMatchObject({ currency: "COP", frequency: "monthly" });
		const [stored] = await getDb(env).select().from(billingPlan).where(eq(billingPlan.id, result.id));
		expect(stored).toMatchObject({ organizationId: orgAId, programId, amountMinor: 120000, defaultDueDay: 5 });
	});

	it("keeps tenant lists isolated", async () => {
		const ownerList = await callApi("/api/programs", ownerA);
		const foreignList = await callApi("/api/programs", ownerB);
		expect((await ownerList.json() as { programs: unknown[] }).programs).toHaveLength(1);
		expect((await foreignList.json() as { programs: unknown[] }).programs).toHaveLength(0);
		const plansB = await callApi("/api/billing-plans", ownerB);
		expect((await plansB.json() as { plans: unknown[] }).plans).toHaveLength(0);
	});
});
