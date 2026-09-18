# Collections workspace consolidation

Status: implemented locally on 2026-09-18. Execution evidence is recorded in
[VERIFICATION.md](../specs/VERIFICATION.md). The following plan preserves the
design decisions and acceptance criteria used for delivery.

## Outcome

Reduce the operational navigation to Members and Collections & payments without
removing receivables, receipts, credit, enrollment history or audit evidence.
This plan is a follow-up delivery slice, not a replacement for specifications
11, 13, 14, 16 and 17. Update those contracts before implementing changed behavior.

## Baseline before implementation

- `AppLayout.tsx` exposes separate `/app/charges` and `/app/payments` entries.
  `DashboardPage.tsx` links directly to both, sometimes with period/state filters.
- `ChargesPage.tsx` owns generation preview/confirmation, period/state/plan/tag
  filters, pagination and authorized adjustment/void actions.
- `PaymentsPage.tsx` owns history, method/status/date filters, pagination and
  authorized reversal. It currently directs people to a Member to record money.
- `CustomerMemberDetailPage.tsx` contains the payment composer and history inside
  its private `PaymentSection`. Extract that implementation rather than copying it.
- The payment preview applies money to the oldest outstanding charges first.
  Posting already accepts explicit allocations and validates Member/Branch scope.
- The charges API accepts an omitted period, but its state filter currently
  matches one derived state. A combined unpaid filter must run before pagination.
- Existing list effects need stale-response protection during this refactor;
  clearing a debounce timer alone cannot cancel an already-started request.

## Proposed user experience

### Navigation and responsibilities

Keep Members for identity, contact details, plans/enrollments and individual
financial history. Keep the existing Register payment action in its profile.

Replace the separate Charges and Payments menu items with one Collections &
payments item. Use two tabs:

| Tab | Purpose | Initial view |
| --- | --- | --- |
| Monthly fees | What is owed, with access to paid/void history | All periods, unpaid only |
| Received payments | Money recorded and its receipt history | All dates, posted only |

Use Monthly fees rather than naming the entire first tab To collect: staff must
also be able to find paid and voided fees there. To collect is its default status
filter. Unpaid means an open charge with a positive remaining balance, including
partial and overdue charges; partial overdue debt must never be omitted.

Do not default unpaid fees to the current month: that would hide older debts.
Clearly display the selected month/all-periods scope. The billing month and the
payment date range are independent concepts and must have independent filters.

### Tables and actions

- Reuse `ChargesTable` and `PaymentsTable` styling, shared controls, money input,
  skeletons and centered dialogs; no additional UI dependency.
- Monthly fees columns: Member, Plan, Month, Due date, State, Outstanding and
  Actions. Show Register payment only for payable rows; keep permitted adjustment
  and void actions secondary. Names/rows still open Member profiles, while row
  buttons and text selection do not trigger navigation.
- Received payments keeps Member, receipt, date, method, status and amount, with
  cancellation available only to authorized users for posted payments. Cancelled
  records remain discoverable through the state filter.
- Add a workspace Register payment action that starts with searchable Member
  selection limited to the active Branch. Reuse the same composer as row/profile
  entry points. Show the selected Member and Branch prominently before saving.
- Retain Generate monthly fees as a separate authorized action. Open a dialog
  with an explicit month (current business month by default), preview and final
  confirmation. Never infer a generation period from an all-periods list filter.
- Do not add overview totals calculated from loaded/paginated rows. Keep dashboard
  aggregates authoritative; additional workspace aggregates are outside this slice.

### One shared payment flow

1. From a fee row, select that Member and that exact unpaid charge; prefill its
   current outstanding amount. From a Member profile or the global action, retain
   the existing oldest-debt default and active-enrollment suggestion when applicable.
2. Enter/edit amount and select an active company payment method. Cash stays the
   default. Preserve grouped currency input and allow partial payments.
3. Show the proposed destination of the money using readable month/plan labels.
   A row-triggered payment must not silently settle a different, older charge.
4. Offer an explicit switch to pay other pending fees for the same Member/Branch
   when needed. Show any remainder as available credit before confirmation.
   If no charge exists, explicitly explain that recording money creates credit;
   do not silently create a monthly fee or mark a nonexistent fee paid.
5. Use entry and review steps inside one centered dialog rather than stacked
   payment dialogs. The final button records the payment only after review.
6. On success, show receipt feedback and refresh both fee and payment views, plus
   the Member balances when entered from its profile. Retain the current tab and
   filters. A fully paid row leaves an unpaid-only list; a partial one remains.

A targeted server preview can accept an optional charge ID, validate it against
the tenant, active Branch and Member, and return its latest outstanding amount.
Keep the existing preview behavior when no target is supplied. Reuse the current
posting endpoint and explicit allocations; do not create a second ledger path.
On a concurrent balance conflict, refresh the preview and require another review.
Preserve a submission's idempotency key and payload on uncertain retries; a new
key is for a newly reviewed operation, never a blind retry of a timeout.

## Routes, state and compatibility

- Canonical routes: `/app/collections/fees` and `/app/collections/payments` under
  one shared workspace header/tab bar. `/app/collections` redirects to fees.
- Redirect `/app/charges` and `/app/payments` with history replacement and preserve
  recognized filters. An old charges link with a period and no state retains
  its historical all-states meaning; direct navigation to the new workspace uses
  the unpaid default. Explicit dashboard links define their intended view.
- Update dashboard cards, quick actions and empty-state links. Keep expected
  charges, outstanding debt, overdue debt and collected-money destinations distinct.
  Map payment date ranges deliberately; do not treat a billing month as a receipt
  date without matching the dashboard metric's existing semantics.
- Store each tab's filters in its URL and preserve them when switching tabs within
  the same workspace. Support direct links, reload and browser back/forward.
- Fetch only the active tab. Use abort/response-generation guards, reset pagination
  on filter changes and prevent overlapping Load more actions and stale appends.
- Key pending requests, caches and dialogs by Organization and active Branch.
  Switching scope discards drafts/results and never allows an old dialog to submit
  under a new Branch. Do not use URL Branch IDs to override session authority.

## Delivery order

1. Update specifications 13/14/17 and relevant Member/permission references. Add
   the typed bilingual navigation/tab/filter/review messages and accessible tab
   layout contract. No changes to stored financial records are planned.
2. Extract charge/payment views from their full-page containers. Add the shared
   workspace, tabs, navigation, redirects and dashboard links with current actions
   intact; introduce the unpaid filter before pagination and all-periods view.
3. Extract the payment dialog from `PaymentSection`, keeping Member history
   separate. Preserve profile defaults and existing receipt/credit behavior.
4. Add row-targeted preview and global Member selection. Implement the shared
   entry/review flow, retry protection and balance refresh after all mutations.
5. Verify mobile/desktop, keyboard, both languages, role/Branch restrictions,
   legacy links and financial scenarios. Update dated verification evidence.

Each step must remain buildable and preserve existing workflows. Group later
commits by navigation/views, payment workflow/API and validation/documentation;
commit/push only when requested. No deployment is included in this plan.

## Acceptance matrix

| Scenario | Required outcome |
| --- | --- |
| Fee 80,000; payment 50,000 | Receipt 50,000; remaining fee 30,000; still in unpaid view |
| Remaining payment 30,000 | Two receipts, one fully paid fee, no duplicate fee |
| August debt exists; pay September from its row | September is the reviewed target; August is not silently paid |
| Partial payment past its due date | Appears in unpaid view regardless of derived status precedence |
| One payment covers several fees | Explicit distribution and reconciled totals |
| Overpayment or no open fees | Explicit credit preview in the same Branch |
| Cancel a payment | Authorized reason/confirmation, restored balances, retained receipt history; no implied refund |
| Generate the same month twice | Preview and server uniqueness prevent duplicate fees |
| Two tabs register against the same fee | Server conflict handled with refreshed review |
| Double click, timeout and retry | One logical payment and receipt, controls recover |
| Switch Branch/company while loading or editing | No stale rows, wrong-scope submission or leaked Member options |
| Paid/void historical fees and cancelled receipts | Available through filters, never discarded |
| Legacy/dashboard links, reload, back/forward | Correct tab and filter semantics preserved |
| 320px/390px, tablet and desktop | No horizontal overflow; usable tabs, rows, dialog and touch targets |
| Keyboard and screen reader | Semantic tables/tabs, labeled actions, focus return and clear status/error feedback |

Use isolated synthetic fixtures for UI mutations. Add focused regression tests
for new API filters/targeted preview, permissions, cross-tenant/Branch denial,
idempotency and financial allocation scenarios. Run repository typecheck, lint,
environment/i18n/form checks, Workers tests and target build/dry-run gates.
No automatic generation, collection messages, online payments, schema migration,
new financial rules or data cleanup are part of this consolidation.
