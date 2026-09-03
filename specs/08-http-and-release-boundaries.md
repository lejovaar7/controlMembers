# Specification 08: HTTP and Release Boundaries

[All specifications](README.md)

## API composition

`src/worker/index.ts` composes Better Auth, health, company selection, Branch,
Member, platform, account-setup and language routes. `src/worker/http.ts` supplies:

- `readJsonObject`: malformed JSON, arrays and null become `400 INVALID_INPUT`.
- `requireSameOriginJson`: custom write requests require JSON and reject a foreign
  Origin or cross-site fetch metadata. Same-origin browser requests and explicit
  non-browser requests without an Origin remain usable.
- `RequestError`: safe validation/conflict codes separate from auth failures.

Hono limits API request bodies to 16 KiB and returns 413 for larger payloads.
Successful and guarded API responses use `Cache-Control: no-store`. Unexpected
errors return generic 500 without raw database, account or tenant details.

Unknown application endpoints handled by Hono return JSON
`{"error":"Not Found"}`. `/api/auth/*` is a delegated Better Auth namespace:
unknown auth routes may return an empty `404`, while entries in `disabledPaths`
return a plain-text `Not Found` `404`. That variation exposes no protected data,
but API clients must not assume every auth `404` is JSON. Application guard and
validation failures outside that namespace remain stable JSON error codes.

## Native Better Auth boundary

`getAuth().disabledPaths` disables unrestricted member/Team directory reads,
arbitrary member-role reads, role updates, removals, leave/delete, invitation
HTTP operations and native Organization settings editing. The supported server API is
still available to guarded orchestration and future-infrastructure tests.

Native Organization list, activation, active-member/role/metadata and permission
reads are disabled too: Better Auth's default membership check does not enforce
the application's `isActive` field. Use `/api/companies` and
`/api/companies/active`; do not re-enable native paths as a UI shortcut. Membership
scope/delegation fields are accepted only through guarded application writes
before the server-only `addMember` call. No public native member creation is enabled.

`auth/http-policy.ts` additionally guards create/update Team and add-Team-member
HTTP requests with the active-Organization admin context. Only Owner/unrestricted
admin may create a Branch; limited admins may rename assigned Branches. The
native `set-active-team` path checks active membership and Branch access too.
Browser Team membership creation is limited to owner/admin self-assignment
within already-authorized scope for active-Team compatibility;
other employees must go through the Member workflow. Foreign Organization IDs
cannot redirect these writes. Branch names are trimmed and limited to 100
characters in Better Auth hooks, independently of frontend validation.

## Scope of release hardening

- Auth and management forms recover from rejected requests and network errors.
- Settings edits only personal/company language; other settings remain an extension point.
- The unsupported invitation acceptance page and route were removed. Invitation
  templates/hooks remain server-only future infrastructure with escaped HTML and
  tests; no v1 UI promises an unfinished invitation flow.
- EmailService logs delivery IDs, not recipients, tokens or message bodies.
- Test fixtures use simulated Email and isolated local D1, not real customers.
- Language writes accept only `{locale}` with a registered key or null.
  `/api/account/locale` PATCH targets only the authenticated user; company PATCH
  requires a live active-company Owner/admin. Browser user/company IDs and extra
  fields are rejected. Native user locale input cannot bypass validation.
  Company saves may include `X-Company-Context`; a mismatch is a 409 concurrency
  conflict, never permission to select a tenant through a header.
  API error codes remain stable machine-readable identifiers; UI maps them to
  safe translated messages instead of rendering server text.
- Local/dev/production have separate configuration and D1 identities; remote
  placeholders prevent accidental publication and secrets remain external.
- Environment commands reject shared resources and ambiguous remote targets.
  This is an operator guardrail, not a replacement for Cloudflare permissions.
- Dev has an email-recipient allowlist and a distinct custom domain. Alternate
  workers.dev/preview URLs are disabled, but website access restrictions still
  require the operator's separate policy/setup.

## Verification and maintenance

`test/hardening.test.ts` proves malformed/origin/body-size handling, non-caching,
disabled invitation surfaces, first-platform-admin bootstrap and email escaping.
`test/helpers.ts` centralizes test actors and same-origin Worker requests.
`test/access-controls.test.ts` covers inactive memberships, delegated appointment,
scope restrictions and attempted native/re-provision bypasses.

See [the verification record](VERIFICATION.md) for the actual command results,
browser checks, dependency remediation and release limitations.
Remote resource/secret/domain setup and production deployment remain separate
operations, not implicit actions of the local gate. Environment configuration
is covered by [Testing and Operations](09-testing-and-operations.md#environment-contract).
Ownership transfer, deletion and dependency major upgrades remain separate tasks.

## Acceptance checks

- Malformed JSON, arrays, null, invalid write origins/content types and oversized
  bodies fail with safe status/error responses rather than raw exceptions.
- Tenant/auth responses are not exposed as reusable cached application data.
- Unsupported native directory, invitation, destructive and role-edit endpoints
  stay unavailable over HTTP with `404`; their response format is owned by
  Better Auth. Guarded supported workflows remain functional.
- Foreign Organization IDs cannot redirect native Team writes into another
  tenant, and ordinary members cannot perform owner/admin self-activation.
- An inactive membership cannot list/select its company or use supported Team
  writes; a limited admin cannot self-assign or activate an unauthorized Branch.
- Email HTML escapes names and links; delivery logging does not include
  recipients, message bodies, passwords or tokens.
- Production data, secrets, local runtime state and build artifacts are not
  committed. Each clone supplies its own external configuration.
- The cross-module flows in the [release checklist](09-testing-and-operations.md#release-checklist)
  remain valid after an HTTP/auth policy change.
