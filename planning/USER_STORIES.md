# ControlMembers MVP User Stories

[Delivery planning](README.md) · [Specifications](../specs/README.md)

Priority uses `P0` for the smallest releasable receivables workflow, `P1` for the
complete MVP and `Later` for explicitly deferred work. Acceptance criteria here
identify delivery slices; canonical rules remain in the linked specification.

## Epic A — Product conversion and foundation

### CM-001 — Establish ControlMembers identity (`P0`)

As a product team, we need the cloned repository to identify itself as
ControlMembers so development and deployment cannot be confused with the source
template.

- Package, page title, Worker and database placeholders use ControlMembers names.
- The template remote is retained as read-only reference; no product `origin` is
  invented without its real repository URL.
- Foundation specs remain applicable and product specs are indexed.
- The full inherited quality gate passes.

### CM-002 — Distinguish Members from Team (`P0`)

As an operator, I want customer records called Members and authenticated staff
called Team so the interface is unambiguous.

- Navigation and copy use Member/Miembro only for customer records.
- Better Auth `member` persistence remains unchanged.
- English and Spanish catalogs remain complete.

## Epic B — Organization billing setup

### CM-010 — Configure financial settings (`P0`)

As an Owner, I want to set Organization currency and timezone so dates and money
are interpreted consistently.

- Only Owner/authorized admin may update supported settings.
- Currency is ISO 4217; timezone is validated IANA.
- Currency becomes immutable after financial data exists.
- Settings are tenant-scoped and bilingual.

### CM-011 — Manage Programs (`P0`)

As an authorized administrator, I want Programs that describe activities without
requiring scheduling features.

- Create, rename, activate/deactivate and assign offered Branches.
- Duplicate active names are rejected within the tenant.
- Inactive Programs remain visible in history.

### CM-012 — Manage monthly Plans (`P0`)

As an authorized administrator, I want reusable monthly Plans so enrollment
terms are consistent.

- Amount uses minor units and Organization currency.
- Due day accepts 1–28.
- Plan may be Organization-wide or Program-specific.
- Editing a Plan does not alter history.

## Epic C — Members and Contacts

### CM-020 — Create and find a Member (`P0`)

As Team staff, I want to register and search a Member so I can manage their
enrollment and balance.

- Name and accessible Branch are required.
- Optional document, birth date, email, phone and notes are validated.
- Duplicate signals warn without silent merging.
- Search and pagination do not leak inaccessible records or counts.

### CM-021 — Maintain Member status (`P0`)

As authorized staff, I want to pause or deactivate a Member without deleting
history.

- Confirmation explains future billing and existing debt behavior.
- Existing Charges and Payments remain unchanged.
- Status filters distinguish active, paused and inactive.

### CM-022 — Manage responsible Contacts (`P1`)

As Team staff, I want to link a payer/guardian to one or more Members so billing
and future communication reaches the right person.

- Contact may be shared across Members in one Organization.
- Relationship, primary and billing flags are explicit.
- Phone normalization and consent are separate fields.
- Scoped actors cannot infer other linked Members.

### CM-023 — View Member profile (`P0`)

As Team staff, I want one Member page showing profile, enrollment and finances so
I can resolve questions quickly.

- Overview, Contacts, Enrollments and Financial Activity are distinct sections.
- Outstanding, credit and net position use ledger definitions.
- Actions reflect server-authorized Branch scope.

## Epic D — Enrollments and Charges

### CM-030 — Enroll a Member (`P0`)

As authorized staff, I want to enroll a Member in a Program and Plan so monthly
Charges can be generated.

- Program is offered at the selected accessible Branch.
- Plan defaults are previewed and snapshotted.
- Duplicate overlapping Enrollment is rejected.
- Multiple different Programs are supported.

### CM-031 — Change or end an Enrollment (`P1`)

As authorized staff, I want future terms to change without rewriting generated
Charges.

- Pause/resume/end use explicit effective dates.
- Existing Charge snapshots remain unchanged.
- The UI previews the next affected period.

### CM-032 — Generate monthly Charges (`P0`)

As an authorized administrator, I want to generate a selected month's Charges
so receivables exist predictably.

- Preview gives eligible/already-existing/skipped counts.
- Confirmation creates missing Charges only.
- Repeat and concurrent generation cannot duplicate a period.
- Partial failure is retryable and accurately reported.

### CM-033 — Review and filter Charges (`P0`)

As Team staff, I want to see pending, partial, paid and overdue Charges so I know
where collection work is needed.

- Filters include period, Branch, Program, state and Member search.
- State and balance come from server ledger calculations.
- Empty, zero, failure and loading states are distinct.

### CM-034 — Adjust or void a Charge (`P1`)

As an authorized actor, I want to correct exceptional billing with an audit trail.

- Reason is required.
- Allocated Charges cannot be silently voided.
- Original values and actor/time remain inspectable.

## Epic E — Payments and receivables

### CM-040 — Record a straightforward Payment (`P0`)

As Team staff, I want to record a Member's payment and apply it to open Charges.

- Member, amount, date and method are required.
- Allocation preview never exceeds Payment or Charge balances.
- Submit uses an idempotency key.
- Success shows receipt number and final allocation.

### CM-041 — Record partial and multi-Charge Payments (`P0`)

As Team staff, I want one Payment to cover part or all of several Charges.

- Manual allocation and oldest-first assistance are supported.
- Unallocated value becomes visible Member credit.
- Concurrent balance conflict reloads instead of overallocating.

### CM-042 — View Payment history (`P0`)

As authorized staff, I want searchable Payment history so I can reconcile cash
and answer Member questions.

- Filter by date, Branch, method, Member and state.
- Detail shows allocation, recorder and receipt.
- Limited users only see in-scope records.

### CM-043 — Reverse a Payment (`P1`)

As an Owner or explicitly authorized admin, I want to reverse an erroneous
Payment without deleting evidence.

- Confirmation names Member, amount and balance consequence.
- Nonempty reason is required.
- Charge balances and credit recalculate.
- Reversal and replacement Payment remain separately auditable.

## Epic F — Dashboard and reports

### CM-050 — View monthly health (`P0`)

As an Owner, I want expected, collected, outstanding and overdue summaries so I
can understand the current month immediately.

- Every metric uses specification 15 formulas.
- Cards link to reconciled filtered lists.
- `asOf`, period and Branch scope are visible.

### CM-051 — Review receivables aging (`P1`)

As an Owner, I want aging buckets so I can prioritize collection work.

- Current, 1–30, 31–60, 61–90 and 90+ are mutually exclusive.
- Totals reconcile with open Charge balances.
- Branch-limited views declare their scope.

### CM-052 — Export operational CSV (`P1`)

As an authorized Owner/admin, I want filtered Members, Payments and receivables
exports for offline review.

- Export uses current authorized filters and stable columns.
- Formula injection is neutralized.
- Export action is audited without copying row contents to logs.

## Epic G — Onboarding data and release quality

### CM-060 — Preview and import Members (`P1`)

As an Owner, I want to import a bounded Member CSV so initial onboarding is
practical.

- Preview performs no writes and shows row outcomes.
- Confirmation is idempotent.
- Only Member/Contact data is accepted; no financial rows.
- Batch result and actor are audited.

### CM-061 — Complete responsive bilingual acceptance (`P0`)

As a Spanish- or English-speaking staff user, I want critical workflows to work
on mobile and desktop in my language.

- Catalogs and named placeholders are complete.
- Member lookup, Charge review and Payment recording work at 390×844.
- Keyboard/focus and non-color status checks pass.
- Verification records observed scope and limitations.

### CM-062 — Release a controlled dev pilot (`P1`)

As the product owner, I want one fictional or consenting pilot Organization in
dev before production release.

- Dev D1, domain, secrets and email recipients are configured separately.
- Migrations run before compatible code deployment.
- Tenant isolation, backups and actual email setup flows are verified.
- Production requires a separate explicit approval and configuration.

## Later epics

- WhatsApp reminders and provider webhooks.
- Online payment gateway and reconciliation.
- Member/payer self-service portal.
- Attendance, schedules, groups and instructors.
- Additional billing frequencies, taxes and legal invoicing.
- Large asynchronous imports and stored export files.
