import { Hono } from "hono";
import { getAuth } from "./auth";
import { AuthError, requireAuth, requirePlatformAdmin } from "./auth/session";
import { getDb } from "./db";
import { systemCheck } from "./db/schema";
import {
	hasCredentialAccount,
	provisionOrganizationWithOwner,
	resendAccountSetup,
} from "./platform/provision";
import { requireTenant } from "./tenant";
import { listAccessibleBranches } from "./tenant/branch";

const app = new Hono<{ Bindings: Env }>();

app.all("/api/auth/*", (c) =>
	getAuth(c.env, c.executionCtx).handler(c.req.raw),
);

app.get("/api/health", async (c) => {
	try {
		const db = getDb(c.env);
		await db.select({ id: systemCheck.id }).from(systemCheck).limit(1);
		return c.json({ status: "ok", database: "ok" });
	} catch (error) {
		console.error("Health check failed", error);
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
		branches: branches.map((branch) => ({
			id: branch.branchId,
			name: branch.name,
		})),
	});
});

/** Platform administration. Organization roles never grant access here. */
app.post("/api/platform/organizations", async (c) => {
	await requirePlatformAdmin(c.env, c.req.raw);

	const body = await c.req.json<{
		companyName?: unknown;
		ownerName?: unknown;
		ownerEmail?: unknown;
	}>();

	const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
	const ownerName = typeof body.ownerName === "string" ? body.ownerName.trim() : "";
	const ownerEmail = typeof body.ownerEmail === "string" ? body.ownerEmail.trim() : "";

	if (!companyName || !ownerName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail)) {
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
	});
});

app.post("/api/platform/account-setup/resend", async (c) => {
	await requirePlatformAdmin(c.env, c.req.raw);
	const body = await c.req.json<{ email?: unknown }>();
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

	if (await hasCredentialAccount(c.env, session.user.id)) {
		return c.json({ error: "PASSWORD_ALREADY_SET" }, 409);
	}

	const body = await c.req.json<{ newPassword?: unknown }>();
	const newPassword =
		typeof body.newPassword === "string" ? body.newPassword : "";
	if (newPassword.length < 8) return c.json({ error: "INVALID_INPUT" }, 400);

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
	if (error instanceof AuthError) {
		return c.json({ error: error.code }, error.status);
	}
	console.error("Unhandled request error", error);
	return c.json({ error: "Internal Server Error" }, 500);
});

export default app;
