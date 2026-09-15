import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getAuth } from "../src/worker/auth";
import { getDb } from "../src/worker/db";
import { member, organization } from "../src/worker/db/auth-schema";
import { plan, planBranch, planTag, tag } from "../src/worker/db/schema";
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

describe("Plans and tags", () => {
	let planId: string;

	it("creates one Branch-scoped monthly Plan with optional tags", async () => {
		const response = await callApi("/api/plans", ownerA, {
			name: "Football children",
			description: "Training for children",
			amountMinor: 120000,
			defaultDueDay: 5,
			branchIds: [branchAId],
			tagNames: ["Football", " Children "],
		});
		expect(response.status).toBe(201);
		const result = await response.json() as { id: string; currency: string; frequency: string; branchIds: string[]; tags: Array<{ name: string }> };
		planId = result.id;
		expect(result).toMatchObject({ currency: "COP", frequency: "monthly", branchIds: [branchAId] });
		expect(result.tags.map((item) => item.name)).toEqual(["Football", "Children"]);

		const [stored] = await getDb(env).select().from(plan).where(eq(plan.id, planId));
		expect(stored).toMatchObject({ organizationId: orgAId, name: "Football children", amountMinor: 120000, defaultDueDay: 5 });
		const branchLinks = await getDb(env).select().from(planBranch).where(eq(planBranch.planId, planId));
		expect(branchLinks.map((link) => link.branchId)).toEqual([branchAId]);
		const tagLinks = await getDb(env).select().from(planTag).where(eq(planTag.planId, planId));
		expect(tagLinks).toHaveLength(2);
	});

	it("reuses tags case-insensitively and returns them in the catalog", async () => {
		const response = await callApi("/api/plans", ownerA, {
			name: "Football adults",
			amountMinor: 150000,
			defaultDueDay: 10,
			branchIds: [branchAId],
			tagNames: ["football", "Adults"],
		});
		expect(response.status).toBe(201);
		const storedTags = await getDb(env).select().from(tag).where(eq(tag.organizationId, orgAId));
		expect(storedTags).toHaveLength(3);

		const responseBody = await response.json() as { tags: Array<{ name: string }> };
		expect(responseBody.tags.map((item) => item.name)).toEqual(["Football", "Adults"]);
		const catalog = await callApi("/api/plans", ownerA);
		const catalogBody = await catalog.json() as { plans: unknown[]; tags: Array<{ name: string }> };
		expect(catalogBody.plans).toHaveLength(2);
		expect(catalogBody.tags.map((item) => item.name)).toEqual(["Adults", "Children", "Football"]);
	});

	it("updates a Plan while preserving omitted Branches and tags", async () => {
		const response = await callApi(`/api/plans/${planId}`, ownerA, { amountMinor: 125000, defaultDueDay: 8 }, "PATCH");
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({ amountMinor: 125000, defaultDueDay: 8, branchIds: [branchAId] });
		const branchLinks = await getDb(env).select().from(planBranch).where(eq(planBranch.planId, planId));
		const tagLinks = await getDb(env).select().from(planTag).where(eq(planTag.planId, planId));
		expect(branchLinks).toHaveLength(1);
		expect(tagLinks).toHaveLength(2);
	});

	it("rejects foreign Branches, duplicate active names, old fields, and limited setup administration", async () => {
		const foreign = await callApi("/api/plans", ownerA, { name: "Swimming", amountMinor: 90000, defaultDueDay: 5, branchIds: [branchBId], tagNames: [] });
		expect(foreign.status).toBe(404);
		const duplicate = await callApi("/api/plans", ownerA, { name: " football children ", amountMinor: 90000, defaultDueDay: 5, branchIds: [branchAId], tagNames: [] });
		expect(duplicate.status).toBe(409);
		const legacyField = await callApi("/api/plans", ownerA, { name: "Legacy", programId: "old", amountMinor: 90000, defaultDueDay: 5, branchIds: [branchAId], tagNames: [] });
		expect(legacyField.status).toBe(400);
		const denied = await callApi("/api/plans", limitedAdmin, { name: "Music", amountMinor: 90000, defaultDueDay: 5, branchIds: [branchAId], tagNames: [] });
		expect(denied.status).toBe(403);
	});

	it("keeps tenant catalogs isolated and removes the former routes", async () => {
		const foreignList = await callApi("/api/plans", ownerB);
		expect((await foreignList.json() as { plans: unknown[]; tags: unknown[] })).toEqual({ plans: [], tags: [] });
		expect((await callApi("/api/programs", ownerA)).status).toBe(404);
		expect((await callApi("/api/billing-plans", ownerA)).status).toBe(404);
	});
});
