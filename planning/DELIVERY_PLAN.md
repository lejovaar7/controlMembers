# ControlMembers MVP Delivery Plan

[Delivery planning](README.md) · [User stories](USER_STORIES.md)

Milestones are vertical, testable increments. They are not deadlines. A
milestone is complete only when its schema, authorization, API, UI,
internationalization, tests and documentation agree.

## Definition of ready

A story is ready when:

- its responsible specification is approved;
- required product decisions are settled;
- data and permission invariants are explicit;
- empty/error/concurrency cases are known;
- no missing external credential is required for local implementation.

## Definition of done

- Behavior matches the canonical specification and story acceptance criteria.
- Database changes use generated, inspected Drizzle migrations.
- Server tests cover success, validation, role, Branch and tenant isolation.
- UI covers loading, empty, error, pending and success states.
- English and Spanish catalogs are complete.
- Typecheck, lint, all tests and environment dry-runs pass.
- Relevant manual responsive/keyboard checks are recorded.
- No remote migration, deploy or real message occurs without explicit authority.

## Milestone 0 — Product conversion

Stories: CM-001, CM-002.

Deliverables:

- ControlMembers repository identity and safe remotes;
- product/specification/planning documentation;
- neutral product shell language and navigation plan;
- unchanged inherited security behavior;
- clean baseline quality-gate record.

Exit: repository can accept domain code without contradicting template-only
instructions, and the source template remains untouched.

## Milestone 1 — Organization billing setup

**Status:** In progress. Settings, Programs, Program-Branch availability and
monthly Plans are implemented across persistence, API, UI and automated tests.
Editing/deactivation UX and the final responsive usability pass remain before
the milestone exit is claimed.

Stories: CM-010, CM-011, CM-012.

Deliverables:

- currency/timezone settings;
- Program and Program-Branch persistence;
- monthly Plans;
- scoped management APIs and pages;
- migrations and isolation tests.

Exit: an Owner can configure one Branch, Program and Plan entirely through UI.

## Milestone 2 — Member registry

Stories: CM-020, CM-021, CM-022, CM-023.

Deliverables:

- customer Member, Contact and relationship schema;
- scoped search/list/detail/write APIs;
- responsive Member list/profile/forms;
- duplicate warnings and status lifecycle;
- privacy and cross-Branch tests.

Exit: staff can register a Member with payer Contact and find the record from a
mobile viewport without creating an auth account.

## Milestone 3 — Enrollment and monthly Charges

Stories: CM-030, CM-031, CM-032, CM-033, CM-034.

Deliverables:

- Enrollment and Charge schema;
- price snapshots and due-date rules;
- idempotent period generation and preview;
- receivables list/detail;
- adjustment/void audit path.

Exit: an Organization can generate one month twice without duplicates and see
accurate pending/overdue states.

## Milestone 4 — Payment ledger

Stories: CM-040, CM-041, CM-042, CM-043.

Deliverables:

- Payment, Allocation and idempotency persistence;
- full/partial/multi-Charge posting;
- Member credit and reconciled balances;
- payment history/receipt and reversal;
- concurrency, audit and financial invariant tests.

Exit: expected, allocated, outstanding and cash collected reconcile through
posting and reversal scenarios.

## Milestone 5 — Decision dashboard

Stories: CM-050, CM-051.

Deliverables:

- period/Branch filters;
- expected, collected, outstanding and overdue cards;
- aging and Member balance reports;
- drill-through links and scope disclosures;
- aggregate correctness/performance tests.

Exit: an Owner can identify overdue accounts and reconcile every summary number
to operational records.

## Milestone 6 — Onboarding and export

Stories: CM-052, CM-060.

Deliverables:

- versioned Member CSV template;
- no-write preview and idempotent confirmation;
- scoped operational exports;
- formula-injection protections and audit events.

Exit: a pilot can onboard existing Members without direct database edits and
export receivables without leaking another Branch.

## Milestone 7 — MVP release candidate

Stories: CM-061, CM-062.

Deliverables:

- end-to-end fictional academy walkthrough;
- responsive, keyboard and bilingual acceptance;
- dependency/security review proportional to release;
- dev resource and real-email verification;
- migration/deployment runbook and recovery notes.

Exit: the same tested revision is explicitly approved before any production
migration or deployment.

## Post-MVP sequence

1. Validate collection behavior with real operators.
2. Specify reminder rules and consent jurisdiction.
3. Add Queue/Cron and provider-neutral notifications.
4. Integrate WhatsApp only after templates and webhook security are defined.
5. Consider online payments after ledger reconciliation is stable.
