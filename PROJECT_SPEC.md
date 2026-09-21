# ControlMembers: Project Overview

ControlMembers is a closed B2B SaaS for organizations that manage recurring
member fees. It targets sports, music, martial arts, swimming, dance, language
and similar academies while keeping its core domain independent from any one
discipline.

The project was cloned from the SaaS foundation and preserves its implemented
identity, Organization, Branch, user access, email, localization, database and
environment boundaries. The ControlMembers MVP business modules are implemented
locally on that foundation; remote pilot release still requires explicit
environment configuration and approval.

## Product model

- An Organization is one customer/tenant and a Branch is one location.
- Authenticated owners, administrators and employees are **Users** managed under
  **Users & permissions**.
- A customer-facing **Member** receives the service and is not an authenticated
  Better Auth member by default.
- A Plan describes what the Member receives and its monthly price, usual due day,
  available Branches and optional organizational tags.
- Enrollments connect a Member, Plan and Branch and snapshot agreed terms.
- Charges are immutable monthly receivable snapshots.
- Payments are posted to a ledger and allocated to one or more Charges.
- Dashboard and reports derive from the same ledger formulas.
- Users can review manual WhatsApp reminder drafts and send them in WhatsApp.
  Automated reminders and online payments remain post-MVP extensions.

## Documentation map

- [Product brief](PRODUCT_BRIEF.md): concise product identity.
- [Specifications](specs/README.md): canonical behavior, rules and acceptance
  checks. Modules 00–17 and 19 describe the implemented local MVP; module 18
  documents manual drafts and the future automated notification boundary.
- [Delivery planning](planning/README.md): prioritized user stories, milestones
  and product decisions. Planning never overrides a specification.
- [Operator guide](README.md): setup, commands and environment operation.
- [Agent guidance](CLAUDE.md): repository rules for implementation.
- [Verification record](specs/VERIFICATION.md): dated evidence, not planned claims.

## MVP release outcome

An authorized User can configure Plans and tags, register Members and responsible
Contacts, create Enrollments, generate monthly Charges, record
and reverse Payments, and identify overdue balances within their Branch scope.
An Owner can reconcile expected, collected and outstanding values for a period.

The MVP excludes public signup, Member portals, online gateways, automated
messages, attendance, scheduling, tax invoicing and general accounting.

## Current status

The inherited SaaS foundation and ControlMembers MVP are implemented and
verified locally. This includes billing setup, Plans and tags, Members and shared
Contacts, Enrollments, monthly Charges, Payments and allocations, reversals,
dashboard/reporting, scoped CSV import/export, financial permissions and audit.
No remote migration or deployment is implied by local completion.
