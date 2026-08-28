import { and, eq } from "drizzle-orm";
import { getAuth } from "../auth";
import { getDb } from "../db";
import {
	account,
	member,
	organization as organizationTable,
	team,
	user as userTable,
} from "../db/auth-schema";
import { slugify } from "./slug";

export type ProvisionOwnerInput = {
	companyName: string;
	ownerName: string;
	ownerEmail: string;
};

export type ProvisionOwnerResult = {
	organizationId: string;
	organizationName: string;
	branchId: string;
	userId: string;
	/** True when the owner still has to complete account setup. */
	setupEmailSent: boolean;
};

/** Provisional credential, never returned, emailed, logged or stored in clear. */
function generateProvisionalPassword(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A user who has never proven their mailbox still needs account setup. */
async function needsAccountSetup(env: Env, userId: string): Promise<boolean> {
	const [row] = await getDb(env)
		.select({ emailVerified: userTable.emailVerified })
		.from(userTable)
		.where(eq(userTable.id, userId))
		.limit(1);
	return row ? !row.emailVerified : false;
}

async function findUserByEmail(env: Env, email: string) {
	const [row] = await getDb(env)
		.select({ id: userTable.id, emailVerified: userTable.emailVerified })
		.from(userTable)
		.where(eq(userTable.email, email))
		.limit(1);
	return row ?? null;
}

/** Free slug, retrying rather than trusting the first candidate. */
async function resolveSlug(env: Env, name: string): Promise<string> {
	const base = slugify(name);
	for (let attempt = 0; attempt < 6; attempt += 1) {
		const candidate =
			attempt === 0 ? base : `${base}-${(attempt + 1).toString(36)}`;
		const taken = await getAuth(env).api.checkOrganizationSlug({
			body: { slug: candidate },
		});
		if (taken?.status) return candidate;
	}
	return `${base}-${Date.now().toString(36)}`;
}

/**
 * Creates a company, its owner and its Main branch.
 *
 * Every step is written to be safe to retry: an existing user is reused rather
 * than recreated, an existing membership is left alone, and an existing Main
 * branch is not duplicated. Email failure never rolls back valid database work.
 */
export async function provisionOrganizationWithOwner(
	env: Env,
	input: ProvisionOwnerInput,
): Promise<ProvisionOwnerResult> {
	const auth = getAuth(env);
	const db = getDb(env);

	const companyName = input.companyName.trim();
	const ownerName = input.ownerName.trim();
	const ownerEmail = input.ownerEmail.trim().toLowerCase();

	// A. Reuse an existing account; never touch its password, verification
	// state or platform role.
	let existing = await findUserByEmail(env, ownerEmail);
	if (!existing) {
		await auth.api.createUser({
			body: {
				email: ownerEmail,
				name: ownerName,
				password: generateProvisionalPassword(),
				// Platform role stays the default non-admin role.
			},
		});
		existing = await findUserByEmail(env, ownerEmail);
	}
	if (!existing) throw new Error("owner account could not be provisioned");
	const userId = existing.id;

	// B. Reuse a company this owner already has under the same name, so a retry
	// after a partial failure resumes instead of creating a second tenant.
	const [alreadyOwned] = await db
		.select({ id: organizationTable.id, name: organizationTable.name })
		.from(organizationTable)
		.innerJoin(member, eq(member.organizationId, organizationTable.id))
		.where(
			and(
				eq(member.userId, userId),
				eq(organizationTable.name, companyName),
			),
		)
		.limit(1);

	// Created on the owner's behalf with no session and no headers, so Better
	// Auth treats it as a system action and allowUserToCreateOrganization does
	// not block it.
	const organization =
		alreadyOwned ??
		(await auth.api.createOrganization({
			body: {
				name: companyName,
				slug: await resolveSlug(env, companyName),
				userId,
				keepCurrentActiveOrganization: true,
			},
		}));
	if (!organization) throw new Error("organization could not be created");

	// C. Main branch. Reuse it if a previous attempt already created it.
	const [existingBranch] = await db
		.select({ id: team.id })
		.from(team)
		.where(eq(team.organizationId, organization.id))
		.limit(1);

	const branchId =
		existingBranch?.id ??
		(
			await auth.api.createTeam({
				body: { name: "Main", organizationId: organization.id },
			})
		).id;

	// Better Auth needs a team_member row before a team can become active, but
	// its add-team-member API requires the acting user's session, which does not
	// exist during provisioning. The frontend's activateBranch() adds the row on
	// first use. Owner authority comes from the organization role either way.

	// E. Only a user who has never proven their mailbox gets a setup link.
	const setupRequired = await needsAccountSetup(env, userId);
	if (setupRequired) {
		await auth.api.signInMagicLink({
			body: { email: ownerEmail, callbackURL: "/setup-account" },
			headers: new Headers(),
		});
	}

	return {
		organizationId: organization.id,
		organizationName: organization.name,
		branchId,
		userId,
		setupEmailSent: setupRequired,
	};
}

/** Resends account setup for a provisioned user who has not finished it. */
export async function resendAccountSetup(
	env: Env,
	email: string,
): Promise<boolean> {
	const normalized = email.trim().toLowerCase();
	const existing = await findUserByEmail(env, normalized);
	if (!existing || existing.emailVerified) return false;

	await getAuth(env).api.signInMagicLink({
		body: { email: normalized, callbackURL: "/setup-account" },
		headers: new Headers(),
	});
	return true;
}

/** True when the user has no usable credential yet (first-time setup). */
export async function hasCredentialAccount(
	env: Env,
	userId: string,
): Promise<boolean> {
	const [row] = await getDb(env)
		.select({ id: account.id })
		.from(account)
		.where(eq(account.userId, userId))
		.limit(1);
	return Boolean(row);
}
