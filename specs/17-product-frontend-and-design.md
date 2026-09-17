# Specification 17: Product Frontend and Design System

[All specifications](README.md)

**Status:** Implemented locally across the bilingual responsive application.
Automated catalog checks pass; final device/browser pilot acceptance remains a
release activity.

## Experience goal

ControlMembers must feel calm, clear and fast for nontechnical owners and staff.
It is an operational tool, not a dense accounting system. The most common tasks
—finding a Member, seeing what is owed and recording a Payment—must require few
decisions and preserve financial context.

## Design foundation

Continue the inherited stack:

- Tailwind CSS 4 for tokens and layout;
- shadcn/ui components built on Base UI;
- Lucide icons;
- Geist variable font;
- existing `PageContainer`, `PageHeader`, form and feedback patterns.

Reuse existing primitives before introducing an equivalent. Wrap generated
shadcn files rather than modifying them when product behavior is needed. Do not
add a second component library. Product branding may define one primary accent,
logo and semantic status tokens while preserving accessible contrast.

This branded baseline is the explicit product-level exception that permits
visual token, size, radius and elevation changes in the checked-in Button, Input
and Card primitives. Their behavior and public component APIs remain stable.

## Brand system

ControlMembers belongs to the same visual family as ControlWash. Its logo keeps
the original ControlWash symbol, the exact vector construction of `Control`, its
proportions and its navy/blue colors (`#02285A` and `#02A3F1`); only the product
word changes from `Wash` to `Members`. The interface uses an accessible blue
accent (`#1263C0`), navy text and cool off-white surfaces, aligned with the shared
brand family. Semantic green, amber and rose badges retain explicit status
labels. Financial data takes precedence over decorative color.

The wordmark appears on public/authentication surfaces and in the application
shell. Dashboards may repeat it inside a bounded brand panel without competing
with balances or actions. All screens inherit the same CSS variables, spacing,
radius, elevation and focus treatment; do not recreate brand colors ad hoc in
individual feature pages.

The desktop shell has a 248-pixel sidebar from 1024 pixels upward. Below that
breakpoint, a Base UI modal navigation drawer provides focus trapping, Escape
handling and focus restoration. It closes after navigation and when switching
to desktop width. Language and sign-out controls remain available in the drawer.
Main content has a keyboard skip link and shared focusable page headings.
The logo belongs to the sidebar navigation, without a horizontal separator
under it, and links to the dashboard or member list according to report access.
A soft right-side shadow separates navigation from the workspace without a hard
vertical border. The company header groups a prominent company name with its
branch below. Desktop account controls use a compact language selector, initials
avatar, user name and company role; smaller screens retain these controls in the
navigation drawer. The compact inherited-language option names the language and
company source without clipping a long instruction.

Dashboard cards use one column below 380 pixels, two on larger mobile screens
and four on wide desktops. Amounts show the currency symbol first, with a shared
currency caption above the cards to preserve legibility. The
collection visualization uses the API collection rate, with an explicit unknown
state rather than inventing zero. Its accessible label includes the value.
Period changes discard stale dashboard results, with structural skeletons and retry feedback.

Member, Charge and Payment lists share compact bordered rows. Report tables
become labeled vertical rows below 640 pixels, preserving financial fields and
column headers. Inputs and selects are at least 44 pixels tall; small shared
buttons are at least 40 pixels. Reduced-motion preferences disable decoration
and loading animations. Public, authentication, platform and tenant screens
share the same surface, typography and control tokens.

### Loading convention

Use the existing shadcn/ui Skeleton primitive for content with a known layout.
The shared `components/content-skeleton.tsx` owns reusable list, dashboard,
detail and form patterns. Keep page headings, filters and navigation visible;
replace only the region waiting for data. Shapes follow the responsive grid and
approximate the resulting rows, fields or cards. Never show fake values or an
empty-results message before a request finishes.

| Waiting for | Required pattern | Current screens |
| --- | --- | --- |
| Records or directory | ListSkeleton | Companies, members, users, charges, payments |
| Metrics and summaries | DashboardSkeleton | Dashboard, financial reports |
| A complete entity | DetailSkeleton | Company and member details |
| Settings and fields | FormSkeleton | Billing settings and plans |
| Session or workspace resolution | Loader (LDRS Ring 2) | Authentication and application guards |
| Submit, resend or selector mutation | LoadingButton or inline Loader | Forms, invitations, language and workspace selectors |

Ring 2 remains the sole spinner, with shared speed and stroke style. Do not
replace an editable form with a skeleton during submission. Busy buttons retain
their dimensions and prevent duplicate submission. Loading regions have one
translated status announcement; skeleton shapes are hidden from assistive
technology. Loading copy is not shown visually. Reduced motion stops both pulse
and ring animations. Errors and empty results remain separate, explicit states.

### Mobile forms and content

Authentication uses a centered, width-constrained card below the public header,
with room to scroll naturally on short screens or when the keyboard opens.
Fields and primary actions are 48 pixels tall, and inputs use 16-pixel text to
avoid focus zoom. Password fields share a labeled visibility toggle. The desktop
brand panel is omitted on smaller screens so the form stays the main action.
Page actions wrap and expand on mobile; long translated button labels remain
inside their controls. Data tables become labeled records below 640 pixels.

## Terminology and navigation

### Plain-language copy convention

Write for owners and staff without technical or accounting training. Use clear
actions while retaining the established "Import CSV", "Preview import" and
"Export payments" terminology requested for file operations.
Reserve file extensions and format names for upload instructions, explaining
that the completed template must be saved as comma-separated CSV, not XLSX.
Spanish uses "sede" consistently for branches and "informes" for reports.
Payment reversal is labeled "Cancel payment"; its confirmation explains that it
stops counting toward charges and credit and does not issue a refund.

Use shared `currencyName` and `formatMoney` helpers for visible currency names
and amounts. Amounts always place the currency symbol first, followed by a
nonbreaking space and the localized number (for example, `$ 0`). They omit decimals for whole
values and preserve hundredths otherwise. Dashboard, member pages, charges, payments and reports
show a shared `CurrencyLabel` once above the data, rather than repeating a long
currency name in every figure. Currency labels use capitalized, plural names.
Billing settings select currencies by their readable names while retaining their
original codes in requests. Money remains stored in hundredths; language never
selects a currency or changes financial calculations.
Avoid implementation details such as "starter" in customer-facing settings.

Customer records are **Members/Miembros**. The section for authenticated
organization users is **Users & permissions/Usuarios y permisos**. Its primary
action is **Add user/Agregar usuario** and its description is “Manage who can
sign in to the system and what actions they can perform.” The target application
navigation is:

1. Dashboard
2. Members
3. Charges
4. Payments
5. Plans
6. Reports
7. Users & permissions
8. Branches
9. Settings

Navigation hides unauthorized modules for usability; direct routes remain
server-protected. On narrow screens it becomes an accessible menu rather than a
wrapped desktop sidebar.

## Status language

| State | Visual intent | Required non-color cue |
| --- | --- | --- |
| Paid | positive/success | “Paid” label and icon where useful |
| Pending | neutral/information | “Pending” label |
| Partial | warning | “Partially paid” plus remaining value |
| Overdue | destructive/urgent | “Overdue” plus days/value |
| Void/Reversed | muted | explicit lifecycle label |

Color is never the only signal. Money is formatted through shared Intl helpers
using Organization currency; business dates use Organization timezone.

## Core screen contracts

### Dashboard

Four primary cards—Expected, Collected, Outstanding, Overdue Members—appear
before secondary charts or lists. Each navigates to a filtered report. Empty
setup states provide one next action.

### Members

Search and high-value filters remain visible. Desktop may use a table; mobile
uses compact rows/cards without horizontal dependence. Selecting a Member opens
a full page with overview, contacts, enrollments and financial activity.

### Charges

Period and payment-state filters lead. Bulk generation is a distinct confirmed
action and never shares placement with destructive actions. Balance and due date
are more prominent than internal identifiers.

### Payments

The composer shows Member, amount, method, date and allocation preview. It
requires a final review before posting. A successful result shows receipt number
and allocation, not only a toast.

### Plans

A Plan combines the offering and its monthly terms. The primary form asks for
name, optional description, monthly price, usual due day and available Branches.
When only one Branch exists it is assigned without showing a selector. Optional
tags use an inline chip/autocomplete control and never determine price, access or
billing behavior. Simple management lists prioritize active records; historical
inactive records remain discoverable.

## Interaction rules

- One primary action per page region.
- Destructive/reversal actions use explicit confirmation naming subject and
  consequence; confirmation language does not rely on button color.
- Pending submits disable duplicates and expose an accessible status.
- Server validation maps to specific safe field or form messages.
- Search input is debounced and cancellable; stale tenant/Branch results are
  discarded using inherited context rules.
- Filters are reflected in the URL when sharing/reload is useful, excluding
  secrets or sensitive free text.
- Focus moves to meaningful headings/errors after navigation or failed submit.

## Responsive and accessibility requirements

- Critical flows work at 390×844 CSS pixels and desktop widths.
- No essential action requires hover.
- All controls have programmatic names and keyboard operation.
- Dialog focus is trapped and restored by Base UI primitives.
- Touch targets are at least 40 CSS pixels in the product application.
- Structural skeletons reserve content space and Ring 2 indicates actions;
  errors, empty data and zero results are
  visually and semantically distinct.
- `document.lang` and direction follow the existing localization provider.
- English and Spanish catalogs remain complete with placeholder parity.

## Acceptance checks

- A staff user can find a Member and post a straightforward Payment in under one
  minute during moderated acceptance testing.
- “Member/Miembro” is used only for customers, never for authenticated users.
- Critical financial consequences remain visible on mobile.
- Status meaning is understandable without color.
- New features reuse the inherited component/token system.
- Keyboard, focus, narrow-layout and bilingual checks are recorded in the
  verification log.
