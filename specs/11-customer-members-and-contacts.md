# Specification 11: Members and Contacts

[All specifications](README.md)

**Status:** Target MVP contract; implementation has not started.

## Purpose

Manage people who receive an Organization's service and the contacts who may be
responsible for payment or communication. A customer Member is not an
authenticated Team member.

## Data model

### `customer_member`

Required fields:

- `id`: opaque application-generated identifier.
- `organizationId`: immutable tenant owner.
- `primaryBranchId`: Branch validated inside the same Organization.
- `displayName`: trimmed, 1–200 characters.
- `status`: `active`, `paused` or `inactive`.
- `createdAt`, `updatedAt`.

Optional MVP fields:

- `documentType`, `documentNumber`;
- `birthDate` as a date without time;
- `email`, `phoneE164`;
- `notes` with a documented length limit;
- `externalReference` for imports.

The record does not contain a password, auth user ID, outstanding balance or
derived payment status. Balances come from the financial ledger.

### `contact`

A Contact belongs to exactly one Organization and may relate to multiple
Members. It stores display name, optional email, optional normalized E.164 phone,
and timestamps. At least one usable email or phone is recommended but not
required while WhatsApp and portals are out of scope.

### `member_contact`

The relationship stores:

- `customerMemberId` and `contactId` within the same Organization;
- relationship label such as parent, guardian, self, spouse or other;
- `isPrimary` and `isBillingContact` booleans;
- future-ready communication consent fields: channel, state, captured time,
  source and withdrawal time. MVP may expose only `none`/`granted` for WhatsApp
  readiness and must not imply that consent was obtained automatically.

At most one active primary Contact and one billing Contact exist per Member.
The same Contact may be billing contact for several Members.

## Lifecycle rules

- `active`: can receive new enrollments and generated Charges.
- `paused`: retains history; automatic future generation skips paused
  enrollments according to specification 13.
- `inactive`: retained for history and excluded from active defaults.
- Status changes do not void existing Charges, reverse Payments or delete
  enrollments.
- Records referenced by financial history are never hard-deleted.
- Duplicate detection warns on exact normalized identifiers; staff decides
  whether to use the existing record. The server never silently merges people.

## Authorization and Branch visibility

- Every query begins with `requireTenant()` and scopes by `organizationId`.
- Owners and all-Branch administrators can read/write all Members.
- Limited administrators and ordinary staff can only read Members whose primary
  Branch they may access, subject to the business permission matrix in spec 16.
- A submitted Branch ID is loaded inside the validated tenant and checked with
  the inherited Branch authorization helpers.
- Cross-tenant IDs return the same not-found response as unknown IDs.
- Contacts linked to Members outside the actor's scope must not reveal those
  other Member identities. A shared Contact may be edited only by an actor whose
  authority covers all affected active Member relationships; otherwise it is
  presented read-only or edited through a narrowly scoped relationship action.

## API target contract

- `GET /api/customer-members`: paginated search and filters.
- `POST /api/customer-members`: create one Member.
- `GET /api/customer-members/:id`: scoped detail and summary.
- `PATCH /api/customer-members/:id`: update permitted profile fields.
- `PATCH /api/customer-members/:id/status`: explicit lifecycle change.
- Nested contact endpoints create/link/update/unlink relationships without
  exposing Organization IDs as authority.

List inputs include bounded cursor/page size, normalized search, status,
accessible Branch and receivables state. Receivables filtering may delegate to
the ledger query specified in 14 rather than duplicating balance logic.

## Frontend target

- Searchable Member list with distinct loading, empty and failure states.
- Filters for Branch, lifecycle and payment state.
- Member profile with Overview, Enrollments and Financial Activity sections.
- Create/edit flow that preserves unsaved data after recoverable errors.
- Clear warning before pausing or deactivating a Member; history consequences are
  explained without implying that debt is erased.
- Mobile rows expose name, Branch, status and balance before secondary metadata.

## Acceptance checks

- Creating a Member never creates a Better Auth user or Organization membership.
- Identical names are permitted; opaque IDs and normalized identifiers prevent
  accidental record selection.
- Contact relationships support siblings without duplicating the Contact.
- Pausing/inactivating preserves Charges, Payments and audit history.
- Scoped Team users cannot infer foreign Branch or Organization data through
  list totals, filters, detail errors or Contact relationships.
- English and Spanish copy uses “Member/Miembro” for customers and “Team/Equipo”
  for authenticated staff.
