# ControlMembers Specifications

This is the single canonical specification structure for ControlMembers. Each
numbered module owns its behavior, rules, boundaries and acceptance checks.
Numbers are reading order, not delivery phases. Implementation status is stated
inside each product module; actual evidence belongs in
[`VERIFICATION.md`](VERIFICATION.md).

## Implemented SaaS foundation

| Module | Responsibility | Main source area |
| --- | --- | --- |
| [00 — Product and Architecture](00-product-and-architecture.md) | Product topology, stack and platform boundaries. | config and application entry points |
| [01 — Database and Migrations](01-database-and-migrations.md) | D1, Drizzle schemas and generated migrations. | `src/worker/db/`, `drizzle/` |
| [02 — Authentication and Email](02-authentication-and-email.md) | Sign-in, verification, recovery, setup and email. | auth/email modules and pages |
| [03 — Platform Provisioning](03-platform-provisioning.md) | Platform bootstrap and Organization/Owner/Main creation. | platform/setup modules |
| [04 — Tenant and Branch Security](04-tenant-and-branch-security.md) | Active tenant, Branch scope and isolation. | tenant modules |
| [05 — Frontend Application](05-frontend-application.md) | Routes, layouts, localization and accessibility foundation. | React app and shared i18n |
| [06 — Branch Management](06-branch-management.md) | Branch visibility and administration. | Branch UI/API tests |
| [07 — Team Access Management](07-member-management.md) | Authenticated employee provisioning, roles and Branch scope. | existing Member/Team access modules |
| [08 — HTTP and Release Boundaries](08-http-and-release-boundaries.md) | Safe request/response and release boundaries. | HTTP/auth policy |
| [09 — Testing and Operations](09-testing-and-operations.md) | Environments, quality gate and release operation. | scripts, tests and config |

Specification 07 retains its historical filename and Better Auth persistence
terminology. In ControlMembers product copy, those authenticated people are the
**Team**; “Member” refers to the customer record in specification 11.

## ControlMembers MVP contracts

| Module | Responsibility | Status |
| --- | --- | --- |
| [10 — Product and MVP](10-controlmembers-product.md) | Outcomes, scope, terminology and primary journeys. | Target MVP |
| [11 — Members and Contacts](11-customer-members-and-contacts.md) | Customer records, responsible payers and lifecycle. | Target MVP |
| [12 — Programs, Plans and Enrollments](12-programs-plans-and-enrollments.md) | Offered activities and commercial terms. | Target MVP |
| [13 — Charges and Billing Cycles](13-charges-and-billing-cycles.md) | Monthly generation, due dates, states and adjustments. | Target MVP |
| [14 — Payments and Ledger](14-payments-and-ledger.md) | Payments, allocations, credit and reversals. | Target MVP |
| [15 — Dashboard and Reports](15-dashboard-and-reports.md) | Reconciled metrics, aging and exports. | Target MVP |
| [16 — Domain Permissions and Audit](16-domain-permissions-and-audit.md) | Business capabilities and append-only evidence. | Target MVP |
| [17 — Product Frontend and Design](17-product-frontend-and-design.md) | Navigation, shadcn-based design and responsive UX. | Target MVP |
| [18 — Notification Boundary](18-notifications-boundary.md) | Safe future WhatsApp/message architecture. | Post-MVP boundary |
| [19 — Import, Export and Privacy](19-import-export-and-privacy.md) | Member onboarding, operational exports and data care. | Target MVP |

## Reading paths

- Product and design: 10, 17.
- Data and financial behavior: 11–15.
- Security and isolation: 04, 08, 16.
- Implementation/release: 01, 05, 09 and
  [`../planning/DELIVERY_PLAN.md`](../planning/DELIVERY_PLAN.md).
- Future WhatsApp work: 18 only after the MVP ledger is stable.

## Documentation responsibilities

- These numbered modules are authoritative product contracts.
- [`../PROJECT_SPEC.md`](../PROJECT_SPEC.md) is the concise overview.
- [`../planning/`](../planning/README.md) owns stories, order and open decisions;
  it cannot redefine product behavior.
- [`../README.md`](../README.md) owns operator setup and commands.
- [`../CLAUDE.md`](../CLAUDE.md) owns repository implementation conventions.
- [`VERIFICATION.md`](VERIFICATION.md) records only executed evidence and limits.

When behavior changes, update the responsible module before or with code. Do not
repeat one rule in multiple modules: reference the owner. Cross-cutting domain
features inherit tenant isolation (04), frontend context/localization (05), HTTP
hardening (08) and testing/release requirements (09).
