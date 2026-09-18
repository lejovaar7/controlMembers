# Specification 14: Payments, Allocations and Ledger

[All specifications](README.md)

**Status:** Implemented and verified locally; remote pilot release remains pending.

## Purpose

The Collections & payments workspace combines monthly fees and received-payment
history under one navigation item. A shared centered payment dialog is used by
Member profiles, fee rows and global Member selection. Entry and final review
are steps in the same dialog. Targeted preview settles only the selected fee;
switching to oldest-debt allocation requires an explicit user choice. Excess
money is disclosed as Branch credit. Uncertain retries retain the reviewed
payload and idempotency key; definite allocation conflicts require fresh review.

Record money received, apply it to Charges, preserve unapplied Member credit and
correct mistakes without destroying financial history.

## Payment record

A Payment stores:

- opaque ID and immutable Organization and Member IDs;
- receiving Branch ID;
- positive `amountMinor` and Organization currency;
- business `paidAt` timestamp;
- method: built-in `cash` or an active Organization-owned custom method;
- immutable custom method ID and name snapshot when a custom method is used;
- optional external reference and bounded note;
- Organization-scoped human receipt number;
- state: `posted` or `reversed`;
- recorded actor/time and reversal actor/time/reason.

The `recordedByUserId` is always derived from the authenticated session. The
browser cannot claim another actor. An idempotency key protects repeat submits;
the same key and tenant returns the original result, while mismatched payloads
are rejected.

The browser creates opaque 128-bit random idempotency keys with the shared
`createIdempotencyKey` helper. It uses `crypto.getRandomValues`, which is also
available on LAN HTTP development origins; payment review must not depend on
the secure-context-only `crypto.randomUUID`. A confirmation keeps its captured
key when retried. The same helper is used by Member CSV import confirmation.

## Branch ledger isolation

Payment lists, previews, recording and reversals respect the active workspace.
Allocations must belong to the receiving Branch as well as the same Member and
Organization. A Member shared between Branches has separate Branch balances;
sharing their identity never combines receivables or credit between workspaces.

## Payment method catalog

Every company starts with Cash as its only selectable method. Cash is built in,
translated and cannot be renamed or deactivated. Settings lets Owners and admins
with access to all Branches add, rename, deactivate and reactivate company-wide
methods. Staff may read the catalog and record payments using active methods.
Names are required, limited to 80 characters and unique per company after
whitespace/case normalization, including inactive names. Cash/Efectivo is reserved.
User-entered names are displayed verbatim, without translation.

`GET /api/payment-methods` returns active methods; `?inactive=1` includes inactive
custom methods for Settings, and `?history=1` also includes legacy method codes
actually used in the caller's accessible payment history. `POST` creates a method
and `PATCH /api/payment-methods/:id` updates its name or active state. Tenant and
management permissions are enforced by the Worker; methods are never deleted.

New payments reject inactive, unknown and foreign-company method IDs. Legacy
`bank_transfer`, `card` and `other` remain readable/filterable for old records but
are not accepted for new payments. An identical idempotent retry returns its
original payment even when its custom method was subsequently renamed/deactivated.
Payment history and CSV exports retain the name captured when money was recorded.

Migration `0012_sudden_bruce_banner.sql` adds the catalog and nullable method ID/name
columns without rewriting payments. The existing internal `method` enum remains
for compatibility: custom payments store `other` plus their ID/name snapshot. API
responses expose the custom ID as `method`; filtering `other` selects only legacy
records without a custom ID. Apply migration 0012 before running this version.

## Allocations

An Allocation associates a positive portion of one Payment with one open Charge.
Payment, Charge and Member must belong to the same Organization and Member.

Invariants:

- active allocations never exceed the Payment amount;
- active allocations never cause a Charge to exceed its total in MVP;
- reversed Payments contribute zero active allocation;
- void Charges accept no allocations;
- allocation writes and Payment creation must be atomic when the runtime permits;
  otherwise the API must use a retry-safe staged design and never report success
  until invariants hold.

An unallocated remainder is Member credit. It is calculated as posted Payment
amount minus active allocations; it is not duplicated in a mutable balance
column. Default assisted allocation uses oldest overdue Charges and then oldest
open Charges, but the user can review the distribution before posting.

## Reversal and correction

- Posted Payments are never edited or deleted.
- Reversal requires a nonempty reason and permission from spec 16.
- Reversal removes the Payment's financial effect while preserving the Payment
  and Allocations for audit.
- A correction is a reversal followed by a new Payment.
- Repeating an identical reversal is safe; conflicting reversal data is rejected.
- Receipt numbers are never reused after reversal.

## Balance definitions

- Charge paid amount: sum of active Allocations.
- Charge outstanding: total minus paid amount.
- Member credit: posted Payment value not actively allocated.
- Member outstanding: sum of non-void Charge outstanding.
- Member net position: outstanding minus credit, exposed alongside—not instead
  of—the gross values.
- Collected for a period: posted Payments whose `paidAt` falls inside the period,
  independent of the Charge periods they pay.
- Expected for a period: totals of non-void Charges belonging to that period.

Reports must not call allocated value “cash collected.”

## Target API and UI

- Payment composer from Member or Charge context.
- Open-Charge allocation preview with manual adjustments.
- Payment receipt/detail with allocations and audit metadata.
- Payment history filters by date, Branch, method, Member and state.
- Receipt date filters use inclusive company-local calendar dates, with the same
  timezone conversion as dashboard totals. Invalid or reversed date bounds fail.
- Uncertain attempts retain their reviewed payload/key across dialog dismissal
  and route navigation within the current browser app session. A full page reload
  ends this in-memory recovery state; no payment data is written to browser storage.
- The Payments directory uses the responsive Member table design, with Member
  and receipt number, payment date, method, state, amount, available credit and
  permitted cancellation actions. Row clicks open the Member profile; cancel
  buttons open the existing reason/confirmation dialog without navigating away.
- Reversal dialog naming amount, Member and consequences.
- Member profile shows gross outstanding, available credit and net position.
- Member detail opens the payment composer from its header. Distribution lookup
  failures show a retry action without discarding the amount; stale lookup
  responses are ignored. Successful posting selects the receipt history and
  refreshes the visible Branch balance after the final confirmation.
- Opening the Member composer prefills the outstanding amount of the oldest
  open Charge in the current Branch. When none exists, it suggests the sum of
  active enrollment agreed amounts minus discounts in that Branch. Paused or
  ended enrollments and other Branches do not contribute. With neither source,
  the field remains empty. Staff can edit or clear the suggestion; reopening
  recomputes it from the current detail instead of retaining an abandoned edit.
  This is only a form default: previews, credit handling and explicit final
  confirmation still govern recording the payment.

## Concurrency

The server checks each Charge's current open status and remaining balance inside
the same D1 batch transaction that inserts the Payment, allocations and audit.
An invalid allocation violates the existing positive-amount constraint, rolling
back the whole batch and returning `ALLOCATION_CONFLICT`. Simultaneous retries
with the same key and payload return the existing receipt. Conflicting payments
return a stable conflict response and the UI reloads the latest balances.
Client-calculated balance is preview only.

## Acceptance checks

- Full, partial, multi-payment and one-payment/multi-charge cases reconcile.
- Repeat submission with the same idempotency key never duplicates money.
- Cross-Member, cross-Branch-unauthorized and cross-tenant allocations fail.
- Reversal restores Charge balances and retains the complete original event.
- Member credit equals unapplied ledger value under concurrent operations.
- Collected, allocated, outstanding and expected values use distinct formulas.
- Currency values never use binary floating point.
