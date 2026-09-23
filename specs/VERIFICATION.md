# ControlMembers Verification Record

## 2026-09-23 — Automatic Plan matching and explicit missing-Plan choices

- Imported Plan names use the existing unique normalized match against active
  Plans in the current Branch. Missing Plans now remain unresolved by default;
  importing without an Enrollment requires an explicit choice. Common Plans still
  fill blank source values without overwriting recognized or unknown source Plans.
- Added a Plan selector to each review row, showing the catalog price and dates
  after selection. Missing/unmatched feedback explains the next action. Changes
  invalidate validation; unresolved selected rows cannot be confirmed. Controls
  are disabled during validation, uncertain saves and for excluded rows.
- Added matching coverage for case/accents, multiple Plans, unknown names,
  ambiguous names, absent columns, single-Plan catalogs and explicit no-enrollment
  choices. Existing server tests cover Branch scope and current price revalidation.
- Updated sample 01 with a Plan column, preserving its existing cells, and rebuilt
  the guide/ZIP. Artifact Tool edited the CSV; the application parser verified
  three expected matches with a synthetic catalog and three unresolved choices
  with an empty catalog. Artifact Tool's CSV preview renderer exited without an
  error message, so verification used cell preservation and parser assertions.
- The running development server returned HTTP 200 for the updated module with
  inline Plan selection and missing-Plan feedback. Browser file workflow remains
  unverified under the earlier upload denial. No real import or database changes
  were performed.
- Passed typecheck, lint, 27 environment checks, 2 catalog checks, 2 form checks,
  all 267 Workers tests across 25 files, and all three environment build dry runs.
  Diff whitespace checks passed.

## 2026-09-23 — Import limited to new-member form fields

- Removed More details and all extra-field disclosures from mapping and row
  editing. Kept name, document number, email, phone, WhatsApp, current Branch,
  Plan and enrollment dates. Removed the redundant choose-another-file action;
  the selected-file Remove action remains available.
- The browser filters mappings through an eight-field allowlist before building
  drafts, avoiding invisible import of removed reference, Contact, type or status
  data. Members are active and the UI explains the supported-field scope. The v3
  template contains only these fields. Richer legacy API support remains intact.
- Added regressions for an older rich file producing only supported personal and
  enrollment data, and for the exact simplified template. Manual browser file
  verification remains outstanding; the prior upload denial was not bypassed.
- Typecheck, lint, 27 environment checks, 2 catalog checks and 2 form checks passed.
  The full Workers run passed 265 of 266 tests; the remaining test incorrectly
  expected unquoted CSV headers. Corrected that assertion to parse the CSV and
  reran all 13 import tests successfully, then passed all three build dry runs.
  HTTP 200 module inspection confirmed the basic document field and mapping
  allowlist, with no More details or previous-code field. Diff checks passed.
- Updated the existing sample CSV guide/ZIP to reflect ignored legacy columns and
  document-based duplicate checks. The sample CSV data itself was not changed.

## 2026-09-23 — Plain-language import fields and optional editor sections

- Labeled external references as optional previous Member codes and explained
  their use with an example. Updated Spanish validation feedback to use the same
  term and replaced technical preview/validation action wording with simpler copy.
- Grouped optional column mappings by purpose. Row editing now prioritizes common
  fields, with expandable documents/previous-code and Contact groups, summaries
  of populated values, and contextual help for document types and relationships.
  Draft/confirmation and backend identifier semantics remain unchanged.
- Browser upload verification remains outstanding under the previously declined
  upload permission; no file upload or alternative injection was attempted.
- Passed typecheck, lint, 27 environment checks, 2 catalog checks (repeated after
  the final button wording), 2 form checks, 264 Workers tests in 25 files and all
  three environment build dry runs. The running development server returned
  HTTP 200 with the updated label, help and optional editor sections. Diff checks
  passed. No Member data was saved during verification.

## 2026-09-22 — Simplified import details step

- Replaced the 17-field mapping wall with four common fields, actual nonempty CSV
  examples, plain-language empty choices and a required-name explanation.
  Additional mappings and phone/date settings use expandable sections with
  visible summaries of detected fields and current defaults.
- Renamed the step Check details and added Continue to review. Missing file Plans
  default to Assign later, while explicit file Plans remain subject to review.
  Enrollment dates appear only when Plans are involved; removal resets the
  common Plan choice. Existing validation, row editing and final save remain.
- The browser inventory had no open tabs. The earlier declined upload permission
  remains respected: no upload or injected-file workaround was attempted. Manual
  browser verification of this step remains outstanding.
- Full gate passed: typecheck, lint, 27 environment checks, 2 catalog checks,
  2 form checks, 264 Workers tests across 25 files and all three environment build
  dry runs. The development server returned HTTP 200 for the updated import
  module, containing Check details, More details and Continue to review.

## 2026-09-22 — Import file removal and actionable parsing errors

- Added a selected-file summary and Remove file action even after a failed read.
  Removal resets file input, drafts, mappings and validation; a generation guard
  ignores obsolete reads after replacement/removal. Saving or an uncertain save
  outcome disables removal. Corrected files can be selected again with the same name.
- Empty files, header-only templates, malformed CSV, invalid headers, inconsistent
  columns and size/row limits now have separate localized instructions. A parser
  regression checks all seven cases and a corrected file with one Member.
- No browser upload was retried after the earlier declined permission. Browser
  verification of selection/removal remains outstanding; no real Member data was
  uploaded or changed during this correction.
- Full gate passed: typecheck, lint, 27 environment checks, 2 catalog checks,
  2 form checks, 264 Workers tests in 25 files and dev/production/local build
  dry runs. The running development URL returned HTTP 200 without a restart.

## 2026-09-22 — Editable Member import with column mapping and Plans

- Added bounded delimiter-aware CSV parsing, explicit column mapping with Spanish/
  English suggestions, national/international phone handling and editable WhatsApp
  fallback. The review supports row editing/exclusion, bulk or individual Plan
  selection, dates, Contacts and an explicit details-only option.
- Structured previews validate without writes. Confirmation rechecks scope,
  identifiers and current Plan prices against a review fingerprint, then commits
  the complete selection and enrollment/first-fee writes in one idempotent batch.
  Legacy CSV API semantics remain supported; the download now uses template v2.
- The localization boundary check now inspects executable identifiers rather than
  matching words such as "document" inside translated UI copy.
- Runtime inspected the wizard's initial screen with synthetic responses. The
  browser's file chooser rejected the test-file upload because permission was
  declined. No upload workaround was attempted; the full browser file/mapping/edit/
  confirmation journey remains unverified. Removed temporary fixtures and sample
  files. No real Member, user account, Plan, payment or remote database was changed
  during QA. Parser and persistence scenarios were exercised by automated tests.
- Full gate passed: typecheck, lint, 27 environment checks, 2 catalog checks,
  2 form checks, 263 Workers tests in 25 files and dev/production/local build
  dry runs. Coverage includes quoted/delimited files, phone/date conversion,
  WhatsApp choices, duplicate rows, invalid Contacts, scope/Plan restrictions,
  review invalidation, atomic writes, concurrent idempotency and the 50-row limit.
  `git diff --check` passed. No migration, dependency or deployment was required.

## 2026-09-22 — Wait for replacement session requests during Branch changes

- Reproduced the reported workspace error with the real Better Auth client and
  AppLayout: its deferred activation signal cancels the explicit session refetch,
  whose promise resolves while the replacement request is still fetching.
  The previous transition guard then compared the old Branch and latched failure.
- Reconciliation now waits until the session is neither pending nor refetching.
  Retained final scope/error checks and the centered overlay with visible content.
- An abort-aware synthetic fetch fixture with 1.8-second session latency showed
  the error before the fix. The same scenario passed afterward in both directions,
  displaying the selected Branch and restoring controls without the error screen.
  Removed the fixture and temporary tab; no real account or Branch was changed.
- Full gate passed: typecheck, lint, 27 environment checks, 2 catalog checks,
  2 form checks, 253 Workers tests in 24 files and dev/production/local build
  dry runs. `git diff --check` passed.

## 2026-09-22 — Keep the workspace visible during Branch changes

- Replaced the opaque transition background with a lightly dimmed overlay and
  the shared loader inside a compact centered surface. Kept the page mounted
  behind it and retained the inert shell and activation/session safeguards.
- Runtime checked the actual AppLayout with delayed synthetic Branch activation
  at desktop and 390-pixel widths. Confirmed visible page content behind the
  centered indicator, inaccessible background actions while pending, and the
  selected Branch and restored controls on completion. Removed the fixture/tab
  and reset the viewport; no real records or sessions were changed.
- Full gate passed: typecheck, lint, 27 environment checks, 2 catalog checks,
  2 form checks, 253 Workers tests in 24 files and dev/production/local build
  dry runs. `git diff --check` passed.

## 2026-09-22 — Loading transition when switching Branches

- Manual Branch selection immediately unmounts the outgoing page and displays
  the shared full-screen Ring2 loader over an inert shell. After activation,
  the refreshed session must match the requested scope before the new page mounts.
  Repeated submissions are locked; failed activation restores retry controls.
- Runtime checked the actual AppLayout and BranchSwitcher using synthetic
  responses with delayed activation: desktop success and 390-pixel mobile
  failure followed by a successful retry. Verified the centered loader, hidden
  outgoing content, correct selected Branch and one successful activation.
  Removed fixtures and temporary tabs and restored the viewport. No real
  account, Branch or business data was modified by these checks.
- Full gate passed: typecheck, lint, 27 environment checks, 2 catalog checks,
  2 form checks, 253 Workers tests in 24 files and dev/production/local build
  dry runs. No dependency, migration or deployment changes were needed.

## 2026-09-22 — Clearer staff directory rows

- Staff rows show one effective access state, compact Branch labels, bordered
  permission disclosures and a two-column grid of outlined actions. Pending
  accounts have a full-width resend action; inactive accounts retain reactivation.
  Compact desktop widths omit decorative action icons to keep labels inside buttons.
- Runtime checked the actual MembersPage with synthetic directory responses:
  pending, active, inactive and scope-restricted/read-only entries, permission
  expansion, opening/cancelling access editing, and opening/cancelling deactivation.
  Inspected 1280-, 1024- and 390-pixel layouts. Removed fixtures/tab and reset the
  viewport. Requests outside the mock directory were blocked; no real account,
  permissions or email delivery was changed during QA.
- Full gate passed: typecheck, lint, 27 environment checks, 2 catalog checks,
  2 form checks, 253 Workers tests in 24 files and dev/production/local dry runs.
  Final compact-action refinements also passed typecheck, lint and catalog checks;
  the latter was rerun outside the sandbox after a subprocess EPERM.

## 2026-09-22 — Rounded modal scroll regions

- Shared CenteredDialog now clips an inner native scroll region inside its
  rounded outer shell. The themed scrollbar has a narrow rounded thumb,
  inset track ends and no arrow buttons where WebKit scrollbar styling applies.
- Runtime checks used the actual shared modal and SelectField with synthetic
  form content at desktop and 390-pixel widths. Verified curved corners at both
  scroll ends, wheel and keyboard scrolling, access to bottom actions, select
  popovers, focus restoration when reviewing, Escape dismissal and outside-click
  dismissal with focus returned to the trigger. Removed the fixture/tab and
  restored the browser viewport; no user or company records were changed.
- Full gate passed: typecheck, lint, 27 environment checks, 2 catalog checks,
  2 form checks, 253 Workers tests in 24 files and dev/production/local build
  dry runs. No dependency, database schema or deployment changes were needed.

## 2026-09-21 — Compact received-payment table

- Removed inline application breakdowns from payment rows, tightened spacing,
  shortened table-only status badges and aligned monetary values. View receipt
  opens the complete applications, credit and permitted cancellation action;
  member names still link to profiles. Financial operations are unchanged.
- Inspected actual components with synthetic applied, mixed-credit and reversed
  receipts at desktop, 900px and 390px widths. Fixed intermediate-width action
  clipping and verified no cell overflow. Checked opening/closing receipt detail
  and return focus. Temporary fixture, server and tab were removed.
- Typecheck, lint, translation and form checks passed. No data migration or
  deployment was required for this UI change.

## 2026-09-21 — Required plan at manual signup and separate WhatsApp number

- Add member requires an explicitly selected active Plan from the Branch.
  Empty catalogs block submission and offer inline Plan creation to authorized
  users while preserving entered member data. The Worker validates the same
  requirement and commits Member, Enrollment, first fee and audit in one batch.
- Create/edit includes phone-as-WhatsApp selection and an optional separate
  number. Reminders use that choice, including an explicitly empty separate
  number. Existing members retain phone-as-WhatsApp behavior.
- Typecheck, lint, local build, 27 environment tests, 2 i18n tests, 2 form checks
  and all 253 Worker tests passed. Tests include missing/inactive/foreign-scope
  plans with no partial records, signup debt, independent WhatsApp updates,
  optional numbers and invalid input. Older unenrolled-member fixtures are
  seeded explicitly to preserve legacy/imported-record coverage.
- Browser verification used the actual dialog and Plan editor with synthetic
  responses: no-plan block, inline plan creation retaining the member name,
  explicit selection when plans exist, separate phone/WhatsApp payload and
  screenshot inspection. Temporary fixture, server and tab were removed.
- Reviewed additive migration `0014_bumpy_mongu.sql` and applied only this pending
  migration to local and dev D1. No production migration or deployment performed.

## 2026-09-21 — Signup payment and selectable monthly day

- New enrollments create their first fee atomically on the start date. The
  monthly day defaults to signup and can independently be chosen from 1–31.
  Short months clamp without changing the anchor; prior agreements remain.
- Added coverage for days 29/30/31, leap February, year rollover, independent
  recurring days, signup payment, duplicate prevention, invalid dates, discounts,
  staff access and charge audit events. Bulk generation remains owner/admin only.
- Typecheck and lint passed. The full suite passed 248 Worker tests plus 27
  environment, 2 catalog and 2 form checks. The subsequent staff/audit test passed
  with all 15 tests in its integration file.
- Inspected the actual member page and enrollment dialog with synthetic API
  responses: signup defaults, day-31 preview, saving into the targeted payment
  dialog, and cancellation preserving the unpaid fee. No real records changed.
  Temporary fixture files, server and browser tab were removed.
- Later months still require explicit monthly generation. No new migration or
  deployment was performed for this change.

## 2026-09-21 — Member CSV template download button

- Restyled the template link with the shared outlined button, decorative download
  icon and full-width mobile layout. Native download semantics and endpoint remain.
- Inspected the actual Member import section at desktop and 390-pixel mobile
  widths using an empty synthetic directory. Removed the temporary fixture/tab
  and reset the viewport. The template endpoint returned HTTP 200, text/csv and
  the expected attachment filename. No Member data was imported or modified.
- Typecheck, lint, 27 environment checks, 2 catalog checks, 2 form checks and
  all 242 Workers tests passed, together with dev/production/local build dry runs.

## 2026-09-21 — Monthly fee selection in payment dialogs

- Every payment form now exposes a Monthly fee to pay selector, including the
  Member detail entry point. Options show plan, month and outstanding amount;
  paid, void and other-Branch fees are excluded. Choosing a fee updates the
  suggested amount, while the several-fees option suggests the combined balance.
- Runtime checks used the actual PaymentDialog with synthetic API responses:
  choosing November changed the amount to 50,000 and the confirmed mock payload
  contained November only; several fees suggested 130,000 across October and
  November. Empty fees disabled the selector and left the amount blank.
  Direct November entry and English labels were checked, as were desktop and
  390-pixel mobile layouts. Temporary fixtures/tab were removed and viewport reset.
- Full gate passed: typecheck, lint, 27 environment checks, 2 catalog checks,
  2 form checks, 242 Workers tests in 23 files, and dev/production/local dry runs.
  No real payment or fee was created. Existing-credit application and fee
  generation behavior remain unchanged.

## 2026-09-21 — Receipt applications and accidental advance protection

- Member Charges now include their Branch and the same derived payment state as
  Collections. Receipts expose the plan/month/amount of each application and
  unused credit; cancelled receipts retain historical applications explicitly.
  Member history and the payments table distinguish applied payments, advances
  and mixed receipts. History includes the receipt time as well as its date.
- No outstanding Charge means no suggested payment amount, even with active
  enrollments. Any new unallocated remainder requires explicit advance consent
  in the form and API. Idempotent replay is preserved; consent never permits
  over-allocation of a paid Charge. Different unpaid months remain payable.
- Full gate passed: typecheck, lint, 27 environment checks, 2 catalog checks,
  2 form checks, 242 Workers tests in 23 files, and dev/production/local dry runs.
  Final advance-copy clarification also passed typecheck, lint, catalog checks
  and the local build. Expected bundle-size notices remain informational.
- Runtime verification used actual Member detail/PaymentDialog components with
  synthetic data: paid fee with zero balance, same-day allocated/advance receipts,
  empty amount after full payment, disabled review until advance acknowledgement,
  explicit advance confirmation and captured allowCredit payload. Visual checks
  covered desktop and 390-pixel mobile layouts. Fixtures/tab removed and viewport
  reset; no real payment was created or changed.
- Read-only dev lookup confirmed the two reported receipts are unapplied posted
  payments. The user confirmed receiving both amounts, so both records were kept.
  Existing credit application and Charge generation workflows were not changed.

## 2026-09-21 — Clearer Member balance cards

- Replaced the signed net-balance card with a leading, nonnegative Amount still
  to pay. Separate cards explain unpaid fees and received but unallocated credit.
  Contextual copy covers no debt, enough credit and a remaining amount to pay.
  Ledger calculations, stored records and payment allocation remain unchanged.
- Inspected the actual summary component using synthetic zero, credit-only,
  credit-covered, partially covered and debt-only balances. Checked Spanish and
  English copy and layouts at 390×844 and 1280×800. Removed the temporary fixture
  files/tab and reset the viewport after verification.
- Typecheck, lint, 27 environment checks, 2 i18n checks, 2 form checks,
  239 Workers tests and dev/production/local build dry runs passed.
  No migration, real payment write, commit, push or deployment was performed.

## 2026-09-21 — Manual WhatsApp collection reminders

- Added Overdue accounts filtering (including partial payments), read-only scoped
  reminder previews and an editable recipient/message dialog. The draft nets
  unused posted credit within the same Member/Branch and blocks covered debt.
- Nine new checks cover full/partial payments, reversals, void/future Charges,
  shared-Member Branch isolation, foreign tenants and anonymous access, eligible
  guardian Contacts, missing phones, no ledger mutation and safe link encoding.
- Typecheck, lint, 27 environment tests, 2 catalog checks, 2 form checks and
  239 Workers tests in 23 files passed. Dev, production and local build/deployment
  dry runs passed; no actual deployment or database migration was performed.
- Browser checks used real ChargesPage/dialog components with synthetic API
  responses and a stubbed WhatsApp handoff. Verified editable text and encoded
  destination, changed credit blocking handoff, missing-phone handling, popup
  blocking, English/Spanish copy, keyboard dismissal and trigger focus return.
  Visual inspection covered 390×844 and 1280×800. Temporary fixture files and
  browser tab were removed, and viewport override reset.
- Local network health endpoint returned HTTP 200. No real message was sent or
  Member/payment record modified. Real WhatsApp delivery remains a manual user
  action outside the application; opening a draft is never recorded as delivery.

## 2026-09-21 — Enrollment-specific monthly deadlines

- New enrollments default to a first payment one month after signup and accept
  an explicit later date. Stable recurring days handle January 31 → February
  28/29 → March 31. Generation and previews use due months starting with the
  first deadline; financial snapshots, uniqueness and Branch isolation remain.
- Generated migration `0013_icy_bastion.sql` only adds nullable `first_due_date`
  and `recurring_day` columns. Reviewed SQL and pending migration list, then
  applied it successfully to local D1 and remote **dev** D1. Existing rows retain
  legacy terms. Production migration/deployment was not performed.
- The enrollment dialog exposes start and first-due DatePickers, an automatic
  one-month suggestion, manual override/reset, next-date preview and validation.
  Future-term day editing supports 1–31 on new schedules and 1–28 on legacy rows.
  Plan forms/cards explain individual payment dates instead of a fixed day.
- Browser verification used the real Member detail component with synthetic API
  responses: September 21 suggested October 21 and November 21; changing the
  first deadline to October 25 previewed November 25 and persisted on the card
  after saving. A same-day deadline blocked submission with an inline message;
  resetting restored the automatic date. Screenshot inspection passed. Fixture
  files and tab were removed; no real Member or billing records were created.
- Typecheck, lint, 27 environment tests, 2 i18n tests, 2 form tests,
  230 Workers tests in 22 files, and dev/production/local dry runs passed.
  Targeted integration checks covered preview/generation agreement, concurrent
  duplicate prevention, custom dates, leap years, month rollover, saved snapshots,
  invalid dates, legacy behavior and end-date limits. Existing chunk-size warnings
  remain. The development server stays running.

## 2026-09-21 — Full enrollment payment dates

- Member detail now returns a payment date per Enrollment. It prioritizes the
  earliest outstanding Charge snapshot by Enrollment ID, or projects the first
  ungenerated calendar month using the company-local date and existing billing
  rules. Paid/void periods, end months, inactive Members and paused/ended
  Enrollments are respected without altering Charges or generating new ones.
- Enrollment cards show full localized start/payment dates, with separate labels
  for pending and projected deadlines. Dates use UTC formatting for date-only
  values, avoiding a previous-day shift in the browser.
- Added five schedule tests covering future starts, outstanding snapshots,
  month/year rollover, enrollment isolation, stopped schedules and company-local
  month boundaries. The existing API future-terms test also verifies that the
  pending payment date keeps its original Charge snapshot after a due-day edit.
- Runtime browser verification rendered the actual Member detail component with
  synthetic API data and confirmed both pending/projected October 1, 2026 labels.
  Screenshot inspection confirmed the full month fits on a separate readable
  line. Temporary fixtures and the browser tab were removed.
- Typecheck, lint, 27 environment checks, 2 catalog checks, 2 form checks,
  225 Workers tests in 21 files and all three environment dry runs passed.
  Existing chunk-size warnings remain. No real records, deployment or email
  delivery were changed; the development server remains running.

## 2026-09-21 — Duplicate enrollment feedback

- Read-only development data inspection confirmed an existing active enrollment
  in the reported Plan; the server correctly rejects another enrollment for the
  same Member, Plan and Branch. No real records were changed.
- The Add enrollment dialog now maps `ENROLLMENT_ALREADY_EXISTS` to localized
  red feedback explaining the active enrollment or suggesting resuming a paused
  enrollment. A fallback covers conflicts not present in the loaded history.
  Other failures stay generic. The selected Plan/date remain available, and
  editing either field or reopening the dialog clears previous errors.
- Browser verification used the actual Member detail page with synthetic API
  responses: active and paused conflicts kept the dialog open and displayed
  the corresponding Spanish explanation. Screenshot inspection confirmed red
  feedback inside the centered dialog. Temporary fixtures and tab were removed.
- Typecheck, lint, 27 environment checks, 2 catalog checks, 2 form checks,
  220 Workers tests across 20 files, and dev/production/local dry runs passed.
  No deployment or email delivery was performed; the development server remains
  running. Build chunk-size warnings remain unchanged.

## 2026-09-21 — Future enrollment terms validation

- The existing form disabled Save until its required reason was supplied without
  explaining the missing field; its native number input also accepted arbitrary
  digit counts. Added visible missing-field feedback and a shared billing-day
  input limited to two digits, with inline/browser validation for days 1–28.
  Server billing rules and mandatory audit reasons remain unchanged.
- Interactive synthetic browser QA used the real ActionDialog, MoneyInput and
  BillingDayInput. Typing 123 kept 12; letters were rejected; day 29 showed an
  error and blocked submission. Day 12 plus a reason submitted amount 8000000,
  discount 0 and dueDay 12, then closed the dialog. Reopening displayed the saved
  day. Blank-field feedback explained the disabled button. Preview files and
  tab were removed; no real enrollments or charges were changed.
- A Workers regression saved dueDay 12 with the full form payload and verified
  that historical charge dates remained unchanged while the next month's fee
  used day 12. It also rejected missing reasons and days 0, 29, 123 and 1.5.
  All 220 Workers tests, typecheck, 27 environment checks, 2 i18n checks, 2 form
  checks and all three target build/deployment dry runs passed. Final lint passed
  without warnings after removing the temporary preview. The existing day-range
  translation was reused after an initial duplicate-key check failed.

## 2026-09-21 — Visible enrollment action buttons

- Changed enrollment Pause/Resume and End from ghost to the shared outline
  variant, matching Edit future terms. End uses normal foreground contrast.
  Action handlers, confirmation dialogs and enrollment rules are unchanged.
- Visually verified the shared buttons against live styles in a synthetic
  enrollment-card preview. All actions have visible borders before hover.
  Removed the preview files and tab; no real enrollments were modified.
- Typecheck, lint, 27 environment checks, 2 i18n checks, 2 form checks and all
  219 Workers tests passed. Dev, production and local build/deployment dry runs
  passed; existing bundle-size advisories remain.

## 2026-09-18 — Consistent alignment by column type

- Replaced uniformly centered headers with matching header/body alignment:
  descriptive text, dates and contact fields left; amounts right; status and
  action columns centered. Action groups and skeletons follow their columns.
  Reports use numeric headers; mobile keeps its labeled-field layout.
  Text/numeric alignment follows the Material Design data-table convention:
  https://m1.material.io/components/data-tables.html
- Browser QA rendered actual Member, charge, payment and staff components with
  synthetic data, plus representative Branch/report markup using live styles.
  Checked every header/body alignment and centered action groups on desktop.
  At 390px, all tables used the narrow layout without horizontal overflow and
  action groups returned to their mobile placement. Removed temporary fixtures,
  closed the QA tab and reset the viewport. No real data was modified.
- Typecheck, lint, 27 environment checks, 2 i18n checks, 2 form checks and all
  219 Workers tests passed. Dev, production and local build/deployment dry runs
  passed; existing bundle-size advisories remain.

## 2026-09-18 — Centered table headers

- Added the shared centered column-header convention and restricted numeric/action
  alignment rules to body cells. Removed competing header alignment from Reports,
  Users and Branches while preserving existing narrow-screen field layouts.
- Browser QA loaded the live application stylesheet with six synthetic table
  variants: Members, monthly fees, payments, users, Branches and reports. All 29
  header cells computed to centered alignment, including balance/actions; numeric
  body cells retained right alignment. Visually inspected desktop rendering and
  removed the temporary fixture and tab. No real data was accessed or changed.
- Typecheck, lint, 27 environment checks, 2 i18n checks, 2 form checks and all
  219 Workers tests passed, along with dev, production and local build/deployment
  dry runs. Existing bundle-size advisories remain.

## 2026-09-18 — Member directory phone column

- Replaced the document-number column with Phone and made Email a separate
  column. Phone is no longer repeated above email. Responsive labels and loading
  headers use the same translated column definitions; absent values retain the
  localized Not provided placeholder. Member data and search remain unchanged.
- Rendered the actual MembersTable with isolated synthetic complete/missing
  contact records. Confirmed Spanish headers, one phone occurrence, separate
  email, no document number and two missing-value placeholders. Removed the
  temporary renderer. Live LAN health returned HTTP 200 with database status OK.
- Typecheck, lint, 27 environment checks, 2 i18n checks, 2 form checks and all
  219 Workers tests passed. Dev, production and local build/deployment dry runs
  passed; existing bundle-size advisories remain. No real data was changed.

## 2026-09-18 — Collections and payments workspace

- Combined financial navigation under Collections & payments with Monthly fees
  and Received payments. Added legacy redirects preserving former all-state and
  monthly defaults, independent URL filters, dashboard drill-through links,
  all-period unpaid fees, and guarded asynchronous directory/pagination loading.
  Monthly generation keeps its explicit company-local month and confirmation.
- Extracted shared Member selection/loading/payment composition. Profile, global
  and fee-row actions use one dialog with entry and review steps. Fee-row preview
  targets the selected fee, while oldest-debt allocation remains an explicit
  alternative. Review shows Member, Branch, billing month, distribution and credit.
  Uncertain requests reuse the exact payload/key, including after dialog dismissal
  within the same app session. Definite conflicts require fresh balance review.
- Added server targeting authorization and unpaid filtering before pagination.
  Receipt date filters now share dashboard company-timezone boundaries. A new
  simultaneous-payment regression exposed two accepted payments exceeding one
  fee's balance. Transactional balance checks now reject the second allocation
  and roll back its payment; simultaneous identical retries return one receipt.
  Both focused regressions passed. No schema, data migration, scheduled generation,
  financial rule change or deployment.
- Regression suite: 219 tests across 20 Workers files passed, including targeted
  later-month payment, partial/full settlement, idempotent retry, reversal,
  overpayment credit, paid-target/conflict rejection, unpaid pagination,
  cross-Member/tenant/Branch denial, company-local dates, legacy routes,
  simultaneous balance conflicts and simultaneous idempotent retries.
  Typecheck, lint, 27 environment checks, 2 i18n checks, 2 form checks, and dev,
  production and local build/deployment dry runs passed. A catalog guard initially
  rejected a new key containing the reserved lowercase word `document`; the key
  was renamed and the checks rerun successfully. Final UI-only focus/scope changes
  were followed by another typecheck, lint, i18n check and local build. After the
  concurrency fix, all checks above, all 219 Workers tests and all three target
  build/deployment dry runs passed again.
- Isolated browser checks used synthetic data, with no real payments or emails:
  50,000 + 30,000 settled September's 80,000 fee and preserved August's balance;
  receipt history/pagination showed both entries. Profile payment refreshed the
  balance to zero and selected history. A Member without fees showed explicit
  credit; switching destination reviewed two fees for one payment. Lost-response
  retry (including close/reopen) returned one receipt; a changed balance returned
  to entry with a fresh preview. Verified generation review, legacy redirects,
  filter retention between tabs, Member search limited to the switched Branch,
  staff action restrictions, English/Spanish, Escape/focus return and single-dialog
  review focus. Responsive checks at 320px, 390px, 1100px and 1440px showed no
  horizontal page overflow. Existing bundle-size advisories remain.
  Removed temporary fixtures and checked the live LAN health endpoint: HTTP 200,
  application and database OK. The normal development server remains running.

## 2026-09-18 — Branch directory table

- Replaced Branch cards with the shared directory table surface: Branch name,
  current-Branch badge and right-aligned Edit name action. Preserved search,
  current-first ordering, creation, centered editor, permission gates and APIs.
- Isolated browser QA at 1440px and 390px confirmed table semantics, names and
  badge wrapping, no horizontal overflow, search/count/no-results/reset, opening
  an editor from its row, simulated rename/refresh and Escape focus return.
  English limited-admin mode showed its single assigned Branch and no creation
  action. No console errors were observed; no real Branch records were changed.
- Typecheck, lint, 27 environment checks, 2 i18n checks, 2 form checks and all
  212 Workers tests passed, along with dev, production and local build/deployment
  dry runs. LAN health returned HTTP 200 with database status OK.
  Temporary QA fixtures were removed; the normal development server stayed up.

## 2026-09-18 — Users and permissions table

- Replaced staff cards with a semantic directory table matching the Member,
  charges and payments tables: identity/email, role, Branch scope, status and
  authorized actions. Financial/delegation details expand under the role;
  restricted scope explanations and pending activation remain visible.
- Moved Add user to the header and reused the centered form for access editing,
  restoring focus to the relevant row action on dismissal. Preserved the guarded
  directory, mutation routes and permission checks; no backend changes.
- Isolated browser QA at 1440px, 1100px and 390px verified long names/emails,
  responsive layout without horizontal overflow, permission disclosure, edit
  dialog/save/focus return, create dialog/Escape, confirmed deactivation and
  activation resend feedback. Mutations used synthetic responses only: no real
  user permissions changed and no emails were sent. English limited-admin mode
  retained read-only entries and hid owner-only financial details. Also checked
  loading skeletons, an empty directory and recovery through the retry action.
- Typecheck, lint, 27 environment checks, 2 i18n checks, 2 form checks and all
  212 Workers tests passed, as did dev, production and local build/deployment
  dry runs. Existing bundle-size advisories remain. The normal LAN
  server health endpoint returned HTTP 200 with database status OK. Temporary
  browser fixtures were removed.

## 2026-09-18 — Branch management redesign

- Replaced inline create/rename forms with shared centered dialogs and a
  searchable responsive card directory. The current Branch is highlighted and
  sorted first, with a short workspace-switching explanation. Add branch is a
  header action; card edit buttons have Branch-specific accessible names.
- Forms keep the existing Better Auth Team APIs and role/scope guards. Blank
  or unchanged names cannot be saved, pending requests disable controls and
  dismissal, and failures preserve the name with local error feedback. Successful
  saves refresh the app-shell list and announce creation or renaming.
- Browser QA used synthetic Branches and the actual Better Auth client with
  intercepted fixture responses. At 1440px and 390px verified layout, long names,
  creating a Branch, renaming the current Branch (including summary refresh),
  search/no-results/reset, unchanged-name prevention, Escape dismissal and
  failed-save input retention. No horizontal overflow was observed. English
  limited-admin mode showed only the assigned Branch with rename and no creation;
  member mode redirected to the dashboard. An empty owner workspace retained
  the create action and omitted the current-Branch summary.
- Typecheck, lint, 27 environment checks, 2 i18n checks, 2 form checks and all
  212 Workers tests passed, as did dev, production and local build/deployment
  dry runs. Existing bundle-size advisories remain. No real Branch records,
  permissions, schema or dependencies were changed; no deployment occurred.
  Removed QA fixtures and retained the normal LAN development server.

## 2026-09-18 — Plans workspace redesign

- Reorganized Plans into a searchable, status-filtered card directory with active
  plans first. Cards show monthly price, due day, Branches, tags and status, with
  edit/activation actions. Billing configuration is a separate header dialog.
- Added a shared create/edit PlanEditor using CenteredDialog and MoneyInput.
  Essential fields remain visible, description/tags use an optional disclosure,
  and a price/day summary previews the terms. Branch selection defaults to the
  current workspace; editing retains shared assignments. Empty selection blocks
  saving, failed saves retain input, and pending requests disable fields/dismissal.
  Added matching PlansSkeleton, first-plan guidance and filter-reset empty states.
- Synthetic browser checks at 1440px, 900px and 390px covered Spanish/English,
  long names, custom tags, active/inactive plans, empty setup and single/multiple
  Branches. No horizontal overflow or unexpected console errors were observed.
  Created a fixture at 80,000 with a tag, searched by that tag, edited its Branches
  and confirmed removal from the current Branch. Verified activation under the
  inactive filter, confirmed deactivation, failed-save value retention, initial
  currency setup, and Escape dismissal. Single-Branch forms omit Branch choices.
- Typecheck, lint, 27 environment checks, 2 i18n checks, 2 form checks and all
  212 Workers tests passed. Dev, production and local build/deployment dry runs
  passed; existing bundle-size advisories remain. Rechecked translations after
  the final singular-count copy adjustment. No real business data was mutated,
  no dependency/schema changes or deployments were made, and QA fixtures were
  removed. The normal LAN development server remains running.

## 2026-09-18 — Payments table and development server recovery

- Payments now shares the Member directory table styling, responsive labeled
  fields, clickable rows and initial skeletons. Member/receipt, date, method,
  status, amount/credit and permitted cancellation actions remain visible.
- Isolated browser checks with synthetic payments covered desktop (1440px),
  mobile (390px), English read-only mode (900px), long names/custom methods,
  posted/cancelled payments and unapplied credit. No horizontal overflow or
  browser errors were observed. Verified cancellation with a reason updates the
  fixture row without navigation, paging adds the next record, clicking a method
  cell opens the Member profile, and unmatched search shows the empty state.
  Read-only users have no Actions column or cancellation buttons.
- Typecheck, lint, environment/i18n/form checks and all 212 Workers tests passed,
  followed by dev, production and local build/deployment dry runs. No deployment
  or real payment mutation occurred. Temporary browser fixtures were removed.
- Investigated a reported ERR_CONNECTION_REFUSED: no process was listening on
  port 5173 and the previous development process was absent. The retained log
  did not establish the termination cause. Restarted the normal local-dev
  command in a hidden background process, retaining remote dev D1 and real email.
  The LAN health endpoint returned HTTP 200 with database ok and the actual home
  page rendered in the browser. No database reset was needed.

## 2026-09-18 — Charges directory table

- Replaced the Charges record list with a semantic table using the existing
  Member directory styles, row hover, border, header and responsive layout.
  Columns show Member, Plan, localized due date, payment state, outstanding/original
  total and authorized actions. Initial loading uses matching skeleton rows.
- Browser checks with synthetic data covered desktop (1440px), intermediate
  width (900px) and mobile (390px), all five payment states, long names/Plans,
  Spanish/English and read-only permissions. No horizontal overflow or browser
  errors were observed. Mobile rows retain labeled fields and usable actions.
- Verified row and keyboard-link navigation to Member profiles, payment-state
  filtering, search with no results, adjustment confirmation updating a fixture
  balance from 80,000 to 79,000, and opening/cancelling the void dialog without
  navigating away. Paid, partially paid and void rows omit mutation buttons;
  users without adjustment permission have no Actions column.
- Typecheck, lint, 27 environment checks, 2 i18n checks, 2 form checks and all
  212 Workers tests (19 files) passed. Dev, production and local build/deployment
  dry runs passed; no deployment was performed. The existing bundle-size advisory
  remains. Temporary fixtures were removed, no real records were changed, and
  the running LAN development server returned HTTP 200 with database status ok.

## 2026-09-18 — Grouped monetary inputs

- Added exact react-number-format 5.4.5 behind MoneyInput, using the existing
  Input styling. Payment amount/allocation, plan creation/editing, future monthly
  terms/discount and signed charge adjustments use localized grouping while
  keeping unformatted decimal strings in state and form submission. Ordinary
  numbers, including due days, retain their original behavior. Required, bounds,
  two-decimal precision and safe minor-unit validation remain enforced.
- Browser fixtures exercised the real payment and future-terms dialogs plus
  the shared input in a native form. Typed 80000 displayed 80.000; middle edits
  retained caret behavior; pasting 80.000,50 recorded 8000050 minor units with
  0.50 credit. A 1.000 discount reduced an 80.000 monthly fee to 79.000. Allocation
  40.000,25 left exactly 39.999,75 in credit. Signed -12.500,25 submitted canonical
  -12500.25; invalid min/max amounts blocked submission. English 80,000.50 also
  submitted 80000.50. Verified 390x844 layout and decimal input mode for payments.
  No browser errors/warnings or real business writes occurred. Temporary preview
  artifacts/server were removed and the viewport reset.
- Four regression cases cover Spanish/English grouping, four-digit values,
  cents, signed values, limits and invalid/unsafe canonical amounts.
  Drizzle generation reported no schema changes, and its migration check passed.
- Typecheck, lint, 27 environment checks, two catalog checks, two form checks,
  all 212 Worker tests and all three environment builds/deployment dry runs
  passed. Both npm audits reported zero vulnerabilities; the existing bundle
  size advisory remains. Live dev health returned HTTP 200/database `ok`.

## 2026-09-18 — Prefilled Member payment amount

- Opening Record payment now snapshots a suggested amount from the oldest open
  charge's remaining balance in the current Branch, or active agreed fees less
  discounts if no pending charge exists. Other Branches, paused/ended fees and
  void/paid charges do not contribute. Without an eligible source, it stays
  blank. Manual changes persist while editing; cancellation/reopening refreshes
  the default. Preview and final confirmation remain required.
- Added four regression cases covering partial/oldest charges, ignored charges,
  Branch separation, discounts, multiple active fees and missing fees. The pure
  calculation stays independent of browser transport types.
- Browser QA used the real detail page with synthetic responses: a 20,000 fee
  with a 5,000 discount opened at 15,000; editing to 5,000 updated the preview;
  cancel/reopen restored 15,000. A partially paid charge opened at 7,500.50 and
  confirmed that exact amount, updating its receipt and balance. Keyboard
  clearing left the field blank and disabled submission; a Member with no fees
  opened blank. No browser errors/warnings or real payment writes occurred.
  Temporary fixtures/server were removed. Live dev health returned HTTP 200
  with database status `ok`.
- Typecheck, lint, 27 environment checks, two catalog checks, two form checks,
  all 208 Worker tests and all three environment builds/deployment dry runs
  passed. The existing bundle-size advisory remains.

## 2026-09-18 — Open Member profiles from the whole row

- Removed the separate View member action and column; rebalanced the five
  remaining columns. Row clicks now navigate to the Member, with a selection
  guard to avoid navigation after copying text. The name remains a native link
  for keyboard access and standard browser link gestures.
- Verified clicks on a document cell on desktop and a balance on mobile,
  plus Enter on the Member name, using a synthetic two-Member fixture. Each
  reached the correct profile; no browser warnings/errors occurred. Removed
  the temporary fixture/server and reset the viewport. Typecheck, lint and
  scoped diff checks passed.

## 2026-09-18 — Responsive Member directory table

- Replaced the Member record list with a semantic table: name, document,
  phone/email, status, outstanding balance and an explicitly named profile link.
  Added matching skeleton rows, subtle row boundaries and hover/focus treatment.
  Narrow containers stack labeled fields without horizontal scrolling; initials
  avatars and standalone currency captions remain absent.
- Browser QA used the actual directory with isolated, synthetic API responses.
  Verified desktop at 1440px, a 768px viewport and mobile at 390x844, including
  long names/emails, missing fields, all Member states, zero/fractional balances,
  search, status filtering, Load more, loading/empty states and keyboard profile
  navigation. English and Spanish labels were checked. No browser errors or
  warnings occurred; no real records were modified. Removed the temporary
  fixture and preview server and reset the viewport afterward.
- Typecheck, lint, 27 environment checks, two catalog checks, two form checks,
  all 204 Worker tests and all three environment build/deployment dry runs
  passed. The existing bundle-size advisory remains. Live dev health returned
  HTTP 200 with database status `ok`; the user's server remained running.

## 2026-09-18 — Removed standalone currency captions

- Removed the currency caption from Members, Charges, Payments and Reports and
  deleted the now-unused CurrencyLabel component. Currency selectors, amount
  field labels and shared monetary formatting remain available.
- Source search confirmed no remaining component references or standalone
  currency captions. Typecheck, lint and scoped diff checks passed.

## 2026-09-18 — Member detail layout and focused forms

- Reorganized Member detail into Summary, Payment history and Personal
  information. Identity, current Branch, status and Edit/Record payment actions
  lead the page; three distinct balance cards preserve ledger meaning. Mobile
  groups the secondary cards, wraps actions and stacks content without overflow.
- Enrollment cards show monthly price and state; charge cards show readable
  periods, due dates, payment state and outstanding amounts. Payment history
  includes every returned receipt with amount, date, method and state. Personal
  information groups profile fields, notes, status actions and linked contacts.
- Enrollment, contact and payment forms now open in CenteredDialog. Payment
  review retains the nested confirmation and LAN-compatible idempotency helper.
  Preview lookup has a loader, explicit retry and stale-response cleanup.
  Successful posting closes both dialogs and selects the refreshed history.
- Browser QA used the actual page with isolated in-memory API fixtures on LAN
  HTTP. Checked desktop and 390x844, Spanish and English, populated/empty states,
  enrollment/contact creation, profile dialog, outside dismissal, Escape and
  focus return. A simulated preview failure recovered via retry; a simulated
  save failure retained confirmation and retry produced a receipt, zero balance
  and history entry. Browser error/warning logs were empty. No real business
  records or payments were created. Removed the temporary fixture and server.
- Typecheck, lint, 27 environment checks, two catalog checks, two form checks
  and 204 Worker tests passed. Dev, production and local builds/deployment dry
  runs passed; the existing bundle-size advisory remains. The live dev server
  stayed running and returned HTTP 200 with database status `ok`.

## 2026-09-18 — Payment confirmation on LAN HTTP

- Reproduced the reported inactive payment button in the real
  CustomerMemberDetailPage with synthetic data on the LAN HTTP address. The
  browser reported `crypto.randomUUID is not a function` before opening the
  confirmation; its context was non-secure and that method was undefined.
- Replaced direct browser randomUUID calls in payment review and Member import
  with a shared opaque key generated from 16 cryptographically random bytes.
  Added a regression test with crypto.randomUUID absent. Worker-generated IDs
  and the payment API's existing idempotency behavior remain unchanged.
- Repeated browser QA on the same LAN origin: review opened the shared dialog,
  a simulated failed save retained the confirmation, retry reused the same key,
  and success displayed one receipt, a recent payment and an updated zero
  balance. All payment responses were in-memory fixtures; no real payments or
  business records were created. Removed the isolated preview afterward.
- Typecheck, lint, 27 environment checks, two catalog checks, two form checks
  and all 204 Worker tests passed. All three environment builds/deployment dry
  runs passed, retaining the existing client bundle-size advisory.
  The live development health endpoint returned
  HTTP 200/database `ok`; its server remained running throughout the fix.

## 2026-09-18 — Active Branch product workspace isolation

- Fixed the Plans directory loading every company Plan and creation selecting
  every Branch by default. Catalog reads now use the validated session Branch,
  preserve full authorized links for shared-Plan editing, and cards show Branch
  assignments. Defaults select only the active Branch; route content remounts
  after switching to discard previous data and unsaved form state.
- Applied the same workspace boundary to Members, Enrollments, Charges,
  generation, Payments, dashboard, reports and exports. Explicit Enrollment
  links retain shared/historical Member visibility; ledger queries still separate
  each Branch. Member-detail forms use the current Branch for enrollment/payment.
  Company administration/catalog settings retain their Organization scope.
- Added five Worker/D1 regression cases covering exclusive/shared/empty Plan
  catalogs, preserved edit links, Branch switching, Member lists/detail, ledger
  and dashboard totals, reports/exports, rejected cross-Branch overrides, scoped
  generation and a moved/shared Member's separate history and payable charges.
  All 203 Worker tests passed with two workers, along with typecheck, lint,
  27 environment checks, two catalog checks and two form checks. Dev, production
  and local builds/deployment dry runs all passed; the existing Vite client
  bundle-size advisory remains.
- Browser QA rendered the real BillingSetupPage with a synthetic shell and
  in-memory API responses in an isolated preview. Verified creation in Vida B
  without appearing in Main, shared-Plan editing, immediate removal after
  unassigning the current Branch, reset form defaults, an empty Branch and a
  390px layout. No browser warnings/errors; temporary preview removed.
- The real LAN login rendered without errors and `/api/health` returned HTTP
  200/database `ok`. No remote business records, schema changes, emails or
  deployments were performed. Existing saved Branch assignments are preserved.

## 2026-09-18 — Shared language selector flags

- Added pinned flag-icons 7.5.0 with direct Spain/United States SVG imports to
  LanguagePicker. Both selected values and menu options retain language names;
  flags are decorative and non-draggable. The menu has enough width for labels
  and selection indicators without changing other select menus.
- Browser QA on the live public home and login verified compact and regular
  selectors, desktop and 390px layouts, mouse language switching and keyboard
  typeahead/selection. Restored Spanish after testing. No console warnings/errors.
- Typecheck, lint, 27 environment checks, two catalog checks, two form checks,
  all 198 Worker tests with two workers and all three environment builds/deployment
  dry runs passed. Production dependency audit reported zero vulnerabilities.
  No business records, emails or deployments were created by this verification.

## 2026-09-17 — Navigation and dashboard caption cleanup

- Removed the visible workspace caption from desktop/mobile navigation and the
  currency caption above dashboard metrics. Kept the mobile drawer's accessible
  title visually hidden and adjusted navigation padding below the logo.
- Browser QA rendered the real AppLayout and DashboardPage with synthetic
  session, company, branch and metrics data. Verified desktop and 390px layouts,
  mobile drawer opening/closing, retained currency symbols and no console errors.
- Typecheck, lint, Node checks, all 198 Worker tests with two workers and all
  three environment builds/deployment dry runs passed. Removed the isolated
  preview and confirmed LAN development health returned HTTP 200/database `ok`.

## 2026-09-17 — Native selected-text drag mitigation

- Added TextDragGuard at the application root to cancel native drags starting
  from selected non-editable text, including dialog portals. Kept selection/copy,
  input editing and explicit draggable controls available; no global click,
  pointer, selection or overlay-state resets were introduced.
- The reported Chrome loss of clicks after text selection resembles
  [Chromium issue 560371177](https://issuetracker.google.com/issues/560371177).
  The user's blocked Chrome tab was not connected to the browser tools, so this
  is a mitigation of the suspected trigger, not a confirmed reproduction or a
  recovery of that existing browser state.
- Browser QA with real shared components and synthetic text confirmed dragstart
  cancellation for selected page/dialog text, working clicks afterward, normal
  popup opening/backdrop dismissal, select changes and allowed input-text drags.
  The isolated preview disabled HMR during the final checks to avoid unrelated
  concurrent landing updates resetting fixture state. No console warnings/errors.
- Typecheck, lint, 27 environment checks, two catalog checks, two form checks,
  198 Worker tests with two workers and all three environment builds/deployment
  dry runs passed. No database writes, email sends or deployments were performed.

## 2026-09-17 — Public landing redesign

- Reworked the public home with a navy/blue editorial hero, an explicitly
  fictional interactive preview, product benefits, workflow, FAQs and contact
  links to MagdaSystems. Preserved the closed provisioning model and both catalogs.
- Browser QA covered desktop and narrow layouts (312 and 390 CSS pixels),
  English/Spanish switching, mouse and arrow-key preview tabs, section anchors,
  native FAQ expansion, the external contact destination and the login route.
  No horizontal page overflow was observed. Corrected a decorative note that
  overlapped the fictional-data caption on mobile and rechecked its bounds.
- Typecheck, ESLint, 31 Node checks and all 198 Worker tests passed. The local
  optimized build passed; Vite retained its existing large-chunk warning.
  No remote deployment or business-data mutation was performed.

## 2026-09-17 — Shared dialog backdrop dismissal

- Enabled backdrop dismissal in CenteredDialog whenever no save is pending.
  All consumers inherit the behavior; pending saves continue to block dismissal.
- Browser QA used the real shared dialog and select with synthetic form state.
  Verified backdrop dismissal on desktop and at 390px, focus restoration, no
  save on dismissal, inside clicks and nested selection keeping the dialog open,
  and backdrop clicks remaining blocked during a simulated pending save.
- All quality-gate stages passed: typecheck, lint, 27 environment checks, two
  catalog checks, two form checks, 198 Worker tests with two workers, and all
  three environment builds/deployment dry runs. Browser console had no warnings
  or errors. Removed the isolated preview; the existing LAN development server
  returned HTTP 200 with database status `ok`.

## 2026-09-17 — Settings page organization and header action

- Reorganized Settings into a company summary, paired language cards on desktop,
  a payment-method catalog and a billing-settings card linking eligible managers
  to Plans. Used consistent surfaces, spacing and responsive stacking.
- Moved Add payment method to the catalog's top-right corner beside its title;
  its description spans the row below. Mobile places the full-width action after
  the description. Method status uses badges; row actions remain grouped.
- Browser QA rendered the actual Settings page with synthetic company preferences
  and Cash/custom active/inactive methods. Verified desktop placement, the 390px
  mobile layout, Add opening its dialog, Cancel restoring focus and company
  language saving with translated success feedback. No real settings were changed.
- All quality-gate stages passed: typecheck, lint, Node checks, 198 Worker tests
  with two workers, and dev/production/local builds and deployment dry runs.
  Browser console had no warnings/errors. Removed the preview and verified the
  existing LAN development server returned HTTP 200 with database status `ok`.

## 2026-09-17 — Payment-method Settings action placement

- Matched the payment-method card to the language-settings width and moved Add
  below the list into a separated footer. The button aligns left on desktop and
  fills the available width on mobile.
- Browser QA rendered the real Settings page with a synthetic cash-only catalog.
  Verified desktop/mobile placement, popup opening and Cancel returning focus to
  Add; no console warnings/errors. Removed the temporary preview. The existing
  development server remained available with HTTP 200 application/database health.
- Typecheck, lint and Node checks passed. The first Worker run hit the existing
  access-control setup timeout; rerunning with two workers passed all 198 tests.
  All three environment builds and deployment dry runs passed afterward.

## 2026-09-17 — Company payment methods

- Cash is the sole default for new payments. Settings provides company-scoped
  custom methods with creation, rename, deactivation and reactivation. Management
  requires Owner or all-Branch admin permissions. Historical payments and CSV
  exports retain the original method-name snapshot; legacy methods remain
  available only for existing-history filters and idempotent retries.
- Generated migration `0012_sudden_bruce_banner.sql` with Drizzle and reviewed its
  additive table/index/two-column changes. Applied it successfully to local D1
  and the configured remote **dev** D1. No production migration or deployment.
- `npm run check` passed with 198 Worker tests, catalog/form/environment checks
  and all three target builds/dry runs. Six new Worker tests cover defaults,
  authorization, tenant isolation, duplicate names, inactive/foreign-method
  rejection, name snapshots, exports, legacy history and idempotent retries.
  Rechecked typecheck/lint after the final presentation adjustments.
- Browser QA used actual Settings, Member and Payments pages against isolated
  in-memory HTTP fixtures. Created Nequi, recorded a test payment, renamed and
  deactivated the method, verified only Cash remained for new payments, and
  filtered the historic payment while retaining its original Nequi label.
  Checked the shared creation popup at 390px and blank-name submission blocking;
  browser console had no warnings/errors. Removed the temporary preview; no real
  member/payment records were created or changed by these QA fixtures.
- Restarted the unavailable development server with `npm run dev`; its LAN
  health endpoint returned HTTP 200 with application/database status `ok`.

## 2026-09-17 — Member profile editing popup

- "Edit member" opens the existing profile form in the shared centered dialog
  with prefilled values, Cancel/Close controls and responsive scrolling. Saving
  blocks repeat submissions and dismissal; failures preserve the form. Date
  popovers now remain above the dialog without changing generated UI components.
- Browser QA used the actual detail page and API client against isolated,
  in-memory HTTP fixtures. Verified prefilled fields, date selection, disabled
  controls while saving, retained values after a simulated error, successful
  retry, automatic closure and refreshed profile. Cancel discarded unsaved edits
  and returned focus to Edit member. At 390px, the form scrolled vertically with
  no horizontal overflow. No real member data was modified; removed the preview.
- `npm run check` passed: 192 Worker tests, environment/catalog/form checks,
  typecheck, lint and all three environment builds/dry runs.

## 2026-09-17 — Popup headers without decorative icons

- Removed the decorative message/warning badges from `CenteredDialog`, shared
  by Member/User creation and Member, Payment, Charge and other action popups.
  Headers start at the title with space reserved for Close. Destructive actions
  retain their confirmation button styling.
- Browser QA rendered the real shared components with synthetic callbacks.
  Verified the action header on desktop and creation header at 390px: no badge,
  no horizontal overflow, a working Close button and restored trigger focus.
  The creation popup contained only the functional Close icon, and the browser
  reported no warnings or errors. Removed the temporary preview.
- `npm run check` passed, including typecheck, lint, tests and all three target
  builds/dry runs. The existing development server remained running; its health
  endpoint returned HTTP 200 with application and database status `ok`.

## 2026-09-17 — Simplified header language options

- Header and mobile-navigation pickers now offer only English and Español.
  Inherited preferences display their resolved language without a company
  suffix. Settings alone opts into the company-inheritance choice through
  `allowCompanyLanguage`; personal preference persistence is unchanged.
- Browser QA used the real LanguagePicker with a synthetic authenticated
  context inheriting Spanish. The compact trigger displayed Español and its
  popup contained exactly two options. Selecting English and Español called
  the save handler with `en` and `es` respectively. No real account was changed,
  and the browser reported no warnings or errors. Removed the temporary preview.
- `npm run check` passed, including 192 Worker tests, catalog/form/environment
  checks, typecheck, lint and all three environment builds/dry runs.

## 2026-09-17 — Member and User creation popups

- "Add member" and "Add user" now open their feature forms in a centered
  popup using `CenteredDialog`, the presentation also shared by action dialogs.
  Retained the original API calls, Branch selections and User permissions.
  Pending requests disable dismissal and fields; errors keep entered data.
- Browser QA used the actual directory pages and API clients with synthetic
  HTTP fixtures. Verified blank-name blocking, required User Branch selection,
  role-dependent fields, nested Select interaction, error retention and retry,
  Cancel/Escape focus restoration, and successful create/close/list refresh.
  The User request preserved the selected north Branch and report permission.
- Inspected the Member popup at 1440×900; tested the User popup at 390×844 and
  320×680. Forms stayed inside the viewport without horizontal overflow and
  scrolled vertically when needed. Reloaded the fixture and confirmed reopening
  resets the creation fields. No real Member, User or email was created.
- Removed the temporary preview and its dependency cache before the final gate.
  The initial lint attempt included generated fixture dependencies; they were
  removed rather than weakening project lint rules.
- Final `npm run check` passed with typecheck, lint, 27 environment/bootstrap
  checks, 2 catalog checks, 2 form/dialog checks, 192 Worker tests and all three
  environment build/dry runs. The live development health endpoint returned
  HTTP 200 with database status `ok`.

## 2026-09-17 — Shared centered action dialogs

- Replaced all native browser prompts/confirmations in Member detail, Charges,
  Payments and Plans, and the inline User-access confirmation, with a shared
  Base UI dialog. Enrollment terms now use one form; payment review includes
  its amount and allocations. The existing drawer/date/select behavior stays
  separate. Added an automated guard against native browser dialogs.
- Browser QA used the actual pages and API clients with an isolated HTTP fixture
  and synthetic records, without writing to remote D1 or sending emails. At
  1440×900 the reason dialog was centered and 512 pixels wide. At 390×844 and
  320×680, dialogs fit without horizontal overflow; the longer terms form
  scrolled vertically within the viewport.
- Verified blank/whitespace reasons cannot submit, excessive discounts show
  validation, failed saves retain the reason, and pending saves disable controls.
  Cancel and Escape made no writes and returned focus; Tab remained in the
  dialog. Verified terms and enrollment status PATCH payloads, charge adjustment
  and User access changes, plus the payment review, Contact unlink, Charge void
  and Plan deactivation confirmations using fixture data.
- `npm run check` passed: 27 environment/bootstrap checks, 2 catalog checks,
  2 form/dialog convention checks, 192 Worker tests and all three environment
  builds/dry runs. Typecheck and lint were repeated after the feedback typing
  change. The final fixture browser console had no warnings or errors. The
  fixture was stopped and removed; the live development login page rendered
  successfully afterward. No commit, push or deployment was performed.

## 2026-09-17 — Restored nonempty member lists

- Reproduced a successful Member POST followed by a failing list GET in the
  actual Workers/D1 test runtime. The balance query's nested SQL lost column
  qualification and D1 rejected the ambiguous `amount_minor` reference, including
  for newly created Members without Charges. Empty lists skipped that query.
- Replaced the nested balance query with explicit joins and per-Charge payment
  aggregation before summing Member balances. Multiple allocations cannot repeat
  Charge totals; only posted Payments and open Charges affect the balance.
- The 14-test MVP workflow passes with create-then-list regression assertions
  and balance checks after partial Payments, reversals, multiple open Charges,
  adjustments, voids and multiple Payments against one Charge. Requests use
  both owner and branch-scoped staff access; foreign-tenant lists remain empty.
- The running development server's `/api/health` returned HTTP 200 with database
  status `ok`. These checks did not create Members in the remote tenant; the
  create/list workflow was verified against isolated D1 test data.
- Typecheck, lint, 27 environment/bootstrap checks, 2 catalog checks and the form
  check passed. The first full Worker run timed out in the access-control setup
  hook; repeating all Worker tests with `--maxWorkers=2` passed all 192 tests.
  `npm run check:environments` then passed all three builds and deployment dry
  runs. No migration or remote deployment was needed.

## 2026-09-17 — Restored member and related form submission

- Reproduced the member-create failure using the actual CustomerMembersPage and
  API client against a temporary in-memory HTTP fixture. The rendered save
  button had `type="button"`; clicking it left the form open with no POST.
- Added explicit `type="submit"` to eight save actions: member creation/profile,
  enrollments, payments, contacts, billing settings and plan creation/editing.
  Kept the shared Button default and non-submit actions unchanged.
- After the fix, clicking save sent one POST with the selected north branch,
  closed the form and refreshed the list. The fixture member remained visible
  after a page reload. At 390 pixels, Enter saved a second member using the
  default main branch; an empty name kept save disabled. No browser errors were
  recorded. The fixture used no real accounts, database writes or emails and
  was removed afterward; live-tenant creation was not exercised.
- Added `npm run test:forms` to the normal test chain. The regression check
  failed on all eight missing button types before the fix and passed afterward.
  `npm run check` passed with 27 environment/bootstrap checks, 2 catalog checks,
  the new form check, 192 Worker tests and all environment build/dry runs.

## 2026-09-17 — Styled dropdowns throughout the application

- Replaced 20 native select fields with a shared Base UI Select wrapper. Filters,
  forms and company/branch/language switching retain their value handlers,
  conditional options, disabled states and form names. Calendar month/year
  selectors also use the wrapper. The native blue option highlight is replaced
  by neutral rows, a selection check, rounded corners and a soft popup shadow.
- `npm run check` passed, including 192 Worker tests, catalog checks and all
  environment builds/dry runs. Browser QA used the actual Charges page with
  fixture read responses, plus shared form/calendar controls, without real writes.
  At 1440 and 320 pixels, inspected popup styling, long-label wrapping and no
  horizontal overflow. Verified arrow-key and typeahead selection updates the
  Charges URL, required empty values block submission, named form values submit,
  disabled controls/options remain disabled, and Escape restores trigger focus.
- Calendar testing found its absolute navigation bar intercepting clicks on the
  new month/year triggers. Relative positioning fixed the hit target. Mouse
  selection of April 2025 and a day returned the expected `2025-04-01` value.
  No browser warnings or errors were recorded in the final preview.

## 2026-09-17 — Shared date pickers and neutral focus borders

- Added pinned React DayPicker 10.0.1/date-fns 4.4.0 with shadcn Calendar and
  Base UI Popover. Shared month, single-date and range wrappers replace native
  date/month inputs in Dashboard, Charges, Reports, Payments and Member detail.
  Payments applies draft ranges explicitly and retains open-ended filters.
- Neutral focus tokens replace blue outlines, including native selects; shared
  Button/Input hover borders also use neutral tokens. Keyboard focus remains
  visible. Calendar values serialize local fields without UTC date shifts.
- `npm run check` passed: 27 environment/bootstrap checks, 2 catalog checks,
  192 Worker-runtime tests and all three build/dry runs. Three new tests cover
  calendar serialization, invalid dates, leap days and billing periods. After
  browser-discovered width and keyboard fixes, typecheck, lint and the local
  production build passed again. Both npm audits reported zero vulnerabilities.
  Vite still reports the existing main-chunk size advisory; this change adds
  calendar code to that shared bundle.
- An isolated interactive preview used the actual date components and compiled
  application CSS. Verified month/year selection, range apply/clear, an
  end-only range, draft cancellation, English/Spanish labels, birth-date form
  serialization and keyboard arrows/Enter/Escape with trigger focus restoration.
  Reviewed desktop at 1440 pixels and mobile at 390 and 320 pixels. At 320,
  popup scrollWidth equals clientWidth and the page has no horizontal overflow.
  Computed native-select focus color is neutral `rgb(115, 115, 115)`.
  No browser errors were recorded after the fixes. No real records were changed;
  this preview does not replace an authenticated end-to-end payment filter test.
- Restarted the existing development server after dependency installation left
  its old client blank. The actual login page then rendered successfully at
  `http://192.168.1.235:5173/login` with no browser errors.

## 2026-09-17 — Sidebar branding and company header refinement

- Integrated the linked logo into the sidebar without a separator, added a soft
  sidebar shadow and clearer active navigation styling. Header identity now
  stacks company and branch; account controls include initials, name, role and
  a compact inherited-language label. Mobile drawer controls retain access to
  language and sign-out, with 44-pixel menu and close targets.
- `npm run check` passed with 189 Worker tests and all target build/dry runs.
- An interactive, isolated preview reused the actual shell presentation and
  components with fixture company data. Desktop appearance was reviewed at 1440
  pixels; long names produced no horizontal overflow at 320, 768, 1024 and 1440
  pixels. The drawer opened at 390 pixels, showed its account controls, closed
  with Escape and restored focus. No browser errors were recorded. The preview
  did not test remote switching or sign-out and was removed afterward.

## 2026-09-17 — Continuous company header

- Removed the desktop sidebar's right border and matched the company header to
  its opaque background. Navigation and responsive behavior are unchanged.
- An isolated render of the actual shell presentation confirmed a zero-width
  sidebar border and matching backgrounds at 1440 pixels, with no horizontal
  overflow at 390 pixels. The temporary preview was removed afterward.
- `npm run check` passed, including 189 Worker tests and all target dry runs.

## 2026-09-17 — Currency symbol before the amount

- The shared money formatter now places the actual currency symbol first,
  followed by a nonbreaking space and a localized number, including `$ 0`.
  Integer amounts stay compact; negative balances and hundredths are preserved.
- Updated localization assertions cover symbol position and spacing in Spanish
  and English for pesos, dollars and euros. `npm run check` passed, including
  all 189 Worker tests, typechecking, lint and all three build/dry-run targets.

## 2026-09-17 — Restored file terminology and compact currency display

- Restored Import CSV and Export labels, including import controls and export
  permissions. Kept explanatory upload guidance and the other plain-language copy.
- Amounts now use compact currency symbols. Whole values omit decimals; values
  with hundredths preserve both digits. A shared currency caption names the
  currency once above financial data rather than inside every amount.
- `npm run check` passed, including 189 Worker tests and all three build/dry-run
  targets. Typechecking and lint also passed after adding currency captions to
  payment, charge and member-detail pages.
- Actual dashboard metric components and restored file action labels were
  rendered in a temporary static fixture. At 320, 390 and 1440 pixels, large
  amounts remained on one line with no horizontal document overflow. Preview
  resources were removed; no remote data or deployment was changed.

## 2026-09-17 — Plain-language interface copy

- Replaced technical action labels across members, payments, reports and access
  controls with readable bilingual copy; Spanish consistently uses "sede" and
  "informes". Upload instructions explain the actual CSV requirement and retain
  the existing template contract. Download labels reflect their actual contents.
- Currency names and amounts use shared localized helpers; billing settings
  offer named currencies. A new localization test verifies COP/USD names, zero,
  negative balances and hundredths. Explicit fraction precision prevents
  runtime-specific currency defaults from rounding stored hundredths away.
- `npm run check` passed: typechecking, lint, 27 environment/bootstrap tests,
  two localization boundary tests, 189 Worker tests and builds/dry-runs for all
  three targets. No remote deployment or database writes were required.
- Browser review of actual metric, upload and billing settings components in an
  isolated static fixture at 320 and 1440 pixels found no horizontal document
  overflow. This checked representative copy and long monetary values, not all
  authenticated workflows. The temporary preview was removed afterward.

This is dated execution evidence, not a permanent test-count target or proof of
production deployment. The latest repository checkpoint is recorded first; earlier
localization, environment, Starter v1 and dependency-remediation evidence from
the inherited foundation is preserved below.

## 2026-09-17: Structural loading convention and mobile forms

Added the official shadcn/ui Skeleton primitive, using the existing local `cn`
utility instead of retaining a duplicate dependency added by the generator.
Shared list, dashboard, detail and form patterns now represent known data
layouts. Ring 2 remains the only spinner for authentication and actions. The
convention is recorded in specification 17, README and contributor guidance.
Financial reports now show skeletons before data arrives and discard responses
from obsolete period/company requests instead of rendering a premature empty
table. Loading, failure and data states remain distinct.

Updated shared authentication cards, public branding and page actions for small
screens. Authentication fields/actions are 48 pixels tall with 16-pixel input
text, password visibility controls, bounded card width and natural vertical
scrolling. Mobile action labels wrap inside their buttons; the platform header
uses a full-width action row on small screens.

`npm run check` passed: typecheck, lint, 27 environment/bootstrap tests, two i18n
checks, 188 Workers tests and three target build/dry-runs. Dependency installation
reported zero audit vulnerabilities. The existing client chunk warning remains.
Live public routes (login, recovery, verification, invalid reset and home) were
checked at 320 pixels without horizontal overflow. Password visibility was
exercised with a disposable value without submitting a form. Desktop login was
visually reviewed at 1440 pixels.

An isolated server rendered the actual components with fixture shell context,
without API requests or database writes. Twelve content/form screens were
inspected at 320 pixels; representative dashboard, directory, company creation
and billing screens were checked at 390, 768 and 1440 pixels. No horizontal
overflow was observed. This covers initial loading/form layouts, not every
populated tenant record or physical-device keyboard behavior. Temporary preview
tooling was removed. No deployment, commit or push was performed.

## 2026-09-17: Consistent Ring 2 loading indicators

Pinned `ldrs` to 1.1.9 and introduced shared `Loader` and `LoadingButton`
components. Replaced text-only loading and list/dashboard skeletons across
session guards, localization, platform and tenant screens. Existing busy form
actions and workspace/language selectors use the same ring. Busy buttons retain
their dimensions, have accessible names and disable duplicate submission.
Loading labels are visually hidden; reduced motion stops the animation.

`npm run check` passed after the final accessibility adjustment: typecheck,
lint, 27 environment/bootstrap tests, two i18n checks, 188 Workers tests and
all three build/dry-runs. Installation audit and production dependency audit
reported zero vulnerabilities. `git diff --check` passed. The existing client
chunk-size warning remains.

Rendered the actual components in an isolated local preview using compiled CSS.
Desktop and a 390-pixel viewport showed the same ring for page, section and
button sizes without horizontal overflow. Idle/busy matching buttons measured
the same width and 40-pixel height. Browser accessibility inspection confirmed
busy button names and loading status labels. The development health endpoint
returned HTTP 200 and the live login page rendered after reload. Temporary
preview tooling was removed; no deployment, commit or push was performed.

## 2026-09-17: Branded email action links

Updated the shared transactional email layout with ControlMembers branding,
spacing and an action link styled as a button. Removed visible raw URLs from
HTML while preserving the full destination in the link and plain-text fallback.
Removed the obsolete fallback instruction from both language catalogs. Existing
localization checks now verify the escaped destination and absence of visible
URLs while retaining a usable plain-text link.

`npm run check` passed: typecheck, lint, 27 environment/bootstrap tests, two i18n
checks, 188 Workers tests and all three build/dry-runs. `git diff --check` passed.
The running development health endpoint returned HTTP 200. Subsequent
operator-requested preview messages using this layout were accepted by Cloudflare
Email Sending. Rendering in the recipient's mail client still requires recipient
confirmation. Temporary sending scripts were removed. The existing client
chunk-size warning remains.

## 2026-09-17: Operator-requested remote dev data reset

Exported `controlmembers-dev-db` to an ignored backup before clearing all 23
application tables. Verified every application table was empty, all 12 migration
records were retained and `foreign_key_check` returned no violations. Schema,
local preview data and production were unchanged.

Created the replacement platform administrator with the operator's accessible
email and supplied password through Better Auth. Cloudflare accepted the real
verification email. The local health endpoint returned HTTP 200, and sign-in
returned `EMAIL_NOT_VERIFIED` pending the recipient's verification. Remote checks
confirmed the new admin role, zero organizations and intact migration records.
Temporary administrative tooling was removed. No authentication bypass was added.

## 2026-09-17: Remote dev D1 for the local web

Updated `npm run dev` to use the D1 database declared in `env.dev`, alongside
real Email. The server still binds the local APP_URL. The environment runner
validates the dev UUID and resource isolation, overrides inherited production
selection and clears remote development settings for other operations. Vite
mutates the existing DB binding without changing the source local database
identity. Existing local data is retained separately and was not copied.

Read-only Cloudflare checks confirmed `controlmembers-dev-db` exists, has no
pending migrations and initially contained no users or organizations. Created
the operator-requested first platform administrator through the project's
Better Auth server API with the supplied password. Verified the remote role
and credential presence without reading the hash. Cloudflare accepted the
verification email. A sign-in request through the local web returned HTTP 403
`EMAIL_NOT_VERIFIED`, confirming the remote identity and required verification.
Temporary administrative tooling was removed; no public bootstrap endpoint,
plaintext credential or authorization bypass was added.

`npm run check` passed: typecheck, lint, 27 environment/bootstrap tests, two
i18n checks, 188 Workers/D1 tests and all three build/dry-runs. `git diff --check`
passed. The existing client chunk-size warning remains. Restarted with exactly
`npm run dev`; the remote connection and health API (HTTP 200, healthy D1) passed.
No migration, production change, application deployment, commit or push occurred.

## 2026-09-17: Real email as the development default

Made `npm run dev` always connect EMAIL to Cloudflare, retaining local D1 and
binding the host from local APP_URL on port 5173. Moved sender/URL checks into
the existing environment runner and removed the separate `dev:email` command
and helper files. Development overrides inherited simulation settings; builds,
preview, tests and other operations clear inherited real-email settings.
Updated setup defaults, examples and guides to match this behavior.

Validation passed: `npm run check` (typecheck, lint, 26 environment/bootstrap
tests, two i18n checks, 188 Workers/D1 tests and all three build/dry-runs), plus
`git diff --check`. The existing client chunk-size warning remains. Restarted
the application using exactly `npm run dev`, confirmed the Cloudflare remote
connection and HTTP 200 from the web and health API with healthy local D1.
The preceding remote-send verification remains applicable; no additional
activation email was sent for this command consolidation. No commit or push.

## 2026-09-17: Explicit real email from the local web

Added `npm run dev:email` to connect only EMAIL to Cloudflare while retaining
the original local D1 and authentication state. The command checks the sender
and local APP_URL, rejects extra arguments and clears inherited remote target
selection. Ordinary commands clear inherited email opt-in. Vite mutates the
existing EMAIL entry to avoid appending a second simulated binding through the
plugin's array-merge behavior. Updated the operating and architecture guides.

Validation passed: `npm run check` (typecheck, lint, 26 environment/bootstrap
tests, two i18n checks, 188 Workers/D1 tests, and all three target build/dry-runs)
and `git diff --check`. The existing client chunk-size warning remains.

Runtime checks confirmed local HTTP 200 and healthy D1. An initial activation
request returned success but generated simulated files; this exposed and led to
the binding-merge correction. After correction, the real-email server attempted
a remote connection and failed explicitly because Wrangler was unauthenticated.
OAuth authorization timed out without completion. The authorized sender was set
only in ignored local vars; no credentials or generated artifacts were tracked.
After the operator completed a subsequent Wrangler OAuth authorization, the
`dev:email` server established its remote connection successfully. Local health
returned HTTP 200 with healthy D1. A requested activation for an existing Owner
returned HTTP 200 and an Email Service message ID, while the simulated-message
file count remained unchanged (98 files before and after). This verifies remote
submission; inbox delivery still needs recipient confirmation. The web remains
local with real EMAIL and simulated D1. No remote application deployment,
migration, commit or push was performed for this change.

## 2026-09-16: Removed the dev email recipient allowlist

Removed `allowed_destination_addresses` from the dev Email binding and the
deployment/bootstrap checks that required listed recipients. Updated the guides
and regression tests so dev deployment and administrator bootstrap accept an
email without a repository-managed recipient list. Cloudflare account and
sender requirements still apply; local email remains simulated.

Validation passed: `npm run test:environments` (24 tests), `npm run lint`,
`git diff --check`, and `npm run deploy:dev:dry-run`, including TypeScript and
Worker/client builds. Wrangler reported `env.EMAIL (unrestricted)` for the
generated dev binding. The existing client chunk-size warning remains.
No remote deployment or real email delivery was performed or verified.

## 2026-09-16: Distinct school owner emails

Changed platform provisioning to reject a different school when the normalized
Owner email already owns a company, including inactive ownership. Same-name
retries resume the existing school. Existing duplicate ownerships are preserved.
New Organization, Owner membership and initial Branch writes use an atomic D1
batch with an ownership condition to prevent concurrent duplicate creation.
The form includes guidance and a translated conflict message.

Validation passed: type checking through `npm run build`, `npm run lint`,
`git diff --check`, and `npm test` (24 environment/bootstrap checks, two i18n
checks, 188 Workers/D1 tests). Five new cases cover normalized duplicate emails,
inactive ownership, legacy duplicates, competing new names and concurrent
same-name retries. Worker/client builds passed with the existing chunk-size
warning. No schema migration, existing-school modification or deployment.

## 2026-09-16: Platform company directory

Added a searchable, paginated company directory, company details with Owners,
activation status, Branches and active user counts, and an audited name update.
Provisioning success now links to the company detail and directory. An active
membership is required to open a company's operational workspace; platform role
alone does not grant tenant access.

Validation passed:

- `npm run typecheck`, `npm run lint` and `git diff --check`;
- `npm test`: 24 environment/bootstrap tests, two localization checks and 183
  Workers/D1 tests across 13 files, including ten new directory tests;
- `npm run build`: local Worker and client builds; the existing non-blocking
  client chunk-size warning remains (approximately 608 kB uncompressed);
- browser review of directory, empty search and company detail at desktop and
  narrow mobile widths, using temporary simulated responses. Confirmed no
  horizontal document overflow at 320 CSS pixels for the directory and 308 CSS
  pixels for the detail, and fixed activation-button wrapping at narrow widths.

The browser had no authenticated platform session, so visual checks used an
isolated fixture, removed before the final build. Backend authorization, search,
pagination, metadata and audit behavior were exercised against test D1. No real
company or account was modified and no deployment was performed.

## 2026-09-16: Responsive interface redesign

Pulled `origin/main` through `e72a599` before making local changes. Unified the
blue/slate palette, navigation, page hierarchy, financial cards, status badges,
list skeletons, forms and public/auth/platform surfaces. Added a Base UI mobile
navigation drawer and labeled mobile report rows. Dashboard visualization uses
the existing API values; no API, database or permission rules were changed.

Validation passed:

- `npm run typecheck`, `npm run lint`, `npm run test:i18n` and `git diff --check`;
- `npm test`: 24 environment/bootstrap tests, two localization checks and 173
  Workers/D1 tests across 12 files;
- `npm run build`: local Worker and client builds; the existing non-blocking
  JavaScript chunk-size warning remains (approximately 597 kB uncompressed);
- browser review at 320, 390, 768 and 1440 CSS-pixel viewport widths. Reviewed
  dashboard, members and create form, charges, payments, plans, reports, settings,
  member profile, home and sign-in; checked document widths for overflow;
- mobile drawer opening, Escape dismissal and trigger focus restoration;
  localized English/Spanish content and dashboard empty/error states.

The available local session has no active company membership. Internal screens
were reviewed using temporary browser-only API fixtures and synthetic records,
without modifying local accounts, memberships or financial data. The fixture
entry files were removed before the final build. This is layout/interaction
evidence, not a replacement for authenticated business-flow acceptance with a
representative user. No commit, push or deployment was performed.

## 2026-09-16: Branded interface foundation

Introduced the ControlMembers interface palette across the public shell,
authentication experience, application shell, shared Button/Input/Card
primitives, page hierarchy and financial dashboard. The final wordmark uses the
same symbol, `Control` vector, proportions and navy/blue colors as ControlWash;
only `Wash` is replaced by `Members`. The login was visually reviewed in Spanish
at desktop width after fitting the SVG view box for legibility; the authenticated
dashboard still requires the representative-user pilot for browser-level
observation.

`npm run check` passed typecheck, lint, 24 environment/bootstrap tests, two i18n
checks, 173 Workers/D1 tests, and local/dev/production builds and deployment dry
runs. `git diff --check` also passed. The build retains the existing non-blocking
JavaScript chunk-size warning; no API, database, permission or financial rule
changed.

## 2026-09-15: Complete local ControlMembers MVP release candidate

Implemented the complete local receivables workflow on the inherited SaaS
foundation. The product now provides customer Members and shared Contacts,
editable profiles and lifecycle, Plans with optional tags, Enrollments with
snapshotted personal terms, previewed/idempotent monthly Charge generation,
derived pending/partial/paid/overdue states, audited adjustment/void actions,
Payment allocation preview and manual distribution, Member credit, idempotent
posting and audited reversals.

The bilingual responsive application exposes Dashboard, Members, Charges,
Payments, Plans, Reports, Branches, Users & permissions and Settings. Single
Branch flows do not ask the operator to select a Branch. Operational lists use
bounded pagination and filters; dashboard/reporting covers expected, collected,
allocated, outstanding, overdue Members, upcoming due value, aging, Member
balances, Plan totals and Branch totals. Bounded Member CSV import has a no-write
preview and idempotent confirmation; scoped CSV exports neutralize spreadsheet
formula injection and write audit evidence.

Migration `0011_true_plazm` adds the domain ledger, import/audit tables and four
Owner-controlled financial grants without replacing the Better Auth tenant or
Branch model. It was generated by Drizzle Kit, inspected, applied successfully
to local D1 and validated with `npm exec -- drizzle-kit check`. Organization
currency is now locked once a Charge or Payment exists.

The complete `npm run check` gate passed typecheck, lint, 24 environment/bootstrap
tests, two i18n checks, 173 Workers/D1 tests (199 automated tests total), and the
local/dev/production builds and deployment dry-runs. `git diff --check` passed.
A local browser smoke check loaded the landing and sign-in pages at desktop and
390×844; it also found and corrected Base UI link/button semantics, after which
no new browser warning was emitted. Authenticated product journeys are covered
by Workers/D1 integration tests; real-device pilot observation remains part of
the separately authorized dev release.

No remote database migration, email delivery, Cloudflare resource mutation or
deployment occurred.

## 2026-09-15: Unified Plans with optional tags

Removed the separate Program concept from the active ControlMembers product
model. A Plan now owns its name, optional description, monthly minor-unit price,
currency snapshot, usual due day, active state, available Branches and optional
organization tags. The guarded API is now `/api/plans`; the former
`/api/programs` and `/api/billing-plans` routes are absent. Tags are normalized
and reused case-insensitively but do not affect price, access or billing rules.

The bilingual Plans page uses the inherited Tailwind/shadcn design system. It
creates, lists, edits, activates and deactivates complete Plans, formats currency
with the resolved application locale and provides keyboard-operable tag chips
and suggestions.
With one Branch, assignment is automatic and no Branch selector is shown; with
multiple Branches, availability is explicit.

Migration `0010_tranquil_war_machine` replaces the former catalog tables without
discarding their data: every existing Billing Plan becomes a unified Plan, its
former Program description and Branch availability are retained, former
Programs become optional tags, and organization-wide Plans remain available in
all existing Branches. It applied successfully to local D1. A separate SQLite
migration rehearsal seeded a Program-scoped Plan and an organization-wide Plan,
then verified both transformed records, all Branch links, the derived tag,
zero legacy tables and no foreign-key violations.

`npm exec -- drizzle-kit check`, `git diff --check` and the complete
`npm run check` gate passed. The run covered typecheck, lint, 24
environment/bootstrap tests, two i18n checks, 159 Workers/D1 tests (185 automated
tests total), and local/dev/production build and deployment dry-runs. No remote
database, email, cloud resource or deployment was changed.

## 2026-09-15: Clear user, Branch and billing terminology

The authenticated-access page now appears as **Users & permissions/Usuarios y
permisos**, while the existing `/app/members` route, Better Auth membership model
and APIs remain unchanged. Customer-facing **Members/Miembros** retain their
product meaning. Billing setup now presents Programs as **Activities/Actividades**
and Plans as **Monthly fees/Mensualidades**, without renaming persistence or API
contracts. New Spanish companies receive `Sede Principal`; new English companies
receive `Main Branch`. Migration `0009_localize_default_branch` updates only a
legacy Branch named exactly `Main` when it is the company's sole Branch; custom
and multi-Branch data remains untouched.

`npm exec -- drizzle-kit check`, local migration and the complete `npm run check`
gate passed. The run covered typecheck, lint, 24 environment/bootstrap tests,
two i18n checks, 158 Workers/D1 tests (184 automated tests total), and local/dev/
production build and deployment dry-runs. No remote database, email, cloud
resource or deployment was changed.

## 2026-09-15: Explicit company language

Removed the application-default choice from company creation and Settings. Every
new company receives an explicit registered language; the creation form initially
selects the platform administrator's current resolved language, while the platform
API rejects omitted, null and unsupported values before creating an identity.
Personal language remains nullable so people can continue to use their company's
language.

Migration `0008_third_may_parker` normalizes existing null, regional and unsupported
company values to English or Spanish, makes `organization.locale` non-null and
sets English as the storage safety default. It applied successfully to the local
D1 database, and `npm exec -- drizzle-kit check` passed. `npm run check` passed
typecheck, lint, 24 environment/bootstrap tests, two i18n checks, 157 Workers/D1
tests and all local/dev/production builds and deployment dry-runs (183 automated
tests total). No remote database, email, cloud resource or deployment was changed.

## 2026-09-15: Platform routing and contextual language selection

Centralized authenticated start-path selection so platform administrators land
on `/platform` after sign-in or account setup. The landing page, application
layout and `/no-company` guard use the same role rule, so an administrator
without tenant membership is no longer shown the inactive-company dead end.
Valid explicit internal return paths remain supported.

The language picker now offers only English and Spanish to platform-only
accounts. Within an active company it presents the clearer **Use company
language** choice and names the resolved company language instead of showing the
ambiguous former Automatic option. README and frontend specifications document
the same behavior. Two new routing tests cover role parsing, default destinations,
safe explicit paths and hostile return-path fallback.

`npm run check` passed typecheck, lint, 24 environment/bootstrap tests, two i18n
checks, 157 Workers/D1 tests and all local/dev/production builds and deployment
dry-runs (183 automated tests total). `git diff --check` also passed. No database
data, migration, email, cloud resource or deployment was changed.

## 2026-09-15: Guarded platform-admin bootstrap command

Replaced the operator-facing raw SQL bootstrap procedure with
`npm run bootstrap:admin`. The command requires an explicit local, dev or
production target, validates email/name and configured D1/domain/email policy,
requires `--confirm-production` for production, refuses to elevate existing
tenant identities, and conditionally creates only the first platform
administrator. It accepts no password and requests the existing one-time
`/setup-account` Magic Link flow. A retry for the same unfinished identity is
safe; an already configured identity exits without sending another link.

Six new Node tests cover argument rejection, production acknowledgement,
environment isolation, dev email allowlisting, SQL literal escaping and
conditional insertion, first-admin/retry decisions, and the password-free setup
request. `npm run check` passed typecheck, lint, 24 environment/bootstrap tests,
two i18n checks, 155 Workers/D1 tests and all local/dev/production builds and
deployment dry-runs (181 automated tests total). The command help path also ran
successfully. No administrator record, remote database operation, email, cloud
resource, deployment, commit or push was created during verification.

## 2026-09-15: Billing setup vertical slice

Implemented the first ControlMembers domain slice without changing any remote
environment. Generated and applied local migration `0007_organic_lucky_pierre`
for Organization Programs, explicit Program-Branch availability and monthly
Billing Plans. Added guarded Organization billing settings and Program/Plan APIs,
including tenant/Branch validation, active-name uniqueness, role restrictions,
integer minor-unit pricing and currency snapshots.

Added `/app/billing-setup`, a responsive bilingual create/list experience for
currency, timezone, Programs, offered Branches and Plans. The navigation exposes
it only to Owners and unrestricted admins as a UX guard; the Worker remains the
authorization boundary. Six new Workers tests cover configuration permissions,
validation, cross-tenant/cross-Branch rejection, duplicate names and Plan
currency snapshots.

`npm exec -- drizzle-kit check` and `npm run check` passed. The complete gate
included typecheck, lint, 18 environment tests, two i18n checks, 155 Workers/D1
tests and local/dev/production builds plus deployment dry-runs (175 automated
tests total). Both `npm audit` and `npm audit --omit=dev` reported zero known
vulnerabilities. A local HTTP smoke check returned database health OK and served
the ControlMembers SPA at `/app/billing-setup`. No remote migration, cloud
resource, commit, push, email delivery or deployment was performed. Enrollments
and the downstream financial modules remain unimplemented; Program/Plan edit and
deactivation APIs exist, while their UI controls remain follow-up work.

## 2026-09-14: ControlMembers product-clone baseline

Created the separate `/Users/admin/Personal/controlmembers` repository from
foundation commit `7280ab2`. The source template remained unchanged. The clone's
`template` remote fetches the original GitHub repository and has a disabled push
URL; a product `origin` remains intentionally unset until its real repository URL
is provided.

Established the ControlMembers identity, product overview, canonical modules
10–19, prioritized user stories, product decision log and seven-milestone MVP
delivery plan. The documents distinguish customer-facing Members from the
authenticated Team and specify Programs, Plans, Enrollments, Charges, Payments,
Allocations, reporting, permissions, audit, responsive shadcn-based UX, import/
export/privacy and a post-MVP WhatsApp boundary. No domain table, route or screen
is claimed as implemented.

Renamed local/dev/production Worker and D1 placeholders to ControlMembers and
regenerated binding/runtime types. Updated the landing title and bilingual
catalog copy. Installed the locked dependencies and then applied only compatible
security updates offered by the audit: `@cloudflare/vite-plugin` 1.54.9,
`@cloudflare/vitest-plugin` 1.1.9 and Wrangler 4.131.2. A temporary `js-yaml`
4.3.2 override covers the remaining ESLint/shadcn transitive advisory and is
documented in agent guidance.

Verification on this working tree:

| Check | Result |
| --- | --- |
| `npm run cf-typegen` | Passed; `worker-configuration.d.ts` regenerated for the renamed configuration |
| `npm run check` | Passed typecheck, lint, 149 Workers tests, 18 environment tests, two i18n checks and local/dev/production build/dry-runs (169 tests total) |
| `npm audit` | Zero reported vulnerabilities |
| `npm audit --omit=dev` | Zero reported vulnerabilities |
| `npm exec -- drizzle-kit check` | Passed; inherited migration metadata remains consistent |
| `npm run db:migrate:local` | Applied inherited migrations 0000–0006 to the new ignored ControlMembers local D1 state |
| Local HTTP smoke | `GET /api/health` returned `{status:"ok",database:"ok"}` from the new local D1; the server was then stopped |
| `git diff --check` | Passed after generated whitespace normalization |

The first full check ran before the ignored local `.dev.vars` was created, so
Wrangler warned that local required secrets were absent while tests used their
isolated bindings; all checks still passed. A local-only ignored development
file now provides non-production values for future `npm run dev`. No cloud
resource, remote database, real email recipient, product Git remote, commit,
push, remote migration or deployment was created.

## 2026-09-03: Current main and documentation synchronization

`main` now includes the final access-boundary and guide commits that followed the
worktree integration:

| Commit | Scope |
| --- | --- |
| `bf73f33` | Membership retry/peer protections, dormant delegation cleanup, stricter native auth-route blocks, context-sensitive Member UI resets and the 29-test access-control suite |
| `eeb5218` | Company access, lifecycle, migration and permission guidance in README and CLAUDE |

On this exact committed source, `npm run check` passed typecheck, lint, 149
Workers tests, 18 environment tests, two i18n checks, and dev/production/local
builds plus deployment dry runs (169 automated tests total). `drizzle-kit check`
also passed: the seven generated SQL files `0000` through `0006` match the
Drizzle journal and all are documented. Anonymous local HTTP checks confirmed
JSON application `404`, JSON application authorization errors, and Better Auth's
distinct empty/plain-text `404` forms for unknown/disabled auth paths. No request
used a real user account or changed application data.

The subsequent documentation-only synchronization completed the application API
inventory, clarified Better Auth response ownership, replaced obsolete worktree
wording and corrected the four-project TypeScript map. Local documentation links,
heading targets, referenced paths, package scripts and whitespace were checked
after those edits. No runtime source, dependency, lockfile, schema, migration or
binding changed during this synchronization, so the runtime gate above remains
the applicable evidence.

`PROJECT_SPEC.md` and `specs/` remain intentionally untracked; README and CLAUDE
have documentation-only working-tree changes from this synchronization. No push,
remote migration, Cloudflare resource change, real email or deployment was
performed. Older entries below remain historical evidence for their stated
snapshots; this entry is the current repository checkpoint.

## 2026-09-03: Main integration checkpoint

Fast-forwarded `main` through the three authorized commits after reconciling its
pre-existing uncommitted access-control refinements with localization. The
reconciliation preserves the 29-test access-control suite, stricter native auth
blocks, retry/scope protections and expanded access documentation. Personal and
company language behavior, translated UI/email and migration `0006` remain
intact. Pre-existing local changes and specifications remain uncommitted on
`main`; no unrelated change was discarded or folded into the three commits.

Before integration, the reconciled snapshot passed lint, 149 Workers tests, 18
environment tests and two i18n checks (169 total). Typecheck could not write its
incremental cache through the temporary dependency symlink; the authoritative
post-integration `npm run check` from the real main checkout passed typecheck,
lint, the same 169 tests, and dev/production/local builds plus deployment dry
runs. Local HTTP smoke checks returned health/database OK, protected anonymous
locale/company/member responses, JSON API 404 and login HTML as expected. The
local D1 was backed up before migration `0006` applied successfully. No remote
database, push or deployment was used. The integration worktree and temporary
branch were removed only after these checks.

## 2026-09-03: Authorized worktree commits

At the user's explicit request, saved the non-specification changes on
`codex/multilingual-platform` in three ordered commits:

| Commit | Scope |
| --- | --- |
| `1bef46f` | Company selection, active memberships, scoped administrator permissions, migration `0005` and the related lint/test fixes |
| `09408f5` | Extensible personal/company localization, translated UI/email, migration `0006` and localization tests |
| `c6c9bbf` | README and CLAUDE access/localization guides and command descriptions |

The first commit was staged from the saved pre-localization source plus its
related fixes, without replacing worktree files. An isolated export of that
staged snapshot passed typecheck, lint, 95 Workers tests and 18 environment tests.
The final source then passed `npm run check` again: 119 Workers tests, 18
environment tests, two i18n checks, typecheck, lint and all three build/deployment
dry runs. The documentation check found 63 valid local links before this record
was extended; staged whitespace checks passed.

Only `PROJECT_SPEC.md` and `specs/` remain untracked, intentionally excluded from
all three commits. Local secrets, runtime fixtures and build outputs were not
committed. No main-checkout source files, remote branches or cloud resources were
changed; no push, merge, deployment or remote migration was performed.

## 2026-09-03: Extensible localization in an isolated worktree

Implemented the shared language registry and complete initial English/Spanish
catalogs, personal/company preferences, translated application copy and
transactional emails. Updated the same ten module specifications, README and
CLAUDE; no second specification hierarchy was introduced.

Work took place in `/Users/admin/.codex/worktrees/e0b5/saas_template`, based on
`f3c4228`, with the existing uncommitted company-selection, membership-status,
restricted-admin and permission changes preserved. Those inherited changes,
including migration `0005`, are not new localization work. The main checkout was
not modified. No changes were staged or committed; specifications remain
uncommitted.

Baseline checks found one inherited lint failure in automatic company activation
and one outdated permission assertion (94 of 95 Workers tests passed). The effect
now coalesces the asynchronous activation request without synchronously setting
state. The test now first verifies denial without `canAppointAdmins`, then grants
that permission in its fixture. Backend authorization was not relaxed.

| Check | Observed result |
| --- | --- |
| `npm ci` | Installed the locked dependency set; no dependency versions or lockfile changed |
| `npm run db:generate` | Generated nullable `user.locale` migration `0006_lively_starbolt.sql`; final rerun reported no schema changes |
| `npm run db:migrate:local` | All seven generated migrations applied to the fresh worktree-local D1; no remote database accessed |
| `npm run typecheck` and `npm run lint` | Passed |
| Workers-runtime tests | 119 passed across 9 files, including 24 localization tests and all 95 existing tests |
| `npm run test:environments` | All 18 Node tests passed |
| `npm run test:i18n` | Both Node checks passed: application JSX copy/accessibility labels and shared-module environment boundaries |
| `npm run check` | Passed: types, lint, all 139 tests, and dev/production/local builds with deployment dry runs |
| `npm audit` and `npm audit --omit=dev` | Both reported zero vulnerabilities; no forced upgrades |
| `npm run cf-typegen` | Not needed: no Worker binding or Wrangler configuration changes |
| Documentation | Unified ten-module index retained; local Markdown links and `git diff --check` passed |

Automated localization coverage includes:

- Complete catalog keys and named-placeholder parity; locale normalization,
  unsupported values, prototype keys, public hints and personal/company/default
  precedence. Regional values can fall back to a registered parent language.
- Personal persistence across sign-ins; company changes and cleared overrides;
  active membership checks; owner/admin permissions, including branch-scoped
  admins; member, inactive, anonymous and platform-only denials.
- Strict locale request bodies, same-origin protection, disabled native auth
  mutation bypasses, stale UI context rejection and the company-save
  `X-Company-Context` concurrency precondition.
- Recipient-first email language, guarded company context, ambiguous multiple
  memberships, translated subjects/text/HTML, HTML escaping and preserved token
  and callback flags. Public reset responses remain non-enumerating.
- Company locale validation before provisioning, retries that preserve an
  existing company's language, guarded resend context and actual Better Auth
  setup-link activation carrying the language hint.

### Local browser review

Used the Browser skill against the local development server with fictional
`.invalid` users and two local test companies. No real customer accounts, real
email delivery or remote resources were used. Existing synthetic credentials
were used only to sign in; password setup is covered by Workers tests rather
than browser-entered credential changes.

Observed successful flows:

- The public language selector changes the sign-in page and an already-visible
  safe authentication error between English and Spanish.
- Company selection respects separate workspaces; automatic language follows
  the selected company. A personal English preference overrides a Spanish
  company, survives reload and remains personal when switching companies.
- Saving the company language updates the interface and its confirmation;
  clearing the personal override restores company inheritance. The normal
  company-save flow works with its context precondition.
- Settings, navigation, member directory, role labels and member forms display
  translated copy. Stored company/person names and the `Main` branch name remain
  unchanged. A draft member name and selected role remain present when changing
  language.
- At a 390-by-844 viewport, the Spanish settings page is readable, controls fit,
  and document/viewport widths both measure 390 pixels. The document reports
  `lang="es"` and `dir="ltr"`. The viewport override was reset after review.

Limits: English and Spanish are the only installed catalogs in this delivery,
not an architectural limit. Other languages, RTL layouts, complex domain plurals
and automatic translation of user content have not been validated. Browser-owned
validation/password-manager messages remain in the browser's language. Real
email delivery and configured dev/production resources still need release
verification; builds and deployment dry runs are not deployments.

The browser test session was signed out and its tab and local server closed.
Local-only test fixtures and runtime files are ignored by Git. Apply pending
migrations, including `0006`, before running this version against another
database. No commit, push, merge, deployment or remote migration was performed.

## 2026-09-03: Membership permissions, scope, status and company selection

Implemented the four approved changes: Owner-controlled admin appointment,
all/selected administrative Branch scope, company-only deactivation/reactivation,
and one/many/zero active-company selection. No second identity model, ownership
transfer, generic permission engine or billing feature was introduced.

| Check | Observed result |
| --- | --- |
| `npm run db:generate` | Generated additive 0005 and Drizzle metadata; final repeat reports no schema changes |
| `npm exec -- drizzle-kit check` | Passed; migration metadata consistent |
| `npm run db:migrate:local` | Applied only 0005 to the existing local D1; no destructive SQL or remote database access |
| Isolated QA D1 | All six actual migrations applied; only fictional `.invalid` identities, separate temporary state |
| `npm run check` | Passed: typecheck, lint, 18 environment tests, 124 application tests across 9 files, dev/production/local build and deployment dry runs |
| Final typecheck/lint | Passed after UI-copy and documentation review |
| Documentation | Single ten-module structure preserved; 69 local links and 106 source references checked with no missing targets |
| `git diff --check` | Passed |
| Existing environment/dependency work | `package.json`, lockfile, Wrangler, environment scripts, Vite/Vitest config and generated binding types unchanged |

The 29 new tests in `test/access-controls.test.ts` cover default appointment
denial, Owner grant/revoke, no self/onward delegation, no peer edit or repeat-POST
bypass, scoped provisioning/promotion, redacted shared employees, future Branches,
native Team restrictions, stale sessions, one-company-only deactivation,
reactivation, identity/other-company preservation and company-choice rules.
The existing member-creation test now uses Owner authority to create an admin.
All automated emails are mocked; no real email was sent.

### Browser checks for the access changes

The optimized local frontend was served with an isolated temporary Worker/D1
at `http://localhost:5187`, not the normal local database. Observed:

- Single-company Owner sign-in enters directly and displays a company label,
  with no unnecessary company selector.
- Owner directory displays active status, scope and appointment flag; Owner
  entry has no edit/deactivation controls.
- Owner edit form exposes all/selected Branch scope, nonempty Branch selection
  and the default-unchecked admin-appointment checkbox with explanatory text.
- A user with two existing active memberships sees an explicit company chooser
  after sign-in. Choosing company B shows its own Branch; switching to company A
  replaces that context and keeps ordinary-member navigation restrictions.
- An already-limited admin sees only North and has no create-Branch form. The
  Member directory hides unrestricted administrators and shows the shared
  employee read-only without exposing South. Add-member offers only the Member
  role, only North, and no appointment checkbox when delegation is disabled.
- The deactivation confirmation names the person and company and explains that
  identity, history and other companies are preserved. It was cancelled without
  submitting. The limited-admin form was also visually reviewed at the browser's
  default viewport; no new mobile/zoom or exhaustive accessibility check is claimed.

Saving permissions through the browser was paused by the safety approval check;
the unsaved form was cancelled. Manual permission-save and deactivate/reactivate
submissions require explicit approval for the fictional target accounts. Their
server behavior is covered by the automated suite, not claimed as completed
browser checks. No browser credential creation or password changes were performed.
The owned QA tab and temporary Worker were closed after review. Fictional QA
fixtures/state remain in temporary storage outside the repository, available for
an approved follow-up; no fixture was installed in the normal application database.

### Upgrade and release limits

Existing memberships stay active and existing admins keep all-Branch scope.
Appointment permission defaults to false and needs an explicit Owner grant.
Apply 0005 before starting this code in each environment. Never roll back to code
that ignores inactive memberships or limited-admin scope after relying on those
controls without a separate security/recovery plan.

Deactivation is checked on the next server request. Already-rendered content may
remain until focus/visibility refresh or the visible 30-second poll. Access edits
remain ordered, non-transactional operations; interrupted/conflicting changes
can require an Owner to reload and reconcile saved scope. Reactivation restores
saved permissions, so changed responsibilities require a scope review.

No dependency change or new dependency audit, commit, push, remote migration,
Cloudflare resource change or deployment was part of this task. The earlier
dated audit evidence below is not a new audit result.

## 2026-09-03: Local, dev and production environments

Implemented separate target configuration, guarded environment commands,
environment-specific build-only examples, regenerated binding types and updated
the existing unified module documentation. No business logic, dependency version,
lockfile or generated SQL migration changed. Existing local `.dev.vars` and the
top-level D1 identity were preserved.

| Check | Observed result |
| --- | --- |
| `npm run cf-typegen` | Passed; generated local, DevEnv and ProductionEnv binding types; final header uses a portable relative config path |
| `npm run test:environments` | 18 Node tests passed: target isolation, command selection, placeholder/resource guards, allowlist, build verification and extra-argument rejection |
| Workers-runtime tests within `npm run check` | All 95 existing tests passed across 8 files; real Drizzle migrations, local D1, mocked email |
| `npm run check` | Passed: typecheck, lint, Node/Workers tests, and dev/production/local builds plus deployment dry runs |
| Generated dev configuration | Verified `saas-template-dev`, `saas-template-dev-db`, dev custom-domain example and restricted Email binding |
| Generated production configuration | Verified `saas-template-production`, `saas-template-production-db`, separate custom-domain example and unrestricted production Email binding |
| Generated local configuration | Verified original `saas-template` and `saas-template-db`, no public routes, simulated local bindings |
| `CLOUDFLARE_ENV=production npm run db:migrate:local` | Selected local D1 explicitly; reported no migrations to apply; no remote database used |
| Local dev HTTP smoke check | `/api/health` returned 200 with database ok; anonymous `/api/members` returned 401; unknown API returned 404; `/login` returned HTML 200 |
| Optimized local preview HTTP smoke check | Same health, anonymous protection, unknown API and login responses passed |
| Local dev environment override | Starting with inherited production selection still chose local; localhost and port 5173 are pinned to the local auth URL |
| Documentation | Unified ten-module structure retained; local links, source references, command names and whitespace checked |

The environment tests use in-memory configuration fixtures and do not invoke
real deployment or migration. The quality gate permits resource placeholders so
the generic template can be checked without provisioning Cloudflare resources.
Actual remote commands refuse those placeholders. Generated build validation
checks Worker/environment, DB, routes and Email policy before Wrangler proceeds.

Limits: custom domains and remote D1 UUIDs are still examples; no Cloudflare
resources, DNS, Access policies or remote secrets were created/configured. No
remote migrations, real emails, deployment, commit or push were performed.
The actual dev email allowlist/production delivery behavior still needs a real
release check after setup. No new browser interaction/accessibility review or
dependency audit was performed in this environment-configuration task; the
earlier dated results below are not new claims. All test servers were stopped.

## Original verification scope

Verification date: 2026-09-02. Scope: Starter v1 behavior and dependency-security
remediation. Documentation was consolidated earlier on 2026-09-03 without code
changes or a new runtime test run in that consolidation step. Existing Branch
work was preserved. The functional code and guides were subsequently saved in
the five commits listed below.

## Command results

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed, including Worker, React, tooling and tests |
| `npm run lint` | Passed |
| `npm test` | 95 tests passed across 8 files |
| `npm run build` | Production Worker and React assets built |
| `npm run check` | Passed: typecheck, lint, tests, build and Wrangler deploy dry run |
| `git diff --check` | Passed |
| `npm run db:generate` | Generated 0004 during feature work; after the dependency fix, reported no schema changes and created no additional migration |
| `npm run db:migrate:local` | Applied 0004 successfully without deleting data |
| Isolated QA D1 migrations | All five generated migrations applied successfully |
| Exact dependency/lock comparison | Every direct package has an exact version matching the lockfile; Better Auth remains 1.7.2 |
| `npm run cf-typegen` | Not needed: no Wrangler binding/configuration changes |
| Production deployment | Not performed; dry run only |

The gate was repeated as coverage expanded across Branches, directory,
provisioning, access editing and HTTP protection. Final counts above supersede
earlier implementation snapshots.

## Automated acceptance evidence

| Area | Evidence |
| --- | --- |
| Branch closeout | `branches.test.ts`: role-aware lists, create/rename permissions, blank-name validation, foreign tenants and stale active Teams |
| Directory | `members.test.ts`: owner/admin reads, minimal payload, assigned/all-Branch distinction, foreign/anonymous/member denials and blocked native read paths |
| Provisioning | `members.test.ts`: normalized/deduplicated creation, concurrent identical requests, existing platform-user reuse across companies, invalid input before identity, email/second-assignment failure and safe retry |
| Activation | `provisioning.test.ts`, `members.test.ts`: unknown-user signup blocked, single-use links, provisional credential revocation, interrupted setup resend, employee password setup once and assigned-only access |
| Access editing | `members.test.ts`: immutable Owners, admin target restrictions, foreign membership/Branch denial, promotion/demotion, exact repeated scope, removal denial with a stale session and interrupted reconciliation |
| Platform | `provisioning.test.ts`, `hardening.test.ts`: platform-vs-tenant scope, first-admin bootstrap without password, company/Owner/Main creation, existing identity preservation, retries and same-name company collisions |
| HTTP/release | `hardening.test.ts`: malformed/non-object JSON, body limit, cross-origin/content-type rejection, non-caching, disabled invitation operations and escaped email HTML |
| Prior guarantees | Existing tenant isolation, Organization switching, return-path and slug suites retained |

Tests run against the actual Drizzle migrations in the Cloudflare Workers test
runtime. Email is mocked; no real recipient receives test mail. Deliberate failure
tests inject local D1 or email errors to prove retry behavior.

## Browser review

The production frontend was served by a local `wrangler dev` Worker using a
separate temporary D1 and fictional `.invalid` accounts. Browser testing did not
use or modify real customer identities. Existing test credentials were used for
login; choosing new credentials/activation is covered by Workers integration
tests rather than browser-entered password changes.

Observed successful flows:

- Owner with one Branch sees a plain label; adding a second reveals a selector.
- Branch creation and rename refresh the list and selector.
- Switching companies replaces both Branch context and Member directory.
- Owner directory distinguishes owner/admin all-Branch access, member scope and
  exceptional unassigned members; Owner rows have no edit action.
- Admin directory exposes edit actions only for members, not Owners or admins.
- Add member requires at least one Branch; new account success reports setup
  email and shows pending setup/resend controls.
- Editing member assignments saves the exact new Branch scope and refreshes the
  directory. Save and sign-in submission work with the keyboard.
- Member login shows only its newly assigned Branch, with no Members/Branches
  management links; direct management URLs redirect safely to the dashboard.
- An unassigned member reaches the no-Branch access screen without creation UI.
- Interrupting the isolated Worker during Branch submission shows a recoverable
  error and re-enables submission; it does not show an empty/no-access list or
  create the attempted Branch. Restarting the Worker restores normal operation.
- 390 px mobile and 320 px narrow/reflow layouts have no horizontal overflow;
  forms, readable Member cards and company switching remain usable.
- Opening Add member focuses the Name field; Settings renders the real workspace
  summary with explicit extension-point copy. Narrow CSS-viewport checks cover
  reflow; native browser zoom was not changed.

The temporary QA Worker and browser tab were closed after review. Only the
agent-created seed scripts were removed; existing local application data was
preserved. The isolated QA database remains outside the repository in temporary
storage, and no test fixture is part of the application seed/migrations.

## Dependency security remediation

The initial full audit reported five moderate warnings: four affected entries
in the Drizzle Kit/esbuild chain and one qs entry. The production-only audit
reported four because Better Auth lists Drizzle Kit as an optional peer.
Those findings are now fixed, not accepted or hidden.

| Check after remediation | Result |
| --- | --- |
| `npm audit --json` | 0 vulnerabilities at every severity; exit 0 |
| `npm audit --omit=dev --json` | 0 vulnerabilities at every severity; exit 0 |
| Clean `npm ci` in an isolated temporary directory | Passed, reproduced the unchanged lockfile and patched versions; 0 audit findings |
| `npm ls esbuild qs --all` | Legacy loader resolves esbuild 0.25.12; Express/body-parser resolve qs 6.16.0; other esbuild versions unchanged |
| Node smoke checks for `@esbuild-kit/core-utils` | CommonJS and ESM TypeScript transforms, module imports and source maps passed; native transforms also passed after the clean install |
| Node smoke checks for qs | Bracket/comma array overflow rejected, hostile constructor parse/stringify did not throw, ordinary parsing preserved |
| `npm run db:generate` | No schema changes, nothing to migrate |
| `npm exec -- drizzle-kit check` | Migration metadata check passed |
| `npm exec -- shadcn --help` | CLI startup/help passed without changing components |
| `npm run check` | Passed again after remediation: all 95 Workers tests, typecheck, lint, production build and deployment dry run |
| Direct-version and lock-diff assertions | All direct versions unchanged and exact; only qs and the nested esbuild/native-binary entries changed |

### Changes and rationale

- Updated `qs` 6.15.3 to 6.16.0 in the lockfile using `npm update qs`. Both of
  its parents already allow this version, so no qs override was needed. This
  fixes [the bracket/comma array-limit bypass](https://github.com/ljharb/qs/security/advisories/GHSA-x5fp-wj9c-mxmx)
  and [the unsafe isBuffer invocation](https://github.com/ljharb/qs/security/advisories/GHSA-4mjr-xmp4-gh2g).
- Added a [version-scoped npm override](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides)
  for `@esbuild-kit/core-utils@3.3.2 -> esbuild` 0.25.12, replacing 0.18.20.
  The [esbuild development-server advisory](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99)
  is patched from 0.25.0. Drizzle Kit 0.31.10 already uses 0.25.12 for its own
  esbuild, but its legacy loader still pins the vulnerable line. This is why
  the override is narrow and its transform compatibility was tested explicitly.
- No direct dependency was upgraded or downgraded. React, Vite, TypeScript,
  ESLint, Better Auth, Drizzle Kit and shadcn retain their exact versions.
  No `npm audit fix --force`, advisory suppression or production deployment
  was used. In particular, npm's suggested Drizzle Kit downgrade to 0.18.1
  was not applied.

The clean install still prints deprecation notices for the two legacy
`@esbuild-kit` packages and ESLint 9. These are upstream maintenance notices,
not remaining npm security findings. Replacing their parent toolchain belongs
to a separate version-scoped upgrade; removing a deprecation notice alone does
not justify crossing the project's major-version policy.

Keep the override until an upstream update resolves a patched esbuild without
it, then repeat the compatibility checks and both audits before removing it.
The [maintenance specification](09-testing-and-operations.md#dependency-maintenance)
documents the verification commands. Audit results are dated known-advisory
evidence, not a guarantee that future advisories cannot appear.

## Template safety

- `wrangler.json` retains `REPLACE_WITH_REAL_D1_DATABASE_ID` and required external
  `BETTER_AUTH_SECRET`, `APP_URL` and `EMAIL_FROM` values.
- `.dev.vars`, `.wrangler` and `dist` are ignored and absent from tracked files.
  Vite may copy local vars into the ignored Worker build directory; do not share
  that directory or treat it as a public artifact. Only `dist/client` is served.
- Only `src/worker/email/index.ts` accesses the Email binding, and only
  `src/worker/db/index.ts` constructs Drizzle.
- Schema remains Better Auth tables plus technical `system_check`; 0004 adds an
  index, not a business table or a custom role model.
- Invitation placeholder page was removed; its tracked prior version remains
  recoverable through Git history. Future invitation primitives remain tested.
- No real D1, email domain, API secret, test database, recipient or generated
  runtime/build artifact was added to tracked source.

## Completion boundary

All current Starter v1 modules are implemented. Settings editing, invitation
acceptance, deletion/ownership lifecycle, billing, business features and new
infrastructure remain explicitly outside v1. Ordered Better Auth writes are
retryable operations, not a global transaction/versioned concurrent editor.

## Repository baseline

The functional code and guides were committed on 2026-09-02:

| Commit | Scope |
| --- | --- |
| `f895abf` | Unique Organization memberships and generated migration |
| `4af2e57` | Guarded tenant Member management, API hardening and tests |
| `96e8c45` | Branch and Member interfaces, navigation and error recovery |
| `af78428` | esbuild and qs dependency-security fixes |
| `0b3fc5c` | Updated project guides |

The 2026-09-03 documentation consolidation moved behavior and acceptance criteria
into the [single module index](README.md), shortened the project overview and
updated supporting guides. The former duplicate documents were removed after
their useful contracts were integrated. Only documentation changed; runtime
checks above remain the original dated evidence.

Documentation checks on 2026-09-03 passed: ten consecutively numbered modules
in one directory, 60 valid local links (including heading targets), 97 valid
source-path references, no links to removed documents, and `git diff --check`.
At that consolidation checkpoint, the staging area was empty and changed files
were documentation only; no runtime code,
dependency, migration or generated binding file changed during consolidation.

At that checkpoint, the unified specifications and subsequent environment changes
were uncommitted. Refer to the latest dated entry above and `git status` for the
current local changes. Review and commit only when authorized, then configure the
first cloned SaaS's resources and business domain. Real Cloudflare setup, email
delivery and production deployment require their own explicit release task.
No push or production deployment was performed by this work.
