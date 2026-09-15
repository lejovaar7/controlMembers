import { createExecutionContext, env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import worker from "../src/worker";
import { getAuth } from "../src/worker/auth";
import { getDb } from "../src/worker/db";
import { account, user } from "../src/worker/db/auth-schema";
import { organizationInvitationEmail } from "../src/worker/email/messages";
import { callApi, createActor } from "./helpers";

describe("HTTP boundary", () => {
	it("rejects malformed, non-object, oversized and cross-origin bodies without details", async () => {
		for (const body of ["{", "null", "[]"]) {
			const actor = await createActor(`json-${body.length}-${body.charCodeAt(0)}@test.invalid`, true);
			const headers = new Headers(actor.headers);
			headers.set("Content-Type", "application/json");
			const response = await worker.fetch(new Request("http://localhost:5173/api/platform/organizations", { method: "POST", headers, body }), env, createExecutionContext());
			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({ error: "INVALID_INPUT" });
		}
		for (const headers of [{ "Content-Type": "text/plain" }, { "Content-Type": "application/json", Origin: "https://foreign.invalid" }, { "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" }] as Record<string, string>[]) {
			const response = await worker.fetch(new Request("http://localhost:5173/api/members", { method: "POST", headers, body: "{}" }), env, createExecutionContext());
			expect(response.status).toBe(headers["Content-Type"] === "text/plain" ? 400 : 403);
		}
		const oversized = await worker.fetch(new Request("http://localhost:5173/api/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: "x".repeat(17000) }) }), env, createExecutionContext());
		expect(oversized.status).toBe(413);
	});
	it("does not cache tenant responses or advertise unfinished invitation endpoints", async () => {
		const response = await callApi("/api/members");
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		for (const path of ["get-invitation", "list-invitations", "list-user-invitations", "reject-invitation", "cancel-invitation", "update"]) {
			expect((await callApi(`/api/auth/organization/${path}`, undefined, {})).status).toBe(404);
		}
	});
});

describe("platform bootstrap without a password", () => {
	it("activates through one controlled link, chooses credentials and provisions a company", async () => {
		const id = crypto.randomUUID();
		const email = "bootstrap-admin@test.invalid";
		// The only explicit bootstrap exception: mirrors the documented first-admin insert.
		await getDb(env).insert(user).values({ id, name: "Bootstrap admin", email, emailVerified: false, role: "admin", createdAt: new Date(), updatedAt: new Date() });
		const send = vi.mocked(env.EMAIL.send);
		send.mockClear();
		await getAuth(env).api.signInMagicLink({ body: { email, callbackURL: "/setup-account" }, headers: new Headers() });
		expect(send).toHaveBeenCalledTimes(1);
		const message = send.mock.calls[0]?.[0] as { text: string; };
		const url = message.text.match(/https?:\/\/\S+/)?.[0];
		if (!url) throw new Error("Missing bootstrap link");
		const response = await worker.fetch(new Request(url), env, createExecutionContext());
		const actor = { userId: id, email, headers: new Headers({ cookie: response.headers.get("set-cookie")! }) };
		expect((await callApi("/api/account/setup-password", actor, { newPassword: "BootstrapChosen123!" })).status).toBe(200);
		expect(await getDb(env).select().from(account).where(eq(account.userId, id))).toHaveLength(1);
		expect((await callApi("/api/platform/organizations", actor, { companyName: "Bootstrap company", ownerName: "Bootstrap owner", ownerEmail: "bootstrap-owner@test.invalid", locale: "en" })).status).toBe(200);
	});
});

describe("future invitation email infrastructure", () => {
	it("escapes untrusted company and inviter names in HTML", () => {
		const message = organizationInvitationEmail('<img src=x onerror="bad()">', "<script>bad()</script>", "https://example.invalid/invitation?a=1&b=2");
		expect(message.html).not.toContain("<img");
		expect(message.html).not.toContain("<script>");
		expect(message.html).toContain("&lt;script&gt;");
		expect(message.html).toContain("a=1&amp;b=2");
	});
});
