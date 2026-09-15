# Specification 06: Branch Management

[All specifications](README.md)

## Purpose

Manage company locations without introducing a second Branch model. Creation,
renaming, visibility and selection are implemented; deletion is not supported.

## Implemented behavior

### Visibility

- Owner/unrestricted admin sees every current/future Branch in the active Organization.
- Limited admin and member see only assigned Branches.
- Limited admin/member with no assignment sees no Branch and receives the dedicated access
  page.
- Foreign Organization Branches are never returned.

### Management

- Owner/admin sees the Branches navigation item.
- Member does not see the management navigation and is redirected from a direct
  `/app/branches` visit.
- Only Owner/unrestricted admin can create an additional Branch through `createTeam`.
- Owner/admin can rename a Branch through `updateTeam`, but a limited admin can
  rename only an assigned Branch and sees no Branch-creation form.
- The list refreshes after a successful mutation.
- Server hooks trim names and reject empty or over-100-character values.
- Native Team writes are restricted to the active tenant; browser assignment
  writes only support owner/admin self-activation inside existing authorized scope.
  Native active-Team selection is guarded too; inactive memberships cannot use it.
- Branch deletion is absent.

### Single- and multi-location UX

- One accessible Branch is rendered as a plain label.
- Two or more accessible Branches render the Branch selector.
- The dashboard reads active Branch name from shared app-shell state.

## Main source files

| File | Responsibility |
| --- | --- |
| `src/worker/index.ts` | `GET /api/branches` |
| `src/worker/tenant/branch.ts` | Branch access and listing rules |
| `src/react-app/hooks/use-branches.ts` | Organization-keyed accessible list |
| `src/react-app/hooks/use-app-shell.ts` | Shared typed shell state |
| `src/react-app/lib/activate-branch.ts` | Better Auth active-Team compatibility flow |
| `src/react-app/components/branch-switcher.tsx` | Multi-Branch selector |
| `src/react-app/layouts/AppLayout.tsx` | Role-aware navigation and exceptional states |
| `src/react-app/pages/BranchesPage.tsx` | Create and rename forms |
| `src/react-app/pages/NoBranchAccessPage.tsx` | Zero-assignment member message |
| `test/branches.test.ts`, `test/access-controls.test.ts` | Branch management and limited-admin authorization coverage |

## Security enforcement

The Branch page's role check is UX only. Better Auth Team endpoints enforce
management roles; `auth/http-policy.ts` additionally enforces active membership
and Branch scope. Custom Branch reads use validated `TenantContext`.

Tests prove:

- Owner/unrestricted-admin full Branch visibility, including future Branches
- limited-admin/member assigned-only visibility
- zero-assignment behavior
- Owner/unrestricted-admin creation; limited-admin creation refusal
- member creation refusal
- foreign Organization creation refusal
- owner rename
- member and foreign Organization rename refusal
- stale active-Team denial

## Manual acceptance checks

- A company begins with `Main`. Adding a second Branch reveals the selector
  without requiring a full reload; renaming refreshes its list and label.
- Empty/whitespace-only names fail both client and server validation.
- An ordinary member cannot create or rename a Branch, including by navigating
  directly to the management page or calling the API.
- A member with no assignments sees the no-access notice without creation UI.
- A limited admin sees only their locations, may rename those, and cannot create,
  select, self-assign or rename any Branch outside their scope.
- An exceptional Owner/unrestricted-admin company with zero Branches can create one to
  recover; it is not redirected into an endless no-company loop.
- Switching companies never flashes or reuses the previous company's Branches.
- Network failure is recoverable and never presented as zero Branch access.

## Scope and evidence

Branch deletion requires a separate policy for active sessions, assignments
and future Branch-owned business data. Business operations for a location are
defined by the ControlMembers domain specifications, not this Branch module.

Single/multiple Branch, create/rename, company switching, member restrictions
and no-access states were exercised in a local Worker. Failure and retry are
distinct from empty access. README, agent guidance and master status are aligned.
See [the verification record](VERIFICATION.md) for exact checks.
