import { createExecutionContext, env } from "cloudflare:test";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createTranslator, currentPreferences, DEFAULT_LOCALE, formatDate, formatNumber, isLocale, languages, normalizeLocale, publicLocale, resolveLocale, type LocalePreferences } from "../src/shared/i18n";
import { messages } from "../src/shared/i18n/en";
import worker from "../src/worker";
import { getAuth } from "../src/worker/auth";
import { ensureProvisionedUser, resendAccountSetup } from "../src/worker/auth/provisioning";
import { getDb } from "../src/worker/db";
import { member, organization, user } from "../src/worker/db/auth-schema";
import { localizedAuthUrl, resolveEmailLocale, resolveInvitationLocale } from "../src/worker/email/locale";
import { accountSetupEmail, organizationInvitationEmail, passwordResetEmail, verificationEmail } from "../src/worker/email/messages";
import { callApi, createActor, TEST_PASSWORD, type Actor } from "./helpers";

describe("extensible catalogs and language resolution", () => {
	it("requires exactly the same complete keys and interpolation variables in every catalog", () => {
		expect(new Set(messages).size).toBe(messages.length);
		for (const language of Object.values(languages)) {
			expect(Object.keys(language.messages).sort()).toEqual([...messages].sort());
			for (const key of messages) {
				const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
				expect(language.messages[key].trim()).not.toBe("");
				expect(placeholders(language.messages[key]), key).toEqual(placeholders(key));
			}
		}
	});
	it("uses personal and company preferences before the defensive fallback", () => {
		expect(resolveLocale("en", "es")).toBe("en");
		expect(resolveLocale(null, "es")).toBe("es");
		expect(resolveLocale("unknown", "es")).toBe("es");
		expect(resolveLocale("unknown", "unknown")).toBe(DEFAULT_LOCALE);
		expect(resolveLocale(null, null)).toBe(DEFAULT_LOCALE);
	});
	it("normalizes legacy regional values while accepting only registered keys for writes", () => {
		expect(normalizeLocale(" es-CO ")).toBe("es");
		expect(normalizeLocale("EN_us")).toBe("en");
		for (const value of ["unavailable", "", "constructor", "toString", "__proto__", 2, null, {}]) expect(isLocale(value)).toBe(false);
		expect(isLocale("es-CO")).toBe(false);
	});
	it("resolves public pages from link hint, saved choice, browser list and default", () => {
		expect(publicLocale("es", "en", ["en-US"])).toBe("es");
		expect(publicLocale(null, "es", ["en-US"])).toBe("es");
		expect(publicLocale("invalid", "invalid", ["zz-ZZ", "es-CO", "en"])).toBe("es");
		expect(publicLocale(null, null, ["zz-ZZ"])).toBe(DEFAULT_LOCALE);
	});
	it("does not retain a previous user's or company's async locale context", () => {
		const preferences: LocalePreferences = { userLocale: null, organization: { id: "a", locale: "es", canEdit: true } };
		const loaded = { key: "user-a/company-a", preferences };
		expect(currentPreferences(loaded, "user-a/company-a")).toEqual(preferences);
		expect(currentPreferences(loaded, "user-a/company-b")).toBeNull();
		expect(currentPreferences(loaded, "user-b/company-a")).toBeNull();
	});
	it("interpolates user content without translating or recursively interpreting it", () => {
		expect(createTranslator("es")("Edit access for {name}", { name: "North {company}" })).toBe("Editar acceso de North {company}");
		expect(formatNumber("es", 1234.5)).toBe(new Intl.NumberFormat("es").format(1234.5));
		expect(formatDate("es", Date.UTC(2026, 8, 3), { timeZone: "UTC", dateStyle: "long" })).toBe("3 de septiembre de 2026");
	});
});

let owner: Actor;
let other: Actor;
let employee: Actor;
let admin: Actor;
let inactive: Actor;
let platform: Actor;
let spanishId: string;
let englishId: string;

beforeAll(async () => {
	[owner, other, employee, admin, inactive, platform] = await Promise.all(
		["owner", "other", "employee", "admin", "inactive", "platform"].map((name) => createActor(`locale-${name}@test.invalid`, name === "platform")),
	);
	const auth = getAuth(env);
	spanishId = (await auth.api.createOrganization({ body: { name: "Empresa Español", slug: "locale-es", locale: "es", userId: owner.userId } }))!.id;
	englishId = (await auth.api.createOrganization({ body: { name: "English Company", slug: "locale-en", locale: "en", userId: other.userId } }))!.id;
	for (const actor of [employee, admin, inactive]) await auth.api.addMember({ body: { organizationId: spanishId, userId: actor.userId, role: actor === admin ? "admin" : "member", allBranches: false } });
	await auth.api.addMember({ body: { organizationId: englishId, userId: employee.userId, role: "member" } });
	for (const actor of [owner, employee, admin, inactive]) await auth.api.setActiveOrganization({ headers: actor.headers, body: { organizationId: spanishId } });
	await auth.api.setActiveOrganization({ headers: other.headers, body: { organizationId: englishId } });
	await getDb(env).update(member).set({ isActive: false }).where(and(eq(member.userId, inactive.userId), eq(member.organizationId, spanishId)));
});

async function preferences(actor: Actor) {
	const response = await callApi("/api/account/locale", actor);
	expect(response.status).toBe(200);
	expect(response.headers.get("Cache-Control")).toBe("no-store");
	return await response.json() as LocalePreferences;
}

describe("guarded language preferences", () => {
	it("reads only the authenticated account and validated active company", async () => {
		expect((await callApi("/api/account/locale")).status).toBe(401);
		expect(await preferences(owner)).toEqual({ userLocale: null, organization: { id: spanishId, locale: "es", canEdit: true } });
		expect((await preferences(employee)).organization?.canEdit).toBe(false);
		expect((await preferences(inactive)).organization).toBeNull();
		expect((await preferences(platform)).organization).toBeNull();
	});
	it("persists a personal preference across sessions, and null restores company inheritance", async () => {
		expect((await callApi("/api/account/locale", owner, { locale: "en" }, "PATCH")).status).toBe(200);
		const response = await getAuth(env).api.signInEmail({ body: { email: owner.email, password: TEST_PASSWORD }, asResponse: true });
		const anotherSession = { ...owner, headers: new Headers({ cookie: response.headers.get("set-cookie")! }) };
		expect((await preferences(anotherSession)).userLocale).toBe("en");
		expect((await preferences(other)).userLocale).toBeNull();
		expect((await callApi("/api/account/locale", owner, { locale: null }, "PATCH")).status).toBe(200);
		const value = await preferences(owner);
		expect(resolveLocale(value.userLocale, value.organization?.locale)).toBe("es");
	});
	it("allows company owners and admins, including branch-scoped admins, but not members or platform-only users", async () => {
		for (const actor of [employee, inactive, platform, undefined]) expect((await callApi("/api/company/locale", actor, { locale: "en" }, "PATCH")).status).toBe(actor ? 403 : 401);
		for (const actor of [admin, owner]) expect((await callApi("/api/company/locale", actor, { locale: "es" }, "PATCH")).status).toBe(200);
	});
	it("rejects unsupported languages, foreign identifiers and unrelated settings without changes", async () => {
		for (const route of ["/api/account/locale", "/api/company/locale"]) {
			for (const body of [{ locale: "unavailable" }, { locale: "es-CO" }, { locale: "ES" }, { locale: "__proto__" }, { locale: true }, {}, { locale: "es", userId: other.userId }, { locale: "es", organizationId: englishId }, { locale: "es", currency: "EUR" }]) {
				expect((await callApi(route, owner, body, "PATCH")).status).toBe(400);
			}
		}
		expect((await callApi("/api/company/locale", owner, { locale: null }, "PATCH")).status).toBe(400);
		expect((await preferences(owner)).organization?.locale).toBe("es");
		expect((await preferences(other)).organization?.locale).toBe("en");
	});
	it("cannot bypass guarded writes using Better Auth native organization or user updates", async () => {
		expect((await callApi("/api/auth/organization/update", owner, { organizationId: englishId, data: { locale: "es" } })).status).toBe(404);
		await callApi("/api/auth/update-user", owner, { locale: "en" });
		expect((await preferences(owner)).userLocale).toBeNull();
	});
	it("preserves same-origin JSON protection for both locale endpoints", async () => {
		for (const route of ["/api/account/locale", "/api/company/locale"]) {
			const headers = new Headers(owner.headers);
			headers.set("Content-Type", "application/json");
			headers.set("Origin", "https://foreign.invalid");
			const response = await worker.fetch(new Request(`http://localhost:5173${route}`, { method: "PATCH", headers, body: '{"locale":"en"}' }), env, createExecutionContext());
			expect(response.status).toBe(403);
		}
	});
	it("rejects a stale tab's company language save after its shared session changed company", async () => {
		const headers = new Headers(other.headers);
		headers.set("Content-Type", "application/json");
		headers.set("X-Company-Context", spanishId);
		const response = await worker.fetch(new Request("http://localhost:5173/api/company/locale", { method: "PATCH", headers, body: '{"locale":"es"}' }), env, createExecutionContext());
		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({ error: "WORKSPACE_CHANGED" });
		expect((await preferences(other)).organization?.locale).toBe("en");
	});
	it("changes inherited language when switching companies without changing personal preference", async () => {
		expect((await callApi("/api/companies/active", employee, { organizationId: englishId })).status).toBe(200);
		const english = await preferences(employee);
		expect(english.organization?.id).toBe(englishId);
		expect(resolveLocale(english.userLocale, english.organization?.locale)).toBe("en");
		await callApi("/api/companies/active", employee, { organizationId: spanishId });
		const spanish = await preferences(employee);
		expect(resolveLocale(spanish.userLocale, spanish.organization?.locale)).toBe("es");
	});
	it("normalizes legacy company values and safely resolves unsupported stored values", async () => {
		await getDb(env).update(organization).set({ locale: "es-CO" }).where(eq(organization.id, spanishId));
		expect((await preferences(owner)).organization?.locale).toBe("es");
		await getDb(env).update(organization).set({ locale: "unsupported" }).where(eq(organization.id, spanishId));
		expect((await preferences(owner)).organization?.locale).toBe(DEFAULT_LOCALE);
		expect((await callApi("/api/company/locale", owner, { locale: null }, "PATCH")).status).toBe(400);
		expect((await preferences(owner)).organization?.locale).toBe(DEFAULT_LOCALE);
		await callApi("/api/company/locale", owner, { locale: "es" }, "PATCH");
	});
});

describe("recipient-based transactional email", () => {
	it("localizes every email part and keeps HTML interpolation escaped", () => {
		for (const builder of [accountSetupEmail, verificationEmail, passwordResetEmail]) {
			const result = builder("https://example.invalid/?a=1&b=2", "es");
			expect(result.subject).not.toBe(builder("https://example.invalid/").subject);
			expect(result.text).toContain("puedes ignorar este correo");
			expect(result.html).toContain('lang="es"');
			expect(result.html).toContain("Si el enlace no funciona");
			expect(result.html).toContain("a=1&amp;b=2");
		}
		const invitation = organizationInvitationEmail("<img src=x>", "<script>bad()</script>", "https://example.invalid/", "es");
		expect(invitation.subject).toBe("Invitación para unirte a <img src=x>");
		expect(invitation.html).not.toContain("<script>");
		expect(invitation.html).not.toContain("<img");
		expect(invitation.html).toContain("&lt;script&gt;");
	});
	it("does not select an arbitrary company for a multi-company recipient", async () => {
		expect(await resolveEmailLocale(env, employee.email)).toBe(DEFAULT_LOCALE);
		expect(await resolveEmailLocale(env, employee.email, { organizationId: spanishId })).toBe("es");
		expect(await resolveEmailLocale(env, employee.email, { organizationId: englishId })).toBe("en");
		expect(await resolveEmailLocale(env, inactive.email, { organizationId: spanishId })).toBe(DEFAULT_LOCALE);
		expect(await resolveEmailLocale(env, owner.email, { organizationId: englishId })).toBe(DEFAULT_LOCALE);
	});
	it("lets recipient preference win over the sender or company, including future invitations", async () => {
		await callApi("/api/account/locale", employee, { locale: "en" }, "PATCH");
		expect(await resolveEmailLocale(env, employee.email, { organizationId: spanishId, fallbackLocale: "es" })).toBe("en");
		expect(await resolveInvitationLocale(env, employee.email, spanishId)).toBe("en");
		expect(await resolveInvitationLocale(env, "invited@test.invalid", spanishId)).toBe("es");
		await callApi("/api/account/locale", employee, { locale: null }, "PATCH");
	});
	it("persists the provisioning language before sending the first activation email and preserves it on retries", async () => {
		const send = vi.mocked(env.EMAIL.send);
		send.mockClear();
		const body = { companyName: "Nueva Empresa", ownerName: "Nueva persona", ownerEmail: "new-spanish-owner@test.invalid", locale: "es" };
		const response = await callApi("/api/platform/organizations", platform, body);
		expect(response.status).toBe(200);
		const result = await response.json() as { organizationId: string };
		const message = send.mock.calls.at(-1)?.[0] as { text: string; subject: string };
		expect(message.subject).toBe("Termina de configurar tu cuenta");
		const url = new URL(message.text.match(/https?:\/\/\S+/)![0]);
		expect(new URL(url.searchParams.get("callbackURL")!).searchParams.get("lang")).toBe("es");
		const activation = await worker.fetch(new Request(url), env, createExecutionContext());
		expect(activation.status).toBe(302);
		expect(new URL(activation.headers.get("location")!).searchParams.get("lang")).toBe("es");
		await callApi("/api/platform/organizations", platform, { ...body, locale: "en" });
		const [company] = await getDb(env).select().from(organization).where(eq(organization.id, result.organizationId));
		expect(company.locale).toBe("es");
	});
	it("rejects unsupported provisioning languages before creating any account", async () => {
		expect((await callApi("/api/platform/organizations", platform, { companyName: "Missing", ownerName: "Missing", ownerEmail: "missing-locale@test.invalid" })).status).toBe(400);
		expect((await callApi("/api/platform/organizations", platform, { companyName: "Rejected", ownerName: "Rejected", ownerEmail: "invalid-locale@test.invalid", locale: "unavailable" })).status).toBe(400);
		expect(await getDb(env).select().from(user).where(eq(user.email, "missing-locale@test.invalid"))).toHaveLength(0);
		expect(await getDb(env).select().from(user).where(eq(user.email, "invalid-locale@test.invalid"))).toHaveLength(0);
	});
	it("uses company context for member setup and resend without accepting foreign context", async () => {
		const identity = await ensureProvisionedUser(env, "spanish-setup-member@test.invalid", "Persona");
		await getAuth(env).api.addMember({ body: { userId: identity.id, organizationId: spanishId, role: "member" } });
		const send = vi.mocked(env.EMAIL.send);
		send.mockClear();
		expect(await resendAccountSetup(env, identity.email, spanishId)).toBe(true);
		expect(send.mock.calls.at(-1)?.[0]).toMatchObject({ subject: "Termina de configurar tu cuenta" });
		expect(await resendAccountSetup(env, identity.email, englishId)).toBe(false);
		expect(send).toHaveBeenCalledTimes(1);
	});
	it("uses the recipient's sole company for password reset, ignoring the requester's language", async () => {
		const send = vi.mocked(env.EMAIL.send);
		send.mockClear();
		await getAuth(env, undefined, { fallbackLocale: "en" }).api.requestPasswordReset({ body: { email: owner.email, redirectTo: "/reset-password" } });
		expect(send.mock.calls.at(-1)?.[0]).toMatchObject({ subject: "Restablece tu contraseña" });
	});
	it("preserves generic recovery responses in either public language and sends no email for unknown accounts", async () => {
		const send = vi.mocked(env.EMAIL.send);
		send.mockClear();
		const auth = getAuth(env, undefined, { fallbackLocale: "es" });
		const unknown = await auth.api.requestPasswordReset({ body: { email: "unknown-locale@test.invalid", redirectTo: "/reset-password" } });
		expect(send).not.toHaveBeenCalled();
		const known = await auth.api.requestPasswordReset({ body: { email: platform.email, redirectTo: "/reset-password" } });
		expect(known).toEqual(unknown);
		expect(send.mock.calls.at(-1)?.[0]).toMatchObject({ subject: "Restablece tu contraseña" });
	});
	it("preserves auth tokens and existing callback flags while adding a language hint", () => {
		const url = new URL(localizedAuthUrl("https://example.invalid/api/auth/verify-email?token=opaque&callbackURL=%2Fverify-email%3Fverified%3D1", "es"));
		expect(url.searchParams.get("token")).toBe("opaque");
		const callback = new URL(url.searchParams.get("callbackURL")!);
		expect(callback.searchParams.get("verified")).toBe("1");
		expect(callback.searchParams.get("lang")).toBe("es");
	});
});
