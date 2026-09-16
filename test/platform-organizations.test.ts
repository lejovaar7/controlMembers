import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "../src/worker/db";
import { member, organization, team, user } from "../src/worker/db/auth-schema";
import { auditEvent } from "../src/worker/db/schema";
import { callApi, createActor, type Actor } from "./helpers";
import type { CompanyDetail, CompanyDirectory } from "../src/react-app/lib/platform";

let platform: Actor;
let owner: Actor;
let admin: Actor;
const companyId = "directory-company";
const path = `/api/platform/organizations/${companyId}`;
beforeAll(async () => {
 platform = await createActor("directory-platform@test.invalid", true);
 owner = await createActor("directory-owner@test.invalid");
 admin = await createActor("directory-admin@test.invalid");
 const db = getDb(env);
 await db.insert(organization).values({ id: companyId, name: "Directory Academy", slug: "directory-academy", createdAt: new Date(), locale: "es" });
 await db.insert(member).values([
  { id: "directory-owner", userId: owner.userId, organizationId: companyId, role: "owner", createdAt: new Date() },
  { id: "directory-admin", userId: admin.userId, organizationId: companyId, role: "admin", isActive: false, createdAt: new Date() },
 ]);
 await db.insert(team).values({ id: "directory-branch", organizationId: companyId, name: "Sede Principal", createdAt: new Date() });
});

describe("platform company directory", () => {
 it("requires platform role for listing, details and renaming", async () => {
  for (const actor of [undefined, owner, admin]) {
   const expected = actor ? 403 : 401;
   expect((await callApi("/api/platform/organizations", actor)).status).toBe(expected);
   expect((await callApi(path, actor)).status).toBe(expected);
   expect((await callApi(path, actor, { name: "Denied" }, "PATCH")).status).toBe(expected);
  }
 });
 it("shows owners, branches and active user count without granting tenant access", async () => {
  const response = await callApi(path, platform);
  expect(response.status).toBe(200);
  const detail = await response.json() as CompanyDetail;
  expect(detail).toMatchObject({ name: "Directory Academy", branchCount: 1, activeUserCount: 1, canOpenWorkspace: false });
  expect(detail.owners).toEqual([expect.objectContaining({ email: owner.email, setupRequired: false, isActive: true })]);
  expect(detail.branches).toEqual([{ id: "directory-branch", name: "Sede Principal" }]);
  expect(JSON.stringify(detail)).not.toMatch(/password|token|secret/i);
  expect((await callApi("/api/companies/active", platform, { organizationId: companyId })).status).toBe(403);
 });
 it("matches company and owner searches and treats wildcard input literally", async () => {
  for (const search of ["DIRECTORY ACADEMY", owner.email.toUpperCase()]) {
   const response = await callApi(`/api/platform/organizations?search=${encodeURIComponent(search)}`, platform);
   const result = await response.json() as CompanyDirectory;
   expect(result.total).toBe(1);
   expect(result.organizations[0]?.id).toBe(companyId);
  }
  const response = await callApi("/api/platform/organizations?search=%25", platform);
  expect(await response.json()).toMatchObject({ organizations: [], total: 0, nextOffset: null });
 });
 it("paginates all companies without duplicates", async () => {
  for (let index = 0; index < 21; index++) await getDb(env).insert(organization).values({ id: `page-${index}`, name: `Pagination ${index}`, slug: `page-${index}`, createdAt: new Date(2026, 0, 1) });
  const first = await (await callApi("/api/platform/organizations?search=Pagination", platform)).json() as CompanyDirectory;
  const second = await (await callApi(`/api/platform/organizations?search=Pagination&offset=${first.nextOffset}`, platform)).json() as CompanyDirectory;
  expect(first.total).toBe(21);
  expect(first.organizations).toHaveLength(20);
  expect(second.organizations).toHaveLength(1);
  expect(second.nextOffset).toBeNull();
  expect(new Set([...first.organizations, ...second.organizations].map((row) => row.id)).size).toBe(21);
 });
 it("rejects invalid pagination and oversized searches", async () => {
  for (const query of ["offset=-1", "offset=1.5", "offset=NaN", `search=${"x".repeat(121)}`]) {
   expect((await callApi(`/api/platform/organizations?${query}`, platform)).status).toBe(400);
  }
 });
 it("returns 404 for a missing company", async () => {
  expect((await callApi("/api/platform/organizations/missing", platform)).status).toBe(404);
  expect((await callApi("/api/platform/organizations/missing", platform, { name: "New" }, "PATCH")).status).toBe(404);
 });
 it("only offers workspace access for an active membership", async () => {
  const db = getDb(env);
  await db.insert(member).values({ id: "directory-platform-member", userId: platform.userId, organizationId: companyId, role: "admin", createdAt: new Date() });
  expect(await (await callApi(path, platform)).json()).toMatchObject({ canOpenWorkspace: true, activeUserCount: 2 });
  await db.update(member).set({ isActive: false }).where(eq(member.id, "directory-platform-member"));
  expect(await (await callApi(path, platform)).json()).toMatchObject({ canOpenWorkspace: false, activeUserCount: 1 });
 });
 it("reports pending owner activation without exposing credentials", async () => {
  await getDb(env).update(user).set({ emailVerified: false }).where(eq(user.id, owner.userId));
  const detail = await (await callApi(path, platform)).json() as CompanyDetail;
  expect(detail.owners[0]?.setupRequired).toBe(true);
 });
 it("renames with an audit record and preserves identity and access", async () => {
  const db = getDb(env);
  const previous = await db.select().from(member).where(eq(member.organizationId, companyId));
  expect((await callApi(path, platform, { name: "  Renamed Academy  " }, "PATCH")).status).toBe(200);
  const [updated] = await db.select().from(organization).where(eq(organization.id, companyId));
  expect(updated).toMatchObject({ name: "Renamed Academy", slug: "directory-academy", locale: "es" });
  expect(await db.select().from(member).where(eq(member.organizationId, companyId))).toEqual(previous);
  const [audit] = await db.select().from(auditEvent).where(eq(auditEvent.organizationId, companyId));
  expect(audit).toMatchObject({ actorUserId: platform.userId, eventType: "platform.organization.renamed", subjectId: companyId });
  expect(JSON.parse(audit.detailsJson)).toEqual({ name: "Renamed Academy" });
 });
 it("rejects empty names and attempts to change unrelated properties", async () => {
  for (const body of [{ name: " " }, { name: 123 }, { name: "x".repeat(201) }, { name: "Valid", currency: "USD" }, { name: "Valid", ownerId: platform.userId }]) {
   expect((await callApi(path, platform, body, "PATCH")).status).toBe(400);
  }
 });
});
