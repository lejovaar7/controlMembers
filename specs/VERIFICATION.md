# ControlMembers Verification Record

This is dated execution evidence, not a permanent test-count target or proof of
production deployment. The latest repository checkpoint is recorded first; earlier
localization, environment, Starter v1 and dependency-remediation evidence from
the inherited foundation is preserved below.

## 2026-09-16: Distinct school owner emails

Changed platform provisioning to reject a different school when the normalized
Owner email already owns a company, including inactive ownership. Same-name
retries resume the existing school. Existing duplicate ownerships are preserved.
New Organization, Owner membership and initial Branch writes use an atomic D1
batch with an ownership condition to prevent concurrent duplicate creation.
The form includes guidance and a translated conflict message.

Validation passed: type checking through `npm run build`, `npm run lint`,
`git diff --check`, and `npm test` (24 environment/bootstrap checks, two i18n
checks, 188 Workers/D1 tests). Five new cases cover normalized duplicate emails,
inactive ownership, legacy duplicates, competing new names and concurrent
same-name retries. Worker/client builds passed with the existing chunk-size
warning. No schema migration, existing-school modification or deployment.

## 2026-09-16: Platform company directory

Added a searchable, paginated company directory, company details with Owners,
activation status, Branches and active user counts, and an audited name update.
Provisioning success now links to the company detail and directory. An active
membership is required to open a company's operational workspace; platform role
alone does not grant tenant access.

Validation passed:

- `npm run typecheck`, `npm run lint` and `git diff --check`;
- `npm test`: 24 environment/bootstrap tests, two localization checks and 183
  Workers/D1 tests across 13 files, including ten new directory tests;
- `npm run build`: local Worker and client builds; the existing non-blocking
  client chunk-size warning remains (approximately 608 kB uncompressed);
- browser review of directory, empty search and company detail at desktop and
  narrow mobile widths, using temporary simulated responses. Confirmed no
  horizontal document overflow at 320 CSS pixels for the directory and 308 CSS
  pixels for the detail, and fixed activation-button wrapping at narrow widths.

The browser had no authenticated platform session, so visual checks used an
isolated fixture, removed before the final build. Backend authorization, search,
pagination, metadata and audit behavior were exercised against test D1. No real
company or account was modified and no deployment was performed.

## 2026-09-16: Responsive interface redesign

Pulled `origin/main` through `e72a599` before making local changes. Unified the
blue/slate palette, navigation, page hierarchy, financial cards, status badges,
list skeletons, forms and public/auth/platform surfaces. Added a Base UI mobile
navigation drawer and labeled mobile report rows. Dashboard visualization uses
the existing API values; no API, database or permission rules were changed.

Validation passed:

- `npm run typecheck`, `npm run lint`, `npm run test:i18n` and `git diff --check`;
- `npm test`: 24 environment/bootstrap tests, two localization checks and 173
  Workers/D1 tests across 12 files;
- `npm run build`: local Worker and client builds; the existing non-blocking
  JavaScript chunk-size warning remains (approximately 597 kB uncompressed);
- browser review at 320, 390, 768 and 1440 CSS-pixel viewport widths. Reviewed
  dashboard, members and create form, charges, payments, plans, reports, settings,
  member profile, home and sign-in; checked document widths for overflow;
- mobile drawer opening, Escape dismissal and trigger focus restoration;
  localized English/Spanish content and dashboard empty/error states.

The available local session has no active company membership. Internal screens
were reviewed using temporary browser-only API fixtures and synthetic records,
without modifying local accounts, memberships or financial data. The fixture
entry files were removed before the final build. This is layout/interaction
evidence, not a replacement for authenticated business-flow acceptance with a
representative user. No commit, push or deployment was performed.

## 2026-09-16: Branded interface foundation

Introduced the ControlMembers interface palette across the public shell,
authentication experience, application shell, shared Button/Input/Card
primitives, page hierarchy and financial dashboard. The final wordmark uses the
same symbol, `Control` vector, proportions and navy/blue colors as ControlWash;
only `Wash` is replaced by `Members`. The login was visually reviewed in Spanish
at desktop width after fitting the SVG view box for legibility; the authenticated
dashboard still requires the representative-user pilot for browser-level
observation.

`npm run check` passed typecheck, lint, 24 environment/bootstrap tests, two i18n
checks, 173 Workers/D1 tests, and local/dev/production builds and deployment dry
runs. `git diff --check` also passed. The build retains the existing non-blocking
JavaScript chunk-size warning; no API, database, permission or financial rule
changed.

## 2026-09-15: Complete local ControlMembers MVP release candidate

Implemented the complete local receivables workflow on the inherited SaaS
foundation. The product now provides customer Members and shared Contacts,
editable profiles and lifecycle, Plans with optional tags, Enrollments with
snapshotted personal terms, previewed/idempotent monthly Charge generation,
derived pending/partial/paid/overdue states, audited adjustment/void actions,
Payment allocation preview and manual distribution, Member credit, idempotent
posting and audited reversals.

The bilingual responsive application exposes Dashboard, Members, Charges,
Payments, Plans, Reports, Branches, Users & permissions and Settings. Single
Branch flows do not ask the operator to select a Branch. Operational lists use
bounded pagination and filters; dashboard/reporting covers expected, collected,
allocated, outstanding, overdue Members, upcoming due value, aging, Member
balances, Plan totals and Branch totals. Bounded Member CSV import has a no-write
preview and idempotent confirmation; scoped CSV exports neutralize spreadsheet
formula injection and write audit evidence.

Migration `0011_true_plazm` adds the domain ledger, import/audit tables and four
Owner-controlled financial grants without replacing the Better Auth tenant or
Branch model. It was generated by Drizzle Kit, inspected, applied successfully
to local D1 and validated with `npm exec -- drizzle-kit check`. Organization
currency is now locked once a Charge or Payment exists.

The complete `npm run check` gate passed typecheck, lint, 24 environment/bootstrap
tests, two i18n checks, 173 Workers/D1 tests (199 automated tests total), and the
local/dev/production builds and deployment dry-runs. `git diff --check` passed.
A local browser smoke check loaded the landing and sign-in pages at desktop and
390×844; it also found and corrected Base UI link/button semantics, after which
no new browser warning was emitted. Authenticated product journeys are covered
by Workers/D1 integration tests; real-device pilot observation remains part of
the separately authorized dev release.

No remote database migration, email delivery, Cloudflare resource mutation or
deployment occurred.

## 2026-09-15: Unified Plans with optional tags

Removed the separate Program concept from the active ControlMembers product
model. A Plan now owns its name, optional description, monthly minor-unit price,
currency snapshot, usual due day, active state, available Branches and optional
organization tags. The guarded API is now `/api/plans`; the former
`/api/programs` and `/api/billing-plans` routes are absent. Tags are normalized
and reused case-insensitively but do not affect price, access or billing rules.

The bilingual Plans page uses the inherited Tailwind/shadcn design system. It
creates, lists, edits, activates and deactivates complete Plans, formats currency
with the resolved application locale and provides keyboard-operable tag chips
and suggestions.
With one Branch, assignment is automatic and no Branch selector is shown; with
multiple Branches, availability is explicit.

Migration `0010_tranquil_war_machine` replaces the former catalog tables without
discarding their data: every existing Billing Plan becomes a unified Plan, its
former Program description and Branch availability are retained, former
Programs become optional tags, and organization-wide Plans remain available in
all existing Branches. It applied successfully to local D1. A separate SQLite
migration rehearsal seeded a Program-scoped Plan and an organization-wide Plan,
then verified both transformed records, all Branch links, the derived tag,
zero legacy tables and no foreign-key violations.

`npm exec -- drizzle-kit check`, `git diff --check` and the complete
`npm run check` gate passed. The run covered typecheck, lint, 24
environment/bootstrap tests, two i18n checks, 159 Workers/D1 tests (185 automated
tests total), and local/dev/production build and deployment dry-runs. No remote
database, email, cloud resource or deployment was changed.

## 2026-09-15: Clear user, Branch and billing terminology

The authenticated-access page now appears as **Users & permissions/Usuarios y
permisos**, while the existing `/app/members` route, Better Auth membership model
and APIs remain unchanged. Customer-facing **Members/Miembros** retain their
product meaning. Billing setup now presents Programs as **Activities/Actividades**
and Plans as **Monthly fees/Mensualidades**, without renaming persistence or API
contracts. New Spanish companies receive `Sede Principal`; new English companies
receive `Main Branch`. Migration `0009_localize_default_branch` updates only a
legacy Branch named exactly `Main` when it is the company's sole Branch; custom
and multi-Branch data remains untouched.

`npm exec -- drizzle-kit check`, local migration and the complete `npm run check`
gate passed. The run covered typecheck, lint, 24 environment/bootstrap tests,
two i18n checks, 158 Workers/D1 tests (184 automated tests total), and local/dev/
production build and deployment dry-runs. No remote database, email, cloud
resource or deployment was changed.

## 2026-09-15: Explicit company language

Removed the application-default choice from company creation and Settings. Every
new company receives an explicit registered language; the creation form initially
selects the platform administrator's current resolved language, while the platform
API rejects omitted, null and unsupported values before creating an identity.
Personal language remains nullable so people can continue to use their company's
language.

Migration `0008_third_may_parker` normalizes existing null, regional and unsupported
company values to English or Spanish, makes `organization.locale` non-null and
sets English as the storage safety default. It applied successfully to the local
D1 database, and `npm exec -- drizzle-kit check` passed. `npm run check` passed
typecheck, lint, 24 environment/bootstrap tests, two i18n checks, 157 Workers/D1
tests and all local/dev/production builds and deployment dry-runs (183 automated
tests total). No remote database, email, cloud resource or deployment was changed.

## 2026-09-15: Platform routing and contextual language selection

Centralized authenticated start-path selection so platform administrators land
on `/platform` after sign-in or account setup. The landing page, application
layout and `/no-company` guard use the same role rule, so an administrator
without tenant membership is no longer shown the inactive-company dead end.
Valid explicit internal return paths remain supported.

The language picker now offers only English and Spanish to platform-only
accounts. Within an active company it presents the clearer **Use company
language** choice and names the resolved company language instead of showing the
ambiguous former Automatic option. README and frontend specifications document
the same behavior. Two new routing tests cover role parsing, default destinations,
safe explicit paths and hostile return-path fallback.

`npm run check` passed typecheck, lint, 24 environment/bootstrap tests, two i18n
checks, 157 Workers/D1 tests and all local/dev/production builds and deployment
dry-runs (183 automated tests total). `git diff --check` also passed. No database
data, migration, email, cloud resource or deployment was changed.

## 2026-09-15: Guarded platform-admin bootstrap command

Replaced the operator-facing raw SQL bootstrap procedure with
`npm run bootstrap:admin`. The command requires an explicit local, dev or
production target, validates email/name and configured D1/domain/email policy,
requires `--confirm-production` for production, refuses to elevate existing
tenant identities, and conditionally creates only the first platform
administrator. It accepts no password and requests the existing one-time
`/setup-account` Magic Link flow. A retry for the same unfinished identity is
safe; an already configured identity exits without sending another link.

Six new Node tests cover argument rejection, production acknowledgement,
environment isolation, dev email allowlisting, SQL literal escaping and
conditional insertion, first-admin/retry decisions, and the password-free setup
request. `npm run check` passed typecheck, lint, 24 environment/bootstrap tests,
two i18n checks, 155 Workers/D1 tests and all local/dev/production builds and
deployment dry-runs (181 automated tests total). The command help path also ran
successfully. No administrator record, remote database operation, email, cloud
resource, deployment, commit or push was created during verification.

## 2026-09-15: Billing setup vertical slice

Implemented the first ControlMembers domain slice without changing any remote
environment. Generated and applied local migration `0007_organic_lucky_pierre`
for Organization Programs, explicit Program-Branch availability and monthly
Billing Plans. Added guarded Organization billing settings and Program/Plan APIs,
including tenant/Branch validation, active-name uniqueness, role restrictions,
integer minor-unit pricing and currency snapshots.

Added `/app/billing-setup`, a responsive bilingual create/list experience for
currency, timezone, Programs, offered Branches and Plans. The navigation exposes
it only to Owners and unrestricted admins as a UX guard; the Worker remains the
authorization boundary. Six new Workers tests cover configuration permissions,
validation, cross-tenant/cross-Branch rejection, duplicate names and Plan
currency snapshots.

`npm exec -- drizzle-kit check` and `npm run check` passed. The complete gate
included typecheck, lint, 18 environment tests, two i18n checks, 155 Workers/D1
tests and local/dev/production builds plus deployment dry-runs (175 automated
tests total). Both `npm audit` and `npm audit --omit=dev` reported zero known
vulnerabilities. A local HTTP smoke check returned database health OK and served
the ControlMembers SPA at `/app/billing-setup`. No remote migration, cloud
resource, commit, push, email delivery or deployment was performed. Enrollments
and the downstream financial modules remain unimplemented; Program/Plan edit and
deactivation APIs exist, while their UI controls remain follow-up work.

## 2026-09-14: ControlMembers product-clone baseline

Created the separate `/Users/admin/Personal/controlmembers` repository from
foundation commit `7280ab2`. The source template remained unchanged. The clone's
`template` remote fetches the original GitHub repository and has a disabled push
URL; a product `origin` remains intentionally unset until its real repository URL
is provided.

Established the ControlMembers identity, product overview, canonical modules
10–19, prioritized user stories, product decision log and seven-milestone MVP
delivery plan. The documents distinguish customer-facing Members from the
authenticated Team and specify Programs, Plans, Enrollments, Charges, Payments,
Allocations, reporting, permissions, audit, responsive shadcn-based UX, import/
export/privacy and a post-MVP WhatsApp boundary. No domain table, route or screen
is claimed as implemented.

Renamed local/dev/production Worker and D1 placeholders to ControlMembers and
regenerated binding/runtime types. Updated the landing title and bilingual
catalog copy. Installed the locked dependencies and then applied only compatible
security updates offered by the audit: `@cloudflare/vite-plugin` 1.54.9,
`@cloudflare/vitest-plugin` 1.1.9 and Wrangler 4.131.2. A temporary `js-yaml`
4.3.2 override covers the remaining ESLint/shadcn transitive advisory and is
documented in agent guidance.

Verification on this working tree:

| Check | Result |
| --- | --- |
| `npm run cf-typegen` | Passed; `worker-configuration.d.ts` regenerated for the renamed configuration |
| `npm run check` | Passed typecheck, lint, 149 Workers tests, 18 environment tests, two i18n checks and local/dev/production build/dry-runs (169 tests total) |
| `npm audit` | Zero reported vulnerabilities |
| `npm audit --omit=dev` | Zero reported vulnerabilities |
| `npm exec -- drizzle-kit check` | Passed; inherited migration metadata remains consistent |
| `npm run db:migrate:local` | Applied inherited migrations 0000–0006 to the new ignored ControlMembers local D1 state |
| Local HTTP smoke | `GET /api/health` returned `{status:"ok",database:"ok"}` from the new local D1; the server was then stopped |
| `git diff --check` | Passed after generated whitespace normalization |

The first full check ran before the ignored local `.dev.vars` was created, so
Wrangler warned that local required secrets were absent while tests used their
isolated bindings; all checks still passed. A local-only ignored development
file now provides non-production values for future `npm run dev`. No cloud
resource, remote database, real email recipient, product Git remote, commit,
push, remote migration or deployment was created.

## 2026-09-03: Current main and documentation synchronization

`main` now includes the final access-boundary and guide commits that followed the
worktree integration:

| Commit | Scope |
| --- | --- |
| `bf73f33` | Membership retry/peer protections, dormant delegation cleanup, stricter native auth-route blocks, context-sensitive Member UI resets and the 29-test access-control suite |
| `eeb5218` | Company access, lifecycle, migration and permission guidance in README and CLAUDE |

On this exact committed source, `npm run check` passed typecheck, lint, 149
Workers tests, 18 environment tests, two i18n checks, and dev/production/local
builds plus deployment dry runs (169 automated tests total). `drizzle-kit check`
also passed: the seven generated SQL files `0000` through `0006` match the
Drizzle journal and all are documented. Anonymous local HTTP checks confirmed
JSON application `404`, JSON application authorization errors, and Better Auth's
distinct empty/plain-text `404` forms for unknown/disabled auth paths. No request
used a real user account or changed application data.

The subsequent documentation-only synchronization completed the application API
inventory, clarified Better Auth response ownership, replaced obsolete worktree
wording and corrected the four-project TypeScript map. Local documentation links,
heading targets, referenced paths, package scripts and whitespace were checked
after those edits. No runtime source, dependency, lockfile, schema, migration or
binding changed during this synchronization, so the runtime gate above remains
the applicable evidence.

`PROJECT_SPEC.md` and `specs/` remain intentionally untracked; README and CLAUDE
have documentation-only working-tree changes from this synchronization. No push,
remote migration, Cloudflare resource change, real email or deployment was
performed. Older entries below remain historical evidence for their stated
snapshots; this entry is the current repository checkpoint.

## 2026-09-03: Main integration checkpoint

Fast-forwarded `main` through the three authorized commits after reconciling its
pre-existing uncommitted access-control refinements with localization. The
reconciliation preserves the 29-test access-control suite, stricter native auth
blocks, retry/scope protections and expanded access documentation. Personal and
company language behavior, translated UI/email and migration `0006` remain
intact. Pre-existing local changes and specifications remain uncommitted on
`main`; no unrelated change was discarded or folded into the three commits.

Before integration, the reconciled snapshot passed lint, 149 Workers tests, 18
environment tests and two i18n checks (169 total). Typecheck could not write its
incremental cache through the temporary dependency symlink; the authoritative
post-integration `npm run check` from the real main checkout passed typecheck,
lint, the same 169 tests, and dev/production/local builds plus deployment dry
runs. Local HTTP smoke checks returned health/database OK, protected anonymous
locale/company/member responses, JSON API 404 and login HTML as expected. The
local D1 was backed up before migration `0006` applied successfully. No remote
database, push or deployment was used. The integration worktree and temporary
branch were removed only after these checks.

## 2026-09-03: Authorized worktree commits

At the user's explicit request, saved the non-specification changes on
`codex/multilingual-platform` in three ordered commits:

| Commit | Scope |
| --- | --- |
| `1bef46f` | Company selection, active memberships, scoped administrator permissions, migration `0005` and the related lint/test fixes |
| `09408f5` | Extensible personal/company localization, translated UI/email, migration `0006` and localization tests |
| `c6c9bbf` | README and CLAUDE access/localization guides and command descriptions |

The first commit was staged from the saved pre-localization source plus its
related fixes, without replacing worktree files. An isolated export of that
staged snapshot passed typecheck, lint, 95 Workers tests and 18 environment tests.
The final source then passed `npm run check` again: 119 Workers tests, 18
environment tests, two i18n checks, typecheck, lint and all three build/deployment
dry runs. The documentation check found 63 valid local links before this record
was extended; staged whitespace checks passed.

Only `PROJECT_SPEC.md` and `specs/` remain untracked, intentionally excluded from
all three commits. Local secrets, runtime fixtures and build outputs were not
committed. No main-checkout source files, remote branches or cloud resources were
changed; no push, merge, deployment or remote migration was performed.

## 2026-09-03: Extensible localization in an isolated worktree

Implemented the shared language registry and complete initial English/Spanish
catalogs, personal/company preferences, translated application copy and
transactional emails. Updated the same ten module specifications, README and
CLAUDE; no second specification hierarchy was introduced.

Work took place in `/Users/admin/.codex/worktrees/e0b5/saas_template`, based on
`f3c4228`, with the existing uncommitted company-selection, membership-status,
restricted-admin and permission changes preserved. Those inherited changes,
including migration `0005`, are not new localization work. The main checkout was
not modified. No changes were staged or committed; specifications remain
uncommitted.

Baseline checks found one inherited lint failure in automatic company activation
and one outdated permission assertion (94 of 95 Workers tests passed). The effect
now coalesces the asynchronous activation request without synchronously setting
state. The test now first verifies denial without `canAppointAdmins`, then grants
that permission in its fixture. Backend authorization was not relaxed.

| Check | Observed result |
| --- | --- |
| `npm ci` | Installed the locked dependency set; no dependency versions or lockfile changed |
| `npm run db:generate` | Generated nullable `user.locale` migration `0006_lively_starbolt.sql`; final rerun reported no schema changes |
| `npm run db:migrate:local` | All seven generated migrations applied to the fresh worktree-local D1; no remote database accessed |
| `npm run typecheck` and `npm run lint` | Passed |
| Workers-runtime tests | 119 passed across 9 files, including 24 localization tests and all 95 existing tests |
| `npm run test:environments` | All 18 Node tests passed |
| `npm run test:i18n` | Both Node checks passed: application JSX copy/accessibility labels and shared-module environment boundaries |
| `npm run check` | Passed: types, lint, all 139 tests, and dev/production/local builds with deployment dry runs |
| `npm audit` and `npm audit --omit=dev` | Both reported zero vulnerabilities; no forced upgrades |
| `npm run cf-typegen` | Not needed: no Worker binding or Wrangler configuration changes |
| Documentation | Unified ten-module index retained; local Markdown links and `git diff --check` passed |

Automated localization coverage includes:

- Complete catalog keys and named-placeholder parity; locale normalization,
  unsupported values, prototype keys, public hints and personal/company/default
  precedence. Regional values can fall back to a registered parent language.
- Personal persistence across sign-ins; company changes and cleared overrides;
  active membership checks; owner/admin permissions, including branch-scoped
  admins; member, inactive, anonymous and platform-only denials.
- Strict locale request bodies, same-origin protection, disabled native auth
  mutation bypasses, stale UI context rejection and the company-save
  `X-Company-Context` concurrency precondition.
- Recipient-first email language, guarded company context, ambiguous multiple
  memberships, translated subjects/text/HTML, HTML escaping and preserved token
  and callback flags. Public reset responses remain non-enumerating.
- Company locale validation before provisioning, retries that preserve an
  existing company's language, guarded resend context and actual Better Auth
  setup-link activation carrying the language hint.

### Local browser review

Used the Browser skill against the local development server with fictional
`.invalid` users and two local test companies. No real customer accounts, real
email delivery or remote resources were used. Existing synthetic credentials
were used only to sign in; password setup is covered by Workers tests rather
than browser-entered credential changes.

Observed successful flows:

- The public language selector changes the sign-in page and an already-visible
  safe authentication error between English and Spanish.
- Company selection respects separate workspaces; automatic language follows
  the selected company. A personal English preference overrides a Spanish
  company, survives reload and remains personal when switching companies.
- Saving the company language updates the interface and its confirmation;
  clearing the personal override restores company inheritance. The normal
  company-save flow works with its context precondition.
- Settings, navigation, member directory, role labels and member forms display
  translated copy. Stored company/person names and the `Main` branch name remain
  unchanged. A draft member name and selected role remain present when changing
  language.
- At a 390-by-844 viewport, the Spanish settings page is readable, controls fit,
  and document/viewport widths both measure 390 pixels. The document reports
  `lang="es"` and `dir="ltr"`. The viewport override was reset after review.

Limits: English and Spanish are the only installed catalogs in this delivery,
not an architectural limit. Other languages, RTL layouts, complex domain plurals
and automatic translation of user content have not been validated. Browser-owned
validation/password-manager messages remain in the browser's language. Real
email delivery and configured dev/production resources still need release
verification; builds and deployment dry runs are not deployments.

The browser test session was signed out and its tab and local server closed.
Local-only test fixtures and runtime files are ignored by Git. Apply pending
migrations, including `0006`, before running this version against another
database. No commit, push, merge, deployment or remote migration was performed.

## 2026-09-03: Membership permissions, scope, status and company selection

Implemented the four approved changes: Owner-controlled admin appointment,
all/selected administrative Branch scope, company-only deactivation/reactivation,
and one/many/zero active-company selection. No second identity model, ownership
transfer, generic permission engine or billing feature was introduced.

| Check | Observed result |
| --- | --- |
| `npm run db:generate` | Generated additive 0005 and Drizzle metadata; final repeat reports no schema changes |
| `npm exec -- drizzle-kit check` | Passed; migration metadata consistent |
| `npm run db:migrate:local` | Applied only 0005 to the existing local D1; no destructive SQL or remote database access |
| Isolated QA D1 | All six actual migrations applied; only fictional `.invalid` identities, separate temporary state |
| `npm run check` | Passed: typecheck, lint, 18 environment tests, 124 application tests across 9 files, dev/production/local build and deployment dry runs |
| Final typecheck/lint | Passed after UI-copy and documentation review |
| Documentation | Single ten-module structure preserved; 69 local links and 106 source references checked with no missing targets |
| `git diff --check` | Passed |
| Existing environment/dependency work | `package.json`, lockfile, Wrangler, environment scripts, Vite/Vitest config and generated binding types unchanged |

The 29 new tests in `test/access-controls.test.ts` cover default appointment
denial, Owner grant/revoke, no self/onward delegation, no peer edit or repeat-POST
bypass, scoped provisioning/promotion, redacted shared employees, future Branches,
native Team restrictions, stale sessions, one-company-only deactivation,
reactivation, identity/other-company preservation and company-choice rules.
The existing member-creation test now uses Owner authority to create an admin.
All automated emails are mocked; no real email was sent.

### Browser checks for the access changes

The optimized local frontend was served with an isolated temporary Worker/D1
at `http://localhost:5187`, not the normal local database. Observed:

- Single-company Owner sign-in enters directly and displays a company label,
  with no unnecessary company selector.
- Owner directory displays active status, scope and appointment flag; Owner
  entry has no edit/deactivation controls.
- Owner edit form exposes all/selected Branch scope, nonempty Branch selection
  and the default-unchecked admin-appointment checkbox with explanatory text.
- A user with two existing active memberships sees an explicit company chooser
  after sign-in. Choosing company B shows its own Branch; switching to company A
  replaces that context and keeps ordinary-member navigation restrictions.
- An already-limited admin sees only North and has no create-Branch form. The
  Member directory hides unrestricted administrators and shows the shared
  employee read-only without exposing South. Add-member offers only the Member
  role, only North, and no appointment checkbox when delegation is disabled.
- The deactivation confirmation names the person and company and explains that
  identity, history and other companies are preserved. It was cancelled without
  submitting. The limited-admin form was also visually reviewed at the browser's
  default viewport; no new mobile/zoom or exhaustive accessibility check is claimed.

Saving permissions through the browser was paused by the safety approval check;
the unsaved form was cancelled. Manual permission-save and deactivate/reactivate
submissions require explicit approval for the fictional target accounts. Their
server behavior is covered by the automated suite, not claimed as completed
browser checks. No browser credential creation or password changes were performed.
The owned QA tab and temporary Worker were closed after review. Fictional QA
fixtures/state remain in temporary storage outside the repository, available for
an approved follow-up; no fixture was installed in the normal application database.

### Upgrade and release limits

Existing memberships stay active and existing admins keep all-Branch scope.
Appointment permission defaults to false and needs an explicit Owner grant.
Apply 0005 before starting this code in each environment. Never roll back to code
that ignores inactive memberships or limited-admin scope after relying on those
controls without a separate security/recovery plan.

Deactivation is checked on the next server request. Already-rendered content may
remain until focus/visibility refresh or the visible 30-second poll. Access edits
remain ordered, non-transactional operations; interrupted/conflicting changes
can require an Owner to reload and reconcile saved scope. Reactivation restores
saved permissions, so changed responsibilities require a scope review.

No dependency change or new dependency audit, commit, push, remote migration,
Cloudflare resource change or deployment was part of this task. The earlier
dated audit evidence below is not a new audit result.

## 2026-09-03: Local, dev and production environments

Implemented separate target configuration, guarded environment commands,
environment-specific build-only examples, regenerated binding types and updated
the existing unified module documentation. No business logic, dependency version,
lockfile or generated SQL migration changed. Existing local `.dev.vars` and the
top-level D1 identity were preserved.

| Check | Observed result |
| --- | --- |
| `npm run cf-typegen` | Passed; generated local, DevEnv and ProductionEnv binding types; final header uses a portable relative config path |
| `npm run test:environments` | 18 Node tests passed: target isolation, command selection, placeholder/resource guards, allowlist, build verification and extra-argument rejection |
| Workers-runtime tests within `npm run check` | All 95 existing tests passed across 8 files; real Drizzle migrations, local D1, mocked email |
| `npm run check` | Passed: typecheck, lint, Node/Workers tests, and dev/production/local builds plus deployment dry runs |
| Generated dev configuration | Verified `saas-template-dev`, `saas-template-dev-db`, dev custom-domain example and restricted Email binding |
| Generated production configuration | Verified `saas-template-production`, `saas-template-production-db`, separate custom-domain example and unrestricted production Email binding |
| Generated local configuration | Verified original `saas-template` and `saas-template-db`, no public routes, simulated local bindings |
| `CLOUDFLARE_ENV=production npm run db:migrate:local` | Selected local D1 explicitly; reported no migrations to apply; no remote database used |
| Local dev HTTP smoke check | `/api/health` returned 200 with database ok; anonymous `/api/members` returned 401; unknown API returned 404; `/login` returned HTML 200 |
| Optimized local preview HTTP smoke check | Same health, anonymous protection, unknown API and login responses passed |
| Local dev environment override | Starting with inherited production selection still chose local; localhost and port 5173 are pinned to the local auth URL |
| Documentation | Unified ten-module structure retained; local links, source references, command names and whitespace checked |

The environment tests use in-memory configuration fixtures and do not invoke
real deployment or migration. The quality gate permits resource placeholders so
the generic template can be checked without provisioning Cloudflare resources.
Actual remote commands refuse those placeholders. Generated build validation
checks Worker/environment, DB, routes and Email policy before Wrangler proceeds.

Limits: custom domains and remote D1 UUIDs are still examples; no Cloudflare
resources, DNS, Access policies or remote secrets were created/configured. No
remote migrations, real emails, deployment, commit or push were performed.
The actual dev email allowlist/production delivery behavior still needs a real
release check after setup. No new browser interaction/accessibility review or
dependency audit was performed in this environment-configuration task; the
earlier dated results below are not new claims. All test servers were stopped.

## Original verification scope

Verification date: 2026-09-02. Scope: Starter v1 behavior and dependency-security
remediation. Documentation was consolidated earlier on 2026-09-03 without code
changes or a new runtime test run in that consolidation step. Existing Branch
work was preserved. The functional code and guides were subsequently saved in
the five commits listed below.

## Command results

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed, including Worker, React, tooling and tests |
| `npm run lint` | Passed |
| `npm test` | 95 tests passed across 8 files |
| `npm run build` | Production Worker and React assets built |
| `npm run check` | Passed: typecheck, lint, tests, build and Wrangler deploy dry run |
| `git diff --check` | Passed |
| `npm run db:generate` | Generated 0004 during feature work; after the dependency fix, reported no schema changes and created no additional migration |
| `npm run db:migrate:local` | Applied 0004 successfully without deleting data |
| Isolated QA D1 migrations | All five generated migrations applied successfully |
| Exact dependency/lock comparison | Every direct package has an exact version matching the lockfile; Better Auth remains 1.7.2 |
| `npm run cf-typegen` | Not needed: no Wrangler binding/configuration changes |
| Production deployment | Not performed; dry run only |

The gate was repeated as coverage expanded across Branches, directory,
provisioning, access editing and HTTP protection. Final counts above supersede
earlier implementation snapshots.

## Automated acceptance evidence

| Area | Evidence |
| --- | --- |
| Branch closeout | `branches.test.ts`: role-aware lists, create/rename permissions, blank-name validation, foreign tenants and stale active Teams |
| Directory | `members.test.ts`: owner/admin reads, minimal payload, assigned/all-Branch distinction, foreign/anonymous/member denials and blocked native read paths |
| Provisioning | `members.test.ts`: normalized/deduplicated creation, concurrent identical requests, existing platform-user reuse across companies, invalid input before identity, email/second-assignment failure and safe retry |
| Activation | `provisioning.test.ts`, `members.test.ts`: unknown-user signup blocked, single-use links, provisional credential revocation, interrupted setup resend, employee password setup once and assigned-only access |
| Access editing | `members.test.ts`: immutable Owners, admin target restrictions, foreign membership/Branch denial, promotion/demotion, exact repeated scope, removal denial with a stale session and interrupted reconciliation |
| Platform | `provisioning.test.ts`, `hardening.test.ts`: platform-vs-tenant scope, first-admin bootstrap without password, company/Owner/Main creation, existing identity preservation, retries and same-name company collisions |
| HTTP/release | `hardening.test.ts`: malformed/non-object JSON, body limit, cross-origin/content-type rejection, non-caching, disabled invitation operations and escaped email HTML |
| Prior guarantees | Existing tenant isolation, Organization switching, return-path and slug suites retained |

Tests run against the actual Drizzle migrations in the Cloudflare Workers test
runtime. Email is mocked; no real recipient receives test mail. Deliberate failure
tests inject local D1 or email errors to prove retry behavior.

## Browser review

The production frontend was served by a local `wrangler dev` Worker using a
separate temporary D1 and fictional `.invalid` accounts. Browser testing did not
use or modify real customer identities. Existing test credentials were used for
login; choosing new credentials/activation is covered by Workers integration
tests rather than browser-entered password changes.

Observed successful flows:

- Owner with one Branch sees a plain label; adding a second reveals a selector.
- Branch creation and rename refresh the list and selector.
- Switching companies replaces both Branch context and Member directory.
- Owner directory distinguishes owner/admin all-Branch access, member scope and
  exceptional unassigned members; Owner rows have no edit action.
- Admin directory exposes edit actions only for members, not Owners or admins.
- Add member requires at least one Branch; new account success reports setup
  email and shows pending setup/resend controls.
- Editing member assignments saves the exact new Branch scope and refreshes the
  directory. Save and sign-in submission work with the keyboard.
- Member login shows only its newly assigned Branch, with no Members/Branches
  management links; direct management URLs redirect safely to the dashboard.
- An unassigned member reaches the no-Branch access screen without creation UI.
- Interrupting the isolated Worker during Branch submission shows a recoverable
  error and re-enables submission; it does not show an empty/no-access list or
  create the attempted Branch. Restarting the Worker restores normal operation.
- 390 px mobile and 320 px narrow/reflow layouts have no horizontal overflow;
  forms, readable Member cards and company switching remain usable.
- Opening Add member focuses the Name field; Settings renders the real workspace
  summary with explicit extension-point copy. Narrow CSS-viewport checks cover
  reflow; native browser zoom was not changed.

The temporary QA Worker and browser tab were closed after review. Only the
agent-created seed scripts were removed; existing local application data was
preserved. The isolated QA database remains outside the repository in temporary
storage, and no test fixture is part of the application seed/migrations.

## Dependency security remediation

The initial full audit reported five moderate warnings: four affected entries
in the Drizzle Kit/esbuild chain and one qs entry. The production-only audit
reported four because Better Auth lists Drizzle Kit as an optional peer.
Those findings are now fixed, not accepted or hidden.

| Check after remediation | Result |
| --- | --- |
| `npm audit --json` | 0 vulnerabilities at every severity; exit 0 |
| `npm audit --omit=dev --json` | 0 vulnerabilities at every severity; exit 0 |
| Clean `npm ci` in an isolated temporary directory | Passed, reproduced the unchanged lockfile and patched versions; 0 audit findings |
| `npm ls esbuild qs --all` | Legacy loader resolves esbuild 0.25.12; Express/body-parser resolve qs 6.16.0; other esbuild versions unchanged |
| Node smoke checks for `@esbuild-kit/core-utils` | CommonJS and ESM TypeScript transforms, module imports and source maps passed; native transforms also passed after the clean install |
| Node smoke checks for qs | Bracket/comma array overflow rejected, hostile constructor parse/stringify did not throw, ordinary parsing preserved |
| `npm run db:generate` | No schema changes, nothing to migrate |
| `npm exec -- drizzle-kit check` | Migration metadata check passed |
| `npm exec -- shadcn --help` | CLI startup/help passed without changing components |
| `npm run check` | Passed again after remediation: all 95 Workers tests, typecheck, lint, production build and deployment dry run |
| Direct-version and lock-diff assertions | All direct versions unchanged and exact; only qs and the nested esbuild/native-binary entries changed |

### Changes and rationale

- Updated `qs` 6.15.3 to 6.16.0 in the lockfile using `npm update qs`. Both of
  its parents already allow this version, so no qs override was needed. This
  fixes [the bracket/comma array-limit bypass](https://github.com/ljharb/qs/security/advisories/GHSA-x5fp-wj9c-mxmx)
  and [the unsafe isBuffer invocation](https://github.com/ljharb/qs/security/advisories/GHSA-4mjr-xmp4-gh2g).
- Added a [version-scoped npm override](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides)
  for `@esbuild-kit/core-utils@3.3.2 -> esbuild` 0.25.12, replacing 0.18.20.
  The [esbuild development-server advisory](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99)
  is patched from 0.25.0. Drizzle Kit 0.31.10 already uses 0.25.12 for its own
  esbuild, but its legacy loader still pins the vulnerable line. This is why
  the override is narrow and its transform compatibility was tested explicitly.
- No direct dependency was upgraded or downgraded. React, Vite, TypeScript,
  ESLint, Better Auth, Drizzle Kit and shadcn retain their exact versions.
  No `npm audit fix --force`, advisory suppression or production deployment
  was used. In particular, npm's suggested Drizzle Kit downgrade to 0.18.1
  was not applied.

The clean install still prints deprecation notices for the two legacy
`@esbuild-kit` packages and ESLint 9. These are upstream maintenance notices,
not remaining npm security findings. Replacing their parent toolchain belongs
to a separate version-scoped upgrade; removing a deprecation notice alone does
not justify crossing the project's major-version policy.

Keep the override until an upstream update resolves a patched esbuild without
it, then repeat the compatibility checks and both audits before removing it.
The [maintenance specification](09-testing-and-operations.md#dependency-maintenance)
documents the verification commands. Audit results are dated known-advisory
evidence, not a guarantee that future advisories cannot appear.

## Template safety

- `wrangler.json` retains `REPLACE_WITH_REAL_D1_DATABASE_ID` and required external
  `BETTER_AUTH_SECRET`, `APP_URL` and `EMAIL_FROM` values.
- `.dev.vars`, `.wrangler` and `dist` are ignored and absent from tracked files.
  Vite may copy local vars into the ignored Worker build directory; do not share
  that directory or treat it as a public artifact. Only `dist/client` is served.
- Only `src/worker/email/index.ts` accesses the Email binding, and only
  `src/worker/db/index.ts` constructs Drizzle.
- Schema remains Better Auth tables plus technical `system_check`; 0004 adds an
  index, not a business table or a custom role model.
- Invitation placeholder page was removed; its tracked prior version remains
  recoverable through Git history. Future invitation primitives remain tested.
- No real D1, email domain, API secret, test database, recipient or generated
  runtime/build artifact was added to tracked source.

## Completion boundary

All current Starter v1 modules are implemented. Settings editing, invitation
acceptance, deletion/ownership lifecycle, billing, business features and new
infrastructure remain explicitly outside v1. Ordered Better Auth writes are
retryable operations, not a global transaction/versioned concurrent editor.

## Repository baseline

The functional code and guides were committed on 2026-09-02:

| Commit | Scope |
| --- | --- |
| `f895abf` | Unique Organization memberships and generated migration |
| `4af2e57` | Guarded tenant Member management, API hardening and tests |
| `96e8c45` | Branch and Member interfaces, navigation and error recovery |
| `af78428` | esbuild and qs dependency-security fixes |
| `0b3fc5c` | Updated project guides |

The 2026-09-03 documentation consolidation moved behavior and acceptance criteria
into the [single module index](README.md), shortened the project overview and
updated supporting guides. The former duplicate documents were removed after
their useful contracts were integrated. Only documentation changed; runtime
checks above remain the original dated evidence.

Documentation checks on 2026-09-03 passed: ten consecutively numbered modules
in one directory, 60 valid local links (including heading targets), 97 valid
source-path references, no links to removed documents, and `git diff --check`.
At that consolidation checkpoint, the staging area was empty and changed files
were documentation only; no runtime code,
dependency, migration or generated binding file changed during consolidation.

At that checkpoint, the unified specifications and subsequent environment changes
were uncommitted. Refer to the latest dated entry above and `git status` for the
current local changes. Review and commit only when authorized, then configure the
first cloned SaaS's resources and business domain. Real Cloudflare setup, email
delivery and production deployment require their own explicit release task.
No push or production deployment was performed by this work.
