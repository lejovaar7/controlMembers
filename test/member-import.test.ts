import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { buildImportDrafts, importDate, importPhone, memberFormImportMapping, parseImportFile, suggestImportMapping, type ImportDraft, type ImportReview } from "../src/shared/member-import";
import { memberImportTemplate } from "../src/worker/product/imports";
import { getAuth } from "../src/worker/auth";
import { getDb } from "../src/worker/db";
import { charge, customerMember, enrollment, importBatch, payment } from "../src/worker/db/schema";
import { callApi, createActor, type Actor } from "./helpers";

describe("CSV mapping and contact choices", () => {
	it("matches unique plan names and requires a choice for missing or ambiguous plans", () => {
		const parsed = parseImportFile("Nombre,Plan\nAna,  MENSUALIDAD INFÁNTIL  \nLuis,Mensualidad mayores\nEva,\nLeo,Unknown");
		const options = { countryCode: "+57", dateOrder: "dmy" as const, defaultPlan: "", startDate: "2026-09-23", firstDueDate: "2026-10-23", plans: [{ id: "child", name: "Mensualidad infantil" }, { id: "adult", name: "Mensualidad mayores" }] };
		const mapping = memberFormImportMapping(suggestImportMapping(parsed.headers));
		const build = (overrides: Partial<typeof options> = {}) => buildImportDrafts(parsed.records, mapping, { ...options, ...overrides }).map((row) => row.planId);
		expect(build()).toEqual(["child", "adult", "", ""]);
		expect(build({ defaultPlan: "adult" })).toEqual(["child", "adult", "adult", ""]);
		expect(build({ defaultPlan: "__none" })).toEqual(["child", "adult", null, ""]);
		expect(build({ plans: [...options.plans, { id: "duplicate", name: "Mensualidad infántil" }] })).toEqual(["", "adult", "", ""]);
		expect(buildImportDrafts([["Ana"]], { memberName: 0 }, { ...options, plans: [options.plans[0]!] })[0]!.planId).toBe("");
		expect(buildImportDrafts([["Ana", "child"]], mapping, options)[0]!.planId).toBe("child");
	});
	it("imports only the fields exposed by the simple member form", () => {
		const parsed = parseImportFile("member_name,document_number,email,phone,whatsapp,plan,start_date,first_due_date,status,external_reference,contact_name,document_type\nAna,TEST-123,ana@example.test,3001112233,3112223344,Infantil,23/09/2026,23/10/2026,paused,OLD-001,Hidden contact,CC");
		const mapping = memberFormImportMapping(suggestImportMapping(parsed.headers));
		expect(Object.keys(mapping)).toEqual(["memberName", "documentNumber", "email", "phone", "whatsapp", "plan", "startDate", "firstDueDate"]);
		const [row] = buildImportDrafts(parsed.records, mapping, { countryCode: "+57", dateOrder: "dmy", defaultPlan: "__none", startDate: "2026-09-23", firstDueDate: "2026-09-23", plans: [{ id: "plan-1", name: "Infantil" }] });
		expect(row).toMatchObject({ memberName: "Ana", documentNumber: "TEST-123", phone: "+573001112233", whatsapp: "+573112223344", planId: "plan-1", startDate: "2026-09-23", firstDueDate: "2026-10-23", status: "active", documentType: "", externalReference: "", contactName: "", contactEmail: "", contactPhone: "", relationship: "", billingContact: false });
	});
	it("downloads a template limited to the fields in the simple form", async () => {
		const response = memberImportTemplate();
		expect(response.headers.get("Content-Disposition")).toContain("member-import-v3.csv");
		const text = await response.text();
		expect(parseImportFile(text + "Ana,,,,,,,\r\n").headers).toEqual(["member_name", "document_number", "email", "phone", "whatsapp", "plan", "start_date", "first_due_date"]);
		expect(() => parseImportFile(text)).toThrow("NO_DATA_ROWS");
	});
	it("distinguishes empty templates from malformed files and import limits", () => {
		const cases = [
			["\uFEFF \r\n", "EMPTY_FILE"],
			["\uFEFFmember_name,phone\r\n", "NO_DATA_ROWS"],
			["Name,,Phone\nAna,,300", "INVALID_HEADERS"],
			["Name,Phone\nAna,300,extra", "INCONSISTENT_COLUMNS"],
			['Name,Phone\n"Ana,300', "INVALID_CSV"],
			["Name\n" + "Ana\n".repeat(51), "TOO_MANY_ROWS"],
			["Name\n" + "a".repeat(100_001), "FILE_TOO_LARGE"],
		];
		for (const [source, code] of cases) expect(() => parseImportFile(source!)).toThrow(code!);
		expect(parseImportFile("member_name,phone\r\nAna,3001112233").records).toHaveLength(1);
	});
	it("accepts BOM, semicolons, CRLF, quoted delimiters, escaped quotes and embedded newlines", () => {
		const file = parseImportFile('\uFEFFNombre;Teléfono;Plan\r\n"Ana; Ruiz";3001112233;"Plan ""A"""\r\n"Luis\nRuiz";3001112244;Infantil\r\n');
		expect(file.delimiter).toBe(";"); expect(file.records[0]).toEqual(["Ana; Ruiz", "3001112233", 'Plan "A"']); expect(file.records[1]![0]).toBe("Luis\nRuiz");
		expect(suggestImportMapping(file.headers)).toMatchObject({ memberName: 0, phone: 1, plan: 2 });
		expect(parseImportFile("Nombre\tCorreo\nAna\ta@example.test").delimiter).toBe("\t");
	});
	it("rejects ambiguous headers for auto-mapping and malformed or oversized files", () => {
		expect(suggestImportMapping(["Nombre", "name"]).memberName).toBeUndefined();
		for (const source of ['Name,Phone\n"unfinished,300', 'Name,Phone\n"Ana"wrong,300', "Name,Phone\nAna,300,extra", "Name\n" + "Ana\n".repeat(51), "Name\n" + "a".repeat(100_001)]) expect(() => parseImportFile(source)).toThrow();
	});
	it("normalizes national and international numbers without duplicating the Colombian prefix", () => {
		for (const value of ["300 111 2233", "573001112233", "+57 (300) 111-2233", "00573001112233", "'+573001112233"]) expect(importPhone(value, "+57")).toBe("+573001112233");
		expect(importPhone("12025550123", "")).toBe("+12025550123"); expect(importPhone("1e10", "+57")).toBe("1e10");
	});
	it("distinguishes same, separate and explicitly absent WhatsApp and unknown plans", () => {
		const options = { countryCode: "+57", dateOrder: "dmy" as const, emptyWhatsApp: "none" as const, defaultPlan: "plan", startDate: "2026-09-01", firstDueDate: "2026-10-01", plans: [{ id: "plan", name: "Infantil" }] };
		const rows = buildImportDrafts([["Ana", "3001112233", "3001112233", "Infantil"], ["Luis", "3001112244", "3112223344", "Unknown"], ["Eva", "3001112255", "", ""]], { memberName: 0, phone: 1, whatsapp: 2, plan: 3 }, options);
		expect(rows[0]).toMatchObject({ whatsappSameAsPhone: true, whatsapp: "", planId: "plan" });
		expect(rows[1]).toMatchObject({ whatsappSameAsPhone: false, whatsapp: "+573112223344", planId: "", sourcePlan: "Unknown" });
		expect(rows[2]).toMatchObject({ whatsappSameAsPhone: false, whatsapp: "", planId: "plan" });
		expect(buildImportDrafts([["Ana", "3001112233", ""]], { memberName: 0, phone: 1, whatsapp: 2 }, { ...options, emptyWhatsApp: "phone" })[0]!.whatsappSameAsPhone).toBe(true);
		expect(buildImportDrafts([["Ana", "3001112233"]], { memberName: 0, phone: 1 }, options)[0]!.whatsappSameAsPhone).toBe(true);
		expect(importDate("21/09/2026", "dmy")).toBe("2026-09-21"); expect(importDate("09/21/2026", "mdy")).toBe("2026-09-21");
	});
});

let owner: Actor, foreign: Actor, organizationId: string, branchId: string, otherBranch: string, planId: string, otherPlan: string;
async function api<T>(path: string, body?: unknown, method?: string): Promise<T> {
	const response = await callApi(path, owner, body, method); expect(response.ok, `${path}: ${response.status}`).toBe(true); return response.json() as Promise<T>;
}
const draft = (row = 2): ImportDraft => ({ row, memberName: `Imported ${row}`, documentType: "", documentNumber: "", email: "", phone: "+573001112233", whatsappSameAsPhone: true, whatsapp: "", status: "active", externalReference: "", contactName: "", contactEmail: "", contactPhone: "", relationship: "", billingContact: false, planId, startDate: "2026-09-22", firstDueDate: "2026-09-22" });
const review = (rows: ImportDraft[]) => api<ImportReview>("/api/imports/members/preview", { branchId, rows });
const save = (rows: ImportDraft[], reviewToken: string, idempotencyKey: string) => callApi("/api/imports/members/confirm", owner, { branchId, rows, reviewToken, idempotencyKey });
beforeAll(async () => {
	owner = await createActor("import-review@test.invalid"); foreign = await createActor("import-foreign@test.invalid");
	const auth = getAuth(env);
	organizationId = (await auth.api.createOrganization({ body: { name: "Imports", slug: "review-imports", userId: owner.userId } }))!.id;
	const foreignOrg = (await auth.api.createOrganization({ body: { name: "Foreign", slug: "review-foreign", userId: foreign.userId } }))!.id;
	await auth.api.setActiveOrganization({ headers: foreign.headers, body: { organizationId: foreignOrg } });
	await auth.api.setActiveOrganization({ headers: owner.headers, body: { organizationId } });
	branchId = (await auth.api.createTeam({ headers: owner.headers, body: { organizationId, name: "Main" } })).id;
	otherBranch = (await auth.api.createTeam({ headers: owner.headers, body: { organizationId, name: "Other" } })).id;
	await api("/api/product/settings", { currency: "COP", timezone: "America/Bogota" }, "PATCH");
	planId = (await api<{ id: string }>("/api/plans", { name: "Infantil", amountMinor: 8000000, defaultDueDay: 1, branchIds: [branchId] })).id;
	otherPlan = (await api<{ id: string }>("/api/plans", { name: "Other", amountMinor: 6000000, defaultDueDay: 1, branchIds: [otherBranch] })).id;
	await auth.api.addTeamMember({ headers: owner.headers, body: { teamId: branchId, userId: owner.userId } });
	await auth.api.setActiveTeam({ headers: owner.headers, body: { teamId: branchId } });
});

describe("reviewed member import", () => {
	it("collects per-row errors, duplicates and invalid contacts without writing", async () => {
		const rows = [{ ...draft(), documentNumber: "dup", contactEmail: "bad", phone: "80000" }, { ...draft(3), documentNumber: "dup", firstDueDate: "2026-02-30" }];
		const result = await review(rows); expect(result.invalidCount).toBe(2);
		expect(result.rows[0]!.errors).toEqual(expect.arrayContaining(["INVALID_PHONE", "INVALID_CONTACT_EMAIL", "DUPLICATE_IN_FILE"]));
		expect(result.rows[1]!.errors).toContain("INVALID_DUE_DATE");
		expect((await save(rows, result.reviewToken, "invalid-import")).status).toBe(409);
		expect(await getDb(env).select().from(customerMember).where(eq(customerMember.organizationId, organizationId))).toHaveLength(0);
		expect(await getDb(env).select().from(importBatch).where(eq(importBatch.organizationId, organizationId))).toHaveLength(0);
	});
	it("validates plan scope, missing selection, status and foreign branches", async () => {
		for (const row of [{ ...draft(), planId: "" }, { ...draft(), planId: otherPlan }, { ...draft(), status: "inactive" }, { ...draft(), firstDueDate: "2026-09-01" }]) expect((await review([row])).invalidCount).toBe(1);
		expect((await callApi("/api/imports/members/preview", owner, { branchId: otherBranch, rows: [draft()] })).status).toBe(403);
		expect((await callApi("/api/imports/members/preview", foreign, { branchId, rows: [draft()] })).ok).toBe(false);
	});
	it("requires re-review after edits or current plan price changes", async () => {
		const rows = [draft()]; const before = await review(rows);
		expect((await save([{ ...draft(), memberName: "Edited" }], before.reviewToken, "edited-import")).status).toBe(409);
		await api(`/api/plans/${planId}`, { amountMinor: 8500000 }, "PATCH");
		expect((await save(rows, before.reviewToken, "price-change-import")).status).toBe(409);
		expect((await review(rows)).rows[0]!.amountMinor).toBe(8500000);
	});
	it("commits reviewed members, WhatsApp choices, contacts, enrollments and charges atomically and idempotently", async () => {
		const rows = [{ ...draft(), documentNumber: "A-1" }, { ...draft(3), whatsappSameAsPhone: false, whatsapp: "+573112223344", firstDueDate: "2026-10-22", contactName: "Parent", contactPhone: "+573003334444", billingContact: true }, { ...draft(4), planId: null, whatsappSameAsPhone: false, whatsapp: "", status: "inactive" }];
		const result = await review(rows); expect(result.validCount).toBe(3);
		const saved = await save(rows, result.reviewToken, "reviewed-import"); expect(saved.status).toBe(200); expect(await saved.json()).toMatchObject({ created: 3, skipped: 0 });
		expect(await (await save(rows, result.reviewToken, "reviewed-import")).json()).toMatchObject({ created: 3 });
		expect((await save([{ ...draft(), memberName: "Changed" }], result.reviewToken, "reviewed-import")).status).toBe(409);
		const db = getDb(env); const members = await db.select().from(customerMember).where(eq(customerMember.organizationId, organizationId));
		expect(members).toHaveLength(3); expect(members.find((row) => row.displayName === "Imported 3")).toMatchObject({ whatsappSameAsPhone: false, whatsappE164: "+573112223344" });
		expect(members.find((row) => row.displayName === "Imported 4")).toMatchObject({ whatsappSameAsPhone: false, whatsappE164: null, status: "inactive" });
		expect(await db.select().from(enrollment).where(eq(enrollment.organizationId, organizationId))).toHaveLength(2);
		expect(await db.select().from(charge).where(eq(charge.organizationId, organizationId))).toHaveLength(1);
		expect(await db.select().from(payment).where(eq(payment.organizationId, organizationId))).toHaveLength(0);
		expect((await review([{ ...draft(), documentNumber: "A-1" }])).rows[0]!.errors).toContain("MEMBER_IDENTIFIER_EXISTS");
	});
	it("handles larger reviewed payloads while retaining the row limit", async () => {
		const rows = Array.from({ length: 50 }, (_, index) => ({ ...draft(index + 2), planId: null }));
		expect(JSON.stringify({ branchId, rows }).length).toBeGreaterThan(16384);
		expect((await review(rows)).validCount).toBe(50);
		expect((await callApi("/api/imports/members/preview", owner, { branchId, rows: [...rows, draft(52)] })).status).toBe(400);
	});
	it("retries simultaneous submissions once and rejects duplicates added after review", async () => {
		const rows = [{ ...draft(), documentNumber: "concurrent-import" }];
		const result = await review(rows);
		const responses = await Promise.all([save(rows, result.reviewToken, "concurrent-import"), save(rows, result.reviewToken, "concurrent-import")]);
		for (const response of responses) expect(await response.json()).toMatchObject({ created: 1 });
		expect((await save(rows, result.reviewToken, "another-import-key")).status).toBe(409);
		const records = await getDb(env).select().from(customerMember).where(eq(customerMember.normalizedDocument, "concurrent-import"));
		expect(records).toHaveLength(1);
	});
});
