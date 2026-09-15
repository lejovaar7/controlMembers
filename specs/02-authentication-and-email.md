# Specification 02: Authentication and Email

[All specifications](README.md)

## Better Auth configuration

`src/worker/auth/index.ts` constructs Better Auth per request because Worker
bindings are request-scoped. It uses the centralized Drizzle adapter and the
generated Better Auth schema.

Enabled capabilities:

- email/password authentication
- required email verification
- password reset
- Admin plugin for platform roles
- Magic Link plugin for controlled account activation
- Organization plugin
- Teams inside Organizations
- required Organization locale plus optional timezone and currency fields
- nullable user locale, not writable through native user-input fields
- fixed membership active/scope/delegation fields, enforced by guarded application routes

Both email/password signup and Magic Link signup are disabled. Unknown users
cannot create accounts through either public primitive.

Normal users also cannot create Organizations because
`allowUserToCreateOrganization` is false. Platform provisioning uses the
supported server/system path with an explicit user ID and no user session.

## Session guards

`src/worker/auth/session.ts` provides:

- `getCurrentSession()` — Better Auth session resolution from request headers.
- `requireAuth()` — authenticated-session requirement.
- `requirePlatformAdmin()` — checks Admin plugin `user.role` for `admin`.
- `AuthError` — typed `401`, `403`, and `404` authorization failures.

No code manually parses Better Auth cookies.

Platform `user.role` and Organization `member.role` are separate. An
Organization owner/admin does not pass the platform guard.

Authentication proves identity, not company access. Deactivating a membership
does not ban the global account: the person can still sign in, but inactive
companies are excluded and tenant requests are denied. Existing sessions cannot
bypass `requireTenant()`; new login cannot restore disabled access. Company
selection is specified in [Tenant and Branch Security](04-tenant-and-branch-security.md).

## EmailService

`src/worker/email/index.ts` is the only source file that accesses `env.EMAIL`.
Features pass plain `{to, subject, text, html}` messages into the service.

`src/worker/email/messages.ts` provides escaped text/HTML messages for:

- email verification
- password reset
- account setup
- Organization invitation infrastructure

Better Auth background email tasks use the Worker execution context when it is
available.

### Email language

`src/worker/email/locale.ts` resolves the recipient's persisted preference first,
then the company supplied by guarded provisioning/resend. That company must be
an active membership for ordinary setup/recovery. Without an explicit company,
exactly one active membership supplies its language; multiple memberships are
ambiguous and do not select an arbitrary tenant. Unsupported/missing values fall
back to the registry default. A supported public `X-App-Locale` header is only a
presentation fallback when there is no applicable personal/company preference.

Invitations precede membership, so that future server-only hook resolves the
recipient preference and the Organization already authorized by Better Auth.
The sender/administrator's personal language never chooses someone else's email.

All templates share the UI catalogs: subject, text, HTML, actions, alternative
link instructions and footer. HTML escapes interpolated names/URLs after
translation and declares language/direction. Callback URLs carry the resolved
`lang` without changing Better Auth tokens or existing flags. It preserves the
activation-page language before company selection but grants no authority and
does not persist a personal preference. Public/recipient resolution never changes
the generic account-existence response. No live translation service is involved.

Local development/preview and automated tests disable remote bindings and never
send real messages. Dev and production each configure their own `EMAIL_FROM`,
`APP_URL` and independent `BETTER_AUTH_SECRET` on Cloudflare. Real secret values
never belong in tracked source. Each `APP_URL` must match its deployed HTTPS
custom domain; the wrapper cannot verify remote secret values.

Dev's Email binding permits only explicitly allowlisted test recipients. The
platform admin and test accounts must use those mailboxes; other deliveries
fail without undoing valid provisioning. Production has no test-recipient
restriction. Domains/sender setup and actual delivery are external release
checks, not claims established by a build/dry-run.

Build-only `.dev.vars.dev.example` and `.dev.vars.production.example` contain
non-secret fixtures. Optional ignored copies prevent local-file fallback during
builds; they are not deployed secrets. Never copy production credentials into
local files or share the ignored Worker build directory, which can contain them.

First-account activation and established-account password recovery are different
flows; never use setup to overwrite an established credential. Each environment
bootstraps its own admin and owns separate users, sessions and tokens.

## Implemented authentication flows

### Established user sign-in

1. User submits email and password at `/login`.
2. Better Auth validates the credential and required verification state.
3. Known errors are mapped to safe UI messages.
4. A sanitized `returnTo` controls the internal destination.
5. The app retains valid company context, enters the only active company, asks
   for a choice among several, or shows no active company access. It never
   arbitrarily picks the first of multiple memberships.

### Forgot/reset password

1. `/forgot-password` requests a Better Auth reset link.
2. The UI returns the same generic response regardless of account existence.
3. `/reset-password` passes the token back to Better Auth without rendering or
   logging it.
4. The user returns to login after a successful reset.

### First account setup

1. An authorized server flow provisions the user.
2. Better Auth emails a Magic Link with callback `/setup-account`.
3. Magic Link proves mailbox ownership and creates an authenticated session.
   It also revokes the unverified user's provisional credential before password
   setup. Administrators never receive or choose that provisional password.
4. `/api/account/setup-password` refuses users who already have a credential.
5. The authenticated user chooses their own password.

The server never accepts a browser-supplied user ID for password setup.
The endpoint requires a verified mailbox and an 8–128 character password.
`auth/provisioning.ts` shares identity reuse, credential detection and setup
status handling between Owner and employee provisioning. An interrupted verified
account without a password can receive another setup link; an established
account's credentials are never replaced.

## Frontend safety helpers

- `src/react-app/lib/auth-client.ts` configures the Better Auth React client with
  Organization and Team support.
- `src/react-app/lib/auth-errors.ts` prevents rendering raw Better Auth errors.
- `src/react-app/lib/return-path.ts` allows only same-application paths.
- Password and token values are never rendered or logged intentionally.

## Current limitations

- `/accept-invitation` and its placeholder page were removed.
- Invitation email infrastructure is tested server-side for a future explicitly
  requested feature; invitation HTTP endpoints are disabled in v1.
- `/verify-email` remains available for verification support, but public signup
  is disabled and `/register` redirects to login.

## Acceptance checks

- Public signup and Magic Link signup cannot create unknown users.
- Established users can sign in/out and recover a password; recovery does not
  reveal whether an account exists.
- New users prove mailbox ownership and choose their own password using a
  single-use link. No provisional credential survives activation.
- Setup rejects unverified users, an existing password and attempts to select
  another user through browser input.
- Interrupted setup can be resent without replacing established credentials.
- Existing identities keep their password, providers, verification and platform
  role when added to another company.
- Authentication forms recover from network errors without logging passwords
  or tokens; return paths stay inside the application.
- Recipient preference wins over company/sender language. New company locale is
  saved before the first setup email; retries preserve an existing company locale.
- Public reset language remains a fallback and does not expose account existence.
- Every template is complete in every enabled catalog and still escapes user data.

Evidence: `test/provisioning.test.ts`, `test/members.test.ts`,
`test/hardening.test.ts`, `test/localization.test.ts` and `test/return-path.test.ts`.
