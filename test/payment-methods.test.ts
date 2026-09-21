import { env } from "cloudflare:test";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getAuth } from "../src/worker/auth";
import { getDb } from "../src/worker/db";
import { member } from "../src/worker/db/auth-schema";
import { auditEvent, payment } from "../src/worker/db/schema";
import { callApi, createActor, seedLegacyMember, type Actor } from "./helpers";

let owner: Actor, staff: Actor, foreign: Actor;
let organizationId: string, branchId: string, memberId: string;
beforeAll(async () => {
	owner = await createActor("methods-owner@test.invalid");
	staff = await createActor("methods-staff@test.invalid");
	foreign = await createActor("methods-foreign@test.invalid");
	const auth = getAuth(env);
	const org = await auth.api.createOrganization({ body: { name: "Methods", slug: "methods", userId: owner.userId } });
	const other = await auth.api.createOrganization({ body: { name: "Other methods", slug: "other-methods", userId: foreign.userId } });
	if (!org || !other) throw new Error("Missing organizations");
	organizationId = org.id;
	await auth.api.setActiveOrganization({ headers: owner.headers, body: { organizationId } });
	await auth.api.setActiveOrganization({ headers: foreign.headers, body: { organizationId: other.id } });
	branchId = (await auth.api.createTeam({ headers: owner.headers, body: { organizationId, name: "Main" } })).id;
	await auth.api.addMember({ body: { organizationId, userId: staff.userId, role: "member", teamId: branchId, allBranches: false } });
	await auth.api.setActiveOrganization({ headers: staff.headers, body: { organizationId } });
	expect((await callApi("/api/product/settings", owner, { currency: "COP", timezone: "America/Bogota" }, "PATCH")).status).toBe(200);
	memberId = (await seedLegacyMember(owner, { displayName: "Method QA", primaryBranchId: branchId })).id;
});
async function add(name: string) {
	const response = await callApi("/api/payment-methods", owner, { name });
	expect(response.status).toBe(201);
	return await response.json() as { id: string; name: string };
}
function paymentInput(method: string) { return { memberId, branchId, allowCredit: true, amountMinor: 500, method, paidAt: "2026-09-17T12:00:00.000Z", idempotencyKey: crypto.randomUUID() }; }

describe("company payment methods", () => {
	it("starts with cash only, authenticates reads and protects the default", async () => {
		expect((await callApi("/api/payment-methods")).status).toBe(401);
		expect(await (await callApi("/api/payment-methods", staff)).json()).toEqual({ methods: [{ id: "cash", name: null, isActive: true, readOnly: true }], canManage: false });
		expect((await callApi("/api/payment-methods/cash", owner, { name: "Wallet", isActive: false }, "PATCH")).status).toBe(404);
		for (const name of ["Efectivo", " CASH ", "   ", "a".repeat(81)]) expect((await callApi("/api/payment-methods", owner, { name })).status).toBe(name.trim() && name.length < 81 ? 409 : 400);
	});

	it("checks company-wide management permissions on writes", async () => {
		expect((await callApi("/api/payment-methods", staff, { name: "Forbidden" })).status).toBe(403);
		const where = and(eq(member.organizationId, organizationId), eq(member.userId, staff.userId));
		await getDb(env).update(member).set({ role: "admin", allBranches: false }).where(where);
		expect((await callApi("/api/payment-methods", staff, { name: "Forbidden" })).status).toBe(403);
		await getDb(env).update(member).set({ allBranches: true }).where(where);
		const created = await callApi("/api/payment-methods", staff, { name: "Admin method" });
		expect(created.status).toBe(201);
		const { id } = await created.json() as { id: string };
		expect((await callApi(`/api/payment-methods/${id}`, staff, { name: "Admin renamed" }, "PATCH")).status).toBe(200);
		await getDb(env).update(member).set({ role: "member", allBranches: false }).where(where);
		expect((await callApi(`/api/payment-methods/${id}`, staff, { isActive: false }, "PATCH")).status).toBe(403);
	});

	it("normalizes duplicate names and isolates catalogs and updates", async () => {
		const custom = await add("  Nequi  Personal  ");
		expect(custom.name).toBe("Nequi Personal");
		expect((await callApi("/api/payment-methods", owner, { name: "nequi personal" })).status).toBe(409);
		expect((await callApi("/api/payment-methods", foreign, { name: "Nequi Personal" })).status).toBe(201);
		expect((await callApi(`/api/payment-methods/${custom.id}`, foreign, { isActive: false }, "PATCH")).status).toBe(404);
		const foreignCatalog = await (await callApi("/api/payment-methods?inactive=1", foreign)).json() as { methods: Array<{ id: string }> };
		expect(foreignCatalog.methods.some(({ id }) => id === custom.id)).toBe(false);
		const another = await add("Daviplata");
		expect((await callApi(`/api/payment-methods/${another.id}`, owner, { name: "NEQUI PERSONAL" }, "PATCH")).status).toBe(409);
		const events = await getDb(env).select().from(auditEvent).where(and(eq(auditEvent.organizationId, organizationId), eq(auditEvent.subjectId, custom.id)));
		expect(events.map((event) => event.eventType)).toContain("payment_method.created");
	});

	it("rejects legacy, unknown, foreign and inactive methods for new payments", async () => {
		const result = await callApi("/api/payment-methods", foreign, { name: "Foreign only" });
		const foreignId = (await result.json() as { id: string }).id;
		const archived = await add("Archived");
		expect((await callApi(`/api/payment-methods/${archived.id}`, owner, { isActive: false }, "PATCH")).status).toBe(200);
		for (const method of ["bank_transfer", "card", "other", "unknown", foreignId, archived.id]) {
			expect((await callApi("/api/payments", staff, paymentInput(method))).status).toBe(400);
		}
		expect((await callApi("/api/payment-methods", owner, { name: "ARCHIVED" })).status).toBe(409);
	});

	it("preserves snapshots, filters, exports and idempotent retries after changes", async () => {
		const custom = await add("Nequi");
		const input = paymentInput(custom.id);
		const first = await callApi("/api/payments", staff, input);
		expect(first.status).toBe(201);
		const saved = await first.json() as { id: string; method: string; methodName: string };
		expect(saved).toMatchObject({ method: custom.id, methodName: "Nequi" });
		expect((await callApi(`/api/payment-methods/${custom.id}`, owner, { name: "Nequi business", isActive: false }, "PATCH")).status).toBe(200);
		const retry = await callApi("/api/payments", staff, input);
		expect(retry.status).toBe(201);
		expect(await retry.json()).toMatchObject({ id: saved.id, methodName: "Nequi" });
		expect((await callApi("/api/payments", staff, { ...input, amountMinor: 1000 })).status).toBe(409);
		const history = await (await callApi(`/api/payments?method=${custom.id}`, staff)).json() as { payments: Array<{ methodName: string }> };
		expect(history.payments).toHaveLength(1);
		expect(history.payments[0]).toMatchObject({ methodName: "Nequi" });
		expect(await (await callApi("/api/payments?method=other", staff)).json()).toMatchObject({ payments: [] });
		expect(await (await callApi("/api/exports/payments", owner)).text()).toContain('"Nequi"');
		const active = await (await callApi("/api/payment-methods", staff)).json() as { methods: Array<{ id: string }> };
		expect(active.methods.some(({ id }) => id === custom.id)).toBe(false);
		expect((await callApi(`/api/payment-methods/${custom.id}`, owner, { isActive: true }, "PATCH")).status).toBe(200);
		const next = await callApi("/api/payments", staff, paymentInput(custom.id));
		expect(await next.json()).toMatchObject({ methodName: "Nequi business" });
	});

	it("retains legacy history without offering old defaults for new payments", async () => {
		const cash = await callApi("/api/payments", staff, paymentInput("cash"));
		const { id } = await cash.json() as { id: string };
		await getDb(env).update(payment).set({ method: "card" }).where(eq(payment.id, id));
		const filtered = await (await callApi("/api/payments?method=card", staff)).json() as { payments: unknown[] };
		expect(filtered.payments).toHaveLength(1);
		const history = await (await callApi("/api/payment-methods?history=1", staff)).json() as { methods: Array<{ id: string; isActive: boolean }> };
		expect(history.methods).toContainEqual({ id: "card", name: null, isActive: false, readOnly: true });
		const active = await (await callApi("/api/payment-methods", staff)).json() as { methods: Array<{ id: string }> };
		expect(active.methods.some(({ id }) => id === "card")).toBe(false);
		expect((await callApi(`/api/payments/${id}/reverse`, owner, { reason: "Test correction" }, "PATCH")).status).toBe(200);
	});
});
