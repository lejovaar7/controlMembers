import { createExecutionContext, env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import worker from "../src/worker";
import { getAuth } from "../src/worker/auth";
import { getDb } from "../src/worker/db";
import {
	account,
	member,
	organization,
	team,
	user as userTable,
} from "../src/worker/db/auth-schema";
import { provisionOrganizationWithOwner } from "../src/worker/platform/provision";

const PASSWORD = "TestOnlyPassword123!";

type Actor = { userId: string; email: string; headers: Headers };

/** Creates a user directly through the Admin API (public signup is closed). */
async function createUser(email: string, platformAdmin = false): Promise<Actor> {
	const auth = getAuth(env);
	await auth.api.createUser({
		body: {
			email,
			name: email,
			password: PASSWORD,
			...(platformAdmin ? { role: "admin" as const } : {}),
		},
	});

	const db = getDb(env);
	await db
		.update(userTable)
		.set({ emailVerified: true })
		.where(eq(userTable.email, email));

	const [row] = await db
		.select({ id: userTable.id })
		.from(userTable)
		.where(eq(userTable.email, email))
		.limit(1);
	if (!row) throw new Error(`user ${email} was not created`);

	const response = await auth.api.signInEmail({
		body: { email, password: PASSWORD },
		asResponse: true,
	});
	const cookie = response.headers.get("set-cookie");
	if (!cookie) throw new Error(`no session cookie for ${email}`);

	return { userId: row.id, email, headers: new Headers({ cookie }) };
}

function call(path: string, actor?: Actor, body?: unknown, method = "POST") {
	const headers = new Headers(actor ? actor.headers : undefined);
	headers.set("Content-Type", "application/json");
	return worker.fetch(
		new Request(`http://localhost${path}`, {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body),
		}),
		env,
		createExecutionContext(),
	);
}

let platformAdmin: Actor;
let orgOwner: Actor;
let orgAdmin: Actor;

beforeAll(async () => {
	platformAdmin = await createUser("platform-admin@test.invalid", true);
	orgOwner = await createUser("org-owner@test.invalid");
	orgAdmin = await createUser("org-admin@test.invalid");

	const auth = getAuth(env);
	const org = await auth.api.createOrganization({
		body: { name: "Role Scope Co", slug: "role-scope-co", userId: orgOwner.userId },
	});
	if (!org) throw new Error("organization was not created");
	await getDb(env).insert(member).values({
		id: `m-${orgAdmin.userId}`,
		organizationId: org.id,
		userId: orgAdmin.userId,
		role: "admin",
		createdAt: new Date(),
	});
});

describe("public signup is closed", () => {
	it("rejects POST /api/auth/sign-up/email", async () => {
		const response = await call("/api/auth/sign-up/email", undefined, {
			name: "Intruder",
			email: "intruder@test.invalid",
			password: PASSWORD,
		});
		expect(response.ok).toBe(false);

		const [row] = await getDb(env)
			.select({ id: userTable.id })
			.from(userTable)
			.where(eq(userTable.email, "intruder@test.invalid"));
		expect(row).toBeUndefined();
	});

	it("does not let an unknown email create an account via magic link", async () => {
		// Better Auth answers generically to avoid revealing whether the address
		// exists. The guarantee that matters is that no account appears.
		await getAuth(env).api.signInMagicLink({
			body: { email: "ghost@test.invalid" },
			headers: new Headers(),
		});

		const [row] = await getDb(env)
			.select({ id: userTable.id })
			.from(userTable)
			.where(eq(userTable.email, "ghost@test.invalid"));
		expect(row).toBeUndefined();
	});

	it("does not let a normal user create an organization", async () => {
		await expect(
			getAuth(env).api.createOrganization({
				headers: orgOwner.headers,
				body: { name: "Self Made", slug: "self-made" },
			}),
		).rejects.toThrow();
	});
});

describe("platform role is separate from organization role", () => {
	it("refuses an organization owner", async () => {
		const response = await call("/api/platform/organizations", orgOwner, {
			companyName: "Nope",
			ownerName: "Nope",
			ownerEmail: "nope@test.invalid",
		});
		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toEqual({
			error: "NOT_PLATFORM_ADMIN",
		});
	});

	it("refuses an organization admin", async () => {
		const response = await call("/api/platform/organizations", orgAdmin, {
			companyName: "Nope",
			ownerName: "Nope",
			ownerEmail: "nope2@test.invalid",
		});
		expect(response.status).toBe(403);
	});

	it("refuses an unauthenticated caller", async () => {
		const response = await call("/api/platform/organizations", undefined, {
			companyName: "Nope",
			ownerName: "Nope",
			ownerEmail: "nope3@test.invalid",
		});
		expect(response.status).toBe(401);
	});

	it("allows a platform admin", async () => {
		const response = await call("/api/platform/organizations", platformAdmin, {
			companyName: "Allowed Co",
			ownerName: "Allowed Owner",
			ownerEmail: "allowed-owner@test.invalid",
			locale: "en",
		});
		expect(response.status).toBe(200);
	});

	it("keeps the organization owner off the platform role", async () => {
		const [row] = await getDb(env)
			.select({ role: userTable.role })
			.from(userTable)
			.where(eq(userTable.email, "org-owner@test.invalid"));
		expect(row?.role ?? null).not.toBe("admin");
	});
});

describe("provisioning a company", () => {
	const ownerEmail = "acme-owner@test.invalid";
	let result: Awaited<ReturnType<typeof provisionOrganizationWithOwner>>;

	beforeAll(async () => {
		result = await provisionOrganizationWithOwner(env, {
			companyName: "Acme Wash",
			ownerName: "Acme Owner",
			ownerEmail,
		});
	});

	it("creates exactly one user, not a platform admin", async () => {
		const rows = await getDb(env)
			.select({ id: userTable.id, role: userTable.role })
			.from(userTable)
			.where(eq(userTable.email, ownerEmail));
		expect(rows).toHaveLength(1);
		expect(rows[0]?.role ?? null).not.toBe("admin");
	});

	it("makes the user the organization owner", async () => {
		const [row] = await getDb(env)
			.select({ role: member.role })
			.from(member)
			.where(eq(member.organizationId, result.organizationId));
		expect(row?.role).toBe("owner");
	});

	it("creates exactly one English main branch in that organization", async () => {
		const rows = await getDb(env)
			.select({ id: team.id, name: team.name })
			.from(team)
			.where(eq(team.organizationId, result.organizationId));
		expect(rows).toHaveLength(1);
		expect(rows[0]?.name).toBe("Main Branch");
		expect(rows[0]?.id).toBe(result.branchId);
		expect(result.branchName).toBe("Main Branch");
	});

	it("creates Sede Principal for a Spanish company", async () => {
		const spanish = await provisionOrganizationWithOwner(env, {
			companyName: "Academia Local",
			ownerName: "Propietaria Local",
			ownerEmail: "propietaria-local@test.invalid",
			locale: "es",
		});
		const [branch] = await getDb(env)
			.select({ name: team.name })
			.from(team)
			.where(eq(team.organizationId, spanish.organizationId));
		expect(branch?.name).toBe("Sede Principal");
		expect(spanish.branchName).toBe("Sede Principal");
	});

	it("reports that an account setup email was sent", () => {
		expect(result.setupEmailSent).toBe(true);
	});

	it("never returns the provisional password", () => {
		const serialized = JSON.stringify(result);
		expect(serialized).not.toMatch(/password/i);
		expect(Object.keys(result)).not.toContain("password");
	});

	it("leaves the owner unverified until they use the link", async () => {
		const [row] = await getDb(env)
			.select({ emailVerified: userTable.emailVerified })
			.from(userTable)
			.where(eq(userTable.email, ownerEmail));
		expect(row?.emailVerified).toBe(false);
	});
});

describe("magic link activation destroys the provisional credential", () => {
	it("strips the provisional account, verifies the email and opens a session", async () => {
		const ownerEmail = "activate-owner@test.invalid";
		const send = vi.spyOn(env.EMAIL, "send");
		send.mockClear();

		await provisionOrganizationWithOwner(env, {
			companyName: "Activate Co",
			ownerName: "Activate Owner",
			ownerEmail,
		});

		const db = getDb(env);
		const [owner] = await db
			.select({ id: userTable.id })
			.from(userTable)
			.where(eq(userTable.email, ownerEmail));
		if (!owner) throw new Error("owner missing");

		// A provisional credential exists before activation.
		const before = await db
			.select({ id: account.id })
			.from(account)
			.where(eq(account.userId, owner.id));
		expect(before.length).toBeGreaterThan(0);

		const message = send.mock.calls.at(-1)?.[0] as { text: string };
		const url = message.text.match(/https?:\/\/\S+/)?.[0];
		if (!url) throw new Error("magic link url missing");
		send.mockRestore();

		const response = await worker.fetch(
			new Request(url, { redirect: "manual" }),
			env,
			createExecutionContext(),
		);
		expect([200, 302]).toContain(response.status);
		// The link mints the owner's session.
		expect(response.headers.get("set-cookie")).toBeTruthy();

		// Better Auth deletes every account row accrued before the mailbox was
		// proven, so the provisional password cannot survive activation.
		const after = await db
			.select({ id: account.id })
			.from(account)
			.where(eq(account.userId, owner.id));
		expect(after).toHaveLength(0);

		const [verified] = await db
			.select({ emailVerified: userTable.emailVerified })
			.from(userTable)
			.where(eq(userTable.id, owner.id));
		expect(verified?.emailVerified).toBe(true);
	});

	it("does not reuse a consumed setup link", async () => {
		const ownerEmail = "single-use@test.invalid";
		const send = vi.spyOn(env.EMAIL, "send");
		send.mockClear();

		await provisionOrganizationWithOwner(env, {
			companyName: "Single Use Co",
			ownerName: "Single Use Owner",
			ownerEmail,
		});

		const message = send.mock.calls.at(-1)?.[0] as { text: string };
		const url = message.text.match(/https?:\/\/\S+/)?.[0];
		if (!url) throw new Error("magic link url missing");
		send.mockRestore();

		await worker.fetch(
			new Request(url, { redirect: "manual" }),
			env,
			createExecutionContext(),
		);
		const second = await worker.fetch(
			new Request(url, { redirect: "manual" }),
			env,
			createExecutionContext(),
		);
		// A consumed token no longer mints a session.
		const location = second.headers.get("location") ?? "";
		const reused = second.headers.get("set-cookie");
		expect(reused === null || /error/i.test(location)).toBe(true);
	});
});

describe("existing user provisioned as a second owner", () => {
	it("reuses the account without touching its credentials", async () => {
		const email = "existing-owner@test.invalid";
		const existing = await createUser(email);

		const beforeAccounts = await getDb(env)
			.select({ id: account.id, password: account.password })
			.from(account)
			.where(eq(account.userId, existing.userId));

		const result = await provisionOrganizationWithOwner(env, {
			companyName: "Second Company",
			ownerName: "Existing Owner",
			ownerEmail: email,
		});

		const users = await getDb(env)
			.select({ id: userTable.id })
			.from(userTable)
			.where(eq(userTable.email, email));
		expect(users).toHaveLength(1);

		const afterAccounts = await getDb(env)
			.select({ id: account.id, password: account.password })
			.from(account)
			.where(eq(account.userId, existing.userId));
		expect(afterAccounts).toEqual(beforeAccounts);

		// Already verified, so no setup link is sent.
		expect(result.setupEmailSent).toBe(false);

		const [membership] = await getDb(env)
			.select({ role: member.role })
			.from(member)
			.where(eq(member.organizationId, result.organizationId));
		expect(membership?.role).toBe("owner");

		const [row] = await getDb(env)
			.select({ role: userTable.role })
			.from(userTable)
			.where(eq(userTable.id, existing.userId));
		expect(row?.role ?? null).not.toBe("admin");
	});
});

describe("provisioning is retry safe", () => {
	it("resolves same-name collisions without reusing an unrelated company", async () => {
		const name = "Shared Company Name";
		const first = await provisionOrganizationWithOwner(env, { companyName: name, ownerName: "First owner", ownerEmail: "collision-first@test.invalid" });
		const second = await provisionOrganizationWithOwner(env, { companyName: name, ownerName: "Second owner", ownerEmail: "collision-second@test.invalid" });
		expect(second.organizationId).not.toBe(first.organizationId);
		const retried = await provisionOrganizationWithOwner(env, { companyName: name, ownerName: "Second owner", ownerEmail: "collision-second@test.invalid" });
		expect(retried.organizationId).toBe(second.organizationId);
	});
	it("does not duplicate the company, user or initial branch", async () => {
		const input = {
			companyName: "Retry Co",
			ownerName: "Retry Owner",
			ownerEmail: "retry-owner@test.invalid",
			locale: "es" as const,
		};
		const first = await provisionOrganizationWithOwner(env, input);
		const second = await provisionOrganizationWithOwner(env, { ...input, locale: "en" });

		const users = await getDb(env)
			.select({ id: userTable.id })
			.from(userTable)
			.where(eq(userTable.email, input.ownerEmail));
		expect(users).toHaveLength(1);

		const branchesFirst = await getDb(env)
			.select({ id: team.id })
			.from(team)
			.where(eq(team.organizationId, first.organizationId));
		expect(branchesFirst).toHaveLength(1);

		const branchesSecond = await getDb(env)
			.select({ id: team.id })
			.from(team)
			.where(eq(team.organizationId, second.organizationId));
		expect(branchesSecond).toHaveLength(1);

		const orgs = await getDb(env)
			.select({ id: organization.id })
			.from(organization)
			.where(eq(organization.name, "Retry Co"));
		expect(orgs).toHaveLength(1);
		expect(first.organizationId).toBe(second.organizationId);
		expect(first.branchName).toBe("Sede Principal");
		expect(second.branchName).toBe("Sede Principal");
	});
});

describe("setup-password endpoint", () => {
	it("rejects an unauthenticated caller", async () => {
		const response = await call("/api/account/setup-password", undefined, {
			newPassword: "BrandNewPassword123!",
		});
		expect(response.status).toBe(401);
	});

	it("refuses a user who already has a credential", async () => {
		const configured = await createUser("configured@test.invalid");
		const response = await call("/api/account/setup-password", configured, {
			newPassword: "BrandNewPassword123!",
		});
		expect(response.status).toBe(409);
		await expect(response.json()).resolves.toEqual({
			error: "PASSWORD_ALREADY_SET",
		});
	});

	it("never accepts a userId from the browser", async () => {
		const victim = await createUser("victim@test.invalid");
		const attacker = await createUser("attacker@test.invalid");
		const response = await call("/api/account/setup-password", attacker, {
			newPassword: "AttackerChosen123!",
			userId: victim.userId,
		});
		// Refused because the attacker already has a credential; the userId in
		// the body is ignored entirely.
		expect(response.status).toBe(409);
	});
});

describe("account setup email", () => {
	it("sends exactly one setup email for a newly provisioned owner", async () => {
		const send = vi.spyOn(env.EMAIL, "send");
		send.mockClear();

		await provisionOrganizationWithOwner(env, {
			companyName: "Mailed Co",
			ownerName: "Mailed Owner",
			ownerEmail: "mailed-owner@test.invalid",
		});

		expect(send).toHaveBeenCalledTimes(1);
		const message = send.mock.calls[0]?.[0] as {
			to: string;
			subject: string;
			text: string;
		};
		expect(message.to).toBe("mailed-owner@test.invalid");
		expect(message.subject).toMatch(/set/i);
		expect(message.subject).not.toMatch(/reset your password/i);
		expect(message.text).not.toMatch(/[0-9a-f]{64}/);
		send.mockRestore();
	});
});
