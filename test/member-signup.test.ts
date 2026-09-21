import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getAuth } from "../src/worker/auth";
import { getDb } from "../src/worker/db";
import { customerMember, enrollment, charge } from "../src/worker/db/schema";
import { callApi, createActor, type Actor } from "./helpers";

let owner: Actor; let organizationId: string; let branch: string; let otherBranch: string; let plan: string; let inactivePlan: string;
async function json<T>(path: string, body?: unknown, method?: string): Promise<T> {
	const response = await callApi(path, owner, body, method);
	expect(response.ok, `${path}: ${response.status}`).toBe(true);
	return await response.json() as T;
}
const input = () => ({ displayName: "Signup member", primaryBranchId: branch, planId: plan, startDate: "2026-01-30" });
beforeAll(async () => {
	owner = await createActor("signup-owner@test.invalid");
	const auth = getAuth(env);
	organizationId = (await auth.api.createOrganization({ body: { name: "Signup", slug: "signup", userId: owner.userId } }))!.id;
	await auth.api.setActiveOrganization({ headers: owner.headers, body: { organizationId } });
	branch = (await auth.api.createTeam({ headers: owner.headers, body: { organizationId, name: "Main" } })).id;
	otherBranch = (await auth.api.createTeam({ headers: owner.headers, body: { organizationId, name: "No plans" } })).id;
	await auth.api.addTeamMember({ headers: owner.headers, body: { teamId: branch, userId: owner.userId } });
	await auth.api.setActiveTeam({ headers: owner.headers, body: { teamId: branch } });
	await json("/api/product/settings", { currency: "COP", timezone: "America/Bogota" }, "PATCH");
	plan = (await json<{ id: string }>("/api/plans", { name: "Monthly", amountMinor: 9000000, defaultDueDay: 1, branchIds: [branch] })).id;
	inactivePlan = (await json<{ id: string }>("/api/plans", { name: "Inactive", amountMinor: 1000000, defaultDueDay: 1, branchIds: [branch] })).id;
	await json(`/api/plans/${inactivePlan}`, { isActive: false }, "PATCH");
});

describe("member signup with a required plan and WhatsApp choice", () => {
	it("rejects missing, unknown, inactive and other-branch plans without creating partial records", async () => {
		for (const body of [{ ...input(), planId: undefined }, { ...input(), planId: "" }, { ...input(), planId: "unknown" }, { ...input(), planId: inactivePlan }, { ...input(), primaryBranchId: otherBranch }, { ...input(), recurringDay: 32 }]) {
			const result = await callApi("/api/customer-members", owner, body);
			expect([400, 404]).toContain(result.status);
		}
		expect(await getDb(env).select().from(customerMember).where(eq(customerMember.organizationId, organizationId))).toHaveLength(0);
		expect(await getDb(env).select().from(enrollment).where(eq(enrollment.organizationId, organizationId))).toHaveLength(0);
		expect(await getDb(env).select().from(charge).where(eq(charge.organizationId, organizationId))).toHaveLength(0);
	});
	it("creates the member, selected plan enrollment and first fee together and reuses the phone for WhatsApp", async () => {
		const created = await json<{ id: string; enrollmentId: string; firstChargeId: string; whatsappSameAsPhone: boolean }>("/api/customer-members", { ...input(), recurringDay: 31, phoneE164: "+57 300 111 2233" });
		expect(created.whatsappSameAsPhone).toBe(true);
		const detail = await json<{ enrollments: unknown[]; charges: unknown[]; payments: unknown[] }>(`/api/customer-members/${created.id}`);
		expect(detail.enrollments).toEqual([expect.objectContaining({ id: created.enrollmentId, planId: plan, recurringDay: 31, firstDueDate: "2026-01-30" })]);
		expect(detail.charges).toEqual([expect.objectContaining({ id: created.firstChargeId, totalMinor: 9000000, outstandingMinor: 9000000, dueDate: "2026-01-30" })]);
		expect(detail.payments).toHaveLength(0);
		expect(await json(`/api/charges/${created.firstChargeId}/reminder`)).toMatchObject({ recipients: [expect.objectContaining({ phone: "+573001112233" })] });
		await json(`/api/customer-members/${created.id}`, { phoneE164: "+573001112244" }, "PATCH");
		expect(await json(`/api/charges/${created.firstChargeId}/reminder`)).toMatchObject({ recipients: [expect.objectContaining({ phone: "+573001112244" })] });
	});
	it("keeps a separate WhatsApp number when the phone changes, and supports turning it off", async () => {
		const created = await json<{ id: string; firstChargeId: string }>("/api/customer-members", { ...input(), phoneE164: "+573001112233", whatsappSameAsPhone: false, whatsappE164: "+57 311 222 3344" });
		await json(`/api/customer-members/${created.id}`, { phoneE164: "+573001112299" }, "PATCH");
		expect(await json(`/api/customer-members/${created.id}`)).toMatchObject({ member: { phoneE164: "+573001112299", whatsappSameAsPhone: false, whatsappE164: "+573112223344" } });
		expect(await json(`/api/charges/${created.firstChargeId}/reminder`)).toMatchObject({ recipients: [expect.objectContaining({ phone: "+573112223344" })] });
		await json(`/api/customer-members/${created.id}`, { whatsappE164: "" }, "PATCH");
		expect(await json(`/api/charges/${created.firstChargeId}/reminder`)).toMatchObject({ recipients: [] });
		await json(`/api/customer-members/${created.id}`, { whatsappSameAsPhone: true }, "PATCH");
		expect(await json(`/api/charges/${created.firstChargeId}/reminder`)).toMatchObject({ recipients: [expect.objectContaining({ phone: "+573001112299" })] });
	});
	it("accepts optional phones and rejects invalid separate WhatsApp values", async () => {
		for (const fields of [{ whatsappSameAsPhone: "false" }, { whatsappSameAsPhone: false, whatsappE164: "3001112233" }]) {
			expect((await callApi("/api/customer-members", owner, { ...input(), ...fields })).status).toBe(400);
		}
		const created = await json<{ id: string }>("/api/customer-members", { ...input(), whatsappSameAsPhone: false, whatsappE164: "+573112223344" });
		expect(await json(`/api/customer-members/${created.id}`)).toMatchObject({ member: { phoneE164: null, whatsappE164: "+573112223344" } });
		expect(await json("/api/customer-members", input())).toMatchObject({ phoneE164: null, whatsappSameAsPhone: true, whatsappE164: null });
	});
});
