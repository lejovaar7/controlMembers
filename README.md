# ControlMembers

Closed B2B SaaS for recurring member fees, payments and receivables in sports,
music, martial arts, swimming, dance, language and similar academies.

**Stack:** React + Vite + TypeScript + Hono on Cloudflare Workers.
Generated from Cloudflare's official `cloudflare/templates/vite-react-template`.

## Project documentation

- [Product brief](PRODUCT_BRIEF.md) — concise identity and purpose
- [Specifications](specs/README.md) — canonical foundation and MVP contracts
- [Project overview](PROJECT_SPEC.md) — current product and implementation status
- [Delivery planning](planning/README.md) — user stories, milestones and decisions
- [Agent guidance](CLAUDE.md) — repository rules for coding agents
- [Verification record](specs/VERIFICATION.md) — dated checks and release limitations

This clone keeps a fetch-only `template` remote and intentionally has no product
`origin` yet. After creating the real ControlMembers repository, add it with
`git remote add origin <url>`; do not re-enable pushes to `template`.

## Structure

```
src/
  react-app/      # Frontend (React + Vite)
  shared/i18n/    # Typed, extensible catalogs shared by UI and email
  worker/         # Backend (Hono on Cloudflare Workers)
    db/
      index.ts    # getDb() / getTenantDb()
      schema.ts   # Drizzle schema
drizzle/          # Generated migrations (source of truth)
drizzle.config.ts # Drizzle Kit configuration
specs/            # one specification per module, plus verification evidence
index.html        # Frontend entry point
vite.config.ts    # Vite + @cloudflare/vite-plugin
wrangler.json     # Worker, static assets and D1 configuration
scripts/          # Explicit environment commands and safety tests
tsconfig.*.json   # Separate TS projects: app / worker / node / tests
```

Frontend and backend share a single dev process: `@cloudflare/vite-plugin` runs
the Worker inside Vite, so `/api/*` is handled by Hono and everything else is
served by Vite. In production, `wrangler.json` points the Worker at
`./dist/client` as a SPA.

## Endpoints

| Method | Path                                  | Purpose |
| ------ | ------------------------------------- | ------- |
| GET    | `/api/health`                         | D1-backed application health check |
| GET    | `/api/branches`                       | Accessible Branches in the validated active Organization |
| GET    | `/api/companies`                      | Companies with active membership for the signed-in user |
| POST   | `/api/companies/active`               | Guarded company selection; clears the previous Branch |
| GET    | `/api/account/locale`                 | Personal preference and validated active-company language |
| PATCH  | `/api/account/locale`                 | Save/reset the signed-in user's language only |
| PATCH  | `/api/company/locale`                 | Owner/admin language setting for the active company only |
| GET/PATCH | `/api/product/settings`            | Read or manage Organization billing currency and timezone |
| GET/POST/PATCH | `/api/programs`                | List and manage tenant Programs and offered Branches |
| GET/POST/PATCH | `/api/billing-plans`           | List and manage monthly billing Plans |
| GET    | `/api/members`                        | Owner/admin-only directory in the active Organization |
| POST   | `/api/members`                        | Provision/reuse an employee with supported role and Branches |
| PATCH  | `/api/members/:membershipId`          | Update a manageable employee's role and exact Branch scope |
| PATCH  | `/api/members/:membershipId/status`   | Deactivate/reactivate this company's access, preserving identity/history |
| POST   | `/api/members/:membershipId/setup/resend` | Resend setup for an unfinished, manageable account |
| POST   | `/api/platform/organizations`         | Platform-only company, Owner, and Main Branch provisioning |
| POST   | `/api/platform/account-setup/resend`  | Platform-only setup-link resend |
| POST   | `/api/account/setup-password`         | First-time password setup for the authenticated user |

`/api/health` performs a lightweight read through Drizzle to confirm D1 is
reachable. It returns `503` with `{ "status": "error", "database": "unavailable" }`
if the database cannot be queried.

Authentication is handled by Better Auth, mounted at `/api/auth/*`. Native routes
that expose unrestricted directories or bypass v1 management rules are disabled.
Team creation/rename and owner/admin self-activation are additionally scoped to
the active tenant. Custom writes require same-origin JSON; API bodies are limited
to 16 KiB and responses are not cached.

Routing is split by `run_worker_first: ["/api/*"]`: only `/api/*` reaches the
Worker. Everything else is served by Static Assets, with
`not_found_handling: "single-page-application"` so SPA deep links work. Unknown
application API routes return `404` with `{ "error": "Not Found" }`; unknown or
disabled `/api/auth/*` routes are owned by Better Auth and may return an empty or
plain-text `404` instead.

## Development

```bash
npm ci
cp -n .dev.vars.example .dev.vars   # do not overwrite existing local values
# Replace the example local secret in .dev.vars; see Configuration.
npm run db:migrate:local   # create the local D1 schema
npm run dev                # http://localhost:5173
curl http://localhost:5173/api/health
```

The server binds to loopback, uses port 5173, and fails if that port is occupied
instead of silently breaking the configured authentication URL. `npm run preview`
builds the local target and previews it on the same port; stop `dev` first.

## Environments

One repository has three isolated environments. The top-level Wrangler config
is local; `env.dev` and `env.production` are the two deployed environments.

| Environment | URL | Worker | Database | Email |
| --- | --- | --- | --- | --- |
| Local | `http://localhost:5173` | Local runtime, not deployed | Local `controlmembers-db` state | Simulated |
| Dev | Your `https://dev.<domain>` | `controlmembers-dev` | Separate `controlmembers-dev-db` in Cloudflare | Real sending, explicit test-recipient allowlist |
| Production | Your `https://app.<domain>` | `controlmembers-production` | Separate `controlmembers-production-db` in Cloudflare | Real sending |

The ControlMembers remote names are product defaults. Tracked remote D1 IDs,
custom domains and dev recipients are intentionally non-working examples.
See [Configuring ControlMembers environments](#configuring-controlmembers-environments) to
replace them. No Cloudflare resource or DNS setup is created by a local build.

`scripts/environments.mjs` selects the Cloudflare environment **before** Vite
starts/builds, regardless of an inherited `CLOUDFLARE_ENV`. Remote deployment
always builds that target immediately before deploying. Bare `npm run deploy`
and `npm run db:migrate:remote` fail with an explicit-target message.
After building, the wrapper checks the generated Worker/environment, D1, routes
and Email policy against the selected source target before proceeding.

The wrapper rejects shared Worker names, D1 names/IDs, domains, missing bindings,
and unintended local remote connections. Actual migrations/deploys reject D1
placeholders; deploys also reject example domains and dev email recipients.
These are operational guardrails, not Cloudflare access control: direct Wrangler
commands can bypass them. Always verify the Cloudflare account and target.

The Vite plugin and test runtime disable remote binding connections. Local means
local D1 and simulated email, even if remote credentials exist on your machine.
Connecting local code to cloud D1 is **not enabled** by these three environments;
it would need a separate, deliberately guarded opt-in. Never point local tests
at production. `remote: false` controls local simulation only; a deployed Worker
uses its real Cloudflare bindings.

## Database
Cloudflare D1, accessed through Drizzle ORM.

- Binding: `DB` in every environment; separate local/dev/production databases
- Schema: `src/worker/db/schema.ts`
- Migrations: generated by Drizzle Kit into `drizzle/`, applied by Wrangler

`wrangler.json` points `migrations_dir` at `drizzle/`, so Drizzle-generated
migrations are the single source of truth. Never hand-write migrations and never
copy them between directories.

Always obtain a database handle through `getDb(env)` — never call `drizzle()`
directly elsewhere. `getTenantDb(env)` currently delegates to `getDb(env)`;
tenants within one environment share its D1 today, while the helper preserves a
future database-routing boundary. Dev and production never share a D1 database.

The top-level `REPLACE_WITH_REAL_D1_DATABASE_ID` remains a local-only identifier
to preserve existing local state. Do not replace it with a remote UUID. Replace
only `env.dev.d1_databases[0].database_id` and
`env.production.d1_databases[0].database_id` when creating remote databases.
Migration commands resolve the `DB` binding from the original source config and
the explicit target, not a hardcoded name or the most recently built artifact.

## Authentication

Better Auth, with email and password enabled. It is mounted at `/api/auth/*` and
runs on top of the existing Drizzle layer, so Drizzle remains the only schema and
migration authority.

- Configuration: `src/worker/auth/index.ts` (`getAuth(env)`)
- Schema: `src/worker/db/auth-schema.ts` — derived from Better Auth 1.7.2 with
  an application-level unique `(organizationId, userId)` membership index and
  the `isActive`, `allBranches`, `canAppointAdmins` membership fields.
  Preserve these extensions and matching Better Auth additionalFields when
  regenerating auth models, inspect the diff, then use
  `npm run db:generate` for migrations. Do not use a newer auth CLI blindly.

Email verification is required before an email/password user can sign in, and
password reset is enabled. Both use Better Auth's built-in flows and its existing
`verification` table — there are no custom tokens.

## Frontend

`npm run dev` serves the React app and the Worker together on
<http://localhost:5173>.

Client-side routing uses React Router, with three route groups:

| Group | Routes | Status |
| ----- | ------ | ------ |
| Public/auth | `/`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password`, `/setup-account`, `/no-company` | Implemented |
| Platform | `/platform`, `/platform/organizations/new` | Implemented; platform-admin UX guard plus server authorization |
| Application | `/app/dashboard`, `/app/branches`, `/app/no-branch-access`, `/app/members`, `/app/billing-setup`, `/app/settings` | Branch/Team management, billing setup, workspace summary and language settings |
| Redirected | `/register`, `/onboarding` | No public signup or self-service company onboarding |

Invitation acceptance is not exposed: its placeholder page and route were removed.

`/app/*` renders behind a session check. That check is UX only — the Worker
enforces authorization.

Working auth flows are sign in, sign out, resend verification, forgot/reset
password, and controlled first-account setup for already-provisioned users.
Public registration is disabled in Better Auth and `/register` redirects to
login. Local email is always simulated by the supported scripts, so messages appear under
`.wrangler/tmp/email/` instead of being delivered.

Styling is Tailwind CSS v4 with shadcn/ui components in
`src/react-app/components/ui`. ControlMembers extends this existing design
system; product UI rules are specified in
[`specs/17-product-frontend-and-design.md`](specs/17-product-frontend-and-design.md).

## Provisioning

This is a closed B2B SaaS: **public signup is disabled**. Accounts are created by
authorized administrators.

```
Platform admin  →  creates company
                →  provisions the owner
                →  creates the company's Main branch
Owner           →  receives one account-setup link
                →  confirms their email, chooses a password
                →  enters the company
```

Owners/admins add employees at `/app/members` using name, email, role and Branches.
Members need at least one Branch. Admins can have all current/future Branches or
selected Branches. New users receive the same secure setup flow as Owners.
Existing identities, passwords and platform roles are preserved. Email failure
keeps valid access and exposes an authorized resend.

Owners can edit admins/members; admins can edit members only. Owner entries are
read-only, and nobody edits their own access here. Only the Owner may enable
**Can appoint administrators** for an admin; it is off by default. That permission
allows creating/promoting admins, not editing peer admins or passing the
permission on. Limited admins cannot grant wider scope, create new Branches, or
manage an employee shared with locations outside their scope.

The directory also offers **Deactivate access** / **Reactivate access** with a
confirmation. This changes only the person's access to this company, not their
account, password, history or access to other companies. Reactivation restores
saved permissions; review scope first if their responsibilities changed. Inactive
members cannot receive setup resends or regain access by being provisioned again.
Removed access is denied on the next server request, including stale active
Teams. The shell refreshes on focus and every 30 seconds while visible; it cannot
erase information already displayed or downloaded.
Direct provisioning is canonical; invitation acceptance remains deferred.

### Upgrading membership access controls

The generated migration `0005_safe_thunderbird.sql` adds membership status,
admin scope and appointment permission. Apply it before starting the new code:

```bash
npm run db:migrate:local
npm run dev
```

Existing memberships stay active and existing admins retain all-Branch access.
Their permission to appoint admins now requires an explicit Owner grant at
**Members → Edit access → Can appoint administrators**. No one gains that
delegation automatically.

For a separately authorized release, apply `npm run db:migrate:dev` before
`npm run deploy:dev`, validate the flows, then repeat with the explicit production
commands when approved. Deploy never runs migrations implicitly. Do not roll back
to authorization code that ignores inactive memberships or scoped admins after
relying on those controls. See [Member Management](specs/07-member-management.md)
for policies and the limits of ordered, non-transactional access edits.

### Bootstrapping the first platform admin

Better Auth's `auth create-admin` CLI runs in Node against the auth config's
database, so it cannot reach a Cloudflare D1 binding. Bootstrap instead with the
tooling you already use, which never involves a default password:

```bash
# 1. After deploying dev, insert its admin (no password, unverified).
# Replace the name and email; the email must be in dev's recipient allowlist.
npx wrangler d1 execute DB --config wrangler.json --env dev --remote --command \
  "INSERT INTO user (id, name, email, email_verified, role, created_at, updated_at)
   VALUES (lower(hex(randomblob(16))), 'Platform Admin', 'you@example.com', 0, 'admin',
           unixepoch()*1000, unixepoch()*1000);"

# 2. Ask Better Auth to email that address a setup link.
# Replace dev.example.com with your configured dev domain before executing.
curl -X POST https://dev.example.com/api/auth/sign-in/magic-link \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","callbackURL":"/setup-account"}'
```

Opening the link proves mailbox ownership, verifies the account and takes you to
`/setup-account` to choose a password. Each isolated ControlMembers environment
must bootstrap its own platform admin this way. Run this bootstrap once per database; do not insert
the same email again if its user already exists. A failed email can be retried
without reinserting the user.

For local, replace `--env dev --remote` with `--env "" --local` and use
`http://localhost:5173`. Keep the dev server running and open the simulated email
under `.wrangler/tmp/email/`. For production, use `--env production --remote`,
the production URL and a separately chosen production identity. Accounts,
sessions and data do not synchronize between environments. Never reuse test
credentials or test identities in production.

## Multi-tenancy

ControlMembers models tenancy with Better Auth's Organization plugin:

| Application term | Better Auth model            |
| ---------------- | ---------------------------- |
| Tenant / company | `organization`               |
| User's company access | `member`                |
| Branch / location| `team`                       |
| Branch membership| `teamMember`                 |

Default access:

- `owner` reaches every Branch in their company
- `admin` reaches all Branches or only selected ones, according to their membership
- `member` reaches only assigned Branches
- inactive company memberships authorize no tenant access

Roles are Better Auth's defaults (`owner`, `admin`, `member`). ControlMembers
adds only the domain grants defined in specification 16.

Each organization carries optional settings: `locale`, `timezone` and
`currency`.

An owner signs in to a company that already exists, with its `Main` Branch
already created. One active company is entered automatically and appears as a
label, not a selector. With multiple active companies, an existing valid selection
is kept; otherwise the user explicitly chooses one. Switching company clears the
old Branch and reloads the app to discard previous-company state. With no active
memberships, the user sees a no-active-company-access notice. There is still one
identity and one login; memberships are company access records, not subscriptions.

Every company has at least one internal branch. A single-location business keeps
just `Main` and the branch selector stays out of the way — it appears as a plain
label. Add a second branch and the switcher becomes a real control.

| Role | Branches | Management |
| ---- | -------- | ---------- |
| owner | all Branches | Create/rename Branches; manage admin/member access and status; delegate admin appointment |
| admin | all or selected Branches | Rename permitted Branches; manage fully in-scope members; appoint admins only if Owner-authorized; create Branches only with all-Branch scope |
| member | only assigned branches | none |

A member or limited admin with no Branch assignment sees a dedicated notice rather than any
company or branch creation flow.

Branch management uses guarded Better Auth Team APIs: Owner/unrestricted admin
may add Branches; limited admins may rename only their assigned Branches. Deletion remains
deliberately unsupported.

Server-side helpers live in `src/worker/tenant/`:

- `requireTenant(env, request)` → validated `TenantContext`
- `requireOrganizationAdmin(env, request)` → active-tenant owner/admin guard
- `requireBranch(env, request)` → validated `BranchContext`
- `canAccessBranch(env, tenant, branchId)` → the one branch authorization rule

The active organization and active branch come from the Better Auth session;
identifiers sent by the client are never trusted for authorization.

## Languages

The platform is extensibly multilingual. English and Spanish are the initial
complete catalogs; another language requires a translated catalog, not a new
tenant model or a rewrite. English is the application fallback.

For a Spanish company, choose **Español** in **Company language** when creating
the company, or open **Settings → Company language** as its Owner/admin and save
**Español**. All active company admins can change this company-wide preference,
including branch-scoped admins. This does not grant any additional data access.

The interface chooses a language in this order:

1. The signed-in person's **My language** preference (`user.locale`).
2. The active company's language (`organization.locale`).
3. The application's `DEFAULT_LOCALE` (English).

**Automatic** clears the personal override and follows the active company. A
personal choice applies across companies and sessions; it never changes anyone
else's account. Company changes apply immediately in the current view and on
other sessions' next focus/visible 30-second refresh. Names, Branch names (including
`Main`), addresses and other entered data are not translated.

Before sign-in, the selector is browser-local. Public pages use a supported
`?lang=...` hint, saved browser choice, browser language list, then the fallback.
This does not persist a personal override on login. A supported email `lang` hint
also preserves the activation-page language before a company has been selected.

Verification, recovery and setup emails translate subject, plain text, HTML,
actions and footer. They use the **recipient's** preference, then the company
of the guarded workflow. Without that context, exactly one active membership
may supply the company language; multiple memberships do not select an arbitrary
company. Public `X-App-Locale` is only a final presentation fallback. Known and
unknown reset requests still receive the same generic response. Invitation
templates are translated too, but invitation acceptance remains disabled.

To add a language:

1. Create `src/shared/i18n/fr.ts` (for example) implementing every `Catalog` key.
   Translate complete messages and preserve named placeholders such as `{name}`.
2. Register its native name, Intl locale, direction and catalog in
   `src/shared/i18n/index.ts`. Public/personal/company selectors, validation and
   email then share the registry. Regional/script catalogs may be registered
   too; reads fall back to a registered parent when appropriate.
3. Run `npm run typecheck`, `npm run test:i18n` and `npm run check`, then review
   translated layouts and emails. RTL languages additionally need layout review.

No machine translation service or language dependency is required. UI copy uses
`useT()`; dynamic feedback stores typed message keys so changing language updates
existing messages without clearing forms. Browser-owned validation/password-
manager messages use the browser's own language. Currency, timezone, plural-rich
domain copy and user content translation are separate product concerns; use
`formatDate`/`formatNumber` with explicit business options for new displays.

Apply the generated migration before running this version against an existing
database; no customer record is rewritten:

```bash
npm run db:migrate:local
npm run dev
npm run test:i18n
npm run check
```

When explicitly releasing: apply `npm run db:migrate:dev`, then deploy dev and
verify its emails/UI. Only after approval, migrate and deploy production with
the corresponding explicit commands. This repository state has not been
deployed to either remote environment.

## Current status

The inherited SaaS foundation is implemented. ControlMembers product contracts,
user stories and milestones are documented. The first product slice now includes
Organization billing settings, Programs, Program-Branch availability and monthly
Plans across schema, guarded APIs, a responsive bilingual setup screen and
isolation tests. Member registry, Enrollments, Charges, Payments and reporting
remain planned work. The quality gate includes typecheck, lint, Node and
Workers/D1 tests, and all three environment builds/deployment dry runs.
See [the dated verification record](specs/VERIFICATION.md) for results, manual
checks and dependency-audit results. The 2026-09-02 dependency remediation leaves
both the full and production-only audits at zero reported vulnerabilities.
No production deployment is part of this completion.

Start at [specs/README.md](specs/README.md) for the single specification index.
Each numbered file owns one module's contract and status. Delivery order lives in
[`planning/DELIVERY_PLAN.md`](planning/DELIVERY_PLAN.md).

## Configuration

Three values are required. They are declared in `wrangler.json` under
`secrets.required`, so `npm run cf-typegen` includes them in `Env` and a missing
value fails loudly instead of silently falling back.

| Name                 | Purpose                                          |
| -------------------- | ------------------------------------------------ |
| `BETTER_AUTH_SECRET` | Better Auth signing secret                       |
| `APP_URL`            | Canonical app URL; used for links in emails      |
| `EMAIL_FROM`         | Sender address for outgoing email                |

Local values live in `.dev.vars`, which is untracked. Copy `.dev.vars.example`
without overwriting an existing file, generate a value with the command below,
and set it as the local `BETTER_AUTH_SECRET`:

```bash
openssl rand -base64 32
```

Keep local `APP_URL=http://localhost:5173`. Local email can use an `.invalid`
sender because it is simulated. Never install the example secret in Cloudflare.

Remote secrets are set separately on Cloudflare for **each** target. Generate
different random signing secrets for dev and production. Set `APP_URL` to exactly
the HTTPS origin corresponding to that target's `routes[0].pattern` (no path),
and `EMAIL_FROM` to an authorized sender. Enter values at the interactive prompt,
not in command arguments or committed files:

```bash
npx wrangler secret put BETTER_AUTH_SECRET --config wrangler.json --env dev
npx wrangler secret put APP_URL --config wrangler.json --env dev
npx wrangler secret put EMAIL_FROM --config wrangler.json --env dev

npx wrangler secret put BETTER_AUTH_SECRET --config wrangler.json --env production
npx wrangler secret put APP_URL --config wrangler.json --env production
npx wrangler secret put EMAIL_FROM --config wrangler.json --env production
```

Wrangler may ask to create the named Worker when setting its first secret;
confirm the intended account and Worker. These commands are real remote changes.
On an existing deployed Worker, `secret put` updates the active deployment; treat
production secret changes as release operations, not harmless local preparation.
Changing a signing secret later may invalidate authentication state; do not
regenerate it as part of every deploy.

### Build-time files versus deployed secrets

Wrangler can read local `.dev.vars` when building any target if no target-specific
file exists. To avoid that fallback on your machine, optional **build-only**
examples are provided:

```bash
cp -n .dev.vars.dev.example .dev.vars.dev
cp -n .dev.vars.production.example .dev.vars.production
```

These contain non-secret fixtures, not deployed credentials. A named file is
complete and does not merge with `.dev.vars`. The examples are tracked; actual
`.dev.vars*` files are ignored. Do not copy production secrets into them.
Remote Workers obtain their real values from Cloudflare, not these files.

Vite can copy local values into ignored `dist/controlmembers/.dev.vars` (the folder
name follows the base Worker name). Never publish/share the full `dist` directory
as static files. Only `dist/client` is served. Do not create public `VITE_*`
variables containing Worker secrets.

## Email

Outgoing email uses the Cloudflare `EMAIL` binding (Email Sending) through
`src/worker/email/`. Application and auth code never touches the binding
directly.

**Local development and tests simulate email** — nothing is actually sent, and
local generated bodies are written under `.wrangler/tmp/email/`. The supported
scripts and Vite/test configurations deliberately disable remote bindings.
Use the deployed dev environment to test actual delivery.

Both deployed environments need an `EMAIL_FROM` authorized in **Cloudflare Email
Sending**. Each SaaS onboards its own sending domain or subdomain and configures
its own values. Dev's `send_email[0].allowed_destination_addresses` must list only
controlled test mailboxes, including the dev platform admin and test employees.
An unlisted recipient is rejected by the binding: provisioning may succeed but
report failed setup email. Update the allowlist, redeploy dev and resend.

Production has no test-recipient restriction. Never import customer recipients
into dev to test sending. The allowlist controls email, not website access;
restrict dev access separately (for example with Cloudflare Access) before wider
testing. Access policies are not provisioned by this application.

## Configuring ControlMembers environments

Local setup needs no remote database or domain. The following steps create real
Cloudflare resources and belong to an explicitly authorized release/setup:

1. Authenticate with `npx wrangler login` and verify the account with
   `npx wrangler whoami`. Use an appropriately scoped Cloudflare token for CI.
2. Choose different Worker names and database names in `env.dev` and
   `env.production` in `wrangler.json`. Leave the original top-level local D1
   identity unchanged to retain existing local data.
3. Create two databases. These commands match the default names; if you renamed
   them, use your new names instead:

   ```bash
   npx wrangler d1 create controlmembers-dev-db
   npx wrangler d1 create controlmembers-production-db
   ```

4. Copy each returned UUID into the corresponding environment's `database_id`.
   Never use the same database for both environments. Remote D1 IDs are resource
   identifiers, not passwords; the real secrets stay outside Git.
5. In a domain managed by the intended Cloudflare account, choose two distinct
   hosts such as `dev.<your-domain>` and `app.<your-domain>`. Replace each
   environment's `routes[0].pattern` with its hostname only. `custom_domain: true`
   lets deployment configure that hostname; do not attach an occupied production
   hostname to dev. `workers_dev` and `preview_urls` stay disabled, so no alternate
   public URL bypasses the chosen domain/access policy.
6. Onboard the email sending domain, replace dev's recipient examples with
   controlled mailboxes, and set all three remote secrets per environment using
   [Configuration](#configuration). The command wrapper cannot verify secret
   values or Cloudflare domain ownership; check them before release.
7. Run `npm run cf-typegen` and `npm run check`. This verifies both remote build
   targets but does **not** migrate, create resources or deploy them.
8. Publish dev first using [Deploy](#deploy), bootstrap its admin, and verify the
   full application and actual email delivery. Only then prepare production's
   separate data/admin and approve its deployment.

The same `DB` binding is used by migration scripts, so renaming remote databases
does not require editing `package.json`. If deliberately changing the local
database identity later, migrate the newly selected local database; existing
files are not moved or deleted automatically.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Local frontend + Worker, local D1, simulated email |
| `npm run preview` | Build local target and preview at localhost:5173 |
| `npm run build` | Typecheck + optimized build using local configuration |
| `npm run build:dev` | Typecheck + build for the remote dev target; no deployment |
| `npm run build:production` | Typecheck + build for production; no deployment |
| `npm run deploy:dev:dry-run` | Rebuild dev and simulate its deployment |
| `npm run deploy:production:dry-run` | Rebuild production and simulate its deployment |
| `npm run check:environments` | Build/dry-run dev, production, then local; no remote writes |
| `npm run check` | Typecheck, lint, all Node/Workers tests, all three build/dry-run targets |
| `npm run typecheck` / `npm run lint` | TypeScript / ESLint |
| `npm test` | Node environment-safety and i18n checks, then isolated Workers/D1 tests |
| `npm run test:environments` | Environment configuration and command-safety tests only |
| `npm run test:i18n` | Catalog-use and platform-neutral shared-module checks |
| `npm run test:watch` | Watch Workers-runtime tests locally |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts`, including named environments |
| `npm run db:generate` | Generate Drizzle migrations from the schemas |
| `npm run db:migrate:local` | Apply migrations to local D1 only |
| `npm run db:migrate:dev` | Apply migrations to real dev D1 |
| `npm run db:migrate:production` | Apply migrations to real production D1 |
| `npm run deploy:dev` | Validate configuration, rebuild and deploy dev |
| `npm run deploy:production` | Validate configuration, rebuild and deploy production |
| `npm run deploy` / `npm run db:migrate:remote` | Intentionally fail: choose an explicit target |

## Deploy

After completing the external setup above, run the dev release. Replace the
example hostname in each curl command with your configured domain:

```bash
npm run check
npm run db:migrate:dev
npm run deploy:dev
curl https://dev.example.com/api/health
```

Bootstrap dev's own platform admin, test activation and password recovery with
allowlisted addresses, create a company/Branches/members, and verify permissions
and company switching. Confirm every email link returns to the dev origin.

Only after approving the same code revision for production:

```bash
npm run deploy:production:dry-run
npm run db:migrate:production
npm run deploy:production
curl https://app.example.com/api/health
```

Bootstrap production separately on the first release. Do not copy dev users,
sessions, credentials or business records into production. The application
deployment does not apply migrations, and migrations do not deploy code.

For schema changes, inspect generated SQL and test it in local and dev first.
The migration-before-deploy order above assumes backward-compatible changes
(for example adding a nullable field). For destructive/incompatible changes,
plan a staged migration and recovery procedure explicitly. Rolling back Worker
code does not roll back D1 schema/data. Check recovery/backup readiness before
production data changes.

All targets share the ignored `dist` directory. Do not build/deploy different
targets concurrently in the same checkout. The supported deploy commands rebuild
and select their target rather than trusting a previous build. Do not use bare
`wrangler deploy` or add `--env`/`--config` overrides to npm commands. Vite's
optimized "production build" is a compilation mode, not the production resource
target; the runner sets `CLOUDFLARE_ENV` before building.

There is no automatic Git-push deployment or CI release approval configured.
Production is currently an explicit operator command. If adding CI later, run
the same checks, deploy dev first, and require an approval gate for production.

Configuration reference: [Cloudflare environments with Vite](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/)
and [Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/).
