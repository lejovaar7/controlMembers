# Specification 01: Database and Migrations

[All specifications](README.md)

## Purpose

Cloudflare D1 is the only database and Drizzle is the only SQL access layer.
Organizations within an environment share one D1 database. Local, dev and
production have independent database state; the deployed environments use two
different Cloudflare D1 databases, not the local simulated database.

## Database entry points

`src/worker/db/index.ts` exposes:

- `getDb(env)` — the only place a D1 binding becomes a Drizzle instance.
- `getTenantDb(env, organizationId)` — currently delegates to `getDb()` and
  preserves a future per-tenant database-routing boundary.

The tenant helper does not provide authorization. Its `organizationId` must
come from a validated `TenantContext`.

## Schemas

### Technical schema

`src/worker/db/schema.ts` defines `system_check`, used by `/api/health` to prove
the schema-migration-D1-query path.

### Better Auth schema

`src/worker/db/auth-schema.ts` defines the installed Better Auth `1.7.2` model:

| Table | Application responsibility |
| --- | --- |
| `user` | Identity, platform-admin role and nullable personal language preference |
| `session` | Session plus active Organization and Team |
| `account` | Credential/provider records |
| `verification` | Better Auth verification/reset/Magic Link state |
| `organization` | Company / tenant |
| `member` | User/company relation, role, active status, admin Branch scope and appointment permission |
| `team` | Branch / location |
| `team_member` | Member Branch assignment and active-Team mechanics |
| `invitation` | Better Auth Organization invitation infrastructure |

Organization rows include required `locale` plus optional `timezone` and `currency` fields.
There is no separate tenant, Branch, or Branch-membership custom table.
`user.locale` is a nullable personal override; `organization.locale` is the
explicit company default and cannot be null. Null personal locale means company
inheritance. The shared registry's English `DEFAULT_LOCALE` remains the safe
application fallback.
Timezone/currency remain optional with no hardcoded business default or editor.
Better Auth declares user locale as non-input; only the guarded application
endpoint edits it. No new authentication or preference table is introduced.

Membership has fixed application fields `isActive`, `allBranches` and
`canAppointAdmins`, mirrored in Better Auth's member `additionalFields`.
They are per-company access controls, not identity fields or subscriptions.
`isActive` is not accepted by native input; authorized application routes own
status changes. Scope/delegation enter the server-only `addMember` API only
after application validation; their public bypass paths are disabled.

## Migrations

`drizzle.config.ts` reads both schema files and generates into `drizzle/`.
Wrangler applies that same directory in development, tests, and deployment.

| Migration | Content |
| --- | --- |
| `0000_open_groot.sql` | `system_check` |
| `0001_certain_mysterio.sql` | Better Auth identity, account, session, and verification tables |
| `0002_groovy_namora.sql` | Organizations, members, Teams, team members, invitations, and active session fields |
| `0003_solid_ikaris.sql` | Admin plugin platform role, ban, impersonation fields |
| `0004_big_mentallo.sql` | Unique Organization/user membership index for retry-safe provisioning |
| `0005_safe_thunderbird.sql` | Active memberships, administrator Branch scope and Owner-controlled appointment permission |
| `0006_lively_starbolt.sql` | Nullable `user.locale` for personal language preference |
| `0007_organic_lucky_pierre.sql` | Programs, Program/Branch availability and monthly Billing Plans |
| `0008_third_may_parker.sql` | Normalize existing company languages and require an explicit Organization locale |
| `0009_localize_default_branch.sql` | Localize a legacy single default `Main` Branch without changing custom or multi-Branch data |
| `0010_tranquil_war_machine.sql` | Consolidate Billing Plans and Programs into unified Plans, Branch availability and optional tags while preserving existing catalog data |
| `0011_true_plazm.sql` | Customer Members, Contacts, Enrollments, Charges, Payments, Allocations, imports, audit events and financial membership grants |

Migrations are generated artifacts and the single migration source of truth.
There is no test-only schema and no custom migration runner.

`npm run db:migrate:local`, `npm run db:migrate:dev` and
`npm run db:migrate:production` delegate to Wrangler's migration command using
the `DB` binding, original source config and explicit environment/locality.
They do not infer a target from the last build or a hardcoded database name.
The ambiguous `db:migrate:remote` command intentionally fails. The environment
wrapper only selects/validates the target; Wrangler still owns SQL execution.

Schema changes are tested in local and dev before production. Promoting code or
migrations never copies dev accounts/data into production. Deployment and
migration are separate operations; code rollback does not reverse a migration.

The membership uniqueness constraint and three permission/status columns are
intentional application extensions to the auth-generated schema; preserve them
and matching Better Auth additionalFields on regeneration. If importing an old
database with duplicate memberships, audit those duplicates before applying
0004. The migration fails safely rather than silently deleting user data.

0005 adds columns without deleting or rewriting identity/history. Defaults keep
existing memberships active and existing admins unrestricted by Branch. The
appointment flag defaults to false: after upgrade, only the Owner can appoint
admins until the Owner explicitly delegates it. Ordinary members still require
assignments even though the stored all-Branch column defaults to true. Apply
this migration before running the new code in each environment; deployment does
not apply it automatically. Older code does not enforce these new controls, so
do not roll back to older authorization code after relying on scoped/deactivated
access without a separate security/recovery plan.

## Data ownership rules already enforced by architecture

- Organization is the tenant boundary.
- Deactivation changes the existing `member` row only; it neither deletes the
  account/assignments nor disables memberships in other companies.
- Team belongs to exactly one Organization.
- Team membership assigns a user to a Branch.
- Active Organization and Team are session fields, not custom cookies or
  application tables.
- Optional Organization settings remain generic.
- Language migration adds one nullable column; it preserves all existing users,
  credentials, memberships and company settings. Apply pending migrations before
  running the updated application in each environment.

## Deliberately absent

The implemented product slice contains Plan, Plan/Branch, tag and Plan/tag
tables. Modules 11–16 still specify customer Member, Contact, Enrollment, Charge,
Payment, Allocation and audit persistence to add through generated migrations.
Every tenant-owned table requires Organization and, where applicable, Branch
keys.

## Acceptance checks

- Local development and tests initialize D1 from the same generated migrations.
- Duplicate `(organizationId, userId)` memberships are rejected without silently
  deleting existing records.
- `getTenantDb()` never substitutes for membership/access validation.
- A dependency-only update with an unchanged schema generates no new migration.
- A clone uses its own dev and production databases and secrets. Their D1 names
  and IDs cannot be shared; remote placeholders fail before remote operations.
- Configuring remote UUIDs does not change the original local D1 identity.
  Deliberately changing the local identity requires initializing its new state.
