# Specification 03: Platform Provisioning

[All specifications](README.md)

## Purpose

The platform administrator creates SaaS customers. End users never create their
own company, first Owner, or localized initial Branch.

## Platform scope

`requirePlatformAdmin()` authorizes platform operations from Better Auth Admin
plugin `user.role`. Organization roles never grant this access.

The React `PlatformLayout` also checks platform role for UX, but backend guards
remain authoritative.

Implemented platform routes:

- `/platform`
- `/platform/organizations/new`
- `/platform/organizations/:id`
- `GET /api/platform/organizations` (search and pagination)
- `GET /api/platform/organizations/:id`
- `PATCH /api/platform/organizations/:id` (company name only)
- `POST /api/platform/organizations`
- `POST /api/platform/account-setup/resend`

## Company directory and administration

The platform home lists all companies, including companies where the current
platform administrator has no membership. Search matches company name, slug,
Owner name or Owner email. Results use stable creation-date/ID ordering and
20-row pages; search values are bound and wildcard characters are literal.

Each company detail shows its Owners and activation status, Branch names,
active user count, language, currency and timezone. Platform administrators may
rename a company; the update and `platform.organization.renamed` audit event
are atomic. Identity, slug, memberships and financial configuration remain intact.
An active Owner with pending setup can receive the existing setup-link resend.
Provisioning success links directly to the new company's detail and directory.

Platform role does not grant tenant access. The detail offers **Open company**
only for an active membership of the signed-in account, and the activation API
independently verifies membership. Member, charge and payment administration
continues to require tenant role and Branch permissions. Platform administration
does not impersonate Owners or automatically create memberships.

## First platform-admin bootstrap

The guarded `npm run bootstrap:admin` command avoids a public bootstrap endpoint,
raw operator SQL and a default password:

1. Validate the explicit local, dev or production target and its D1/email/domain
   configuration.
2. Insert the first unverified Better Auth user with platform role `admin` through
   Wrangler D1, refusing an existing different admin or non-platform identity.
3. Request a controlled Magic Link for that existing email.
4. The administrator completes the common `/setup-account` flow.

There is no hardcoded administrator email, hidden setup route, or default
credential.

## Customer provisioning input

The platform form accepts only:

- company name
- Owner name
- Owner email
- company language (required registered locale, initially the platform administrator's current language)

It does not collect billing, tax, branding, address, currency, timezone,
or Branch configuration.

## Provisioning implementation

`src/worker/platform/provision.ts` performs:

1. Normalize Owner email.
2. Reuse an existing Better Auth user or create one with a cryptographically
   random provisional credential.
3. Preserve existing password, verification state, providers, and platform role.
4. Reuse a same-named Organization already owned by that user after a partial
   retry. Reject a different company name with `409 OWNER_EMAIL_ALREADY_ASSIGNED`
   if the normalized email already owns a company, including inactive ownership.
5. Create a new Organization, Owner membership and localized initial Branch in
   one atomic Drizzle/D1 batch. A conditional organization insert rechecks the
   ownership inside that batch; the membership foreign key rolls back a losing
   concurrent request. Resolve same-company retries and return a conflict for
   competing company names. Slug collisions from unrelated owners are retried.
   Use `Sede Principal` for Spanish companies and `Main Branch` for English.
   Existing partial provisions reuse their Branch or recover it through Teams.
6. Send account setup for a new or interrupted account (not an established password account).

The required `locale` is validated before identity creation and stored on a new
Organization before sending email. Omitted, null and unsupported values are rejected.
Retrying an existing company never overwrites its language. Setup and platform
resend carry that company's ID internally; resend checks active recipient
membership when a company ID is supplied. The recipient's personal language
still wins. Company names are not translated; the initial Branch name is chosen
from the company language when it is first created.

`slugify()` produces a safe Organization slug. Provisioning checks availability
and adds a bounded suffix before using a random fallback. Occupied slugs are
normal collisions, not fatal errors.

## Security properties

- The provisional credential is never returned, logged, displayed, or emailed.
- Magic Link signup is disabled, so only a provisioned account can activate.
- Verified existing password users do not receive forced first-account setup.
- An existing account that does not own a company can become an Owner without
  identity or credential changes. A new school must use a different Owner email
  from all existing schools. Email matching trims whitespace and ignores case.
- Legacy duplicate ownerships are retained, never deleted or reassigned by this
  validation. They cannot be used to create a third company. Existing employee
  memberships and company switching are unaffected.
- The Organization Owner does not gain platform role.
- Retry does not duplicate the user, Organization, or initial Branch.
- Email failure does not invalidate already-created database state.

## Account setup endpoint

`POST /api/account/setup-password`:

- requires an authenticated session with a verified mailbox
- checks for a credential-provider account with a non-null password
- requires an 8–128 character password
- calls Better Auth's server-only password API
- ignores any browser-supplied user identity
- returns `409 PASSWORD_ALREADY_SET` for an established credential

`SetupAccountPage` redirects platform administrators to `/platform` and normal
tenant users to `/app/dashboard` after successful setup.

Provisioning reports `setupEmailStatus` as `sent`, `not-required` or `failed`;
the platform form offers resend after a mail failure and can reset for another
company. Both forms recover from network errors. Shared primitives are in
`src/worker/auth/provisioning.ts` and also power employee setup.

## Acceptance checks

- Bootstrap works without a public setup endpoint, predefined account or default
  password. The explicit operator procedure is in the
  [README](../README.md#bootstrapping-the-first-platform-admin).
- Only a platform administrator can provision a company. Organization owner
  and admin roles alone receive a denial from the backend.
- A successful request creates/reuses one company, its Owner and localized
  initial Branch, then
  reports setup email as sent, unnecessary or failed without exposing secrets.
- Existing accounts retain credentials and platform role; a new company Owner
  does not become a platform administrator.
- Repeating a request reuses the same owned company. Equal company names with
  unrelated Owners do not cause accidental company reuse or fatal slug errors.
- Different schools cannot reuse an Owner email, including simultaneous
  submissions. Rejection creates no orphan Organization, Branch or membership,
  sends no activation email and preserves the existing account credentials.
- The creation form explains the unique-email requirement and displays a
  localized conflict message without clearing the entered form values.
- Email failure leaves valid company access intact and offers a safe resend.
- The form recovers from request failures and can start another company entry.

Directory acceptance additionally covers platform-only list/detail/rename,
literal search, pagination, activation status, active counts, audited rename,
rejection of unrelated update fields, and absence of implicit tenant access.

Evidence: `test/platform-organizations.test.ts`, `test/provisioning.test.ts`, `test/hardening.test.ts` and the
[verification record](VERIFICATION.md). Billing, ownership transfer and company
deletion are outside this module's current scope.
