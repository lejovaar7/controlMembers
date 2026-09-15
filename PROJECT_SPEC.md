# ControlMembers: Project Overview

ControlMembers is a closed B2B SaaS for organizations that manage recurring
member fees. It targets sports, music, martial arts, swimming, dance, language
and similar academies while keeping its core domain independent from any one
discipline.

The project was cloned from the SaaS foundation and preserves its implemented
identity, Organization, Branch, Team access, email, localization, database and
environment boundaries. The ControlMembers business modules are specified but
only partially implemented: billing settings, Programs, Program-Branch
availability and monthly Plans are the first verified product slice.

## Product model

- An Organization is one customer/tenant and a Branch is one location.
- Authenticated owners, administrators and employees are the **Team**.
- A customer-facing **Member** receives the service and is not an authenticated
  Better Auth member by default.
- Programs describe activities; Plans describe monthly price/due-day defaults.
- Enrollments connect a Member, Program, Branch and Plan.
- Charges are immutable monthly receivable snapshots.
- Payments are posted to a ledger and allocated to one or more Charges.
- Dashboard and reports derive from the same ledger formulas.
- WhatsApp reminders and online payments are post-MVP extensions.

## Documentation map

- [Product brief](PRODUCT_BRIEF.md): concise product identity.
- [Specifications](specs/README.md): canonical behavior, rules and acceptance
  checks. Modules 00–09 are the implemented foundation; 10–19 define the target
  ControlMembers MVP and future notification boundary.
- [Delivery planning](planning/README.md): prioritized user stories, milestones
  and product decisions. Planning never overrides a specification.
- [Operator guide](README.md): setup, commands and environment operation.
- [Agent guidance](CLAUDE.md): repository rules for implementation.
- [Verification record](specs/VERIFICATION.md): dated evidence, not planned claims.

## MVP release outcome

An authorized Team member can configure Programs and Plans, register Members and
responsible Contacts, create Enrollments, generate monthly Charges, record and
reverse Payments, and identify overdue balances within their Branch scope. An
Owner can reconcile expected, collected and outstanding values for a period.

The MVP excludes public signup, Member portals, online gateways, automated
messages, attendance, scheduling, tax invoicing and general accounting.

## Current status

The inherited SaaS foundation is implemented and verified. Product documentation
and delivery planning are established in this clone. Billing setup is implemented
across persistence, guarded APIs, bilingual UI and tests. Customer-facing Members,
Enrollments, Charges, Payments and reporting remain planned and must not be
described as implemented until verification evidence exists.
