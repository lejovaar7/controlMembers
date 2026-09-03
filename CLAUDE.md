# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Hard rules

1. **Everything in this repository must be written in English.** Documentation,
   code, comments, identifiers, UI copy, commit messages, branch names — all of
   it. This holds even when the conversation happens in another language. Do not
   mirror the language of the prompt into project files.

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

The template is built in phases. Each phase adds one capability, is verified end
to end, and leaves the repository in a working state. Do not implement anything
belonging to a later phase unless it is explicitly requested.

Documentation roles:

- `PROJECT_SPEC.md` is the master product and architecture specification.
- `README.md` is the developer/operator guide and current status summary.
- `specs/implemented/` describes behavior already present in source.
- `specs/` contains completed Starter v1 specifications and `VERIFICATION.md`.

When behavior changes, update every affected layer so these sources do not
contradict one another.

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
src/worker/        Backend (Hono on Cloudflare Workers)
  auth/            Better Auth configuration and session guards
  db/              Drizzle entry point and schemas
  email/           EmailService and message builders
  platform/        Platform-admin customer provisioning
  tenant/          Tenant/Branch authorization and guarded Member management
drizzle/           Generated migrations
specs/             Implemented-system catalog and completed delivery plan
index.html         Frontend entry point
vite.config.ts     Vite + @cloudflare/vite-plugin
wrangler.json      Worker config + static assets
tsconfig.json      References the three projects below
  tsconfig.app.json      only src/react-app, DOM types
  tsconfig.worker.json   only src/worker, Workers types
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

Cloudflare D1 accessed through Drizzle ORM. Binding `DB`, database name
`saas-template-db`.

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
- Changing `database_id` repoints local D1 at a different database — re-run
  `npm run db:migrate:local` afterwards.

Dependency policy: pin every direct dependency to an exact version, stable
releases only. Stay on React 19, Vite 7, TypeScript 5.9.x, ESLint 9,
typescript-eslint 8 and Hono 4 unless a phase explicitly says otherwise.

The scoped `@esbuild-kit/core-utils@3.3.2` override to `esbuild` 0.25.12 fixes
Drizzle Kit's legacy transitive dependency. Preserve it until the upstream chain
resolves to a patched release without it. Dependency maintenance must verify
Drizzle generation/checking, the full quality gate and both npm audits; see
`specs/implemented/07-testing-and-operations.md`.

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
- UI copy stays English until localization is implemented.

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

- `owner` and `admin` reach **every** branch in their organization, with no
  `team_member` row required.
- `member` reaches **only** branches they have a `team_member` row for.
  Organization membership alone grants no branch access.
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
- An authenticated user with no Organization is in an abnormal provisioning
  state and sees `/no-company`; never send them to company creation.
- `/onboarding` is not a supported product flow and redirects into the
  application, where the normal guards resolve the safe state.
- `activeOrganizationId` is the only source of truth for the current tenant, and
  `activeTeamId` for the current branch. Never mirror either in localStorage, a
  cookie, or a custom column.
- Switching organization must re-evaluate branch state; a branch from the
  previous organization must never stay active.
- Better Auth's `setActiveTeam` requires a `team_member` row even for an owner,
  while our rules give owner/admin every branch without one. Use
  `activateBranch()`, which adds the missing membership and retries.
- `GET /api/branches` is the authoritative accessible-branch list. Better Auth's
  own team endpoints do not match our rules: listing an organization's teams
  ignores assignment, and listing a user's teams ignores owner/admin reach.

Branches:

- Every tenant has at least one internal branch. `Main` is created during
  platform provisioning; never remove that model.
- A single-location business must not be forced to think about branch selection.
  With one accessible branch the switcher is a plain label, not a control.
- Owner/admin branch access derives from the **organization role**. Member branch
  access derives from **team_member**.
- `activateBranch()` may create a team_member row for an owner/admin purely
  because Better Auth's `setActiveTeam` demands one. **That row is never the
  source of authorization for owner/admin**, and the Members UI must not
  read it as a scoped branch permission.
- A member with zero branch assignments goes to `/app/no-branch-access` — never
  to company or branch creation, and never shown branch names they cannot reach.
- Branch create/rename go through Better Auth's Team APIs, which already enforce
  the organization role. Do not add a custom endpoint or write team rows from
  React.
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

## Completed Starter v1

Specifications 00–04 are complete:

- `/app/branches` and `/app/no-branch-access`
- owner/admin Branch creation and rename through Better Auth Team APIs
- single-Branch and multi-Branch UX
- shared app-shell Branch state
- role and cross-tenant Branch tests
- owner/admin-only Member directory and direct employee provisioning
- role/access editing: owner manages admin/member; admin manages member only
- read-only Owners; no ownership transfer or member/Branch deletion
- secure setup resends, safe existing-account reuse, idempotent assignments
- native HTTP bypass protection, body/origin validation and generic errors
- read-only Settings extension shell and removal of invitation placeholder UI

Use `specs/implemented/README.md` to understand the code and
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

## Commands

| Command              | Purpose                                          |
| -------------------- | ------------------------------------------------ |
| `npm run dev`        | Dev server, frontend + worker (port 5173)        |
| `npm run typecheck`  | `tsc -b` across all three TS projects            |
| `npm run lint`       | ESLint                                           |
| `npm run build`      | Typecheck + production build into `dist/`        |
| `npm run preview`    | Build + local preview of the production bundle   |
| `npm run check`      | Typecheck + lint + tests + build + `--dry-run`   |
| `npm test`           | Workers-runtime tests (Vitest)                   |
| `npm run db:generate`       | Generate a migration from the schema     |
| `npm run db:migrate:local`  | Apply migrations to local D1             |
| `npm run db:migrate:remote` | Apply migrations to remote D1            |
| `npm run deploy`     | Build + deploy to Cloudflare Workers             |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts`           |

Run `npm run cf-typegen` after any change to `wrangler.json`, then commit the
regenerated types.

## Before finishing any phase

Run the full gate and confirm it is green:

```
npm run cf-typegen   # if wrangler.json changed
npm run typecheck
npm run lint
npm run build
npm run check
```

Then verify the actual behaviour at runtime — do not rely on a successful build
alone. Use `npx wrangler dev` for anything routing- or Workers-related, since it
exercises the real runtime rather than Vite's emulation.

## Conventions

- Keep changes minimal and scoped to what was asked.
- Do not add new stub files, commented-out scaffolding, or unused dependencies.
  Settings editing and invitation acceptance are deliberate post-v1 exclusions,
  not examples of placeholder routes to copy.
- Tabs for indentation, double quotes — match the existing files.
- `worker-configuration.d.ts` is generated and is excluded from ESLint.
- The Worker name lives in `wrangler.json` (`name`) and should be changed per
  project derived from this template.
