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
- start date and nullable end date as local business dates;
- status: `active`, `paused` or `ended`;
- agreed `amountMinor`, currency and due day snapshots/overrides;
- optional fixed discount in minor units;
- actor and created/updated timestamps.

The default is at most one overlapping active Enrollment for the same Member,
Plan and Branch. A Member may have several Plans simultaneously. The Plan values
pre-fill a new Enrollment, but the agreed amount and due day are stored on the
Enrollment so a personal price does not require a one-person Plan.

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

- Plans: list, create, edit and activate/deactivate.
- Plan writes accept exact Branch IDs and tag names; the server resolves tags
  within the Organization.
- Plan lists return Branch IDs and tags in a stable order.
- Enrollments: create, update future terms, pause/resume and end.
- Member detail shows active and historical Enrollments.
- Forms preview the next amount and due date before saving.
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
