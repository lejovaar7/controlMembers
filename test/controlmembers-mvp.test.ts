import { env } from "cloudflare:test";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getAuth } from "../src/worker/auth";
import { getDb } from "../src/worker/db";
import { member } from "../src/worker/db/auth-schema";
import { auditEvent, contact, customerMember } from "../src/worker/db/schema";
import { callApi, createActor, type Actor } from "./helpers";

let owner: Actor;
let staff: Actor;
let foreignOwner: Actor;
let organizationId: string;
let branchId: string;
let foreignBranchId: string;
let customerId: string;
let planId: string;
let januaryChargeId: string;
let paymentId: string;

async function expectMemberBalance(outstandingMinor: number) {
	const response = await callApi("/api/customer-members?search=Ana&limit=1", staff);
	expect(response.status).toBe(200);
	expect(await response.json()).toMatchObject({ members: [{ id: customerId, outstandingMinor }], nextOffset: null, currency: "COP" });
}

beforeAll(async () => {
	owner = await createActor("mvp-owner@test.invalid");
	staff = await createActor("mvp-staff@test.invalid");
	foreignOwner = await createActor("mvp-foreign@test.invalid");
	const auth = getAuth(env);
	const organization = await auth.api.createOrganization({ body: { name: "MVP Academy", slug: "mvp-academy", userId: owner.userId } });
	const foreign = await auth.api.createOrganization({ body: { name: "Foreign Academy", slug: "foreign-academy", userId: foreignOwner.userId } });
	if (!organization || !foreign) throw new Error("organizations missing");
	organizationId = organization.id;
	await auth.api.setActiveOrganization({ headers: owner.headers, body: { organizationId } });
	await auth.api.setActiveOrganization({ headers: foreignOwner.headers, body: { organizationId: foreign.id } });
	branchId = (await auth.api.createTeam({ headers: owner.headers, body: { organizationId, name: "Sede Principal" } })).id;
	foreignBranchId = (await auth.api.createTeam({ headers: foreignOwner.headers, body: { organizationId: foreign.id, name: "Foreign" } })).id;
	await auth.api.addMember({ body: { organizationId, userId: staff.userId, role: "member", teamId: branchId, allBranches: false } });
	await auth.api.setActiveOrganization({ headers: staff.headers, body: { organizationId } });
	const settings = await callApi("/api/product/settings", owner, { currency: "COP", timezone: "America/Bogota" }, "PATCH");
	expect(settings.status).toBe(200);
	const planResponse = await callApi("/api/plans", owner, { name: "Fútbol infantil", amountMinor: 10000, defaultDueDay: 5, branchIds: [branchId], tagNames: ["Fútbol", "Niños"] });
	planId = (await planResponse.json() as { id: string }).id;
});

describe("ControlMembers MVP workflow", () => {
	it("creates a customer Member independently from authenticated users", async () => {
		const response = await callApi("/api/customer-members", owner, { displayName: "Ana Pérez", primaryBranchId: branchId, documentType: "TI", documentNumber: "1001", email: "ana@example.test", phoneE164: "+573001112233", planId, startDate: "2026-01-01", firstDueDate: "2026-01-05" });
		expect(response.status).toBe(201);
		const created = await response.json() as { id: string; status: string; outstandingMinor: number };
		customerId = created.id;
		expect(created).toMatchObject({ status: "active", outstandingMinor: 0 });
		const [stored] = await getDb(env).select().from(customerMember).where(eq(customerMember.id, customerId));
		expect(stored).toMatchObject({ organizationId, displayName: "Ana Pérez", normalizedDocument: "1001" });
		const list = await callApi("/api/customer-members?search=&status=&offset=0", owner);
		expect(list.status).toBe(200);
		expect(await list.json()).toMatchObject({ members: [{ id: customerId, outstandingMinor: 0 }] });
		expect((await callApi("/api/customer-members", owner, { displayName: "Foreign", primaryBranchId: foreignBranchId })).status).toBe(404);
	});

	it("adds a responsible billing Contact and returns scoped detail", async () => {
		const response = await callApi(`/api/customer-members/${customerId}/contacts`, staff, { displayName: "Laura Pérez", relationship: "mother", phoneE164: "+573009998877", isPrimary: true, isBillingContact: true, whatsappConsent: "granted" });
		expect(response.status).toBe(201);
		const detail = await callApi(`/api/customer-members/${customerId}`, staff);
		const body = await detail.json() as { contacts: Array<{ displayName: string; isBillingContact: boolean }> };
		expect(body.contacts).toEqual([expect.objectContaining({ displayName: "Laura Pérez", isBillingContact: true })]);
	});

	it("enrolls the Member using Plan price and a chosen first due date, rejecting overlap", async () => {
		const detail = await (await callApi(`/api/customer-members/${customerId}`, staff)).json() as { enrollments: Array<{ agreedAmountMinor: number; dueDay: number; status: string }> };
		expect(detail.enrollments).toEqual([expect.objectContaining({ agreedAmountMinor: 10000, dueDay: 5, status: "active" })]);
		const duplicate = await callApi(`/api/customer-members/${customerId}/enrollments`, staff, { planId, branchId, startDate: "2026-02-01" });
		expect(duplicate.status).toBe(409);
	});

	it("generates idempotent monthly Charges and derives overdue state", async () => {
		const first = await callApi("/api/charges/generate", owner, { period: "2026-01" });
		expect(first.status).toBe(200);
		expect(await first.json()).toMatchObject({ created: 1, alreadyExisting: 0 });
		const retry = await callApi("/api/charges/generate", owner, { period: "2026-01" });
		expect(await retry.json()).toMatchObject({ created: 0, alreadyExisting: 1 });
		const list = await callApi("/api/charges?period=2026-01", staff);
		const body = await list.json() as { charges: Array<{ id: string; paymentState: string; outstandingMinor: number }> };
		januaryChargeId = body.charges[0]!.id;
		expect(body.charges[0]).toMatchObject({ paymentState: "overdue", outstandingMinor: 10000 });
		await expectMemberBalance(10000);
	});

	it("posts a partial Payment once and preserves Member credit math", async () => {
		const input = { memberId: customerId, branchId, amountMinor: 4000, method: "cash", paidAt: "2026-01-15T15:00:00.000Z", idempotencyKey: "pay-partial-1" };
		const first = await callApi("/api/payments", staff, input);
		expect(first.status).toBe(201);
		const result = await first.json() as { id: string; allocatedMinor: number; creditMinor: number };
		paymentId = result.id;
		expect(result).toMatchObject({ allocatedMinor: 4000, creditMinor: 0 });
		const retry = await callApi("/api/payments", staff, input);
		expect(retry.status).toBe(201);
		expect((await retry.json() as { id: string }).id).toBe(paymentId);
		const chargeList = await callApi("/api/charges?period=2026-01", owner);
		expect((await chargeList.json() as { charges: Array<{ paymentState: string; outstandingMinor: number }> }).charges[0]).toMatchObject({ paymentState: "partial", outstandingMinor: 6000 });
		await expectMemberBalance(6000);
	});

	it("requires permission to reverse and restores the Charge balance", async () => {
		expect((await callApi(`/api/payments/${paymentId}/reverse`, staff, { reason: "Wrong amount" }, "PATCH")).status).toBe(403);
		expect((await callApi(`/api/payments/${paymentId}/reverse`, owner, { reason: "Wrong amount" }, "PATCH")).status).toBe(200);
		const list = await callApi("/api/charges?period=2026-01", owner);
		expect((await list.json() as { charges: Array<{ outstandingMinor: number }> }).charges[0]!.outstandingMinor).toBe(10000);
		await expectMemberBalance(10000);
	});

	it("adjusts and voids an unallocated Charge with audit evidence", async () => {
		await callApi("/api/charges/generate", owner, { period: "2026-02" });
		const list = await callApi("/api/charges?period=2026-02", owner);
		const chargeId = (await list.json() as { charges: Array<{ id: string }> }).charges[0]!.id;
		expect((await callApi(`/api/charges/${chargeId}/adjust`, owner, { adjustmentMinor: 1000, reason: "Equipment fee" }, "PATCH")).status).toBe(200);
		await expectMemberBalance(21000);
		expect((await callApi(`/api/charges/${chargeId}/void`, owner, { reason: "Created by mistake" }, "PATCH")).status).toBe(200);
		await expectMemberBalance(10000);
		const events = await getDb(env).select().from(auditEvent).where(and(eq(auditEvent.organizationId, organizationId), eq(auditEvent.subjectId, chargeId)));
		expect(events.map((event) => event.eventType)).toEqual(expect.arrayContaining(["charge.adjusted", "charge.voided"]));
	});

	it("reconciles member balances and dashboard metrics after multiple replacement Payments", async () => {
		for (const amountMinor of [6000, 4000]) {
			const payment = await callApi("/api/payments", owner, { memberId: customerId, branchId, amountMinor, method: "cash", paidAt: "2026-01-20T12:00:00.000Z", idempotencyKey: `pay-replacement-${amountMinor}`, allocations: [{ chargeId: januaryChargeId, amountMinor }] });
			expect(payment.status).toBe(201);
			await expectMemberBalance(amountMinor === 6000 ? 4000 : 0);
		}
		const dashboard = await callApi("/api/dashboard?period=2026-01", owner);
		expect(await dashboard.json()).toMatchObject({ expectedMinor: 10000, collectedMinor: 10000, allocatedMinor: 10000, outstandingMinor: 0, overdueMembers: 0, collectionRate: 1 });
	});

	it("previews and confirms a bounded idempotent CSV Member import", async () => {
		const header = "member_name,branch_id,document_type,document_number,email,phone,status,external_reference,contact_name,contact_email,contact_phone,relationship,billing_contact";
		const csv = `${header}\nCarlos Ruiz,${branchId},CC,2002,carlos@example.test,+573002221111,active,legacy-2,,,,,false`;
		const preview = await callApi("/api/imports/members/preview", owner, { csv });
		expect(await preview.json()).toMatchObject({ validCount: 1, invalidCount: 0, warningCount: 0 });
		const before = await getDb(env).select().from(customerMember).where(eq(customerMember.organizationId, organizationId));
		expect(before).toHaveLength(1);
		const confirmed = await callApi("/api/imports/members/confirm", owner, { csv, idempotencyKey: "import-1" });
		expect(await confirmed.json()).toMatchObject({ created: 1, skipped: 0, failed: 0 });
		const retry = await callApi("/api/imports/members/confirm", owner, { csv, idempotencyKey: "import-1" });
		expect(await retry.json()).toMatchObject({ created: 1, skipped: 0, failed: 0 });
	});

	it("provides report balances and safe CSV exports only in scope", async () => {
		const balances = await callApi("/api/reports/member-balances", owner);
		expect((await balances.json() as { balances: unknown[] }).balances).toHaveLength(2);
		const exported = await callApi("/api/exports/members", owner);
		expect(exported.status).toBe(200);
		expect(exported.headers.get("content-type")).toContain("text/csv");
		expect(await exported.text()).toContain("Ana Pérez");
		expect((await callApi("/api/customer-members", foreignOwner)).status).toBe(200);
		expect((await (await callApi("/api/customer-members", foreignOwner)).json() as { members: unknown[] }).members).toHaveLength(0);
	});

	it("reports aging and period totals from the same active ledger", async () => {
		const response = await callApi("/api/reports/financial-summary?period=2026-01", owner);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			period: "2026-01",
			aging: { current: 0, days1To30: 0, days31To60: 0, days61To90: 0, days90Plus: 0 },
			plans: [expect.objectContaining({ name: "Fútbol infantil", expectedMinor: 10000, allocatedMinor: 10000, outstandingMinor: 0 })],
			branches: [expect.objectContaining({ name: "Sede Principal", expectedMinor: 10000, allocatedMinor: 10000, outstandingMinor: 0 })],
		});
	});

	it("lets the Owner grant financial permissions and audits the change", async () => {
		expect((await callApi("/api/reports/member-balances", staff)).status).toBe(403);
		const [membership] = await getDb(env).select().from(member).where(and(eq(member.organizationId, organizationId), eq(member.userId, staff.userId)));
		if (!membership) throw new Error("staff membership missing");
		const updated = await callApi(`/api/members/${membership.id}`, owner, { role: "member", branchIds: [branchId], allBranches: false, canViewReports: true, canExportFinancialData: true }, "PATCH");
		expect(updated.status).toBe(200);
		expect((await callApi("/api/reports/member-balances", staff)).status).toBe(200);
		expect((await callApi("/api/exports/member-balances", staff)).status).toBe(200);
		const events = await getDb(env).select().from(auditEvent).where(and(eq(auditEvent.organizationId, organizationId), eq(auditEvent.subjectId, membership.id)));
		expect(events.map((event) => event.eventType)).toContain("user.permissions_changed");
	});

	it("reuses one Contact across siblings and updates each relationship", async () => {
		const firstDetail = await callApi(`/api/customer-members/${customerId}`, owner);
		const [existingContact] = (await firstDetail.json() as { contacts: Array<{ id: string }> }).contacts;
		if (!existingContact) throw new Error("contact missing");
		const siblingResponse = await callApi("/api/customer-members", owner, { displayName: "Sofía Pérez", primaryBranchId: branchId, planId, startDate: "2027-01-01", firstDueDate: "2027-01-05" });
		const siblingId = (await siblingResponse.json() as { id: string }).id;
		const linked = await callApi(`/api/customer-members/${siblingId}/contacts`, owner, { contactId: existingContact.id, relationship: "mother", isPrimary: true, isBillingContact: true });
		expect(linked.status).toBe(201);
		const contacts = await getDb(env).select().from(contact).where(eq(contact.organizationId, organizationId));
		expect(contacts).toHaveLength(1);
		const siblingDetail = await callApi(`/api/customer-members/${siblingId}`, owner);
		expect((await siblingDetail.json() as { contacts: Array<{ id: string }> }).contacts[0]?.id).toBe(existingContact.id);
	});

	it("locks Organization currency after financial history exists", async () => {
		const response = await callApi("/api/product/settings", owner, { currency: "USD", timezone: "America/Bogota" }, "PATCH");
		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({ error: "CURRENCY_LOCKED" });
	});

	it("allows staff to create an audited signup fee but not a monthly batch", async () => {
		const newMember = await callApi("/api/customer-members", staff, { displayName: "Signup fee test", primaryBranchId: branchId, planId, startDate: "2026-09-30" });
		expect(newMember.status).toBe(201);
		const created = await newMember.json() as { id: string; firstChargeId: string };
		const memberId = created.id;
		const detail = await (await callApi(`/api/customer-members/${memberId}`, staff)).json() as { charges: Array<{ id: string; dueDate: string; outstandingMinor: number }>; payments: unknown[] };
		expect(detail.charges).toEqual([expect.objectContaining({ id: created.firstChargeId, dueDate: "2026-09-30", outstandingMinor: 10000 })]);
		expect(detail.payments).toHaveLength(0);
		expect((await callApi("/api/charges/generate", staff, { period: "2026-10" })).status).toBe(403);
		expect((await callApi(`/api/customer-members/${memberId}`, foreignOwner)).status).toBe(404);
		const events = await getDb(env).select().from(auditEvent).where(eq(auditEvent.subjectId, created.firstChargeId));
		expect(events).toEqual([expect.objectContaining({ eventType: "charge.created", actorUserId: staff.userId, branchId, organizationId })]);
	});
});
