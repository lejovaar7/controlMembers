# Specification 04: Tenant and Branch Security

[All specifications](README.md)

## Tenant model

A Better Auth Organization is the tenant/company. `TenantContext` is created
only from:

```text
authenticated Better Auth session
  -> session.activeOrganizationId
  -> matching active member row for the authenticated user
  -> matching Organization row
```

`src/worker/tenant/index.ts` returns:

- authenticated user ID
- active Organization ID
- active Organization name
- Organization role
- membership ID, effective `allBranches` / `canAppointAdmins`, assigned Branch IDs
- Organization locale, timezone, and currency

A missing active Organization, missing membership or `isActive:false` fails `requireTenant()`.
Browser-supplied Organization IDs are not used as authorization proof.

## Branch model

A Better Auth Team is a Branch/location. `BranchContext` contains Branch ID,
Organization ID, and name after access validation.

Branch authorization is:

| Organization role | Effective Branch access |
| --- | --- |
| `owner` | Every Branch in the active Organization |
| `admin`, `allBranches:true` | Every current/future Branch in the active Organization |
| `admin`, `allBranches:false` | Only Branches with a matching `team_member` assignment |
| `member` | Only Branches with a matching `team_member` assignment |

All roles are denied when the Team belongs to another Organization.

## Server helpers

`src/worker/tenant/branch.ts` provides:

- `listAccessibleBranches()` — role-aware list inside the active Organization.
- `canAccessBranch()` — single Boolean access rule.
- `getBranch()` — loads only an accessible Branch.
- `requireBranch()` — resolves `session.activeTeamId` and enforces access.

Owner and unrestricted-admin access ignores incidental `team_member` rows.
Limited admins and members use assignments. Better Auth may still require a
Team-member row merely to set an active Team; the compatibility helper cannot
add one outside the actor's already-authorized scope.

## Active context

- `session.activeOrganizationId` is the only active-company authority.
- `session.activeTeamId` is the only active-Branch authority.
- There is no custom active-context cookie, local storage authority, or database
  column outside Better Auth session state.
- Switching Organization clears the old active Team before selecting the new
  Organization.
- The app shell retains a valid active company. With no valid active company,
  it enters the sole active membership automatically, but requires explicit
  selection when two or more are available. It never chooses the first of many.
- Switching company reloads the page after server activation, discarding old
  session, Branch and form state while retaining the requested application path.
- A stale or forged active Team does not bypass `requireBranch()`.

## Company selection API

`GET /api/companies` returns `{companies:[{id,name}]}` for only the authenticated
user's active memberships. It requires a session but not an active company and
does not select a company as a read side effect. `POST /api/companies/active`
accepts exactly `{organizationId:string|null}`, validates active membership,
clears the active Team, and delegates activation to Better Auth's server API.
Null clears company context; unknown/inactive membership is denied. Native
company list/activation/member metadata HTTP paths are disabled so they cannot
reintroduce inactive companies. There is no new account or membership model.

## Accessible Branch API

`GET /api/branches` calls `requireTenant()` and
`listAccessibleBranches()`. The browser cannot request another Organization's
list by submitting an Organization ID.

The response contains Branch ID/name for accessible Branches and safe
Organization `{id,name,role}` metadata plus sibling
`permissions:{allBranches,canAppointAdmins}` for the shared shell. It never includes a
full membership directory. `requireOrganizationAdmin()` protects Member routes.
Unrestricted native member/Team reads are disabled over HTTP.

The response also includes `{allBranches,canAppointAdmins}` permissions.
Language reads independently validate the same active membership; language
company writes require Owner/admin and never accept a tenant ID from the body.
Language choice is not an authentication or Branch-authorization mechanism.

## Exceptional states

Branch management renders only the accessible Branches supplied by the app shell.
The searchable directory puts the current Branch first and identifies it as the
current workspace, rather than suggesting other Branches are inactive. Creation
is offered only when `canCreateBranches` is true; scoped administrators retain
rename actions for their assigned Branches. Create and rename use a shared
centered form and the existing Better Auth Team APIs. Successful saves refresh
the shell list; error feedback stays with the form and preserves the typed name.
The page introduces no additional Branch access or switching authority.

- An authenticated user with no active company membership sees `/no-company` and cannot
  create one.
- A normal member or limited admin with zero assignments receives an empty accessible list and
  sees `/app/no-branch-access`.
- That state does not reveal inaccessible Branch names or offer Branch creation.
- An owner or unrestricted admin with an exceptional zero-Branch Organization can create a
  Branch from the management screen.

## Rules for ControlMembers domain features

Every tenant-owned entity must carry `organizationId`. Branch-scoped entities
must additionally carry `branchId`. Resolve them through validated session,
membership and Branch context; identifiers from React are never proof of access.
The database helper provides a connection, not automatic query authorization.

The inherited foundation provides `owner`, `admin` and `member` Organization
roles. ControlMembers layers only the explicit business grants in specification
16 over those roles; they never replace or widen the Organization/Branch boundary.

## Product workspace selection

The session's active Team narrows product data independently of administrative
permissions. `requireWorkspaceTenant` validates it with the existing Branch
authorization helper; `workspaceCondition` applies it to ledger queries.
Owners retain company administration and explicit Plan sharing rights, but
their selected workspace does not aggregate other Branches. Invalid active
Teams fail closed. Requests without an active Team retain the authorized API
scope; the application shell resolves a Branch before displaying product pages.

Plans, Members, Enrollments, Charges, Payments, dashboard, reports and exports
respect this workspace. Branch switching remounts route content to discard
previous results, pending dialogs and form defaults. Company settings, identity,
staff permissions, tags and payment-method catalogs remain Organization-owned.
See `test/workspace-isolation.test.ts` for real Worker/D1 regression coverage.

## Acceptance checks

- Membership in company A never grants reads or writes in company B.
- Owner/unrestricted admin sees all Branches; limited admin/member sees assigned ones only.
- Incidental Owner/unrestricted-admin Team rows do not narrow their permissions.
- Disabled membership grants no tenant access, even with an existing session.
  Other active company memberships and the shared identity remain untouched.
- One company needs no selector; several without valid active context require
  selection. Activation never widens membership or Branch permissions.
- Foreign, forged or stale active Team IDs cannot bypass server guards.
- Switching company clears the old Team and never reuses the former company's
  Branch list. Recovery selects existing authorized state; it creates nothing.
- Missing membership or zero assigned Branches yields the appropriate safe
  state, not an onboarding form or a leak of inaccessible Branch names.
- Every new tenant/Branch-owned feature adds its own isolation tests.

Evidence: `test/tenant-isolation.test.ts`, `test/onboarding.test.ts` (legacy
filename), `test/branches.test.ts`, `test/members.test.ts` and `test/access-controls.test.ts`.
