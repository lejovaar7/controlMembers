import { and, eq } from "drizzle-orm";
import { getAuth } from "../auth";
import { ensureProvisionedUser, sendAccountSetup, type SetupEmailStatus } from "../auth/provisioning";
import { getDb } from "../db";
import {
	member,
	organization as organizationTable,
	team,
} from "../db/auth-schema";
import { slugify } from "./slug";
import { readRequiredLocale } from "../localization";
import { DEFAULT_LOCALE, type Locale } from "../../shared/i18n";

export type ProvisionOwnerInput = {
	companyName: string;
	ownerName: string;
	ownerEmail: string;
	locale?: Locale;
};

export type ProvisionOwnerResult = {
	organizationId: string;
	organizationName: string;
	branchId: string;
	branchName: string;
	userId: string;
	/** True only when an account-setup message was successfully requested. */
	setupEmailSent: boolean;
	setupEmailStatus: SetupEmailStatus;
};

/** Free slug, retrying rather than trusting the first candidate. */
async function resolveSlug(env: Env, name: string): Promise<string> {
	const base = slugify(name);
	for (let attempt = 0; attempt < 6; attempt += 1) {
		const candidate =
			attempt === 0 ? base : `${base}-${(attempt + 1).toString(36)}`;
		// Better Auth's check-slug throws for an occupied slug; a scoped read
		// lets normal name collisions continue without swallowing other errors.
		const [taken] = await getDb(env).select({ id: organizationTable.id }).from(organizationTable).where(eq(organizationTable.slug, candidate)).limit(1);
		if (!taken) return candidate;
	}
	return `${base}-${crypto.randomUUID().slice(0, 12)}`;
}

/**
 * Creates a company, its owner and its localized main branch.
 *
 * Every step is written to be safe to retry: an existing user is reused rather
 * than recreated, an existing membership is left alone, and an existing initial
 * branch is not duplicated. Email failure never rolls back valid database work.
 */
export async function provisionOrganizationWithOwner(
	env: Env,
	input: ProvisionOwnerInput,
): Promise<ProvisionOwnerResult> {
	const auth = getAuth(env);
	const db = getDb(env);
	const locale = readRequiredLocale(input.locale ?? DEFAULT_LOCALE);

	const companyName = input.companyName.trim();
	const ownerName = input.ownerName.trim();
	const ownerEmail = input.ownerEmail.trim().toLowerCase();

	// A. Reuse an existing account; never touch its password, verification
	// state or platform role.
	const existing = await ensureProvisionedUser(env, ownerEmail, ownerName);
	const userId = existing.id;

	// B. Reuse a company this owner already has under the same name, so a retry
	// after a partial failure resumes instead of creating a second tenant.
	const [alreadyOwned] = await db
		.select({ id: organizationTable.id, name: organizationTable.name, locale: organizationTable.locale })
		.from(organizationTable)
		.innerJoin(member, eq(member.organizationId, organizationTable.id))
		.where(
			and(
				eq(member.userId, userId),
				eq(member.role, "owner"),
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
				locale,
				slug: await resolveSlug(env, companyName),
				userId,
				keepCurrentActiveOrganization: true,
			},
		}));
	if (!organization) throw new Error("organization could not be created");
	const organizationLocale = alreadyOwned
		? readRequiredLocale(alreadyOwned.locale)
		: locale;
	const localizedBranchName = organizationLocale === "es" ? "Sede Principal" : "Main Branch";

	// C. Initial branch. Reuse it if a previous attempt already created it.
	const [existingBranch] = await db
		.select({ id: team.id, name: team.name })
		.from(team)
		.where(eq(team.organizationId, organization.id))
		.limit(1);

	const branchId =
		existingBranch?.id ??
		(
			await auth.api.createTeam({
				body: { name: localizedBranchName, organizationId: organization.id },
			})
		).id;
	const branchName = existingBranch?.name ?? localizedBranchName;

	// Better Auth needs a team_member row before a team can become active, but
	// its add-team-member API requires the acting user's session, which does not
	// exist during provisioning. The frontend's activateBranch() adds the row on
	// first use. Owner authority comes from the organization role either way.

	// D. New accounts and interrupted setups receive a link; established ones do not.
	const setupEmailStatus = await sendAccountSetup(env, ownerEmail, organization.id);

	return {
		organizationId: organization.id,
		organizationName: organization.name,
		branchId,
		branchName,
		userId,
		setupEmailSent: setupEmailStatus === "sent",
		setupEmailStatus,
	};
}
