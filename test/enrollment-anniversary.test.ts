import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getAuth } from "../src/worker/auth";
import { getDb } from "../src/worker/db";
import { enrollment } from "../src/worker/db/schema";
import { callApi, createActor, type Actor } from "./helpers";
import { billingDateInMonth, defaultFirstDueDate } from "../src/shared/billing-dates";

let owner: Actor; let branchId: string; let planId: string;
async function json<T>(path: string, body?: unknown, method?: string): Promise<T> {
	const response = await callApi(path, owner, body, method);
	expect(response.ok, `${path}: ${response.status}`).toBe(true);
	return await response.json() as T;
}
type Detail = { enrollments: Array<{ id: string; dueDay: number; firstDueDate: string | null; paymentDue: { date: string } | null }>; charges: Array<{ id: string; dueDate: string; billingPeriod: string; totalMinor: number }> };
beforeAll(async () => {
	owner = await createActor("anniversary-owner@test.invalid");
	const auth = getAuth(env);
	const org = (await auth.api.createOrganization({ body: { name: "Anniversary", slug: "anniversary", userId: owner.userId } }))!;
	await auth.api.setActiveOrganization({ headers: owner.headers, body: { organizationId: org.id } });
	branchId = (await auth.api.createTeam({ headers: owner.headers, body: { organizationId: org.id, name: "Main" } })).id;
	await auth.api.addTeamMember({ headers: owner.headers, body: { teamId: branchId, userId: owner.userId } });
	await auth.api.setActiveTeam({ headers: owner.headers, body: { teamId: branchId } });
	await json("/api/product/settings", { currency: "COP", timezone: "America/Bogota" }, "PATCH");
	planId = (await json<{ id: string }>("/api/plans", { name: "Monthly", amountMinor: 8000000, defaultDueDay: 1, branchIds: [branchId] })).id;
});
async function member() { return (await json<{ id: string }>("/api/customer-members", { displayName: "New member", primaryBranchId: branchId })).id; }
async function create(id: string, input: Record<string, unknown>) { return json<{ id: string; firstDueDate: string; dueDay: number }>(`/api/customer-members/${id}/enrollments`, { planId, branchId, ...input }); }

describe("anniversary enrollment billing", () => {
	it("defaults September 21 to October 21 independently of the plan day", async () => {
		const id = await member();
		expect(await create(id, { startDate: "2026-09-21" })).toMatchObject({ firstDueDate: "2026-10-21", dueDay: 21 });
		expect(await json("/api/charges/generate/preview", { period: "2026-09" })).toMatchObject({ willCreate: 0 });
		await json("/api/charges/generate", { period: "2026-09" });
		expect((await json<Detail>(`/api/customer-members/${id}`)).charges).toHaveLength(0);
		await Promise.all([json("/api/charges/generate", { period: "2026-10" }), json("/api/charges/generate", { period: "2026-10" })]);
		await json("/api/charges/generate", { period: "2026-11" });
		const detail = await json<Detail>(`/api/customer-members/${id}`);
		expect(detail.charges.map((fee) => fee.dueDate).sort()).toEqual(["2026-10-21", "2026-11-21"]);
		expect(detail.enrollments[0]!.paymentDue?.date).toBe("2026-10-21");
	});
	it("clamps January 31 to February then returns to 31 in March", async () => {
		const id = await member();
		expect(await create(id, { startDate: "2026-01-31", firstDueDate: "2026-02-28", recurringDay: 31 })).toMatchObject({ dueDay: 31 });
		for (const period of ["2026-02", "2026-03", "2026-04"]) await json("/api/charges/generate", { period });
		expect((await json<Detail>(`/api/customer-members/${id}`)).charges.map((fee) => fee.dueDate).sort()).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
		expect(defaultFirstDueDate("2028-01-31")).toBe("2028-02-29");
		expect(defaultFirstDueDate("2026-12-21")).toBe("2027-01-21");
		expect(billingDateInMonth("2028-03", 31)).toBe("2028-03-31");
	});
	it("accepts a custom first date and retains past charges after future day changes", async () => {
		const id = await member(); const created = await create(id, { startDate: "2026-09-21", firstDueDate: "2026-10-25" });
		expect(created.dueDay).toBe(25);
		await json("/api/charges/generate", { period: "2026-10" });
		const before = (await json<Detail>(`/api/customer-members/${id}`)).charges;
		await json(`/api/enrollments/${created.id}`, { dueDay: 31, reason: "New agreement" }, "PATCH");
		await json("/api/charges/generate", { period: "2026-10" });
		expect((await json<Detail>(`/api/customer-members/${id}`)).charges).toEqual(before);
		await json("/api/charges/generate", { period: "2026-11" });
		expect((await json<Detail>(`/api/customer-members/${id}`)).charges.map((fee) => fee.dueDate).sort()).toEqual(["2026-10-25", "2026-11-30"]);
	});
	it("rejects invalid dates and anchors without creating an enrollment", async () => {
		const id = await member();
		for (const input of [{ firstDueDate: "2026-09-21" }, { firstDueDate: "2026-09-20" }, { firstDueDate: "2026-02-30" }, { firstDueDate: "" }, { firstDueDate: "2026-10-21", recurringDay: 1 }, { recurringDay: 32 }]) {
			expect((await callApi(`/api/customer-members/${id}/enrollments`, owner, { planId, branchId, startDate: "2026-09-21", ...input })).status).toBe(400);
		}
		expect((await json<Detail>(`/api/customer-members/${id}`)).enrollments).toHaveLength(0);
	});
	it("preserves legacy calendar schedules and stops new schedules at their end date", async () => {
		const id = await member(); const created = await create(id, { startDate: "2026-09-21" });
		await getDb(env).update(enrollment).set({ firstDueDate: null, recurringDay: null }).where(eq(enrollment.id, created.id));
		await json("/api/charges/generate", { period: "2026-09" });
		expect((await json<Detail>(`/api/customer-members/${id}`)).charges[0]!.dueDate).toBe("2026-09-01");
		const second = await member(); await create(second, { startDate: "2026-09-21", endDate: "2026-10-20" });
		await json("/api/charges/generate", { period: "2026-10" });
		expect((await json<Detail>(`/api/customer-members/${second}`)).charges).toHaveLength(0);
	});
});
