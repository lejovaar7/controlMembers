# SaaS Starter Specifications

This is the single specification structure for the project: one document per
module, combining behavior, rules, source references and acceptance checks.
Numbers are a reading order, not delivery phases or a list of unfinished tasks.

Starter v1 is implemented. The [verification record](VERIFICATION.md) contains
dated test results and release limitations; it is evidence, not another feature
specification. Production deployment remains a separate operation.

## Modules

| Module | What it explains | Main source area |
| --- | --- | --- |
| [00 — Product and Architecture](00-product-and-architecture.md) | Product model, stack, application boundaries and what belongs to a cloned SaaS. | `package.json`, `wrangler.json`, `vite.config.ts`, `tsconfig*.json` |
| [01 — Database and Migrations](01-database-and-migrations.md) | Shared D1, Drizzle schemas, generated migrations and membership uniqueness. | `src/worker/db/`, `drizzle/`, `drizzle.config.ts` |
| [02 — Authentication and Email](02-authentication-and-email.md) | Sign-in, verification, password recovery, first-account setup and email delivery. | `src/worker/auth/`, `src/worker/email/`, auth pages |
| [03 — Platform Provisioning](03-platform-provisioning.md) | Operator bootstrap and creation of a company, Owner and Main Branch. | `src/worker/platform/`, platform and setup routes/pages |
| [04 — Tenant and Branch Security](04-tenant-and-branch-security.md) | Company membership, active context, Branch access and isolation rules. | `src/worker/tenant/index.ts`, `src/worker/tenant/branch.ts` |
| [05 — Frontend Application](05-frontend-application.md) | Routes, layouts, switching, language settings, extensible catalogs and accessibility. | `src/react-app/`, `src/shared/i18n/` |
| [06 — Branch Management](06-branch-management.md) | Branch visibility, creation, renaming, selection and no-access states. | Branch pages/switcher, `use-branches.ts`, `test/branches.test.ts` |
| [07 — Member Management](07-member-management.md) | Directory, identity reuse, setup, Owner delegation, all/selected Branches and company-only deactivation/reactivation. | `src/worker/tenant/members.ts`, Member UI, `test/members.test.ts`, `test/access-controls.test.ts` |
| [08 — HTTP and Release Boundaries](08-http-and-release-boundaries.md) | Request validation, disabled bypass routes, safe errors and template protections. | `src/worker/http.ts`, `src/worker/auth/http-policy.ts`, `test/hardening.test.ts` |
| [09 — Testing and Operations](09-testing-and-operations.md) | Local/dev/production, guarded commands, test coverage, dependency maintenance and releases. | `wrangler.json`, `scripts/`, `vitest.config.ts`, `test/`, package scripts, generated binding types |

## How to review the product

Start with module 00 for the overall model. Review modules 03, 04, 06 and 07
for who can create companies, manage people and access Branches. Review module
05 for the screens and module 09 for validation and production preparation.

Inside each module, acceptance checks describe what must remain true after a
change. They are not claims that every possible test was performed: actual
observations, counts and limitations belong to [VERIFICATION.md](VERIFICATION.md).

## Scope boundaries

The starter is closed B2B, with generic `owner`, `admin` and `member` roles.
It does not implement public signup, self-service company onboarding, invitation
acceptance, deletion/ownership transfer, Settings beyond language, billing or domain
features. Deferred infrastructure constraints are kept in
[module 00](00-product-and-architecture.md#deferred-extension-constraints);
they do not authorize implementation.

## Documentation responsibilities

- This index and the numbered modules are the canonical feature contracts.
- [Project overview](../PROJECT_SPEC.md) is a short introduction pointing here.
- [Operator guide](../README.md) owns setup and day-to-day commands.
- [Agent guidance](../CLAUDE.md) owns coding and repository conventions.
- [Verification record](VERIFICATION.md) owns dated execution evidence.

When behavior changes, update the responsible module and its acceptance checks,
then the operator guide or verification record when affected. Extend this
structure for a genuinely new module; do not create a second set of specs for
the same functionality. Keep source keys and documentation in English; localized
catalog values are the explicit exception. Language behavior belongs to module
05, email resolution to 02, persistence to 01 and provisioning to 03.

## Next work

The language implementation, company/access work, final access-boundary fixes
and supporting guides are integrated into `main`; see the
[verification record](VERIFICATION.md) for commit IDs and checks. No push or
deployment was performed. Specifications and
`PROJECT_SPEC.md` intentionally remain uncommitted; a Git clone will not include
these untracked files.

To build the first real SaaS, define its business domain and follow
[Creating a real SaaS](09-testing-and-operations.md#creating-a-real-saas).
