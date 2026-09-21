import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getAuth } from "../src/worker/auth";
import { callApi, createActor, seedLegacyMember, type Actor } from "./helpers";
import { whatsappReminderUrl } from "../src/react-app/lib/whatsapp-reminder";

let owner: Actor; let outsider: Actor; let branch: string; let otherBranch: string; let plan: string;
type Preview = { overdueMinor: number; creditMinor: number; amountMinor: number; blockedReason: string | null; recipients: Array<{ name: string; phone: string; kind: string }> };
async function json<T>(path: string, body?: unknown, method?: string): Promise<T> {
	const response = await callApi(path, owner, body, method);
	expect(response.ok, `${path}: ${response.status}`).toBe(true); return await response.json() as T;
}
beforeAll(async () => {
	owner = await createActor("reminders-owner@test.invalid"); outsider = await createActor("reminders-outsider@test.invalid");
	const auth = getAuth(env);
	for (const actor of [owner, outsider]) {
		const org = (await auth.api.createOrganization({ body: { name: "Reminders", slug: crypto.randomUUID(), userId: actor.userId } }))!;
		await auth.api.setActiveOrganization({ headers: actor.headers, body: { organizationId: org.id } });
		if (actor === owner) {
			branch = (await auth.api.createTeam({ headers: owner.headers, body: { organizationId: org.id, name: "Main" } })).id;
			otherBranch = (await auth.api.createTeam({ headers: owner.headers, body: { organizationId: org.id, name: "Other" } })).id;
			for (const teamId of [branch, otherBranch]) await auth.api.addTeamMember({ headers: owner.headers, body: { teamId, userId: owner.userId } });
		}
	}
	await json("/api/product/settings", { currency: "COP", timezone: "America/Bogota" }, "PATCH");
	plan = (await json<{ id: string }>("/api/plans", { name: "Monthly", amountMinor: 8000000, defaultDueDay: 5, branchIds: [branch, otherBranch] })).id;
});
beforeEach(async () => { await getAuth(env).api.setActiveTeam({ headers: owner.headers, body: { teamId: branch } }); });
async function fixture(phoneE164: string | null = "+573001112233") {
	const member = (await seedLegacyMember(owner, { displayName: `Member ${crypto.randomUUID()}`, primaryBranchId: branch, phoneE164 })).id;
	await json(`/api/customer-members/${member}/enrollments`, { planId: plan, branchId: branch, startDate: "2026-01-01", firstDueDate: "2026-01-05" });
	for (const period of ["2026-01", "2026-02"]) await json("/api/charges/generate", { period });
	const detail = await json<{ charges: Array<{ id: string; billingPeriod: string }> }>(`/api/customer-members/${member}`);
	const fees = detail.charges.sort((a, b) => a.billingPeriod.localeCompare(b.billingPeriod));
	return { member, first: fees[0]!.id, second: fees[1]!.id };
}
async function pay(member: string, amountMinor: number, allocations: Array<{ chargeId: string; amountMinor: number }> = []) {
	return json<{ id: string }>("/api/payments", { memberId: member, branchId: branch, amountMinor, method: "cash", paidAt: "2026-02-10T15:00:00Z", allowCredit: true, allocations, idempotencyKey: crypto.randomUUID() });
}
describe("manual WhatsApp reminders", () => {
	it("summarizes all overdue fees without mutating the ledger and prefers eligible contacts", async () => {
		const { member, first } = await fixture();
		await json(`/api/customer-members/${member}/contacts`, { displayName: "Guardian", relationship: "mother", phoneE164: "+573009998877", isBillingContact: true, whatsappConsent: "none" });
		await json(`/api/customer-members/${member}/contacts`, { displayName: "Emergency only", relationship: "other", phoneE164: "+573009998866" });
		const before = await json(`/api/customer-members/${member}`);
		const preview = await json<Preview>(`/api/charges/${first}/reminder`);
		expect(preview).toMatchObject({ overdueMinor: 16000000, amountMinor: 16000000, creditMinor: 0, blockedReason: null });
		expect(preview.recipients.map((item) => item.kind)).toEqual(["contact", "member"]);
		expect(preview.recipients[0]!.name).toBe("Guardian");
		expect(await json(`/api/customer-members/${member}`)).toEqual(before);
	});
	it("retains partial overdue fees in the filter and rechecks new payments", async () => {
		const { member, first } = await fixture();
		await pay(member, 3000000, [{ chargeId: first, amountMinor: 3000000 }]);
		const result = await json<{ charges: Array<{ id: string; isOverdue: boolean; paymentState: string }> }>("/api/charges?state=overdue&limit=50");
		expect(result.charges.find((fee) => fee.id === first)).toMatchObject({ isOverdue: true, paymentState: "partial" });
		expect(await json(`/api/charges/${first}/reminder`)).toMatchObject({ overdueMinor: 13000000, amountMinor: 13000000 });
		await pay(member, 5000000, [{ chargeId: first, amountMinor: 5000000 }]);
		expect(await json(`/api/charges/${first}/reminder`)).toMatchObject({ blockedReason: "not_overdue", amountMinor: 8000000 });
	});
	it("nets unused credit, excludes reversed payments and never requests a covered debt", async () => {
		const { member, first } = await fixture();
		const payment = await pay(member, 5000000);
		expect(await json(`/api/charges/${first}/reminder`)).toMatchObject({ creditMinor: 5000000, amountMinor: 11000000 });
		await json(`/api/payments/${payment.id}/reverse`, { reason: "Fixture correction" }, "PATCH");
		expect(await json(`/api/charges/${first}/reminder`)).toMatchObject({ creditMinor: 0, amountMinor: 16000000 });
		await pay(member, 20000000);
		expect(await json(`/api/charges/${first}/reminder`)).toMatchObject({ amountMinor: 0, blockedReason: "credit_covers_debt" });
	});
	it("does not subtract another member's credit or invent a missing phone", async () => {
		const target = await fixture(null); const other = await fixture(); await pay(other.member, 20000000);
		expect(await json(`/api/charges/${target.first}/reminder`)).toMatchObject({ amountMinor: 16000000, creditMinor: 0, recipients: [] });
	});
	it("keeps a shared member's debt and credit separate between branches", async () => {
		const { member, first } = await fixture();
		await getAuth(env).api.setActiveTeam({ headers: owner.headers, body: { teamId: otherBranch } });
		await json(`/api/customer-members/${member}/enrollments`, { planId: plan, branchId: otherBranch, startDate: "2026-01-01", firstDueDate: "2026-01-05" });
		await json("/api/charges/generate", { period: "2026-01" });
		await json("/api/payments", { memberId: member, branchId: otherBranch, amountMinor: 30000000, allowCredit: true, allocations: [], method: "cash", paidAt: "2026-02-10T15:00:00Z", idempotencyKey: crypto.randomUUID() });
		await getAuth(env).api.setActiveTeam({ headers: owner.headers, body: { teamId: branch } });
		expect(await json(`/api/charges/${first}/reminder`)).toMatchObject({ overdueMinor: 16000000, creditMinor: 0, amountMinor: 16000000 });
	});
	it("does not request a future fee", async () => {
		const { member } = await fixture();
		const year = new Date().getUTCFullYear() + 1;
		await json("/api/charges/generate", { period: `${year}-01` });
		const detail = await json<{ charges: Array<{ id: string; billingPeriod: string }> }>(`/api/customer-members/${member}`);
		const future = detail.charges.find((fee) => fee.billingPeriod === `${year}-01`)!;
		expect(await json(`/api/charges/${future.id}/reminder`)).toMatchObject({ blockedReason: "not_overdue", overdueMinor: 16000000 });
	});
	it("rejects another tenant, active branch, unauthenticated access and missing IDs", async () => {
		const { first } = await fixture(); const path = `/api/charges/${first}/reminder`;
		expect((await callApi(path)).status).toBe(401);
		expect((await callApi(path, outsider)).status).toBe(404);
		expect((await callApi("/api/charges/missing/reminder", owner)).status).toBe(404);
		await getAuth(env).api.setActiveTeam({ headers: owner.headers, body: { teamId: otherBranch } });
		expect((await callApi(path, owner)).status).toBe(404);
	});
	it("blocks void fees and excludes their balances", async () => {
		const { first } = await fixture();
		await json(`/api/charges/${first}/void`, { reason: "Fixture cancellation" }, "PATCH");
		expect(await json(`/api/charges/${first}/reminder`)).toMatchObject({ blockedReason: "not_overdue", overdueMinor: 8000000 });
	});
	it("encodes the reviewed text and only accepts international phone numbers", () => {
		const message = "¡Hola Ana!\nSaldo: $ 80.000 & gracias #1";
		const url = new URL(whatsappReminderUrl("+573001112233", message));
		expect(url.origin).toBe("https://wa.me"); expect(url.pathname).toBe("/573001112233"); expect(url.searchParams.get("text")).toBe(message);
		for (const phone of ["3001112233", "+00012345678", "+57300?text=oops", "https://example.com"]) expect(() => whatsappReminderUrl(phone, message)).toThrow();
		for (const text of [" ", "a".repeat(2001)]) expect(() => whatsappReminderUrl("+573001112233", text)).toThrow();
	});
});
