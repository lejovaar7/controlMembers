# Specification 00: Product and Architecture

[All specifications](README.md)

## Purpose

The repository builds the ControlMembers Cloudflare application: a React SPA and
a Hono Worker API for recurring member-fee management. It was cloned from the
reusable SaaS foundation and preserves that foundation's security boundaries.

## Product contract

- Closed B2B: users cannot publicly register or create their own company.
- The platform administrator provisions each company, its first Owner and a
  initial Branch named `Sede Principal` in Spanish or `Main Branch` in English.
  The Owner then chooses their own password.
- Owners/admins provision employees; established accounts can belong to several
  companies without duplicate identities or replaced credentials.
- The Owner controls which admins may appoint other admins. Admins may cover
  all Branches or selected Branches. Company access can be deactivated without
  deleting identity/history; inactive memberships do not authorize access.
- One active company is entered automatically. Multiple companies require a
  choice only when the session has no valid active company.
- Organization means company/tenant; Team means Branch/location. Keep Better
  Auth's persistence names, but use Company and Branch in the interface.
- Platform administration and company administration are separate authorities.
  A platform administrator needs explicit membership to access tenant data.
- UI and transactional email are multilingual with extensible typed catalogs.
  Personal language overrides the active company's language, then the application
  fallback applies. English/Spanish are initial catalogs, not a language limit.
- Every company starts with an internal Branch, including single-location
  businesses. Opening another location does not require a different tenant model.
- Authenticated owners/admins/employees are Users managed under **Users &
  permissions/Usuarios y permisos**. Customer-facing Members are separate
  business records and do not receive auth identities by default.
- ControlMembers adds Plans with optional tags, Enrollments, monthly Charges,
  Payments, Allocations, receivables and reports under specifications 10–19.

Detailed role and access policies belong to [tenant security](04-tenant-and-branch-security.md)
and [member management](07-member-management.md).

## Runtime topology

```text
Browser
  -> Cloudflare Static Assets for the React SPA
  -> /api/* routed to the Hono Worker
       -> Better Auth
       -> Drizzle ORM
       -> Cloudflare D1
       -> EmailService -> Cloudflare Email Sending
```

`wrangler.json` configures `run_worker_first: ["/api/*"]`. Unknown SPA paths are
handled by Static Assets with SPA fallback. Unknown application API paths reach
Hono and return JSON `404` from `app.notFound()`. `/api/auth/*` is delegated to
Better Auth, whose unknown or deliberately disabled routes may instead return an
empty or plain-text `404`; clients must use the status rather than assume a JSON
body for that namespace.

## Cloudflare bindings

| Binding/value | Use |
| --- | --- |
| `DB` | Cloudflare D1 database |
| `EMAIL` | Cloudflare Email Sending, accessed only by `EmailService` |
| `ASSETS` | Generated static-asset binding |
| `BETTER_AUTH_SECRET` | Better Auth signing secret |
| `APP_URL` | Canonical URL for Better Auth and email links |
| `EMAIL_FROM` | Outgoing sender address |

`worker-configuration.d.ts` is generated from Wrangler and is the authoritative
Worker environment type. Source code does not maintain a second handwritten
`Env` interface.

The top-level local D1 identity remains `REPLACE_WITH_REAL_D1_DATABASE_ID` to
preserve existing local state. Named `dev` and `production` configurations have
separate D1 placeholders, Worker names, domains and independently set secrets.
All companies within one environment share that environment's D1; databases,
accounts and sessions do not synchronize between environments.

## Build boundaries

- `src/react-app/` is compiled with DOM libraries.
- `src/worker/` is compiled with Worker binding types and no DOM dependency.
- Vite/Drizzle configuration uses the Node TypeScript project.
- Tests use their own referenced TypeScript project.
- Frontend imports use the `@/` alias rooted at `src/react-app/`.
- Frontend code does not import Worker modules.
- `src/shared/i18n/` is imported by both projects and has no DOM, Worker or secret
  dependencies. It owns language metadata, catalogs and presentation helpers.

## Toolchain

- React 19 and React DOM
- Vite 7 with the Cloudflare Vite plugin
- TypeScript 5.9 strict projects
- Hono 4
- Tailwind CSS 4
- shadcn/ui components built on Base UI
- Better Auth 1.7.2
- Drizzle ORM and Drizzle Kit
- Vitest with the Cloudflare Workers plugin

Direct package versions are exact in `package.json`. A version-scoped override
patches the legacy esbuild dependency used by Drizzle Kit; see
[dependency maintenance](09-testing-and-operations.md#dependency-maintenance).

## Hono application

`src/worker/index.ts` owns the API composition:

| Route | Implemented responsibility |
| --- | --- |
| `/api/auth/*` | Better Auth handler with native bypass/destructive routes disabled and active-tenant Team policy |
| `GET /api/health` | Reads `system_check` through Drizzle and returns healthy/unavailable |
| `GET /api/branches` | Returns Branches accessible in the validated tenant |
| `GET /api/companies` | Safe active-company list for the authenticated user |
| `POST /api/companies/active` | Validates membership and changes active company, clearing the old Branch |
| `GET /api/account/locale` | Returns the signed-in user's preference and validated active-company language context |
| `PATCH /api/account/locale` | Saves or clears only the signed-in user's language preference |
| `PATCH /api/company/locale` | Saves or clears language for the active company under Owner/admin authorization |
| `GET/POST /api/members` | Tenant administration directory and secure employee provisioning |
| `PATCH /api/members/:membershipId` | Guarded supported role/Branch access update |
| `PATCH /api/members/:membershipId/status` | Company-only deactivation/reactivation, preserving identity/history |
| `POST /api/members/:membershipId/setup/resend` | Scoped unfinished-account setup resend |
| `POST /api/platform/organizations` | Provisions a customer under platform authorization |
| `POST /api/platform/account-setup/resend` | Resends controlled setup for an unfinished provisioned account |
| `POST /api/account/setup-password` | Sets the authenticated first-time user's password |

Application `AuthError` and `RequestError` values become explicit safe JSON
responses. Better Auth owns response bodies under `/api/auth/*`, including the
non-JSON `404` forms above. Unexpected application errors log only the error
type and return a generic `500` body.
API requests have a 16 KiB body limit, custom writes enforce same-origin JSON,
and responses are not cached. See [HTTP boundaries](08-http-and-release-boundaries.md).

## Operational boundaries

- Local Vite development/preview and tests disable remote binding connections;
  local email is simulated and D1 is local.
- Named dev/production deployment selects the environment before compilation.
  Remote operations require configuring that target's resources explicitly.
- Dev sending has a required test-recipient allowlist; production uses its own
  sender/secrets and permits delivery to customer recipients.
- Public custom domains are environment-specific; workers.dev and preview URLs
  are disabled. The local target has no public route and cannot be deployed by
  the supported commands.
- Static assets build into `dist/client`.
- Source maps and Cloudflare observability are enabled.
- No R2, Queues, Durable Objects, WebSockets, or business services exist.

Commands, environment guards and release boundaries are specified in
[Testing and Operations](09-testing-and-operations.md#environment-contract).

## Foundation and product ownership

The inherited foundation owns identity, Organizations, Team memberships,
Branches, access rules, email, database access, layouts and environment safety.
ControlMembers owns customer Members, Contacts, Plans, tags, Enrollments, Charges,
Payments, Allocations, reports, domain permissions and branding.

Do not add a second ORM/auth system, alternate tenant/Branch model, speculative
infrastructure, generic permission engine or domain abstraction without a
demonstrated product requirement. Prefer small explicit typed modules.

Public signup, self-service Organization onboarding, Member login, online
payments, WhatsApp, attendance, scheduling, tax invoicing, Team/Branch deletion
and ownership transfer are not part of the MVP unless their responsible
specification is explicitly changed.

## Deferred extension constraints

These preserve architecture decisions for future products; none is an
implemented feature or a task to execute automatically.

| Extension | Boundary to preserve if requested |
| --- | --- |
| Per-tenant databases | Keep `getTenantDb()` as the routing boundary; today all tenants share one D1. |
| Files | Use Cloudflare R2 behind a `StorageService`; scope keys under `organizations/{organizationId}/`, optionally including Branch. Do not put large files in D1 or scatter bucket calls through features. |
| Realtime | Use tenant-scoped Durable Objects/WebSockets, with Hibernation for idle connections; D1 remains durable business storage. One object per Organization is a candidate, not an implemented topology. |
| Background jobs | Consider Cloudflare Queues when synchronous work becomes inappropriate, such as webhooks, document generation or notifications. |
| Usage/cost tracking | Allow future per-tenant API, storage, email, realtime and AI usage tracking only when a feature consumes it. |

## Acceptance checks

- A new customer can follow platform creation, Owner activation, employee setup
  and role-scoped access without any public signup or company-creation screen.
- SPA navigation stays with Static Assets; unknown `/api/*` routes return JSON.
- Frontend code cannot import Worker bindings or secret values.
- Domain behavior follows specifications 10–19 without weakening inherited
  tenant, authentication or release boundaries.
- No real customer fixtures or production resource identifiers are committed.
- The [quality gate](09-testing-and-operations.md#release-checklist) passes.

Source: `wrangler.json`, `package.json`, `vite.config.ts`, `tsconfig*.json`,
`worker-configuration.d.ts` and `src/worker/index.ts`.
