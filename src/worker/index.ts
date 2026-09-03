import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { getAuth } from "./auth";
import { enforceAuthHttpPolicy } from "./auth/http-policy";
import { AuthError, requireAuth, requirePlatformAdmin } from "./auth/session";
import { getDb } from "./db";
import { systemCheck } from "./db/schema";
import { provisionOrganizationWithOwner } from "./platform/provision";
import { hasCredentialAccount, resendAccountSetup } from "./auth/provisioning";
import { readJsonObject, RequestError, requireSameOriginJson } from "./http";
import { requireOrganizationAdmin, requireTenant } from "./tenant";
import { listAccessibleBranches } from "./tenant/branch";
import { listMembers, provisionMember, resendMemberSetup, updateMemberAccess } from "./tenant/members";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", bodyLimit({ maxSize: 16_384, onError: (c) => c.json({ error: "REQUEST_TOO_LARGE" }, 413) }));
app.use("/api/*", async (c, next) => {
	if (!c.req.path.startsWith("/api/auth/")) requireSameOriginJson(c.env, c.req.raw);
	await next();
	c.header("Cache-Control", "no-store");
});

app.all("/api/auth/*", async (c) => {
	await enforceAuthHttpPolicy(c.env, c.req.raw);
	return getAuth(c.env, c.executionCtx).handler(c.req.raw);
});

app.get("/api/health", async (c) => {
	try {
		const db = getDb(c.env);
		await db.select({ id: systemCheck.id }).from(systemCheck).limit(1);
		return c.json({ status: "ok", database: "ok" });
	} catch {
		console.error("Health check failed");
		return c.json({ status: "error", database: "unavailable" }, 503);
	}
});

/**
 * Branches the caller may use in their active organization. The list is derived
 * from the validated tenant, never from anything the browser sends.
 */
app.get("/api/branches", async (c) => {
	const tenant = await requireTenant(c.env, c.req.raw);
	const branches = await listAccessibleBranches(c.env, tenant);
	return c.json({
		organization: { id: tenant.organizationId, name: tenant.organizationName, role: tenant.organizationRole },
		branches: branches.map((branch) => ({
			id: branch.branchId,
			name: branch.name,
		})),
	});
});

/** Tenant-scoped administration; never exposes platform roles. */
app.get("/api/members", async (c) => {
	const tenant = await requireOrganizationAdmin(c.env, c.req.raw);
	return c.json({ organizationId: tenant.organizationId, members: await listMembers(c.env, tenant) });
});

app.post("/api/members", async (c) => {
	const tenant = await requireOrganizationAdmin(c.env, c.req.raw);
	return c.json(await provisionMember(c.env, c.req.raw, tenant, await readJsonObject(c.req.raw)));
});

app.post("/api/members/:membershipId/setup/resend", async (c) => {
	const tenant = await requireOrganizationAdmin(c.env, c.req.raw);
	return c.json(await resendMemberSetup(c.env, tenant, c.req.param("membershipId")));
});

app.patch("/api/members/:membershipId", async (c) => {
	const tenant = await requireOrganizationAdmin(c.env, c.req.raw);
	return c.json(await updateMemberAccess(c.env, c.req.raw, tenant, c.req.param("membershipId"), await readJsonObject(c.req.raw)));
});

/** Platform administration. Organization roles never grant access here. */
app.post("/api/platform/organizations", async (c) => {
	await requirePlatformAdmin(c.env, c.req.raw);

	const body = await readJsonObject(c.req.raw);

	const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
	const ownerName = typeof body.ownerName === "string" ? body.ownerName.trim() : "";
	const ownerEmail = typeof body.ownerEmail === "string" ? body.ownerEmail.trim() : "";

	if (!companyName || companyName.length > 200 || !ownerName || ownerName.length > 200 || ownerEmail.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail)) {
		return c.json({ error: "INVALID_INPUT" }, 400);
	}

	const result = await provisionOrganizationWithOwner(c.env, {
		companyName,
		ownerName,
		ownerEmail,
	});

	// Never echo anything derived from the provisional credential.
	return c.json({
		organizationId: result.organizationId,
		organizationName: result.organizationName,
		ownerEmail,
		setupEmailSent: result.setupEmailSent,
		setupEmailStatus: result.setupEmailStatus,
	});
});

app.post("/api/platform/account-setup/resend", async (c) => {
	await requirePlatformAdmin(c.env, c.req.raw);
	const body = await readJsonObject(c.req.raw);
	const email = typeof body.email === "string" ? body.email.trim() : "";
	if (!email) return c.json({ error: "INVALID_INPUT" }, 400);

	const sent = await resendAccountSetup(c.env, email);
	return c.json({ sent });
});

/**
 * First-time credential setup for a provisioned account.
 *
 * Operates only on the authenticated user — no userId is accepted from the
 * browser. Refuses once a credential already exists, so it can never become a
 * way to replace a password without proving the current one.
 */
app.post("/api/account/setup-password", async (c) => {
	const session = await requireAuth(c.env, c.req.raw);
	if (!session.user.emailVerified) throw new AuthError(403, "EMAIL_NOT_VERIFIED");

	if (await hasCredentialAccount(c.env, session.user.id)) {
		return c.json({ error: "PASSWORD_ALREADY_SET" }, 409);
	}

	const body = await readJsonObject(c.req.raw);
	const newPassword =
		typeof body.newPassword === "string" ? body.newPassword : "";
	if (newPassword.length < 8 || newPassword.length > 128) return c.json({ error: "INVALID_INPUT" }, 400);

	await getAuth(c.env).api.setPassword({
		body: { newPassword },
		headers: c.req.raw.headers,
	});

	return c.json({ ok: true });
});

// Only /api/* reaches the Worker (see run_worker_first in wrangler.json),
// so anything unmatched here is an unknown API route.
app.notFound((c) => c.json({ error: "Not Found" }, 404));

// Guards throw AuthError; everything else stays generic so tenant boundaries
// are never revealed through an error body.
app.onError((error, c) => {
	if (error instanceof AuthError || error instanceof RequestError) {
		return c.json({ error: error.code }, error.status);
	}
	console.error("Unhandled request error", { name: error.name });
	return c.json({ error: "Internal Server Error" }, 500);
});

export default app;
