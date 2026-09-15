# Specification 05: Frontend Application

[All specifications](README.md)

## Entry point and design system

`src/react-app/main.tsx` mounts React, `I18nProvider` and the Router. Styling uses Tailwind CSS
4, Geist variable font, and neutral shadcn/ui primitives built on Base UI.

Reusable UI includes:

- `AuthCard` and `FormMessage` for auth flows
- `PageContainer` and `PageHeader` for application pages
- Button, Card, Input, Label, and Separator primitives
- Organization and Branch switchers
- Language picker for public, personal and company preferences

The inherited shell begins neutral. ControlMembers product navigation, semantic
financial states and restrained branding extend it under specification 17 using
the same Tailwind/shadcn/Base UI system.

Source message keys are English; typed catalogs translate UI and email. Reuse Base UI
patterns rather than assuming Radix-specific examples are compatible. Do not
introduce a global state/data-fetching library without a demonstrated need.

## Route groups

### Public/auth layout

Implemented pages:

- `/` — generic home and sign-in/application entry
- `/login` — password sign-in with safe return path
- `/verify-email` — verification resend support
- `/forgot-password` — generic reset request
- `/reset-password` — Better Auth reset completion
- `/setup-account` — authenticated first-time password choice
- `/no-company` — signed-in non-platform account with no active company access,
  including deactivated memberships

Redirects:

- `/register` -> `/login`
- `/onboarding` -> `/app/dashboard`

The unsupported `/accept-invitation` route/page was removed.

### Platform layout

- `/platform` — platform administration home
- `/platform/organizations/new` — customer provisioning form/result

The layout redirects unauthenticated users to login and non-platform users into
the tenant application. Default sign-in, setup completion, home entry and
no-company recovery all send platform administrators here. Server endpoints
repeat the authoritative guard.

### Application layout

- `/app/dashboard` — active company and Branch summary
- `/app/branches` — current Branch management implementation
- `/app/no-branch-access` — zero-assignment member/limited-admin state
- `/app/members` — directory, provisioning, access/delegation editing, deactivation/reactivation and setup resend
- `/app/settings` — workspace summary, personal language and guarded company language

## Application shell state

`AppLayout` composes:

- Better Auth session
- active company memberships from `/api/companies` via `useCompanies()`
- active Organization and active Organization member role
- effective all-Branch, admin-appointment and Branch-creation permissions
- accessible Branches from `/api/branches`
- active accessible Branch
- Organization/Branch switching
- sign-out

It exposes typed `AppShellContext` to nested routes through React Router outlet
context. Dashboard, Branch and Users & permissions pages consume that shared state instead of issuing
duplicate Branch requests.

`useBranches()` distinguishes:

- not loaded for the current Organization
- successful Branch list
- successful empty list
- request failure

Loaded state is keyed by Organization ID so a previous tenant's Branches are not
reported after switching. Branch data and role are revalidated on focus/visibility
and every 30 seconds while visible. A failed fetch is never treated as empty
access; recovery failure exposes a retry instead of an endless spinner.

`useCompanies()` is session-user-keyed and abortable, with the same focus,
visibility and visible 30-second refresh. Inactive companies disappear from
selection; server checks deny their access immediately on the next request,
independently of UI refresh timing. Already rendered content is not erased remotely.

Small frontend libraries also provide class-name composition, safe auth error
mapping, return-path validation, and slug utilities. The frontend slug utility
is legacy from the removed self-service onboarding direction and has no current
route consumer; Organization slug creation is authoritative in the Worker.

## Switching behavior

`OrganizationSwitcher` consumes the shell's active-only company list, not a
second request to Better Auth's unrestricted Organization directory. One company
is a plain label. A valid active company is kept; otherwise one available company
is activated automatically, several show an explicit chooser inside the app
layout, and none shows `/no-company` for tenant users. Platform-only accounts go
to `/platform` instead. The chooser preserves the intended app path.

`activateCompany()` uses the guarded `/api/companies/active` endpoint. The server
clears the old active Team; the UI reloads after success to discard company A's
session, Branches and forms before rendering company B. Failure shows retry, not
an arbitrary company fallback.

`activateBranch()` first calls Better Auth `setActiveTeam()`. If Better Auth
requires a missing Team-member row for an Owner/unrestricted admin, it adds that row through
the supported API and retries. Backend Branch authorization remains role-aware.

## User-access form lifecycle

`MembersPage` owns a company/role/scope-keyed workspace with abortable directory
loads, add/edit forms, resend/status state and accessible feedback. `MemberForm`
shares role and Branch controls, offers admins all/selected scope where allowed,
and exposes the appointment checkbox only to the Owner. The admin role option
requires appointment authority. A status confirmation names the person and says
that deactivation affects only this company; reactivation restores saved access.
Inactive members cannot resend setup. Shared out-of-scope employees are explicitly
read-only. The form never asks an administrator
to choose a user's password. The server-returned `canManage` flag controls edit
visibility; server policy is authoritative. See [Users and Permissions](07-member-management.md).

Settings beyond language and invitation acceptance remain deliberate exclusions.

## Localization contract

The platform-neutral `src/shared/i18n/` module contains a registry, English source
message keys, complete typed catalogs, resolution and Intl formatting helpers.
English and Spanish are the initial catalogs, not a two-language limit. Each new
catalog implements `Catalog`; registering its native name, Intl locale and
direction enables it in every selector and server validator. Do not add a second
language list or per-feature language conditionals.

Authenticated company priority is personal `user.locale` → required active
Organization locale. A null personal value means inherit from the active company;
platform-only accounts display their resolved language explicitly. `DEFAULT_LOCALE`
(English) remains the safe no-company and malformed legacy fallback. Registered regional/script codes are matched
case-insensitively on reads, with parent fallback. Writes require an exact
registered key or null. Currency and timezone are independent, not inferred.

Public pages resolve supported URL `lang` → saved browser choice → browser
language list → application fallback. The public choice uses only
`app.public-language` in localStorage and still works in memory if storage is
unavailable. It is not a tenant identifier or account preference. Signing in
does not silently persist it. Account-setup callbacks may use an explicit `lang`
hint while authenticated but not yet inside a company; personal/company values
still take priority and that hint never selects a company.

`I18nProvider` reads `/api/account/locale` and keys each response by user and
active Organization. It aborts stale requests and uses generation checks so a
late response cannot replace the new context. Initial authenticated loading and
failure are distinct states with retry/sign-out; no old company's language is
rendered while resolving the next. Preferences refresh on focus/visibility and
every 30 seconds while visible. Successful saves update the matching context
immediately and revalidate it.

The language API contract is intentionally narrow:

- `GET /api/account/locale` returns `{userLocale,organization}`. The optional
  Organization value contains only `{id,locale,canEdit}` after current active
  membership validation.
- `PATCH /api/account/locale` accepts exactly `{locale}` and changes only the
  authenticated user. Its value may be a registered locale or `null` to inherit.
  `PATCH /api/company/locale` changes only the active company after an Owner/admin
  guard and requires one exact registered locale key; company null is invalid.
- Extra fields and unsupported values fail safely. `src/worker/localization.ts` owns this
  validation and persistence. The browser never submits a user or company ID as
  language authority.

Company saves send `X-Company-Context` as a concurrency precondition. If another
tab changed the session's active company, the Worker returns `409 WORKSPACE_CHANGED`
instead of applying the old form to the new company. The header grants no access;
the active session and live membership remain the authority. The current browser
always sends the header; the backend accepts its absence for non-browser callers
but never derives a tenant from it.

`useT()` renders labels, navigation, descriptions, errors and confirmations.
State stores typed message keys rather than translated strings; changing language
updates existing feedback and preserves mounted form inputs. Named placeholders
translate complete sentences without translating names or interpreting inserted
content. React escapes text; email has its own HTML escaping. Document title,
`html.lang` and `html.dir` follow the resolved language. Native browser validation
and password-manager UI use the browser's own language.

`LanguagePicker` is visible in public/platform/application shells and Settings.
After login it saves only the current person's preference. Platform-only users
choose an explicit registered language; the company-inheritance option appears
only with an active company and names the resolved company language. Settings
also exposes the active company's language, editable only by its Owner/admin
(including branch-scoped admins); ordinary members see a disabled selector and
explanation.
This is a language permission, not additional Branch/data access. Timezone,
currency and other product settings remain uneditable.

Adding another language needs a complete catalog, one registry entry, checks
and visual/email review. RTL and plural-rich domain features need their own
appropriate layout/formatting work. There is no runtime machine translation.

## Acceptance checks

- Navigation exposes platform/tenant management only to the corresponding role;
  typing a management URL as an ordinary member does not bypass the UX guard.
- Switching companies discards old forms, feedback and late directory responses.
- A failed request shows an error/retry, not a successful empty list or an
  indefinite loading state.
- One accessible Branch is a label; multiple Branches offer a usable selector.
- One active company is a label; several require a choice only when no valid
  company is active. Revoked membership cannot remain a selectable company.
- Scoped admins see only authorized Branches, no create-Branch form, and no
  controls for granting wider scope or onward appointment delegation.
- Auth, switchers and management forms support keyboard input, visible focus,
  semantic labels, password managers and accessible pending/error feedback.
- Mobile/reflow layouts and browser zoom remain usable; never disable pinch
  zoom. See [recorded browser checks](VERIFICATION.md#browser-review) for what was
  actually exercised, rather than treating this checklist as a test log.
- Dashboard and Settings display current workspace data. Settings edits only
  personal/company language; the unsupported invitation page is not advertised.
- Public selection, company inheritance, personal override, clearing an override
  and company switching keep the correct language through reload/sign-in.
- UI copy, existing feedback, role labels and accessible names are translated;
  company/member/Branch data stays unchanged. New catalogs have complete keys
  and matching placeholders. Late requests cannot restore old preferences.
