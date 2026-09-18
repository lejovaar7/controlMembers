# Specification 07: Users and Permissions

[All specifications](README.md)

> **ControlMembers terminology:** this inherited module manages authenticated
> users and is presented as **Users & permissions/Usuarios y permisos** in the
> product. Customer-facing Members/Miembros are separate `customer_member`
> records specified in module 11. Better Auth's existing `member` table, route
> and API terminology remain unchanged.

## Purpose and entry points

`/app/members` is labeled **Users & permissions/Usuarios y permisos** and lets a company owner/admin provision people, manage supported
access and deactivate/reactivate access to that company. A membership is the
existing Better Auth `member` relation between a user and a company, not a paid
subscription or a second login. Identity, credentials and other companies remain
independent of changes to this relation.

| File | Responsibility |
| --- | --- |
| `src/worker/tenant/members.ts` | Directory, validation, target/scope policy, provisioning, access, status and resend |
| `src/worker/tenant/index.ts` | Active membership, role and effective permissions |
| `src/worker/tenant/branch.ts` | Authoritative Branch access |
| `src/worker/auth/provisioning.ts` | Identity reuse and secure account setup |
| `src/worker/auth/http-policy.ts` | Blocks native Team bypasses |
| `src/worker/index.ts` | Five guarded user-access routes |
| `src/react-app/pages/MembersPage.tsx` | Directory, forms, status confirmation and feedback |
| `src/react-app/components/member-form.tsx` | Shared identity/role/Branch/delegation form, never a password form |
| `src/react-app/lib/members.ts` | Browser transport types |
| `test/members.test.ts`, `test/access-controls.test.ts` | Provisioning, permissions, lifecycle, isolation and failure coverage |

## Stored and effective permissions

The membership carries `role` plus three fixed fields introduced by generated
migration `0005_safe_thunderbird.sql`:

| Field | Default | Meaning |
| --- | --- | --- |
| `isActive` | `true` | Whether the company membership authorizes access |
| `allBranches` | `true` | For an admin: all current/future Branches, rather than assigned Branches |
| `canAppointAdmins` | `false` | For an admin: permission to create/promote another admin in this company |

An active Owner always has all Branches and appointment authority. Ordinary
members always use assignments and cannot appoint admins, regardless of an old
stored flag. An inactive membership grants no tenant authority. These fields do
not create custom roles, a generic permission editor or billing subscriptions.

Existing memberships stay active on migration. Existing admins keep all-Branch
access, but appointment authority now requires an explicit Owner grant.

## Authorization

| Actor | Create member | Create/promote admin | Edit access, deactivate/reactivate, resend setup |
| --- | --- | --- | --- |
| Owner | Yes | Yes | Admin or member, never self/Owner |
| Admin, appointment disabled | Yes, within scope | No | Users fully within scope only |
| Admin, appointment enabled | Yes, within scope | Yes, within scope | Users fully within scope only |
| Standard User (`member` role) or platform-only user | No | No | No |

Only the Owner can grant/revoke `canAppointAdmins`, including on creation.
Delegation is off for a new admin unless the Owner explicitly enables it. An
admin cannot change that flag, edit a peer admin, edit themselves, transfer
ownership or create a platform administrator. After promoting a member, that
target becomes a peer admin and is no longer manageable by the promoting admin.

A limited admin cannot grant all-Branch access or any Branch outside their own
assignments. To change a target's access/status or resend setup, the actor must
cover the target's **entire** existing Branch scope. An employee shared with a
Branch outside the actor's scope is read-only; managing that employee requires
the Owner or a wider-scope admin. This prevents a local manager disabling access
to another location. Missing, foreign and unmanageable target IDs return the
same `404 MEMBER_NOT_FOUND`.

## Directory contract

`GET /api/members` returns `{organizationId,members}` from the active tenant.
Entries contain `membershipId`, user `{id,name,email}`, `role`, `isActive`,
`canAppointAdmins`, `setupRequired`, `canManage`, `scopeRestricted` and:

- `{kind:"all-branches"}` for Owner or unrestricted admin.
- `{kind:"assigned-branches",branchIds}` for limited admin or member.

Both active and inactive targets are listed when visible. A limited admin sees
their own entry and users assigned to overlapping Branches, not outside users
or unrestricted administrators. For a shared employee, only overlapping Branch
IDs are returned and `scopeRestricted` marks the read-only partial view. It must
never be submitted as if it were the employee's complete scope.

No password hash, token, platform role, ban, provider record, session or foreign
company membership is exposed.

## Provisioning contract

`POST /api/members` accepts `{name,email,role,branchIds,allBranches?,canAppointAdmins?}`.
Unknown fields are rejected. Role is exactly `admin` or `member`; email is
trimmed/lowercased and a new identity needs a name. Branch IDs are deduplicated.

- Standard Users require at least one valid assigned Branch and cannot request either
  administrative flag as `true`.
- Admins may have all Branches (empty array) or a nonempty selected array.
  Omitting `allBranches` retains the original admin default of all Branches;
  limited-admin callers must explicitly request selected scope.
- Only Owner requests may include `canAppointAdmins`, even when `false`.
- Validate the full desired scope and appointment authority before creating an
  identity. No foreign/missing Branch is accepted.

1. Reuse the normalized-email identity without modifying name, credentials,
   verification, bans, providers or platform role.
2. Otherwise create a Better Auth user with a secret random provisional password.
3. Insert membership role, scope mode and appointment flag together through the
   server-only `addMember`; a new limited admin is never inserted unrestricted.
   Include the first Team for assigned scope; Better Auth rolls membership back
   if that first assignment fails.
4. Add remaining assignments through authorized Better Auth server APIs.
5. Send secure account setup after access exists, only if needed. The validated
   company supplies the email language context; the recipient's personal
   preference takes precedence over that company language.

Response is `{membershipId,alreadyMember,setupEmailStatus}` with `sent`,
`not-required` or `failed`. No provisional password or setup token is exposed.

The unique company/user index and idempotent assignment APIs prevent duplicates.
Repeat POST cannot change role, scope mode, an explicitly supplied delegation
flag, or remove assignments. It can add assignments only to a manageable target;
use PATCH for exact access changes. An existing admin cannot be re-provisioned
by another admin, even with delegation: it returns `409` without sending setup
or changing assignments. The Owner must handle that retry if provisioning was
interrupted. An inactive membership returns `409 MEMBER_INACTIVE`; provisioning
never reactivates it implicitly.

## Account setup and resend

`POST /api/members/:membershipId/setup/resend` requires a manageable active
target. An inactive target returns `409 MEMBER_INACTIVE`. Established accounts
(verified mailbox plus a credential-provider password) return `not-required`.
Interrupted setup, including verified users with no chosen password, can resend.

Resend uses the same guarded company language context as initial setup, never
the acting administrator's language. Subjects, text, HTML and setup-page hints
follow the recipient/company rules in [authentication and email](02-authentication-and-email.md).

Magic Link proves mailbox ownership and revokes unproven provisional credentials.
`/api/account/setup-password` then sets a password for the authenticated verified
user only, refusing an already configured credential. Email failure preserves
valid access and reports `failed`; it is not a rollback of provisioning.

## Updating access

`PATCH /api/members/:membershipId` accepts `{role,branchIds,allBranches?,canAppointAdmins?}`
with the same desired-scope validation. It does not change `isActive`.

- Validate existing target authority and all requested access before mutation.
- For assigned scope, add desired assignments, remove obsolete ones, then
  reaffirm desired rows. A successful save leaves the exact requested set.
- Save scope/delegation and change role through Better Auth after assignments
  exist. Demotion clears delegation; promotion does not inherit dormant flags.
- All-Branch scope ignores incidental Team rows and includes future Branches.
- Removed access is denied on the next server request even with a stale active
  Team. Editing an inactive target's scope does not reactivate access.

These are ordered Better Auth operations, not a global D1 transaction or a
versioned concurrent editor. Interrupted changes can retain extra old access;
they report failure, not success. Reload and save the intended final scope after
a conflict. An Owner may need to complete a failed promotion once the target has
become an admin. Do not promise transactional revocation or conflict-free
simultaneous administration.

## Deactivation and reactivation

`PATCH /api/members/:membershipId/status` accepts exactly `{isActive:boolean}`.
The target policy is the same as access editing; Owner/self/peer admins and
out-of-scope targets are protected. Repeating the same status is harmless.
Reactivation requires saved Branch assignments unless the target has all Branches.

Deactivation changes only this membership. It preserves the user, password,
history, role, delegation, Branch assignments, global sessions and memberships
in other companies. Existing sessions and new logins cannot bypass the inactive
check on tenant routes, company selection or supported native Team writes.
Reactivation restores the **saved** permissions without sending an email; review
and change scope first if the returning person's job has changed.

Company lists include only active memberships. One remaining company is entered
automatically; several require selection when the active company is invalid;
none shows the no-active-company notice. See [tenant security](04-tenant-and-branch-security.md).
Server revocation applies on the next request. Open screens may retain already
rendered content until the next focus/visibility refresh or the visible 30-second
poll; deactivation cannot erase information already displayed or downloaded.

## Frontend and acceptance checks

- The staff directory uses `users-table.tsx`, a semantic table with user name and
  email, company role, accessible Branches, access status and authorized actions.
  Narrow containers stack labeled fields without horizontal scrolling. Permission
  details expand within the role cell; restricted scope explanations remain visible.
  Unmanageable entries show read-only status, with no mutation controls.
- Add user is the page-header action. Both create and edit use the shared centered
  dialog; closing an edit restores focus to its row button. Loading uses matching
  table skeletons, and directory failures retain an explicit retry action.
- Owner-only delegation checkbox, off by default; admin role choice only for
  appointment-authorized actors. Limited callers cannot choose all Branches.
- Active/inactive and scope are visible; read-only shared employees explain why
  they cannot be managed. Owner/self/peer protection matches server responses.
- Deactivate/reactivate requires confirmation naming the person and explaining
  that only this company's access changes. Inactive people cannot resend setup.
- Company/scope changes discard old forms, feedback and late directory responses.
  Loading, errors and empty lists remain distinct; buttons provide pending and
  accessible feedback. No administrator chooses an employee's password.
- Tests cover default denial, Owner grant/revoke, no onward delegation, scoped
  creation/promotion, peer re-provision bypass, outside-scope rejection, shared
  read-only users, stale sessions, company-only deactivation and reactivation.
- Existing-account reuse, concurrent identical creates, partial failure and
  secure setup remain covered by the original provisioning/member suites.

Actual results are in [VERIFICATION.md](VERIFICATION.md). Deletion, ownership
transfer, profile editing, invitation acceptance and business-specific employee
fields/permissions remain outside this module.
