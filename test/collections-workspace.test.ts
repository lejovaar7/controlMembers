import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getAuth } from "../src/worker/auth";
import { callApi, createActor, seedLegacyMember, type Actor } from "./helpers";
import { legacyCollectionUrl, paymentMonthQuery } from "../src/react-app/lib/collections-navigation";

let owner: Actor; let outsider: Actor; let branch: string; let otherBranch: string; let plan: string;
type Fee = { id: string; billingPeriod: string; outstandingMinor: number };
async function json<T>(path: string, body?: unknown, method?: string): Promise<T> {
	const response = await callApi(path, owner, body, method);
	expect(response.ok, `${path}: ${response.status}`).toBe(true); return await response.json() as T;
}
beforeAll(async () => {
	owner = await createActor("collections-owner@test.invalid"); outsider = await createActor("collections-outsider@test.invalid");
	const auth = getAuth(env);
	const org = (await auth.api.createOrganization({ body: { name: "Collections", slug: "collections", userId: owner.userId } }))!;
	const foreign = (await auth.api.createOrganization({ body: { name: "Foreign collections", slug: "foreign-collections", userId: outsider.userId } }))!;
	await auth.api.setActiveOrganization({ headers: owner.headers, body: { organizationId: org.id } });
	await auth.api.setActiveOrganization({ headers: outsider.headers, body: { organizationId: foreign.id } });
	branch = (await auth.api.createTeam({ headers: owner.headers, body: { organizationId: org.id, name: "Main" } })).id;
	otherBranch = (await auth.api.createTeam({ headers: owner.headers, body: { organizationId: org.id, name: "Other" } })).id;
	for (const teamId of [branch, otherBranch]) await auth.api.addTeamMember({ headers: owner.headers, body: { teamId, userId: owner.userId } });
	await json("/api/product/settings", { currency: "COP", timezone: "America/Bogota" }, "PATCH");
	plan = (await json<{ id: string }>("/api/plans", { name: "Monthly", amountMinor: 8000000, defaultDueDay: 5, branchIds: [branch, otherBranch] })).id;
});
beforeEach(async () => { await getAuth(env).api.setActiveTeam({ headers: owner.headers, body: { teamId: branch } }); });
async function fixture() {
	const id = (await seedLegacyMember(owner, { displayName: `Member ${crypto.randomUUID()}`, primaryBranchId: branch })).id;
	await json(`/api/customer-members/${id}/enrollments`, { planId: plan, branchId: branch, startDate: "2026-01-01", firstDueDate: "2026-01-05" });
	for (const period of ["2026-01", "2026-02", "2026-03"]) await json("/api/charges/generate", { period });
	const detail = await json<{ charges: Fee[] }>(`/api/customer-members/${id}`);
	return { id, fees: detail.charges.sort((a, b) => a.billingPeriod.localeCompare(b.billingPeriod)) };
}
describe("collections workspace contracts", () => {
	it("identifies the fee covered by each same-day receipt and exposes its actual payment state", async () => {
		const { id, fees } = await fixture();
		const base = { memberId: id, branchId: branch, amountMinor: 8000000, method: "cash", paidAt: "2026-02-07T15:00:00Z" };
		const first = await json<{ id: string }>("/api/payments", { ...base, allocations: [{ chargeId: fees[0]!.id, amountMinor: 8000000 }], idempotencyKey: crypto.randomUUID() });
		const second = await json<{ id: string }>("/api/payments", { ...base, allocations: [{ chargeId: fees[1]!.id, amountMinor: 8000000 }], idempotencyKey: crypto.randomUUID() });
		const detail = await json<{ charges: Array<{ id: string; branchId: string; paymentState: string }>; payments: Array<{ id: string; allocatedMinor: number; creditMinor: number; applications: Array<{ billingPeriod: string; amountMinor: number }> }> }>(`/api/customer-members/${id}`);
		for (const fee of fees.slice(0, 2)) expect(detail.charges.find((item) => item.id === fee.id)).toMatchObject({ paymentState: "paid", branchId: branch });
		expect(detail.payments.find((item) => item.id === first.id)).toMatchObject({ allocatedMinor: 8000000, creditMinor: 0, applications: [{ billingPeriod: "2026-01", amountMinor: 8000000 }] });
		expect(detail.payments.find((item) => item.id === second.id)?.applications[0]?.billingPeriod).toBe("2026-02");
		const history = await json<{ payments: typeof detail.payments }>(`/api/payments?memberId=${id}`);
		expect(history.payments.find((item) => item.id === second.id)?.applications[0]?.billingPeriod).toBe("2026-02");
		await json(`/api/payments/${first.id}/reverse`, { reason: "Fixture reversal" }, "PATCH");
		const reversed = await json<typeof detail>(`/api/customer-members/${id}`);
		expect(reversed.charges.find((item) => item.id === fees[0]!.id)?.paymentState).toBe("overdue");
		expect(reversed.payments.find((item) => item.id === first.id)).toMatchObject({ creditMinor: 0, applications: [{ billingPeriod: "2026-01" }] });
	});
	it("requires explicit advance consent after every fee is paid and keeps retries idempotent", async () => {
		const { id, fees } = await fixture();
		const base = { memberId: id, branchId: branch, amountMinor: 8000000, method: "cash", paidAt: "2026-02-07T15:00:00Z" };
		for (const fee of fees) await json("/api/payments", { ...base, allocations: [{ chargeId: fee.id, amountMinor: 8000000 }], idempotencyKey: crypto.randomUUID() });
		const extra = { ...base, idempotencyKey: crypto.randomUUID() };
		const rejected = await callApi("/api/payments", owner, extra);
		expect(rejected.status).toBe(409); expect(await rejected.json()).toMatchObject({ error: "CREDIT_CONFIRMATION_REQUIRED" });
		expect((await json<{ payments: unknown[] }>(`/api/payments?memberId=${id}`)).payments).toHaveLength(3);
		const explicit = { ...extra, allowCredit: true };
		const advance = await json<{ id: string }>("/api/payments", explicit);
		expect(await json("/api/payments", explicit)).toMatchObject({ id: advance.id, allocatedMinor: 0, creditMinor: 8000000 });
		expect((await json<{ payments: unknown[] }>(`/api/payments?memberId=${id}`)).payments).toHaveLength(4);
		expect((await callApi("/api/payments", owner, { ...explicit, idempotencyKey: crypto.randomUUID(), allocations: [{ chargeId: fees[0]!.id, amountMinor: 8000000 }] })).status).toBe(409);
	});
	it("requires explicit consent for partial overpayments too", async () => {
		const { id, fees } = await fixture();
		const input = { memberId: id, branchId: branch, amountMinor: 10000000, method: "cash", paidAt: "2026-02-07T15:00:00Z", allocations: [{ chargeId: fees[0]!.id, amountMinor: 8000000 }], idempotencyKey: crypto.randomUUID() };
		expect((await callApi("/api/payments", owner, input)).status).toBe(409);
		expect((await callApi("/api/payments", owner, { ...input, allowCredit: "true" })).status).toBe(400);
		expect(await json("/api/payments", { ...input, allowCredit: true })).toMatchObject({ allocatedMinor: 8000000, creditMinor: 2000000 });
	});
	it("saves a due-day change for future fees and requires a valid day and reason", async () => {
		const { id } = await fixture();
		const before = await json<{ enrollments: Array<{ id: string; dueDay: number; paymentDue: { date: string; kind: string } }>; charges: Array<{ id: string; dueDate: string }> }>(`/api/customer-members/${id}`);
		const endpoint = `/api/enrollments/${before.enrollments[0]!.id}`;
		for (const dueDay of [0, 32, 123, 1.5]) expect((await callApi(endpoint, owner, { dueDay, reason: "Fixture correction" }, "PATCH")).status).toBe(400);
		expect((await callApi(endpoint, owner, { dueDay: 12, reason: "" }, "PATCH")).status).toBe(400);
		await json(endpoint, { agreedAmountMinor: 8000000, discountMinor: 0, dueDay: 12, reason: "New agreed due day" }, "PATCH");
		const after = await json<typeof before>(`/api/customer-members/${id}`);
		expect(after.enrollments[0]!.dueDay).toBe(12);
		expect(after.enrollments[0]!.paymentDue).toEqual({ date: "2026-01-05", kind: "pending" });
		expect(after.charges.map(({ id: chargeId, dueDate }) => ({ id: chargeId, dueDate }))).toEqual(before.charges.map(({ id: chargeId, dueDate }) => ({ id: chargeId, dueDate })));
		await json("/api/charges/generate", { period: "2026-04" });
		const generated = await json<{ charges: Array<{ billingPeriod: string; dueDate: string }> }>(`/api/customer-members/${id}`);
		expect(generated.charges.find((fee) => fee.billingPeriod === "2026-04")?.dueDate).toBe("2026-04-12");
	});
	it("targets a later fee without paying older debt and returns its current balance", async () => {
		const { id, fees } = await fixture(); const target = fees[1]!;
		const preview = await json<{ allocations: Array<{ chargeId: string; amountMinor: number }>; creditMinor: number }>(`/api/customer-members/${id}/payment-preview?amountMinor=5000000&chargeId=${target.id}`);
		expect(preview).toMatchObject({ allocations: [{ chargeId: target.id, amountMinor: 5000000, outstandingMinor: 8000000, billingPeriod: "2026-02" }], creditMinor: 0 });
		const body = { memberId: id, branchId: branch, amountMinor: 5000000, method: "cash", paidAt: "2026-02-07T15:00:00Z", allocations: preview.allocations.map(({ chargeId, amountMinor }) => ({ chargeId, amountMinor })), idempotencyKey: crypto.randomUUID() };
		const first = await json<{ id: string; receiptNumber: string }>("/api/payments", body);
		expect(await json("/api/payments", body)).toMatchObject({ id: first.id, receiptNumber: first.receiptNumber });
		const after = await json<{ charges: Fee[] }>(`/api/customer-members/${id}`);
		expect(after.charges.find((fee) => fee.id === fees[0]!.id)!.outstandingMinor).toBe(8000000);
		expect(after.charges.find((fee) => fee.id === target.id)!.outstandingMinor).toBe(3000000);
		await json("/api/payments", { ...body, amountMinor: 3000000, allocations: [{ chargeId: target.id, amountMinor: 3000000 }], idempotencyKey: crypto.randomUUID() });
		expect((await callApi(`/api/customer-members/${id}/payment-preview?amountMinor=100&chargeId=${target.id}`, owner)).status).toBe(409);
		expect((await callApi("/api/payments", { ...owner }, { ...body, idempotencyKey: crypto.randomUUID() })).status).toBe(409);
		await json(`/api/payments/${first.id}/reverse`, { reason: "Fixture correction" }, "PATCH");
		expect(await json(`/api/customer-members/${id}/payment-preview?amountMinor=8000000&chargeId=${target.id}`)).toMatchObject({ allocations: [{ chargeId: target.id, amountMinor: 5000000 }], creditMinor: 3000000 });
	});
	it("filters all unpaid periods before pagination, retaining partial overdue fees", async () => {
		const { id, fees } = await fixture();
		await json("/api/payments", { memberId: id, branchId: branch, amountMinor: 8100000, method: "cash", paidAt: "2026-03-15T15:00:00Z", allocations: [{ chargeId: fees[0]!.id, amountMinor: 8000000 }, { chargeId: fees[1]!.id, amountMinor: 100000 }], idempotencyKey: crypto.randomUUID() });
		await json(`/api/charges/${fees[2]!.id}/void`, { reason: "Fixture cancellation" }, "PATCH");
		const name = (await json<{ member: { displayName: string } }>(`/api/customer-members/${id}`)).member.displayName;
		const result = await json<{ charges: Fee[]; nextOffset: number | null }>(`/api/charges?state=unpaid&limit=1&search=${encodeURIComponent(name)}`);
		expect(result.charges.map((fee) => fee.id)).toEqual([fees[1]!.id]); expect(result.nextOffset).toBeNull();
		expect(result.charges[0]!.outstandingMinor).toBe(7900000);
	});
	it("rejects simultaneous allocations exceeding the same fee balance", async () => {
		const { id, fees } = await fixture();
		const body = { memberId: id, branchId: branch, amountMinor: 8000000, method: "cash", paidAt: "2026-02-07T15:00:00Z", allocations: [{ chargeId: fees[0]!.id, amountMinor: 8000000 }] };
		const responses = await Promise.all([callApi("/api/payments", owner, { ...body, idempotencyKey: crypto.randomUUID() }), callApi("/api/payments", owner, { ...body, idempotencyKey: crypto.randomUUID() })]);
		expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
		const history = await json<{ payments: unknown[] }>(`/api/payments?memberId=${id}`);
		expect(history.payments).toHaveLength(1);
	});
	it("returns the same receipt for simultaneous retries of one payment", async () => {
		const { id, fees } = await fixture();
		const body = { memberId: id, branchId: branch, amountMinor: 8000000, method: "cash", paidAt: "2026-02-07T15:00:00Z", allocations: [{ chargeId: fees[0]!.id, amountMinor: 8000000 }], idempotencyKey: crypto.randomUUID() };
		const responses = await Promise.all([callApi("/api/payments", owner, body), callApi("/api/payments", owner, body)]);
		expect(responses.map((response) => response.status)).toEqual([201, 201]);
		const receipts = await Promise.all(responses.map((response) => response.json() as Promise<{ id: string }>));
		expect(receipts[0]!.id).toBe(receipts[1]!.id);
		expect((await json<{ payments: unknown[] }>(`/api/payments?memberId=${id}`)).payments).toHaveLength(1);
	});
	it("rejects another Member, tenant or active Branch as a target", async () => {
		const { id, fees } = await fixture(); const second = await fixture();
		const url = `/api/customer-members/${id}/payment-preview?amountMinor=100&chargeId=${fees[0]!.id}`;
		expect((await callApi(url, outsider)).status).toBe(404);
		expect((await callApi(`/api/customer-members/${id}/payment-preview?amountMinor=100&chargeId=${second.fees[0]!.id}`, owner)).status).toBe(404);
		await getAuth(env).api.setActiveTeam({ headers: owner.headers, body: { teamId: otherBranch } });
		expect((await callApi(url, owner)).status).toBe(404);
	});
	it("uses company-local receipt dates consistently with dashboard drill-through", async () => {
		const { id } = await fixture();
		for (const paidAt of ["2026-04-01T04:59:59Z", "2026-04-01T05:00:00Z", "2026-05-01T04:59:59Z", "2026-05-01T05:00:00Z"]) await json("/api/payments", { memberId: id, branchId: branch, amountMinor: 100, method: "cash", paidAt, allowCredit: true, allocations: [], idempotencyKey: crypto.randomUUID() });
		const result = await json<{ payments: unknown[] }>(`/api/payments?${paymentMonthQuery("2026-04")}&memberId=${id}`);
		expect(result.payments).toHaveLength(2);
		expect((await callApi("/api/payments?dateFrom=2026-02-30", owner)).status).toBe(400);
		expect((await callApi("/api/payments?dateFrom=2026-04-30&dateTo=2026-04-01", owner)).status).toBe(400);
	});
	it("preserves legacy link semantics without allowing URL workspace overrides", () => {
		expect(legacyCollectionUrl("fees", "?period=2026-09&search=Ana&branchId=foreign")).toBe("/app/collections/fees?period=2026-09&search=Ana&state=all");
		expect(legacyCollectionUrl("fees", "?period=2026-09&state=overdue")).toContain("state=overdue");
		expect(legacyCollectionUrl("payments", "?method=cash")).toBe("/app/collections/payments?method=cash&status=all");
		expect(paymentMonthQuery("2028-02")).toContain("dateTo=2028-02-29");
	});
});
