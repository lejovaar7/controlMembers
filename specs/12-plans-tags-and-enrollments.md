# Specification 12: Plans, Tags and Enrollments

[All specifications](README.md)

**Status:** Implemented and verified locally across Plans, tags and Enrollments;
remote pilot release remains pending.

## Purpose

Define the recurring offer a Member receives, its standard monthly terms, where
it is available, optional labels used for organization, and the Enrollment that
produces Charges.

## Plans

A Plan is the complete reusable offer. Examples include `Sub-10`, `Piano — 4
classes`, `Karate adults`, or `Basic swimming`. A Plan stores:

- opaque ID and immutable Organization ownership;
- name and optional description;
- positive `amountMinor` and Organization currency;
- `frequency: monthly` and usual due day from 1 through 28;
- active state and actor timestamps;
- one or more available Branches;
- zero or more optional tags.

Active Plan names are unique case-insensitively within an Organization.
Deactivation prevents new Enrollments but preserves existing Enrollments,
Charges and history.

## Branch availability

A Plan must be available at at least one Branch. An Enrollment may select only a
Branch linked to the Plan and accessible to the actor. When an Organization has
one Branch, the UI assigns it automatically and does not show a selector. With
multiple Branches, the form exposes an explicit selection.

The list is filtered by the active session Branch, including for Owners. A Plan
appears in several workspaces only when those Branches are explicitly linked.
New forms initially select only the active Branch and reset to it after saving.
Cards show their assigned Branch names. Editing a shared Plan retains its full
authorized Branch list; removing the current Branch removes it from that list
immediately. Existing assignments are preserved, never inferred or rewritten.

A Member with explicit Enrollments in several Branches is visible in those
workspaces, but each workspace shows only its own Enrollments and ledger. An
authorized explicit Enrollment can link the Member to the current Branch;
merely creating a Plan shared across Branches does not share all Members.

## Tags

Tags are optional Organization-owned labels such as `Football`, `Music`,
`Children`, `Adults` or `Piano`. They exist only to organize, search and filter
Plans and the Members enrolled in them.

- A tag has an opaque ID, display name and normalized case-insensitive name.
- Duplicate normalized names in one Organization resolve to the same tag.
- A Plan may have no tags or several tags.
- Tags never determine price, due day, Branch access, permissions or Charge
  generation.
- Tags are created and selected inline; the MVP does not require a separate tag
  administration page.
- Removing or renaming a tag never changes financial history.

## Enrollments

An Enrollment stores:

- `organizationId`, `customerMemberId`, `planId` and `branchId`;
- start date, first payment due date, recurring day and nullable end date as local business dates;
- status: `active`, `paused` or `ended`;
- agreed `amountMinor`, currency and due day snapshots/overrides;
- optional fixed discount in minor units;
- actor and created/updated timestamps.

The default is at most one overlapping active Enrollment for the same Member,
Plan and Branch. A Member may have several Plans simultaneously. The Plan price
pre-fills a new Enrollment. New Enrollments default their first due date to one
month after their start date, independently of the Plan's historical due day.
Users can choose another first date strictly after the start date. Later payments
repeat its day monthly. An automatically suggested short-month date retains the
start day's anchor (January 31 → February 28/29 → March 31); an explicitly chosen
date uses its chosen day. `recurringDay` is 1–31 and clamps to the last day of short
months without permanently drifting. `firstDueDate` remains the first agreed
payment deadline; editing future due days affects later ungenerated periods.

Existing rows with null `firstDueDate`/`recurringDay` retain legacy calendar-month
billing through `dueDay` (1–28). Additive migration 0013 preserves all existing
rows and financial snapshots. Public `dueDay` resolves to `recurringDay` for new
schedules; the legacy stored column remains for backwards compatibility.
Plan forms/cards no longer present a fixed payment day; existing Plan values are
preserved for legacy readers. Price and branch assignments remain unchanged.

## Historical integrity

- Editing a Plan affects defaults for later Enrollment changes only.
- Editing an Enrollment affects Charges generated after the effective change.
- A generated Charge snapshots Plan name, agreed amount, discount, Branch,
  currency and due date.
- Tag edits never rewrite Charge descriptions or amounts.
- Moving a Member's primary Branch does not rewrite existing Enrollments or
  Charges.
- Ending an Enrollment stops future generation and preserves history.
- Organization currency changes are blocked after financial records exist.

## Authorization

Plan and tag administration requires the business permissions in specification
16. Enrollment creation also requires access to the Member and selected Branch.
All submitted IDs must resolve under the same validated Organization.

## API and UI

The Plans workspace prioritizes the catalog over forms and billing configuration.
Search matches name, description and tags; the status filter includes active and
inactive records, with active plans sorted first. Cards expose monthly price,
assigned Branches, tags and status, with edit and activation actions.
Create/edit use the same centered dialog, preserve Branch assignments and offer
an optional disclosure for description/tags. The editable price is grouped and
a summary previews monthly price and explains personalized payment dates. Invalid
amounts and empty Branch selections block saving. Failed saves retain
the form; pending saves block dismissal. Billing settings have their own dialog
with an explicit company-wide scope explanation. Initial loading uses matching
card skeletons; empty results offer clearing filters or creating the first Plan.

- Plans: list, create, edit and activate/deactivate.
- Plan writes accept exact Branch IDs and tag names; the server resolves tags
  within the Organization.
- Plan lists return Branch IDs and tags in a stable order.
- Enrollments: create, update future terms, pause/resume and end.
- Member detail shows active and historical Enrollments, the full start date,
  and a full payment due date including day, month and year. The earliest unpaid
  Charge for that exact Enrollment takes precedence and preserves its snapshot.
  Without debt, active Members/Enrollments show a clearly labeled projection for
  the first ungenerated due month from the agreed first date for new schedules,
  skipping generated paid/void periods and respecting the end date. Legacy
  projections continue from the company-local current/start month. Paused/ended
  schedules without debt have no projected payment.
  Dates are payment deadlines, not Enrollment expiration dates.
- The Add enrollment dialog starts on today, suggests one month later and offers
  editable first due date plus a preview of the following deadline. Changing the
  start date updates the suggestion until a date is manually chosen. Manual dates
  persist until reset; invalid or empty dates prevent saving with clear feedback.
- Forms preview the next amount and due date before saving.
- The future-terms dialog accepts at most two decimal digits for the billing day,
  validates 1 through 31 for new schedules (1–28 for legacy enrollments), and
  displays an inline error for out-of-range values.
  Required fields, including the audit reason, have explicit missing-field
  feedback when Save is disabled. Saved days apply only to future Charges.
- Duplicate enrollment submissions keep the dialog open and show a localized red
  explanation for the same Plan and Branch. Active enrollments explain that a
  second enrollment cannot be added; paused enrollments suggest resuming.
  Other errors retain generic feedback, and changing the form clears old errors.
- Inactive Plans remain visible in history but are not offered for new
  Enrollments.

## Acceptance checks

- There is no Program entity, Program route or Program choice in the product.
- Plan and tag names cannot cross tenant boundaries.
- A Plan cannot be selected at an unavailable or inaccessible Branch.
- Tag names are normalized and reused without duplicates.
- Plan/tag changes never modify generated Charges.
- A Member can enroll in multiple different Plans.
- Overlapping Enrollment for the same Member, Plan and Branch is rejected.
- Ended or paused Enrollments remain reportable and cannot generate unintended
  Charges.
- Money uses integer minor units; floating-point currency storage is forbidden.
