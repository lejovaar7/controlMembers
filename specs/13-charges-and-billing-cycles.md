# Specification 13: Charges and Billing Cycles

[All specifications](README.md)

**Status:** Implemented and verified locally; remote pilot release remains pending.

## Purpose

Create one durable receivable per Enrollment and monthly period without
duplicates, historical price drift or dependence on a daily status mutation.

## Billing period

The canonical monthly period is stored as a normalized `YYYY-MM` value and
validated independently from locale formatting. Due dates are business dates in
the Organization timezone. APIs return ISO values; the UI localizes presentation.

## Charge record

A Charge stores:

- opaque ID and immutable `organizationId`;
- Enrollment, Member, Plan and Branch references;
- canonical billing period and due date;
- `subtotalMinor`, `discountMinor`, `adjustmentMinor`, `totalMinor`;
- currency;
- descriptive snapshots required to understand history;
- lifecycle `open` or `void` plus void reason/actor/time;
- creation actor/time and optional generation batch ID.

The database enforces uniqueness for Organization + Enrollment + billing period.
`totalMinor` must be nonnegative and equal the documented component formula.

## Derived financial state

Charge payment state is derived at query time from non-reversed Allocations:

- `paid`: allocated amount is at least total;
- `partial`: allocation is positive but below total;
- `overdue`: remaining amount is positive and Organization-local current date is
  after the due date;
- `pending`: remaining amount is positive and not overdue;
- `void`: lifecycle is void regardless of former payment state.

If a Charge with allocations must be voided, its allocations must first be
reassigned or the related Payment reversed in a controlled workflow. A voided
Charge cannot accept new allocations.

## Generation

Generation accepts a target period and optional accessible Branch filter.

In an active workspace, preview and generation default to that Branch only.
Explicit filters cannot include another Branch; switch workspace first.
Charge lists and adjustments/voids follow the same active-Branch boundary.

Generation:

1. resolves the tenant and actor scope;
2. selects eligible active Enrollments for the period;
3. snapshots current billing terms;
4. inserts only missing Charges under the uniqueness constraint;
5. returns created, already-existing, skipped and failed counts.

The operation is idempotent. Concurrent identical requests may race but must
converge on one Charge per Enrollment/period. A retry never changes an existing
Charge. Partial failures are reported and safely retryable.

MVP exposes an explicit authorized “Generate monthly charges” action. Automatic
scheduled generation is deferred until operational behavior is proven.

## Eligibility rules

- Enrollment period overlaps the billing month.
- Enrollment and Member are active when generation is requested.
- Paused status skips generation; it does not alter existing Charges.
- Joining mid-month does not automatically prorate in the proposed MVP default.
- Ending mid-month does not automatically refund or void an existing Charge.
- Staff uses an explicit adjustment/void with reason for exceptional first or
  final periods.

## Adjustments

Before a Charge receives any allocation, an authorized actor may apply a bounded
positive or negative adjustment with reason. After allocation, changes use a
separate adjustment event or corrected Charge workflow; the original total is
never silently overwritten. Every adjustment preserves actor, timestamp, amount
and reason.

## Target API and UI

- The Collections & payments workspace opens on Monthly fees with all periods
  and unpaid balances selected. `state=unpaid` includes every open positive
  balance before pagination, including partial overdue charges. Paid/void history
  remains available through filters. Generation always selects an explicit month.
- Payable rows open the shared payment dialog targeting that exact charge; the
  server preview validates Member and active Branch before suggesting allocations.
- Period summary and generation preview.
- Idempotent generation command with explicit confirmation.
- Charge list filtered by period, Branch, Plan, tag, state and Member search.
- Charge detail showing the formula, allocations and audit events.
- Authorized adjust/void actions with reasons and impact warnings.
- The directory matches the Member table design, including responsive labeled
  rows and loading placeholders. It exposes Member, Plan, due date, payment state,
  outstanding/original total and permitted actions. Row navigation opens the
  Member profile; adjusting or voiding stays in the Charge confirmation flow.

## Acceptance checks

- Repeated and concurrent generation produce no duplicate Charges.
- Plan, tag or Enrollment edits cannot alter an existing Charge snapshot.
- Overdue status respects Organization timezone and due date.
- Filters and totals use the same state/balance definitions as payment reports.
- Pausing, ending or moving records does not erase historical receivables.
- Cross-tenant and inaccessible Branch generation is denied without disclosure.
