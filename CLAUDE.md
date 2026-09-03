# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Hard rules

1. **Code and documentation must be written in English.** Comments, identifiers,
   source message keys, commit messages and branch names stay English. Translated
   values in `src/shared/i18n/` are the explicit exception: the product supports
   multilingual UI and email. Do not translate user-entered data or mirror the
   conversation language into unrelated project files.

2. **Never add Claude as a co-author.** Do not append `Co-Authored-By: Claude`
   (or any similar attribution) to commit messages, and do not add
   "Generated with Claude Code" footers to commits or pull requests.

3. **Commit messages are a single line, written in English.** No body, no
   bullet list, no footer — one line and nothing else, under ~72 characters.

   **Say what you did, directly, in the past tense.** Start with a plain verb:
   `Added`, `Updated`, `Fixed`, `Removed`, `Renamed`, `Moved`.

   **Never use Conventional Commits prefixes.** No `chore:`, `feat:`, `fix:`,
   `docs:`, `refactor:`, `style:`, `test:`, and no scopes like `fix(routing):`.
   They add nothing — write the sentence instead.

   ```
   Added JSON 404 handler for unknown API routes
   Updated routing so only /api/* runs through the Worker
   Fixed SPA deep links returning a Hono 404
   Removed unused demo assets from the template
   ```

   Not this:

   ```
   chore: establish SaaS starter foundation
   feat(api): add health endpoint
   Add health endpoint
   ```

   ```
   Updated routing

   - changed wrangler.json
   - added notFound handler

   Co-Authored-By: Claude <noreply@anthropic.com>
   ```

## What this project is

A reusable base template for building SaaS products. It is not a product itself —
it is the starting point that future SaaS projects get cloned from. Every
decision should favour clarity and reusability over cleverness.

Starter v1 is implemented. Add only explicitly requested capabilities, verify
them end to end, and leave the repository working. Deferred infrastructure and
business-domain features are not implicit tasks.

Documentation roles:

- `specs/README.md` is the single index of canonical module specifications.
- Each numbered file in `specs/` owns its module's behavior, rules, source
  references, limitations and acceptance checks. Numbers are not delivery phases.
- `PROJECT_SPEC.md` is a short project overview pointing to that same structure.
- `README.md` is the developer/operator guide and current status summary.
- `specs/VERIFICATION.md` records dated checks and release limitations.

When behavior changes, update the responsible module and affected guides so they
agree. Do not create parallel delivery/current-state specs for the same feature.

## Stack

- **React** + **Vite** + **TypeScript** — frontend
- **Hono** — backend, running on **Cloudflare Workers**
- **Cloudflare Workers Static Assets** — serves the built SPA
- **Cloudflare D1** + **Drizzle ORM** — persistence and migrations
- **Better Auth 1.7.2** — authentication, platform roles, Organizations, and Teams
- **Cloudflare Email Sending** — outgoing email behind `EmailService`
- **Tailwind CSS 4** + **shadcn/ui using Base UI** — frontend styling
- Scaffolded from Cloudflare's official `cloudflare/templates/vite-react-template`

## Structure

```
src/react-app/     Frontend (React + Vite)
src/shared/i18n/   Platform-neutral language registry, typed catalogs and formatting
src/worker/        Backend (Hono on Cloudflare Workers)
  auth/            Better Auth configuration and session guards
  db/              Drizzle entry point and schemas
  email/           EmailService and message builders
  platform/        Platform-admin customer provisioning
  tenant/          Tenant/Branch authorization and guarded Member management
drizzle/           Generated migrations
specs/             Unified module specifications and verification evidence
index.html         Frontend entry point
vite.config.ts     Vite + @cloudflare/vite-plugin
wrangler.json      Worker config + static assets
scripts/           Explicit environment commands and their Node safety tests
tsconfig.json      References the three projects below
  tsconfig.app.json      frontend + imported shared modules, DOM types
  tsconfig.worker.json   backend + imported shared modules, Workers types
  tsconfig.node.json     only vite.config.ts
worker-configuration.d.ts   Generated — never edit by hand
```

Frontend and backend are separated twice over: by directory, and by TypeScript
project. Keep it that way — the two sides must not be able to import each
other's types by accident.

## Routing

Traffic is split by `run_worker_first: ["/api/*"]` in `wrangler.json`:

- `/api/*` runs through the Hono Worker.
- Everything else is served by Static Assets, with
  `not_found_handling: "single-page-application"` returning `index.html` so SPA
  deep links and hard refreshes work.

Consequences to respect:

- **Do not add a Hono catch-all** that proxies unmatched requests to `ASSETS`.
  SPA routing is the asset router's job, not Hono's.
- All backend routes must live under `/api/`. A route outside that prefix will
  never reach the Worker.
- Unknown `/api/*` routes return a JSON 404 via `app.notFound`.

The `ASSETS` binding is declared and typed but currently unused.

## Database

Cloudflare D1 accessed through Drizzle ORM. Binding `DB` in all three
environments. The top-level configuration preserves local `saas-template-db`;
`env.dev` and `env.production` have distinct cloud databases, Workers and domains.

```
src/worker/db/schema.ts   Drizzle schema
src/worker/db/index.ts    getDb() / getTenantDb()
drizzle/                  Generated migrations — the single source of truth
drizzle.config.ts         Drizzle Kit configuration
```

Rules:

- **Always go through `getDb(env)`.** Never call `drizzle(...)` anywhere else,
  and never reach for `env.DB` directly outside `src/worker/db/`.
- **`getTenantDb(env)` delegates to `getDb(env)` and must stay trivial.** It is a
  future abstraction point only. Do not implement tenants, organizations,
  memberships, roles or database routing behind it until a phase asks for it.
- **Migrations are generated, never hand-written.** Run `npm run db:generate`
  after changing the schema, inspect the SQL, then apply it with
  `npm run db:migrate:local`. Do not copy migrations between directories, do not
  write a custom migration runner, and do not use `drizzle-kit push` to migrate.
- `wrangler.json` sets `migrations_dir` to `./drizzle` so Wrangler consumes the
  Drizzle output directly.
- Do not replace the top-level local database ID when configuring remote
  resources. Set the UUID in its named dev/production environment. Deliberately
  changing local identity requires initializing that new local state.
- All migration commands select the `DB` binding, original source config,
  explicit environment and `--local`/`--remote`; never infer the target from the
  most recent build, and never copy test/dev records into production.

## Environments

- Local is the top-level Wrangler config. `npm run dev` and `preview` use
  loopback port 5173, simulated D1/Email and an ignored `.dev.vars`. Preserve
  existing local data and secret files.
- Dev and production are `env.dev` and `env.production`, with explicitly
  redeclared bindings/secrets, different Worker/D1 names and IDs, separate
  custom domains and separately installed remote secrets.
- `scripts/environments.mjs` selects `CLOUDFLARE_ENV` before Vite builds and
  overrides inherited production selection for local commands. Do not replace
  this with a deploy-time-only `--env` flag.
- Real deployment and migration require explicit targets. Bare `deploy` and
  `db:migrate:remote` intentionally fail; placeholder resources, shared resources
  and extra target overrides must be rejected before remote operations.
- Local Vite/preview and tests disable remote bindings. Adding local-to-cloud D1
  access needs an explicitly requested guarded opt-in; never silently enable it.
- Dev Email requires a controlled test-recipient allowlist. Production uses its
  own real sender. Alternate workers.dev and preview URLs remain disabled;
  dev website access policy and domain ownership are external setup tasks.
- Build-only example values are not deployed secrets. Never share the ignored
  Worker build folder or put secrets in `VITE_*` values; only `dist/client` is
  public. Do not copy production secrets or user data to local/dev.
- Targets share `dist`: build/deploy them sequentially in a checkout. Deploy
  rebuilds its target, but does not apply migrations. Backward-compatible SQL is
  required for migration-before-deploy; destructive changes need a release plan.
- No automatic CI deployment or production approval workflow is configured.
  Remote resources, secrets, DNS, migrations and publication require explicit
  release authority, not merely a passing local quality gate.

Dependency policy: pin every direct dependency to an exact version, stable
releases only. Stay on React 19, Vite 7, TypeScript 5.9.x, ESLint 9,
typescript-eslint 8 and Hono 4 unless a phase explicitly says otherwise.

The scoped `@esbuild-kit/core-utils@3.3.2` override to `esbuild` 0.25.12 fixes
Drizzle Kit's legacy transitive dependency. Preserve it until the upstream chain
resolves to a patched release without it. Dependency maintenance must verify
Drizzle generation/checking, the full quality gate and both npm audits; see
`specs/09-testing-and-operations.md`.

## Frontend

The React app lives in `src/react-app`; the Hono backend lives in `src/worker`.
Never import Worker modules from frontend code — the two TypeScript projects are
separate on purpose.

- Client routing is React Router. Routes live in `src/react-app/router/`, shared
  chrome in `layouts/`, screens in `pages/`.
- **Frontend route guards are UX only. `requireAuth` / `requireTenant` /
  `requireBranch` in the Worker remain authoritative.** Never treat a client-side
  check as security.
- Reuse the shadcn/ui components in `src/react-app/components/ui` before writing
  an equivalent. Those files are generated — re-running `shadcn add` overwrites
  local edits, so wrap rather than modify them.
- Reuse `PageContainer` / `PageHeader` instead of re-implementing page chrome.
- The starter is intentionally unbranded. Do not add project colors, logos or
  marketing design.
- Do not add a global state library (Redux, Zustand, TanStack Query, …) without a
  demonstrated need, and do not add business features to the starter.

### Authentication UI

- Better Auth is the only authentication system. Never write custom password,
  session, or token logic. The existing setup/provisioning orchestration endpoints
  call Better Auth; do not introduce a second authentication implementation.
- Never expose `BETTER_AUTH_SECRET`, Worker secrets or bindings to React. The
  browser talks to same-origin `/api/*`; no Worker module is imported into React.
- **Never log passwords, session tokens, verification tokens or reset tokens**,
  and never render a token in the UI.
- Always pass a `returnTo` through `safeReturnPath()` before navigating. Only
  same-app paths are allowed; everything else falls back to the dashboard.
- Keep email verification required, and keep password-reset responses generic so
  user enumeration stays impossible.
- Never render a raw Better Auth error. Map known codes in `lib/auth-errors.ts`
  and fall back to the generic message.
- Reuse `AuthCard` and `FormMessage` rather than adding new auth wrappers.
- App-controlled UI copy goes through `useT()` / `useI18n()`. Store feedback
  message keys, not translated strings, so changing language updates existing
  messages without discarding forms. Never translate names or other user data.

### Localization

- `src/shared/i18n/` owns the registry and typed catalogs. English and Spanish
  are initial catalogs, not a two-language architectural limit. Register another
  complete catalog once; selectors and server validation derive their options
  from it. Do not add language-specific branches in features.
- Authenticated UI: `user.locale`, then validated active Organization locale,
  then `DEFAULT_LOCALE` (English). Null means inheritance. Public selection is
  browser-local; it never silently becomes a personal account preference.
- GET/PATCH `/api/account/locale` operates only on the signed-in user. PATCH
  `/api/company/locale` requires active company owner/admin, including branch-
  scoped admins. Writes accept only `{locale}`: a registered key or null.
- Native user locale input and native Organization updates remain disabled.
  Never expose a broad settings endpoint to save a language.
- Key async preferences by user + active company, abort stale requests and
  revalidate on focus/visibility and every visible 30 seconds. Document language
  and direction must follow the UI.
- Email uses the recipient's preference and the guarded workflow's company,
  never the sender's language. Without company context, a sole active membership
  may supply it; multiple memberships must not select an arbitrary company.
  Public request language is fallback only. Setup links carry a supported `lang`
  hint into the pre-company activation page without persisting a preference or
  selecting a tenant. Better Auth remains the token/session authority.
- Use shared Intl helpers for dates/numbers; currency and timezone are separate
  business settings, not inferred from a translation language.
- Run `npm run test:i18n` and the Workers localization tests via `npm test`.

## Provisioning model

**This is a closed B2B SaaS. There is no public signup.** Every account
originates from an authorized provisioning flow.

Two role scopes exist and must never be conflated:

| Scope | Field | Meaning |
| ----- | ----- | ------- |
| Platform | `user.role === "admin"` | Platform administrator (Better Auth Admin plugin) |
| Tenant | `member.role === "admin"` | Administrator of one organization only |

An organization owner or admin is **never** a platform admin, and a platform
admin gets no tenant data without explicit membership. Guard platform routes
with `requirePlatformAdmin()`, tenant routes with `requireTenant()`.

Rules:

- `emailAndPassword.disableSignUp` and Magic Link `disableSignUp` must both stay
  `true`. Magic Link exists only to activate already-provisioned accounts.
- `allowUserToCreateOrganization: false`. Tenants are created server-side by
  passing `userId` with **no session and no headers**, which Better Auth treats
  as a system action.
- Provisioning creates Organization + Owner + a branch named `Main`.
- A provisioned user gets a cryptographically random provisional password purely
  because `createUser` requires one. **Never return, email, log or expose it.**
  Better Auth deletes it on magic-link activation (`revokeUnprovenAccountAccess`
  strips every account row of an unverified user), so it cannot survive setup.
- Account setup only sets a password. It must never create a tenant or branch.
- `/api/account/setup-password` operates on the authenticated user only, never a
  browser-supplied userId, and refuses once a credential exists.
- Provisioning must be retry-safe: reuse an existing user, an existing
  same-named company owned by that user, and an existing Main branch. Email
  failure never rolls back valid database work.
- Never build custom auth/session/invitation tokens when Better Auth has the
  primitive.
- A single-location business still has one internal branch named `Main`.

## Multi-tenancy

**An organization is the tenant. A Better Auth team is a branch (a location).**

- Do not create a second tenant model, and do not create custom `branch` or
  branch-membership tables. Better Auth's `organization`, `member`, `team`,
  `team_member` and `invitation` tables are the model.
- Keep Better Auth's native table names. Do not set `modelName` just to make the
  SQL read "branch". Application code uses Branch terminology; the database uses
  Better Auth's.
- Organization-wide settings live on the `organization` row: `locale`,
  `timezone`, `currency`. All optional.

Access rules:

- An active `owner` reaches every branch, with no assignment required.
- An active `admin` with `member.allBranches` reaches every current/future branch;
  a limited admin (`allBranches:false`) requires `team_member` assignments.
- An active `member` reaches **only** branches they have a `team_member` row for.
  Organization membership alone grants no branch access.
- `member.isActive:false` grants no tenant authority, even with an existing session.
- A branch is never reachable from another organization.

Authorization rules:

- **Never trust an `organizationId` or `branchId` sent by the client.** Resolve
  the organization through `requireTenant()` and branches through
  `requireBranch()` / `canAccessBranch()`.
- The active organization and active branch live on the Better Auth session
  (`activeOrganizationId`, `activeTeamId`). That is the only source of truth —
  do not add a cookie, header, column or client store for either.
- `canAccessBranch()` is the single place branch authorization is decided. Do not
  reimplement it in a route.
- Call `getTenantDb(env, organizationId)` only with an organizationId from a
  validated `TenantContext`.

Provisioning and switching:

- End users never create their own Organization. Platform administration
  provisions the Organization, first Owner, and Main Branch before access.
- An authenticated user with no active company membership sees `/no-company`,
  including after deactivation; never send them to company creation.
- Use `/api/companies` for the active-only safe company list, not native
  Organization listing. Retain valid active context; otherwise auto-enter one
  company, require an explicit choice for several, and show no-access for zero.
- Use `/api/companies/active` to validate active membership and clear the old Team.
  Reload after switching to discard old session, Branch and form state.
- `/onboarding` is not a supported product flow and redirects into the
  application, where the normal guards resolve the safe state.
- `activeOrganizationId` is the only source of truth for the current tenant, and
  `activeTeamId` for the current branch. Never mirror either in localStorage, a
  cookie, or a custom column.
- Switching organization must re-evaluate branch state; a branch from the
  previous organization must never stay active.
- Better Auth's `setActiveTeam` requires a `team_member` row even for an owner,
  while our rules give Owner/unrestricted admin every branch without one. Use
  `activateBranch()`, which adds the missing membership and retries.
- `GET /api/branches` is the authoritative accessible-branch list. Better Auth's
  own team endpoints do not match our rules: listing an organization's teams
  ignores assignment, and listing a user's teams ignores owner/admin reach.

Branches:

- Every tenant has at least one internal branch. `Main` is created during
  platform provisioning; never remove that model.
- A single-location business must not be forced to think about branch selection.
  With one accessible branch the switcher is a plain label, not a control.
- Owner/unrestricted-admin access derives from role plus the all-Branch flag.
  Limited-admin/member access derives from **team_member** assignments.
- `activateBranch()` may create a team_member row for an owner/admin purely
  because Better Auth's `setActiveTeam` demands one. For Owner/unrestricted admin,
  that row is compatibility only, not scope. A limited admin may never add a row
  outside their already-authorized Branches through this native HTTP path.
- A member or limited admin with zero branch assignments goes to `/app/no-branch-access` — never
  to company or branch creation, and never shown branch names they cannot reach.
- Branch create/rename go through Better Auth's Team APIs plus `auth/http-policy.ts`.
  Only Owner/unrestricted admin creates; limited admins rename assigned Branches
  only. Keep native active-Team validation too. Do not write Team rows from React.
- **Never treat an API error as an empty branch list.** Loading, failure, zero
  branches and zero *accessible* branches are four distinct states.
- Re-evaluate branch state whenever the organization changes.
- Branch deletion is deliberately unimplemented: it needs a data-migration
  policy for activeTeamId, assignments and future branch-owned data.

Rules for SaaS features built on this template:

- A tenant-owned table must carry `organizationId`.
- A branch-scoped table must carry both `organizationId` and `branchId`.
- Every tenant-owned feature needs its own automated cross-tenant isolation
  tests. `test/tenant-isolation.test.ts` is the pattern to follow.

Roles are the Better Auth defaults (`owner`, `admin`, `member`). Do not add
business roles or dynamic access control here — those belong to each SaaS.

Member administration:

- Only Owner may grant/revoke `member.canAppointAdmins`; default false. An admin
  with that flag can create/promote admins, never edit peer admins or delegate
  onward. No self edits, Owner edits or ownership transfer in this module.
- Owner manages admin/member; admin manages members only and only when the
  target's entire Branch scope is within the actor's scope. Shared wider-scope
  employees are read-only with inaccessible Branch IDs redacted.
- Validate desired scope before identity creation. An admin cannot grant wider
  scope, reactivate via provisioning, or use repeat POST to edit/resend a peer
  admin. That conflict requires Owner intervention, not a bypass.
- Deactivate/reactivate changes only `member.isActive`. Preserve identity,
  credentials, history, saved role/flags/assignments and other companies. Do not
  substitute a global ban or deletion. Reactivation restores saved permissions.
- `requireTenant` rechecks active membership; all tenant routes and supported
  native writes must use those guards. UI refresh is not the security boundary.

## Completed Starter v1

The current module contracts cover:

- `/app/branches` and `/app/no-branch-access`
- Owner/unrestricted-admin Branch creation; scope-aware admin rename
- single-Branch and multi-Branch UX
- shared app-shell Branch state
- role and cross-tenant Branch tests
- owner/admin-only Member directory and direct employee provisioning
- role/access editing: owner manages admin/member; admin manages member only
- Owner-controlled admin appointment and all/selected administrative Branch scope
- company-only deactivation/reactivation and active-only company selection
- read-only Owners; no ownership transfer or member/Branch deletion
- secure setup resends, safe existing-account reuse, idempotent assignments
- native HTTP bypass protection, body/origin validation and generic errors
- personal/company language settings and removal of invitation placeholder UI

Use `specs/README.md` to understand the code and
`specs/VERIFICATION.md` for dated evidence and dependency-audit results. Future domain
features require a new specification; do not treat deferred infrastructure as
unfinished Starter v1 work.

Invitation email infrastructure is tested server-side but disabled over HTTP;
`/accept-invitation` has no route. Direct provisioning is the canonical flow.
Keep native directory/access/destructive paths disabled in `getAuth()` and
preserve `auth/http-policy.ts`; do not re-enable them to make a UI shortcut work.
Member writes must use the guarded orchestration and Better Auth server APIs.
Add desired assignments before removing old ones; only then downgrade an admin.
Preserve the unique Organization/user membership index when updating auth schema.
Preserve `isActive`, `allBranches`, `canAppointAdmins` and their Better Auth
additionalFields configuration too. Migration 0005 must precede new-code startup.
Do not roll back to code that ignores these controls after relying on them.

## Commands

| Command              | Purpose                                          |
| -------------------- | ------------------------------------------------ |
| `npm run dev`        | Dev server, frontend + worker (port 5173)        |
| `npm run typecheck`  | `tsc -b` across all three TS projects            |
| `npm run lint`       | ESLint                                           |
| `npm run build`      | Typecheck + optimized local-target build        |
| `npm run build:dev` / `build:production` | Build explicit remote target only |
| `npm run preview`    | Build + local preview of the production bundle   |
| `npm run check`      | Typecheck, lint, Node/Workers tests, all target dry runs |
| `npm run check:environments` | Build/dry-run dev, production, then local |
| `npm test`           | Environment/i18n Node checks + Workers tests |
| `npm run test:environments` | Node command/configuration checks only |
| `npm run test:i18n` | Catalog-use and shared-module boundary checks |
| `npm run db:generate`       | Generate a migration from the schema     |
| `npm run db:migrate:local`  | Apply migrations to local D1             |
| `npm run db:migrate:dev` / `db:migrate:production` | Apply SQL to explicit remote D1 |
| `npm run deploy:dev` / `deploy:production` | Validate, rebuild and deploy target |
| `npm run deploy:dev:dry-run` / `deploy:production:dry-run` | Build and simulate target deployment |
| `npm run deploy` / `db:migrate:remote` | Intentionally fail; require explicit target |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts`           |

Run `npm run cf-typegen` after any change to `wrangler.json`, then commit the
regenerated types.

## Before finishing a change

For code or configuration changes, run the full gate and confirm it is green:

```
npm run cf-typegen   # if wrangler.json changed
npm run typecheck
npm run lint
npm run build
npm run check
```

Then verify actual behavior at runtime, not just a successful build. The Vite
plugin runs workerd locally; use the guarded `dev`/`preview` scripts for smoke
checks. For an isolated Wrangler QA runtime, explicitly select the source config,
empty local environment, `--local` and a separate temporary persistence directory.

For documentation-only changes, verify links, referenced source paths, semantic
consistency and `git diff --check`. Do not claim new runtime test results when
only documents were checked. Keep dated execution evidence separate from module
contracts. Never create commits, push or deploy without an explicit request.

## Conventions

- Keep changes minimal and scoped to what was asked.
- Do not add new stub files, commented-out scaffolding, or unused dependencies.
  Settings beyond language and invitation acceptance are deliberate exclusions,
  not examples of placeholder routes to copy.
- Tabs for indentation, double quotes — match the existing files.
- `worker-configuration.d.ts` is generated and is excluded from ESLint.
- The Worker name lives in `wrangler.json` (`name`) and should be changed per
  project derived from this template.
