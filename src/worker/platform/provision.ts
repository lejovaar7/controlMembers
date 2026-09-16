import { and, eq, sql } from "drizzle-orm";
import { getAuth } from "../auth";
import { ensureProvisionedUser, sendAccountSetup, type SetupEmailStatus } from "../auth/provisioning";
import { getDb } from "../db";
import {
	member,
	organization as organizationTable,
	team,
	user,
} from "../db/auth-schema";
import { slugify } from "./slug";
import { readRequiredLocale } from "../localization";
import { DEFAULT_LOCALE, type Locale } from "../../shared/i18n";
import { RequestError } from "../http";

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

	// B. One new company per owner email. Existing duplicate ownerships are preserved,
	// but cannot be used to create another company. Same-name retries resume.
	const ownedCompanies = () => db
		.select({ id: organizationTable.id, name: organizationTable.name, locale: organizationTable.locale })
		.from(organizationTable)
		.innerJoin(member, eq(member.organizationId, organizationTable.id))
		.where(
			and(
				eq(member.userId, userId),
				eq(member.role, "owner"),
			),
		);
	const owned = await ownedCompanies();
	let organization = owned.find((company) => company.name === companyName);
	if (!organization && owned.length) throw new RequestError(409, "OWNER_EMAIL_ALREADY_ASSIGNED");
	if (!organization) {
		const id = crypto.randomUUID();
		const createdAt = new Date();
		const initialBranchName = locale === "es" ? "Sede Principal" : "Main Branch";
		// D1 executes the batch atomically. The conditional insert checks ownership
		// inside that transaction, so concurrent requests cannot create two schools
		// or leave an orphan company. If ownership was claimed concurrently, the
		// member foreign key aborts the entire batch and we resolve that conflict.
		for (let attempt = 0; attempt < 3; attempt++) {
			const slug = await resolveSlug(env, companyName);
			try {
				await db.batch([
					db.insert(organizationTable).select(db.select({
						id: sql<string>`${id}`.as("id"), name: sql<string>`${companyName}`.as("name"), slug: sql<string>`${slug}`.as("slug"),
						logo: sql<null>`null`.as("logo"), createdAt: sql<Date>`${createdAt.getTime()}`.as("created_at"), metadata: sql<null>`null`.as("metadata"),
						locale: sql<string>`${locale}`.as("locale"), timezone: sql<null>`null`.as("timezone"), currency: sql<null>`null`.as("currency"),
					}).from(user).where(and(eq(user.id, userId), sql`not exists (select 1 from member where user_id = ${userId} and role = 'owner')`))),
					db.insert(member).values({ id: crypto.randomUUID(), organizationId: id, userId, role: "owner", createdAt }),
					db.insert(team).values({ id: crypto.randomUUID(), organizationId: id, name: initialBranchName, createdAt }),
				]);
				break;
			} catch (error) {
				const concurrentOwned = await ownedCompanies();
				if (concurrentOwned.length) {
					if (!concurrentOwned.some((company) => company.name === companyName)) throw new RequestError(409, "OWNER_EMAIL_ALREADY_ASSIGNED");
					break;
				}
				// A different owner may have taken the same slug after resolveSlug.
				const [collision] = await db.select({ id: organizationTable.id }).from(organizationTable).where(eq(organizationTable.slug, slug)).limit(1);
				if (!collision || attempt === 2) throw error;
			}
		}
		organization = (await ownedCompanies()).find((company) => company.name === companyName);
		if (!organization) throw new RequestError(409, "OWNER_EMAIL_ALREADY_ASSIGNED");
	}
	const organizationLocale = readRequiredLocale(organization.locale);
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
