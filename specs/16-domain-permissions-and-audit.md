# Specification 16: Domain Permissions and Audit

[All specifications](README.md)

**Status:** Partially implemented. Billing-setup endpoints enforce Owner or
unrestricted-admin access and tenant/Branch isolation. Fine-grained permissions
and the audit model for later financial modules remain target MVP work.

## Purpose

Layer business permissions over the inherited Organization roles and Branch
scope without replacing Better Auth or building a speculative generic policy
engine.

## Role baseline

| Capability | Owner | Admin | Staff member |
| --- | --- | --- | --- |
| View in-scope Members and Charges | Yes | Yes | Yes |
| Create/edit in-scope Members | Yes | Yes | Yes |
| Manage Programs and Plans | Yes | Yes if all-Branch | No |
| Manage Enrollments | Yes | In scope | In scope |
| Generate Charges | Yes | In scope | No |
| Record Payments | Yes | In scope | In scope |
| Reverse Payments | Yes | Optional grant | No |
| Void/adjust Charges | Yes | Optional grant | No |
| View financial reports | Yes | In scope | Optional grant |
| Export financial data | Yes | Optional grant | No |
| Manage Team access | Inherited spec 07 | Inherited spec 07 | No |

“In scope” always means the actor also passes Branch access checks. Platform
administrator status alone grants no tenant data access.

## Optional grants

MVP adds only the grants demonstrated above:

- `canReversePayments`;
- `canAdjustCharges`;
- `canViewReports`;
- `canExportFinancialData`.

They belong to the Organization membership and default false except where the
role baseline explicitly grants the action. Only the Owner may grant or revoke
them. They cannot widen Branch scope or be delegated onward.

If implementation shows that existing roles cover a capability safely, do not
persist a redundant flag. Any change to this matrix updates this specification
and access-control tests first.

## Audit events

The domain audit log records high-impact events:

- Member status changes;
- Enrollment creation, pause, resume, term changes and end;
- Charge generation batch, adjustment and void;
- Payment posting and reversal;
- Program/Plan activation changes;
- CSV import and export;
- business permission grants/revocations.

Each event stores Organization, event type, actor user ID, event time, subject
type/ID, optional Branch, and structured before/after or event details. Secrets,
passwords, tokens and unnecessary personal fields are forbidden.

Audit records are append-only through application APIs. Event details are
versioned so future readers can interpret old events. Product history shown to
users may be a safe projection of the audit record.

## Enforcement rules

- Authorization lives in Worker modules, not React conditions.
- Domain services accept a validated TenantContext, never an arbitrary tenant ID.
- Branch-scoped actions use validated accessible Branches.
- Collection endpoints apply permissions before counts, pagination and search.
- Not-found behavior prevents foreign identifier probing.
- Status/permission changes take effect on the next server request, consistent
  with inherited tenant controls.

## Acceptance checks

- Every mutating endpoint has explicit role, grant and Branch tests.
- Platform admins without membership cannot access domain records.
- Optional grants never permit peer Team management or wider Branch access.
- Financial mutation and export events appear in the audit log.
- Audit writes cannot cause a successful financial write to be reported when
  required audit evidence was not persisted.
- UI visibility matches server authority but is never the authority.
