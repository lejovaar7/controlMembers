# Specification 10: ControlMembers Product and MVP

[All specifications](README.md)

**Status:** Partially implemented. The billing-setup foundation is verified;
Member, Enrollment, Charge, Payment and reporting outcomes remain target MVP.

## Purpose

ControlMembers helps organizations that charge recurring membership fees know
who owes, who paid, what is overdue and how much cash was collected. The initial
customers are sports, music, martial arts, swimming, dance, language and similar
academies. Core terminology must not encode a specific discipline.

The product extends the closed B2B foundation in specifications 00–09. An
Organization remains the tenant and a Branch remains a location. Authenticated
employees are called the Team. A customer-facing Member is a separate business
record and never a Better Auth user or membership by default.

## Outcomes

An authorized employee can answer, for an Organization and permitted Branches:

- which Members are active;
- which monthly charges are open, partially paid, paid, overdue or void;
- how much was expected, collected and remains outstanding for a period;
- which payer/contact is responsible for a Member;
- which Program, Plan and enrollment produced a charge;
- who recorded or reversed each financial event.

## MVP scope

- Member and contact records, status and Branch scope.
- Programs, monthly Plans and enrollments.
- Idempotent monthly charge generation.
- Manual payments, multi-charge allocation and Member credit.
- Reversals and voids with an append-only audit trail.
- Receivables lists and dashboard summaries.
- English and Spanish responsive UI.
- CSV Member import and operational CSV exports.
- Existing company, Branch, Team, authentication and localization features.

## Explicitly out of scope

- Public signup or self-service Organization creation.
- Member or payer login portal.
- Online payment gateways and bank reconciliation.
- WhatsApp, SMS or automated outbound reminders.
- Attendance, schedules, instructors, rooms, competitions or learning content.
- Tax invoicing, general accounting, payroll or inventory.
- Automatic late interest, collection agencies or credit reporting.
- Multiple currencies inside one Organization.
- Native mobile applications.

These exclusions prevent adjacent academy-management features from delaying the
receivables workflow. They require a new or updated specification before work.

## Domain language

| Product term | Meaning | Persistence guidance |
| --- | --- | --- |
| Organization | The paying academy or business tenant. | Existing Better Auth `organization`. |
| Branch | A physical or operational location. | Existing Better Auth `team`. |
| Team member | An authenticated owner, administrator or employee. | Existing Better Auth `user` + `member`. |
| Member | A person receiving the recurring service. | New `customer_member`; not an auth user. |
| Contact | A payer, guardian or emergency contact related to Members. | New contact and relationship tables. |
| Program | The activity or service: football, piano, swimming, etc. | New domain table. |
| Plan | Monthly pricing and due-day defaults. | New domain table. |
| Enrollment | A Member's active commercial relationship to a Program and Plan. | New domain table. |
| Charge | An amount receivable for one billing period. | New immutable-snapshot domain table. |
| Payment | Money received and recorded by the Team. | New financial ledger table. |
| Allocation | A portion of a Payment applied to a Charge. | New financial ledger table. |

## Primary journeys

1. Owner provisions the Organization and Team using inherited flows.
2. Team configures currency/timezone, Branches, Programs and Plans.
3. Team creates or imports Members and connects responsible payers.
4. Team enrolls a Member and generates the current monthly charge.
5. Team records a Payment and applies it to one or more open Charges.
6. Dashboard and receivables update from the ledger-derived balances.
7. Authorized staff reverses an erroneous Payment or voids a Charge with a reason.

## Product success criteria

- A new Organization can configure its first Program and Plan and register its
  first payment without product support.
- A staff user can find an overdue Member and record a payment in under one minute.
- Expected, collected and outstanding totals reconcile to the underlying Charges,
  Payments and Allocations for the same filters.
- No user can observe or mutate another Organization's domain records.
- Limited Team members cannot access records outside their Branch scope.
- Financial corrections preserve the original event, actor, time and reason.
- The critical workflows are usable at a 390 CSS-pixel viewport and by keyboard.

## Dependencies

- Architecture and platform boundaries: specification 00.
- Schema and migrations: specification 01.
- Authentication and identity: specification 02.
- Tenant and Branch isolation: specification 04.
- Shared frontend and localization: specification 05.
- Team access management: specification 07.
- HTTP and testing boundaries: specifications 08–09.

## Acceptance checks

- Product copy clearly distinguishes Members from the Team.
- No MVP route or table introduces an alternate tenant, Branch or auth model.
- All domain features map to a canonical specification numbered 11–19.
- Out-of-scope features are not partially exposed as nonfunctional controls.
- The inherited quality gate continues to pass throughout delivery.
