# Specification 12: Programs, Plans and Enrollments

[All specifications](README.md)

**Status:** Partially implemented. Programs, Program-Branch availability and
monthly Plans have persistence, guarded management APIs and create/list UI.
Enrollment behavior and edit/deactivation UI remain target MVP work.

## Purpose

Describe what an Organization offers, its monthly pricing defaults and the
commercial relationship that produces Charges for a Member.

## Programs

A Program is a tenant-owned activity such as Football, Piano or Swimming. It
stores `id`, `organizationId`, name, optional description, active state and
timestamps. Program names are unique case-insensitively within an Organization
among active records.

Programs may be offered at one or more Branches through an explicit join. An
Enrollment may only select a Program offered at its Branch. Deactivating a
Program prevents new enrollments but preserves existing enrollments and history.

Schedules, groups, levels, instructors, attendance and capacity are outside MVP.

## Billing Plans

A Plan stores:

- tenant-owned opaque ID and name;
- `amountMinor`: positive integer minor currency units;
- `currency`: ISO 4217 code equal to the Organization currency;
- `frequency`: `monthly` in MVP;
- `defaultDueDay`: integer 1–28;
- optional Program restriction;
- active state and timestamps.

Day 1–28 avoids month-end ambiguity in the MVP. A future month-end mode requires
an explicit contract. Deactivating a Plan prevents new selection but does not
change Enrollment or Charge snapshots.

## Enrollments

An Enrollment stores:

- `organizationId`, `customerMemberId`, `programId`, `branchId`, `billingPlanId`;
- `startDate` and nullable `endDate` as local business dates;
- `status`: `active`, `paused` or `ended`;
- `amountMinor`, `currency`, `dueDay` snapshots/overrides;
- optional discount as a fixed minor-unit amount for MVP;
- created/updated timestamps and actor audit metadata.

The default is at most one active Enrollment for a Member and Program. A Member
may have several active Enrollments in different Programs. The application must
reject overlapping active periods rather than relying only on UI controls.

## Historical integrity

- Editing a Plan affects only later Enrollment defaults.
- Editing an Enrollment affects Charges generated after the effective change.
- A generated Charge keeps its own Plan, Program, amount, discount, Branch,
  currency, due date and display-label snapshots.
- Moving a Member's primary Branch does not rewrite existing Enrollments or
  Charges. Each Enrollment Branch changes only through an explicit action.
- Ending an Enrollment stops future generation and preserves all history.
- Currency changes are blocked after any Organization financial record exists in
  the MVP; migrations between currencies require a future release plan.

## Authorization

Program and Plan administration requires the business permissions in spec 16.
Enrollment creation also requires access to the Member and selected Branch.
Submitted related IDs must all resolve under the same validated Organization.

## Target API and UI

- Programs: list, create, edit and activate/deactivate.
- Plans: list, create, edit and activate/deactivate.
- Enrollments: create, edit future billing terms, pause/resume and end.
- Member detail shows active and historical Enrollments.
- Forms preview the next amount and due date before saving.
- Inactive Programs and Plans remain visible in historical detail but are not
  offered for new Enrollments.

## Acceptance checks

- Program and Plan names cannot cross tenant boundaries.
- A Program cannot be selected at an unoffered or inaccessible Branch.
- Plan price changes never modify generated Charges.
- A Member can enroll in multiple different Programs without duplicate identity.
- Overlapping active Enrollment for the same Member and Program is rejected.
- Ended/paused Enrollments remain reportable and cannot generate unintended new
  Charges.
- All monetary values use integer minor units; floating-point currency storage is
  forbidden.
