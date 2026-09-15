# Specification 03: Platform Provisioning

[All specifications](README.md)

## Purpose

The platform administrator creates SaaS customers. End users never create their
own company, first Owner, or Main Branch.

## Platform scope

`requirePlatformAdmin()` authorizes platform operations from Better Auth Admin
plugin `user.role`. Organization roles never grant this access.

The React `PlatformLayout` also checks platform role for UX, but backend guards
remain authoritative.

Implemented platform routes:

- `/platform`
- `/platform/organizations/new`
- `POST /api/platform/organizations`
- `POST /api/platform/account-setup/resend`

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
   retry, or create the Organization through Better Auth.
5. Reuse the first existing Branch or create `Main` through Better Auth Teams.
6. Send account setup for a new or interrupted account (not an established password account).

The required `locale` is validated before identity creation and stored on a new
Organization before sending email. Omitted, null and unsupported values are rejected.
Retrying an existing company never overwrites its language. Setup and platform
resend carry that company's ID internally; resend checks active recipient
membership when a company ID is supplied. The recipient's personal language
still wins. Company names and the stored `Main` name are not translated.

`slugify()` produces a safe Organization slug. Provisioning checks availability
and adds a bounded suffix before using a random fallback. Occupied slugs are
normal collisions, not fatal errors.

## Security properties

- The provisional credential is never returned, logged, displayed, or emailed.
- Magic Link signup is disabled, so only a provisioned account can activate.
- Verified existing password users do not receive forced first-account setup.
- Existing users can become Owner of another Organization without duplicate
  identity or credential changes.
- The Organization Owner does not gain platform role.
- Retry does not duplicate the user, Organization, or Main Branch.
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
- A successful request creates/reuses one company, its Owner and `Main`, then
  reports setup email as sent, unnecessary or failed without exposing secrets.
- Existing accounts retain credentials and platform role; a new company Owner
  does not become a platform administrator.
- Repeating a request reuses the same owned company. Equal company names with
  unrelated Owners do not cause accidental company reuse or fatal slug errors.
- Email failure leaves valid company access intact and offers a safe resend.
- The form recovers from request failures and can start another company entry.

Evidence: `test/provisioning.test.ts`, `test/hardening.test.ts` and the
[verification record](VERIFICATION.md). Billing, ownership transfer and company
deletion are outside this module's current scope.
