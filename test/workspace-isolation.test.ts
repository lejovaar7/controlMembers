import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { getAuth } from "../src/worker/auth";
import { callApi, createActor, seedLegacyMember, type Actor } from "./helpers";

let owner: Actor;
let branchA: string;
let branchB: string;
let emptyBranch: string;
let memberA: string;
let memberB: string;
let planA: string;
let planB: string;
let sharedPlan: string;
let chargeB: string;

type TestResult = {
	id: string;
	plans: Array<{ id: string; branchIds: string[] }>;
	members: Array<{ id: string; outstandingMinor: number }>;
	charges: Array<{ id: string; branchId: string }>;
	payments: Array<{ branchId: string }>;
	balances: Array<{ id: string; outstandingMinor: number }>;
	branches: Array<{ id: string; expectedMinor: number }>;
};

async function json(path: string, body?: unknown, method?: string) {
	const response = await callApi(path, owner, body, method);
	expect(response.ok, `${path}: ${response.status}`).toBe(true);
	return await response.json() as TestResult;
}

async function activate(teamId: string) {
	await getAuth(env).api.setActiveTeam({ headers: owner.headers, body: { teamId } });
}

beforeAll(async () => {
	owner = await createActor("workspace-owner@test.invalid");
	const auth = getAuth(env);
	const organization = await auth.api.createOrganization({ body: { name: "Workspace isolation", slug: "workspace-isolation", userId: owner.userId } });
	if (!organization) throw new Error("Missing organization");
	await auth.api.setActiveOrganization({ headers: owner.headers, body: { organizationId: organization.id } });
	const ids: string[] = [];
	for (const name of ["Sede Principal", "Vida B", "Empty branch"]) {
		const branch = await auth.api.createTeam({ headers: owner.headers, body: { organizationId: organization.id, name } });
		await auth.api.addTeamMember({ headers: owner.headers, body: { teamId: branch.id, userId: owner.userId } });
		ids.push(branch.id);
	}
	[branchA, branchB, emptyBranch] = ids as [string, string, string];
	await json("/api/product/settings", { currency: "COP", timezone: "America/Bogota" }, "PATCH");
	planA = (await json("/api/plans", { name: "Only Main", amountMinor: 5000, defaultDueDay: 5, branchIds: [branchA] })).id;
	planB = (await json("/api/plans", { name: "Only Vida B", amountMinor: 9000, defaultDueDay: 5, branchIds: [branchB] })).id;
	sharedPlan = (await json("/api/plans", { name: "Explicitly shared", amountMinor: 7000, defaultDueDay: 5, branchIds: [branchA, branchB] })).id;
	memberA = (await seedLegacyMember(owner, { displayName: "Main member", primaryBranchId: branchA })).id;
	memberB = (await seedLegacyMember(owner, { displayName: "Vida member", primaryBranchId: branchB })).id;
	await json(`/api/customer-members/${memberA}/enrollments`, { planId: planA, branchId: branchA, startDate: "2026-01-01", firstDueDate: "2026-01-05" });
	await json(`/api/customer-members/${memberB}/enrollments`, { planId: planB, branchId: branchB, startDate: "2026-01-01", firstDueDate: "2026-01-05" });
	await json("/api/charges/generate", { period: "2026-01" });
	chargeB = (await json(`/api/charges?branchId=${branchB}&period=2026-01`)).charges[0]!.id;
	await json("/api/payments", { memberId: memberB, branchId: branchB, amountMinor: 2000, method: "cash", paidAt: "2026-01-15T15:00:00Z", idempotencyKey: "workspace-payment" });
});

describe("active Branch workspace isolation", () => {
	it("shows only assigned Plans after switching, retaining all explicit links for editing", async () => {
		await activate(branchA);
		expect((await json("/api/plans")).plans.map((row: { id: string }) => row.id).sort()).toEqual([planA, sharedPlan].sort());
		await activate(branchB);
		const catalog = await json("/api/plans");
		expect(catalog.plans.map((row: { id: string }) => row.id).sort()).toEqual([planB, sharedPlan].sort());
		expect(catalog.plans.find((row: { id: string }) => row.id === sharedPlan)!.branchIds.sort()).toEqual([branchA, branchB].sort());
		await json(`/api/plans/${sharedPlan}`, { description: "Shared defaults" }, "PATCH");
		await activate(emptyBranch);
		expect((await json("/api/plans")).plans).toEqual([]);
	});

	it("isolates Members, financial lists, dashboard, reports and exports", async () => {
		await activate(branchA);
		expect((await json("/api/customer-members")).members.map((row: { id: string }) => row.id)).toEqual([memberA]);
		expect((await callApi(`/api/customer-members/${memberB}`, owner)).status).toBe(404);
		expect((await json("/api/charges?period=2026-01")).charges.map((row: { branchId: string }) => row.branchId)).toEqual([branchA]);
		expect((await json("/api/payments")).payments).toEqual([]);
		expect(await json("/api/dashboard?period=2026-01")).toMatchObject({ expectedMinor: 5000, collectedMinor: 0, scope: "branch" });
		expect((await json("/api/reports/member-balances")).balances).toEqual([expect.objectContaining({ id: memberA, outstandingMinor: 5000 })]);
		expect((await json("/api/reports/financial-summary?period=2026-01")).branches).toEqual([expect.objectContaining({ id: branchA, expectedMinor: 5000 })]);
		for (const kind of ["members", "member-balances", "payments", "receivables"]) {
			const response = await callApi(`/api/exports/${kind}?period=2026-01`, owner);
			expect(response.status).toBe(200);
			expect(await response.text()).not.toContain("Vida");
		}
		await activate(branchB);
		expect((await json("/api/customer-members")).members).toEqual([expect.objectContaining({ id: memberB, outstandingMinor: 7000 })]);
		expect(await json("/api/dashboard?period=2026-01")).toMatchObject({ expectedMinor: 9000, collectedMinor: 2000, outstandingMinor: 7000 });
		expect((await json("/api/payments")).payments).toEqual([expect.objectContaining({ branchId: branchB })]);
	});

	it("generates charges only for the active Branch and rejects cross-Branch overrides", async () => {
		await activate(branchA);
		expect(await json("/api/charges/generate/preview", { period: "2026-02" })).toMatchObject({ willCreate: 1 });
		expect(await json("/api/charges/generate", { period: "2026-02" })).toMatchObject({ created: 1 });
		for (const path of ["/api/charges", "/api/payments", "/api/customer-members", "/api/dashboard"]) {
			expect((await callApi(`${path}?branchId=${branchB}`, owner)).status).toBe(404);
		}
		expect((await callApi("/api/charges/generate", owner, { period: "2026-02", branchIds: [branchB] })).status).toBe(404);
		expect((await callApi(`/api/charges/${chargeB}/adjust`, owner, { adjustmentMinor: 100, reason: "Wrong branch" }, "PATCH")).status).toBe(404);
		await activate(branchB);
		expect((await json("/api/charges?period=2026-02")).charges).toEqual([]);
		expect(await json("/api/charges/generate/preview", { period: "2026-02" })).toMatchObject({ willCreate: 1 });
	});

	it("does not mix old financial history after moving a Member to another Branch", async () => {
		await activate(branchA);
		await json(`/api/customer-members/${memberA}`, { primaryBranchId: branchB }, "PATCH");
		await activate(branchB);
		expect(await json(`/api/customer-members/${memberA}`)).toMatchObject({ enrollments: [], charges: [], payments: [], summary: { grossOutstandingMinor: 0 } });
		expect((await json("/api/customer-members")).members.find((row: { id: string }) => row.id === memberA)!.outstandingMinor).toBe(0);
		expect((await json("/api/reports/member-balances")).balances.find((row: { id: string }) => row.id === memberA)!.outstandingMinor).toBe(0);
		await activate(branchA);
		// Existing receivables must remain reachable and payable at their original Branch.
		expect((await json("/api/customer-members")).members).toEqual([expect.objectContaining({ id: memberA, outstandingMinor: 10000 })]);
		expect(await json(`/api/customer-members/${memberA}`)).toMatchObject({ charges: [expect.anything(), expect.anything()] });
		expect((await json("/api/reports/member-balances")).balances).toEqual([expect.objectContaining({ id: memberA, branchName: "Sede Principal", outstandingMinor: 10000 })]);
		await json("/api/payments", { memberId: memberA, branchId: branchA, amountMinor: 1000, method: "cash", paidAt: "2026-02-15T15:00:00Z", allowCredit: true, idempotencyKey: "moved-member-payment" });
	});

	it("shares Members only through explicit Enrollments and keeps their ledgers separate", async () => {
		await activate(branchA);
		const sharedMember = (await seedLegacyMember(owner, { displayName: "Explicitly shared member", primaryBranchId: branchA })).id;
		await json(`/api/customer-members/${sharedMember}/enrollments`, { planId: sharedPlan, branchId: branchA, startDate: "2026-03-01", firstDueDate: "2026-03-05" });
		await activate(branchB);
		expect((await callApi(`/api/customer-members/${sharedMember}`, owner)).status).toBe(404);
		await json(`/api/customer-members/${sharedMember}/enrollments`, { planId: sharedPlan, branchId: branchB, startDate: "2026-03-01", firstDueDate: "2026-03-05" });
		await json("/api/charges/generate", { period: "2026-03" });
		expect(await json(`/api/customer-members/${sharedMember}`)).toMatchObject({ enrollments: [expect.objectContaining({ branchId: branchB })], charges: [expect.objectContaining({ totalMinor: 7000 })] });
		await activate(branchA);
		expect(await json(`/api/customer-members/${sharedMember}`)).toMatchObject({ enrollments: [expect.objectContaining({ branchId: branchA })], charges: [] });
		expect((await json("/api/customer-members")).members.find((row) => row.id === sharedMember)!.outstandingMinor).toBe(0);
	});
});
