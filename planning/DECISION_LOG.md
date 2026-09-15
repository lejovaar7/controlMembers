# ControlMembers Decision Log

[Delivery planning](README.md) · [Product specifications](../specs/README.md)

This log separates confirmed product decisions from defaults that should be
validated with early customers. A changed decision must update the affected
canonical specification before implementation.

## Confirmed decisions

| ID | Decision | Consequence |
| --- | --- | --- |
| D-001 | ControlMembers is a closed B2B SaaS. | Organizations are provisioned; there is no public organization signup. |
| D-002 | The customer-facing subject is called a **Member**. | Product copy uses Member; it never uses Better Auth's `member` table for customer records. |
| D-003 | Authenticated employees are called **Users** in product copy. | The inherited `/app/members` route and Better Auth persistence remain stable while the UI uses Users & permissions. |
| D-004 | MVP payments are recorded manually. | Payment gateways, reconciliation and provider webhooks are deferred. |
| D-005 | MVP billing frequency is monthly. | The schema may preserve a frequency field, but only `monthly` is accepted until another frequency is specified. |
| D-006 | Financial history is immutable by default. | Posted payments are reversed, charges are voided, and neither is hard-deleted. |
| D-007 | English and Spanish are supported from the first product release. | Every new UI and email message must be added to both typed catalogs. |
| D-008 | WhatsApp is post-MVP. | MVP stores normalized contact/consent data and notification boundaries but sends no messages. |
| D-009 | The inherited tenant and Branch authorization remains authoritative. | Every domain query is scoped from a validated tenant and, when applicable, accessible Branches. |
| D-010 | Design extends the inherited Tailwind/shadcn system. | Product features reuse existing primitives and do not introduce a competing component library. |
| D-011 | The MVP uses Plans without a separate Program entity. | A Plan combines the offer, monthly amount, usual due day and Branch availability; optional tags organize/filter only. |

## Product defaults to validate

These defaults make implementation deterministic. They may be changed before
their milestone begins.

| ID | Default | Status | Affected spec |
| --- | --- | --- | --- |
| D-101 | A Member may have multiple active enrollments, but only one active enrollment per Plan and Branch. | Proposed | 12 |
| D-102 | Joining mid-month does not automatically prorate; staff may adjust or void the first charge. | Proposed | 13 |
| D-103 | A charge becomes overdue immediately after its due date in the Organization timezone; there is no grace period. | Proposed | 13 |
| D-104 | Unallocated payment value becomes account credit for that Member. | Proposed | 14 |
| D-105 | Default automatic allocation applies oldest overdue charges first, then oldest open charges. | Proposed | 14 |
| D-106 | One Organization uses one currency; changing it after financial records exist is blocked in MVP. | Proposed | 12, 14 |
| D-107 | Receipt numbers are Organization-scoped, monotonically increasing display numbers. | Proposed | 14 |
| D-108 | Duplicate detection warns on normalized document or exact email/phone matches but does not silently merge people. | Proposed | 11 |
| D-109 | CSV import is limited to Members and contacts in MVP; financial imports are deferred. | Proposed | 19 |

## Questions for customer discovery

- Which payment methods are actually used and which reference fields matter?
- Is a responsible payer commonly shared by siblings or family members?
- Do academies need enrollment fees in addition to monthly fees?
- How often are first or last months prorated?
- Are discounts permanent, period-specific or both?
- Is a printable receipt required at launch?
- Which dashboard period and delinquency metrics drive daily decisions?
- Which countries and currencies are required for the first paying customers?
- What consent proof is required before future WhatsApp reminders?
