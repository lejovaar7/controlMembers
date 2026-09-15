# Specification 09: Testing and Operations

[All specifications](README.md)

## Workers-runtime tests

Vitest uses `@cloudflare/vitest-plugin`. Tests run in a Workers-compatible
runtime with Cloudflare bindings rather than a Node-only API simulation.

`vitest.config.ts` loads the real SQL files from `drizzle/` and injects them into
the test environment. `test/setup.ts` applies those migrations before tests.
There is no separate test schema and no remote D1 access.

Test-only secret values and email addresses use `.invalid` data. Automated tests
do not send real email. The test configuration pins the top-level local
environment and disables remote bindings, independently of shell environment.

## Current suites

| Test file | Coverage |
| --- | --- |
| `test/slug.test.ts` | Organization slug normalization and fallback safety |
| `test/return-path.test.ts` | Internal-only return paths and external URL rejection |
| `test/onboarding.test.ts` | Organization/Branch state, accessible Branch endpoint, and switching; the filename is legacy |
| `test/tenant-isolation.test.ts` | Tenant resolution, Organization settings, Branch isolation, and invitation email permissions |
| `test/provisioning.test.ts` | Closed signup, platform scope, customer provisioning, Magic Link safety, reuse, retries, and setup password |
| `test/branches.test.ts` | Branch visibility, create/rename permissions, cross-tenant denial, and stale state |
| `test/members.test.ts` | Directory privacy, provisioning/reuse, concurrent identical requests, interrupted writes/mail, role policy, exact assignments and activation |
| `test/access-controls.test.ts` | Owner delegation, limited-admin scope, native/peer bypasses, company-only deactivation/reactivation, stale sessions and explicit company selection |
| `test/hardening.test.ts` | Bootstrap end-to-end, JSON/origin/body-limit handling, native invitation restrictions, cache policy and HTML escaping |
| `test/localization.test.ts` | Catalog completeness/placeholders, priority/fallback, public choice, persistence, tenant isolation, guarded language writes, provisioning and recipient email |
| `scripts/i18n.test.mjs` | Static JSX/accessible copy uses catalogs; shared localization has no browser/Worker/secret dependencies |
| `scripts/environments.test.mjs` | Node tests for environment isolation, explicit targets, placeholder rejection, dev email allowlist, command ordering and argument-override rejection |
| `scripts/bootstrap-admin.test.mjs` | First-platform-admin argument, target, allowlist, SQL escaping, retry and password-free setup-link safety |

See [the dated verification record](VERIFICATION.md) for current counts and
command outputs. `test/helpers.ts` shares actor creation and same-origin requests.

## Security guarantees covered

- public signup is rejected
- unknown email cannot create an account with Magic Link
- normal user cannot create an Organization
- tenant roles do not grant platform access
- platform admin can provision a customer
- provisional credential is not exposed and is revoked on activation
- existing user credentials and platform role are preserved
- foreign Organization activation fails
- foreign Branch access fails
- member access is assignment-scoped
- Owner/unrestricted-admin Branch access is Organization-wide; limited admins are assigned-only
- only Owner can delegate admin appointment, with no self or onward delegation
- a scoped admin cannot manage a person's wider Branch scope through any Member route
- inactive membership denies access without changing identity or other companies
- one active company auto-selects; multiple without valid context require a choice
- stale active Team grants no access
- invitation email uses `EmailService` and member invitation is refused

## Environment contract

The same codebase has exactly three supported environment targets:

| Target | Wrangler selection | Application execution | Data / email |
| --- | --- | --- | --- |
| `local` | Top-level config, explicit empty `CLOUDFLARE_ENV` | Loopback port 5173 through Vite/workerd | Original local D1 state, simulated Email |
| `dev` | `env.dev` | Separate deployed Worker and dev custom domain | Real independent dev D1, allowlisted test email |
| `production` | `env.production` | Separate deployed Worker and production custom domain | Real independent production D1, customer email |

Top-level configuration is local, not a fourth deployed environment. Its D1
name/ID are preserved so this change does not reset existing local data. Each
remote environment explicitly redeclares D1, Email and required secret names.
Worker names, D1 names/IDs and custom domains must be different. Remote IDs,
domains and dev recipients ship as non-working examples for the operator to
replace; no real Cloudflare resource is committed to the generic starter.

`workers_dev` and `preview_urls` are disabled for every target. Local has no
public routes; each remote target has one custom domain. Domain ownership/DNS,
Cloudflare account permissions and any dev website access policy must be
configured externally. An email allowlist is not an access policy.

`vite.config.ts` and `vitest.config.ts` disable remote binding connections.
Local-to-cloud-D1 development is deliberately not part of these three targets;
adding it requires an explicit safe opt-in, never silently changing the default.
The `remote: false` binding setting affects local emulation only, not the real
bindings of a deployed Worker.

### Command selection and safety

`scripts/environments.mjs` is a small environment/CLI orchestration wrapper, not
a database migration implementation. It runs the installed Vite, TypeScript,
Vitest and Wrangler executables, without installing tools dynamically.

- Select `CLOUDFLARE_ENV` before starting Vite or compiling. Local overrides an
  inherited production selection with an explicit empty value.
- Local dev/preview bind loopback at port 5173 and refuse automatic port changes
  so the configured authentication URL stays valid.
- Bare `deploy` and `db:migrate:remote` scripts fail. There is no default remote
  target or supported local deployment. Extra CLI arguments/target overrides
  are rejected rather than forwarded to Wrangler.
- Remote migrations/deploys reject placeholder or malformed UUIDs. Actual
  deploys additionally reject example domains and dev test-recipient examples.
  Builds and dry runs allow placeholders to validate a fresh clone without
  accessing its future cloud resources.
- Missing non-inherited bindings, duplicate resources, absent dev allowlists or
  accidental remote local-binding settings fail before child tools execute.
- Deploy always rebuilds its selected target. After compilation, the wrapper
  verifies the generated Worker name, target environment, D1 binding, routes and
  Email policy against the selected source configuration before proceeding.
  Build/deploy targets share `dist`; do not run them concurrently in one checkout.
- Migrations explicitly use the `DB` binding, source `wrangler.json`, target
  environment and `--local`/`--remote`. Renaming databases needs no script edits;
  the previous Vite deploy redirect cannot select the migration destination.
- Deploy never applies SQL implicitly. Migration never deploys code or copies
  data between environments. Raw Wrangler can bypass wrapper checks; operators
  must still verify their account, permissions and target.

### Configuration and secrets

Local uses an ignored `.dev.vars`; `.dev.vars.example` documents its keys and
requires a generated local signing secret. The existing file is not overwritten.
Dev and production use separately installed Cloudflare secrets: signing secret,
canonical `APP_URL`, and authorized `EMAIL_FROM`. Signing secrets are independent
and each URL matches its own HTTPS domain.

Optional `.dev.vars.dev` and `.dev.vars.production` files can be copied from the
tracked build-only examples to avoid falling back to local values during builds.
They contain no deployed secrets; a build does not upload them as secret values.
Vite may copy local values to the ignored Worker artifact. Never publish/share
the entire build directory; only `dist/client` is public static content.

The wrapper does not fetch or validate deployed secret values, domain ownership,
real email delivery, backups or Cloudflare Access settings. Those are release
checks. Local, dev and production have independent accounts, sessions, tokens and
platform-admin bootstrap; no credentials or customer data are promoted with code.

## Package scripts

| Script | Responsibility |
| --- | --- |
| `npm run setup:local` | Safe first-clone variables, locked install and local D1 migration |
| `npm run bootstrap:admin` | Guarded first platform administrator bootstrap for one explicit environment |
| `npm run dev` / `npm run preview` | Local development / optimized local preview |
| `npm run typecheck` | All referenced TypeScript projects |
| `npm run lint` | ESLint repository checks |
| `npm test` | Node environment/localization checks and Workers-runtime Vitest suite |
| `npm run test:environments` | Only command/configuration-safety tests |
| `npm run test:i18n` | Static localization and shared-module boundary checks |
| `npm run build` / `build:dev` / `build:production` | Typecheck and optimized build for the explicit target |
| `npm run deploy:dev:dry-run` / `deploy:production:dry-run` | Rebuild and simulate the selected remote deployment |
| `npm run check:environments` | Build/dry-run dev, production, then local; never publish |
| `npm run check` | Typecheck, lint, all Node/Workers test suites and all three build/dry-run targets |
| `npm run cf-typegen` | Regenerate Worker binding types |
| `npm run db:generate` | Generate Drizzle migration |
| `npm run db:migrate:local` | Apply local D1 migrations |
| `npm run db:migrate:dev` / `db:migrate:production` | Apply generated SQL to that remote database |
| `npm run deploy:dev` / `deploy:production` | Validate, rebuild and deploy only that environment |
| `npm run deploy` / `db:migrate:remote` | Fail and require an explicit remote target |

## Template operations

Membership access controls use generated migration `0005_safe_thunderbird.sql`;
language changes use `0006_lively_starbolt.sql` for the nullable user preference.
Both are part of the current `main` history. Apply all pending generated SQL
locally before running the app. In an approved release,
apply it in dev and verify language UI and real dev-recipient mail before the
separate production migration/deployment. No migration copies preferences or
accounts between environments. A new catalog alone requires no schema migration.

A ControlMembers installation uses its distinct remote Worker/database names and
two domains, creates two D1 databases, replaces the remote placeholder IDs, configures dev
test recipients, generates binding types, and installs each environment's
secrets. See the [operator setup guide](../README.md#configuring-controlmembers-environments)
for exact commands, domain/email setup and first-admin bootstrap.

Local runtime state, `.dev.vars`, generated `dist`, and `.wrangler` data are
ignored. Generated Drizzle migrations and Worker binding types are tracked when
their sources change.

## Dependency maintenance

`package.json` keeps every direct dependency exact. `package-lock.json` records
the transitive tree used by `npm ci`; install and commit the manifest and lockfile
together when a dependency change is authorized.

The 2026-09-02 security update changes only two transitive packages and esbuild's
matching native binaries:

- `qs` 6.15.3 -> 6.16.0, within Express/body-parser's existing ranges under the
  shadcn CLI. It needs no override or new direct dependency.
- `@esbuild-kit/core-utils@3.3.2 -> esbuild` 0.18.20 -> 0.25.12 via a scoped npm
  override. Drizzle Kit 0.31.10 still depends on the legacy loader; its own esbuild
  already uses 0.25.12. Vite, Wrangler and other esbuild paths are unaffected.

The esbuild override deliberately replaces the legacy `~0.18.20` constraint,
so an audit alone is not a compatibility test. Node smoke checks exercised
CommonJS/ESM TypeScript transformation and source maps. The real Drizzle CLI,
shadcn CLI startup and the application quality gate also passed. Results and
upstream advisory links are in [the verification record](VERIFICATION.md).

For future dependency maintenance, run:

```bash
npm ci
npm ls esbuild qs --all
npm run db:generate
npm exec -- drizzle-kit check
npm exec -- shadcn --help
npm run check
npm audit
npm audit --omit=dev
git diff --check
```

With an unchanged schema, generation must report no changes; inspect any new
migration instead of assuming it is part of a dependency update. Never apply
remote migrations or deploy as an implicit part of these checks.

Remove the override only when an upstream dependency update resolves patched
esbuild without it and the same compatibility/audit checks pass. Do not replace
it with a global override, an automatic forced downgrade or an audit suppression.
A zero-finding audit is dated evidence of known advisories, not a permanent
guarantee that all dependencies are vulnerability-free.

The ControlMembers clone additionally pins the compatible Cloudflare tooling
versions recorded in `package.json` and temporarily overrides transitive
`js-yaml` to 4.3.2 for GHSA-2883-xcg3-v3hh. Reassess and remove that override
when both ESLint and shadcn dependency paths resolve a fixed version themselves;
the same Drizzle, shadcn, application and audit checks remain required.

## Release checklist

The numbered files are module contracts, not sequential delivery tasks. Run the
full gate for behavioral changes and before a release; binding changes also
require `npm run cf-typegen`. For documentation-only changes, check links,
source references, consistency, `git diff --check` and the scope of the diff.

Cross-module flows to verify:

1. Bootstrap a platform administrator without a predefined password, activate
   through a controlled link, then create a company, Owner and localized initial Branch.
2. Activate the new Owner, revoke the provisional credential, choose a password
   and enter the already-created company without company-creation onboarding.
3. Add an established user to another company, preserve credentials and global
   role, then switch companies without carrying over unauthorized Branch state.
4. Provision a new employee, complete setup and verify assigned-only Branch
   access with no Users & permissions/Branches management authority.
5. Change member/admin scope and roles, test Owner delegation and revoke it,
   reject wider-scope/self/peer edits and stale active Branches. Confirm all-Branch
   admins include future locations and limited admins do not.
6. Deactivate access with an existing session, retain the person's identity and
   other company membership, then reactivate saved scope. Verify one/many/zero
   active-company states and explicit selection instead of an arbitrary first company.
7. Exercise keyboard/focus, narrow layouts, request failures and retries across
   authentication, switching and management. Record what was actually tested.

`npm run check` includes typecheck, lint, Node environment tests, Workers/D1 tests
and all three build/deployment dry runs. A passing build does not replace runtime checks. Record
dated outcomes in [VERIFICATION.md](VERIFICATION.md), not permanent hardcoded
test counts in each module. Audit findings need assessment; do not silently
upgrade unrelated packages or force an audit fix.

### Environment acceptance checks

- Local commands still use the original local database when the shell exports
  `CLOUDFLARE_ENV=production`; no real email or remote D1 is used by local/test.
- Every build/dry-run selects its own Worker, D1 and Email policy. A production
  compilation mode must not be confused with the production resource target.
- Ambiguous commands, placeholder remote UUIDs, duplicate resources, missing
  bindings and extra target overrides fail before any remote write.
- Remote dev cannot deploy without a real custom domain and explicit controlled
  email recipients; production has different resources and secrets.
- Local migrations and isolated test databases use all actual Drizzle SQL files;
  adding environments does not change schema, business logic or dependencies.
- Release dev first; verify actual email links, bootstrap, isolation and user
  flows there, then explicitly approve the same code revision for production.
- Test schema changes locally and in dev. Production migration-before-deploy
  assumes backward compatibility; destructive changes need a separate staged
  migration/recovery plan. Rolling back code does not roll back database state.
- Apply membership migration 0005 before the new authorization code. Do not roll
  back to code that ignores deactivation or selected-admin scope after using these
  controls. Existing admins need an explicit Owner grant to appoint admins.
- No automatic Git-push deployment or CI approval gate is claimed. Only local
  checks/dry runs are part of implementation verification; remote provisioning,
  migrations, DNS, secret installation and delivery remain external operations.

## Developing ControlMembers

- Preserve the source template separately; this repository is the product clone.
- Follow the [operator guide](../README.md#configuring-controlmembers-environments)
  for separate dev/production Workers, databases, domains, secrets and sending
  configuration. Migration commands already resolve the selected `DB` binding.
- Bootstrap ControlMembers' own platform administrator and verify real email
  delivery and production configuration in a separately authorized release.
- Implement product milestones from `planning/` under specifications 10–19,
  preserving the Organization/Branch keys and isolation tests required by
  [tenant security](04-tenant-and-branch-security.md).
- No commit, push, remote migration or production deployment is implied by
  completing a module or running local tests.
