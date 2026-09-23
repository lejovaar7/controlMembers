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
Navigation starts below the logo without a visible workspace caption; the mobile
drawer retains a visually hidden accessible title.
A soft right-side shadow separates navigation from the workspace without a hard
vertical border. The company header groups a prominent company name with its
branch below. Desktop account controls use a compact language selector, initials
avatar, user name and company role; smaller screens retain these controls in the
navigation drawer. These compact selectors offer only registered languages
(English and Español), displaying the resolved language without a company
suffix. The explicit company-inheritance option remains in personal settings.
The shared LanguagePicker displays decorative Spain and United States flags
alongside Español and English in both the trigger and options. Import only the
two SVG assets from the pinned flag-icons package; retain the language names
as accessible text. The inheritance option uses the resolved company language's
flag. Keep the dropdown wide enough for a flag, full language name and checkmark.

The header Branch switcher is the operational scope
for Plans, Members, Charges, Payments and reports. Route content remounts on
Branch changes; do not keep a second independent all-Branches filter in a page.
New Plan and Member forms default to the current Branch.
Manual Branch changes keep the page visible beneath a lightly dimmed overlay
with the shared loader centered in a compact raised surface. The shell is inert
until the change completes. Successful activation refreshes the session and
confirms the selected Branch before removing the overlay. A changed Branch key
mounts fresh page state.
If Better Auth cancels a session request to start a newer one, keep waiting while
the session is pending or refetching; a resolved cancelled request is not a scope
failure. Only reconcile the selected Branch after session fetching has settled.
A failed activation restores the controls and displays retry feedback. If the
session cannot confirm the new scope, workspace recovery replaces the loader.
Selecting the current Branch does nothing, and repeated submissions are locked.

Browser request identifiers use `lib/idempotency-key.ts`, including payment
review and Member import. These actions must work at the documented LAN HTTP
development URL as well as localhost and HTTPS. Do not call `crypto.randomUUID`
directly from these flows; its absence on a LAN origin can prevent a dialog
from opening before any request reaches the Worker.

Dashboard cards use one column below 380 pixels, two on larger mobile screens
and four on wide desktops. Amounts show the currency symbol first without a
separate currency caption above the dashboard cards. The
collection visualization uses the API collection rate, with an explicit unknown
state rather than inventing zero. Its accessible label includes the value.
Period changes discard stale dashboard results, with structural skeletons and retry feedback.

Member, Charge and Payment lists share compact bordered rows. Report tables
become labeled vertical rows below 640 pixels, preserving financial fields and
column headers. Inputs and selects are at least 44 pixels tall; small shared
buttons are at least 40 pixels. Reduced-motion preferences disable decoration
and loading animations. Public, authentication, platform and tenant screens
share the same surface, typography and control tokens.

### Public landing page

The public home uses an editorial layout with a large navy/blue headline,
generous section spacing, a product overview, a three-step workflow, native
expandable FAQs and a contact panel. Its styles are scoped to the landing;
authentication and operational screens retain their existing presentation.
Desktop and compact navigation link to the product, workflow and sign-in.
Contact actions link to the MagdaSystems project contact section. There is no
public signup or claim that online payment processing is available.

An explicitly labeled fictional product preview lets visitors switch between
overview, member and payment examples without reading or writing business data.
Tabs support arrow keys, Home/End and selected-panel semantics. FAQs use native
keyboard-operable disclosure controls. All copy is catalog-backed in English
and Spanish, and decorative entrance motion respects reduced-motion settings.

### Date selection and focus convention

Use the shared `components/date-picker.tsx` controls for month, individual date
and date-range selection. Daily calendars use React DayPicker through shadcn's
Calendar; all three controls use the existing Base UI Popover. Month filters
show a twelve-month grid with year navigation and a current-month shortcut.
Dashboard, Charges and Reports share MonthPicker; Payments uses DateRangePicker;
Member birth dates and enrollment start dates use DatePicker. New enrollments
collect the first fee on the start date and use a 1–31 monthly payment day input
with short-month guidance and a preview of the next deadline.

Payment ranges are drafts until "Apply dates". Escape and outside dismissal
discard the draft. Clearing either endpoint preserves open-ended filtering;
clearing both restores all dates. Single-date form controls submit a hidden
date-only value. Preserve `YYYY-MM` and `YYYY-MM-DD` API values using local
calendar fields rather than UTC conversion. Calendar captions, weekday names,
navigation and accessible labels follow the app language.

Popovers fit the viewport and scroll vertically when space is limited. Calendar
days have 40-pixel targets; keyboard arrows move the active day, and closing
returns focus to the trigger. Reuse stable DayPicker components in the wrapper
to preserve its keyboard focus behavior across selection updates.

Focus and hover borders use neutral gray tokens, including select triggers.
Keyboard focus remains visible; pointer-only focus does not add a browser
outline. Selected dates and primary actions retain the brand accent.

### Dropdown convention

Use `components/select-field.tsx`, backed by the existing Base UI Select, for
single-choice dropdowns. Do not render native select menus in product pages.
This includes filters, form fields, company/branch/language switching and the
calendar's month/year menus. Pass explicit value/label options and use
`onValueChange`; labels follow the existing translation catalog.

The popup sits below its trigger when space permits, with a rounded surface,
soft shadow, neutral highlighted rows and a check beside the selected option.
Long labels wrap inside the popup while the trigger truncates within its layout.
Lists scroll within available viewport space. Preserve keyboard arrows,
typeahead, Escape, visible keyboard focus, disabled options, required validation
and named form values through Base UI; selection must not submit the form.

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
The Member CSV template download uses the shared outlined button appearance,
with a download icon and full-width layout on mobile, while retaining a native
download link to the template endpoint.
Spanish uses "sede" consistently for branches and "informes" for reports.
Payment reversal is labeled "Cancel payment"; its confirmation explains that it
stops counting toward charges and credit and does not issue a refund.

Use shared `currencyName` and `formatMoney` helpers for visible currency names
and amounts. Amounts always place the currency symbol first, followed by a
nonbreaking space and the localized number (for example, `$ 0`). They omit decimals for whole
values and preserve hundredths otherwise. Dashboard, member pages, charges,
payments and reports omit standalone currency captions above the data.
Reports uses a compact period toolbar with a single permission-gated export menu.
On phones, aging cards use tighter spacing and report rows group their amounts
under the plan, branch or member name. At widths below 360px, the final balance
uses a separate line to leave room for larger amounts. Full values and names
remain available without horizontal scrolling; desktop keeps the column layout.
Currency names in form labels use capitalized, plural names.
All editable monetary amounts use the shared MoneyInput, backed by
react-number-format 5.4.5 and the existing Input presentation. Spanish input
groups thousands with periods and separates cents with a comma (80.000,50);
English follows its own separators (80,000.50). The input preserves editing,
caret movement and paste, allows at most two decimal places and emits canonical
ungrouped decimal strings to form state. Named fields submit that canonical
value, never their formatted display. Required/min/max and safe minor-unit
validation remain enforced. Negative values are enabled only for signed
adjustments. Ordinary counts, due days, documents and phone numbers keep their
existing input behavior. ActionDialog money fields explicitly opt into this
component, separately from ordinary numeric fields.
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
3. Collections & payments (Monthly fees / Received payments)
4. Plans
5. Reports
6. Users & permissions
7. Branches
8. Settings

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

Table headers match their column contents: descriptive text, identifiers, phone,
email and dates align left; monetary amounts align right with tabular numerals;
status badges and actions align center. Action groups and loading placeholders
follow the same column alignment. Narrow layouts retain labeled fields and
right-aligned values/actions so the desktop rules do not disrupt mobile reading.

Search and high-value filters remain visible. The Member directory uses a
semantic table with Member, phone, email, status and outstanding balance columns.
Phone appears only in its own column; document numbers remain in Member details
and search rather than the directory columns. Clicking anywhere in a Member row opens the profile, while
selecting text does not navigate. The name remains a native link for keyboard
navigation and normal link gestures; there is no separate View member button.
Status badges include text, balances align right, and missing fields say Not
provided. Initials avatars and standalone currency captions are omitted.
The table has matching loading placeholders and preserves filtering and paging.
Below 800px of available content width, each row becomes labeled fields with
name/status first and balance last, without horizontal scrolling.
Selecting a Member opens
a full page with three switchable sections: Summary, Payment history and
Personal information. The header keeps identity, current Branch, status, Edit
member and the primary Record payment action visible. Amount still to pay is
the leading balance, with gross unpaid fees and available credit shown separately.
Mobile places the supporting balances side by side below that nonnegative result.

Summary contains enrollment cards with monthly price and state, alongside
charges with readable periods, due dates, payment state and outstanding amount.
Enrollment edit, pause/resume and end actions use the shared outlined button
variant so every action has a visible boundary before hover or focus.
Payment history shows all payments returned by the Member endpoint with receipt,
date, method, amount and state. Personal information groups profile fields,
notes, Member status actions and linked contacts.

Adding an enrollment or contact and composing a payment use CenteredDialog,
instead of permanently expanded forms. Payment posting uses entry and final
review steps in one shared dialog, preserving its idempotency key on uncertain
retries. Preview failures have an explicit retry action; closing the composer
invalidates its preview. Success closes the dialog, refreshes balances, selects
Payment history and shows the receipt.
Outside-click/Escape dismissal and focus return use the shared dialog wrapper.
The shared modal clips its inner scroll region to the rounded outer shell.
Its narrow, rounded scrollbar is inset from the corners, uses theme colors and
retains native wheel, touch and keyboard scrolling; browser scrollbar arrows
are hidden where supported.
The payment amount is prefilled on opening, using the oldest pending charge's
remaining balance in the current Branch. Without an unpaid Charge the amount
stays empty, with an explanation that additional money is an advance. Any
unallocated remainder requires an explicit extra-money acknowledgement before
review. Amount/distribution changes reset that acknowledgement.

### Charges

Period and payment-state filters lead. Bulk generation is a distinct confirmed
action and never shares placement with destructive actions. Balance and due date
are more prominent than internal identifiers.

The Monthly fees tab reuses the Member table styling: Member, Plan, billing month, due date,
payment state and outstanding balance (with the original total underneath).
Its Actions column offers Register payment for open positive balances. Authorized
users also see Adjust/Void for charges without allocations, using the existing
confirmation dialogs. Row clicks open the
Member profile while links, action buttons and text selection retain their own
behavior. Localized dates preserve their calendar day. Matching skeleton rows
cover initial loading, and narrow containers stack labeled fields without
horizontal scrolling, with name/state first and balance/actions last.

### Payments

The Payments directory shares the Member table styling and responsive layout.
Columns show Member (with receipt number), payment date, method, status, amount
and a View receipt action. Compact rows keep member/receipt to two lines and
shorten badges; allocation breakdowns are shown in the receipt dialog. Unapplied
credit appears below the amount, with full details inside the receipt. Row clicks
open the receipt; member links and text selection retain their own behavior.
Only authorized users see cancellation inside the receipt, and only posted
payments offer it. Matching skeleton rows cover initial loading.
Narrow containers stack labeled fields with name/status first and amount/actions
last, without horizontal scrolling. Search, date, method and state filters and
paging remain available.

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

Plans use a responsive card directory with name, state, prominent monthly price,
due day, Branch assignments and optional tags. Search and status filters stay
above the catalog. Add plan is the primary header action; billing configuration
is secondary and opens separately instead of occupying the initial viewport.
Creation and editing share a centered dialog. Description/tags are disclosed on
demand, essential terms remain visible, and the footer previews price/due day.
Shared dialog focus, pending-state protection and dismissal rules apply. Saved
edits update the directory immediately; removing the current Branch hides the
Plan from that workspace. Card skeletons match the loaded layout.

### Branch management

The Branches screen has a compact current-workspace summary, search by name and
a responsive table with Branch name and Actions columns. The current Branch is sorted first and marked with
a text badge; the summary explains using the existing header selector when more
than one Branch is available. Add branch is the primary header action for users
with creation permission. Each row offers Edit name with an accessible label
that includes the Branch name. Both actions use centered, icon-free dialogs.
Unchanged/blank names cannot be submitted; pending saves prevent dismissal and
duplicate requests, while errors preserve the input. Successful saves announce
the result and refresh the shell. Empty search results offer clearing the search;
limited administrators see their existing scope explanation and no create action.
The table reuses the Member directory surface, header and row styling; narrow
containers stack the name/current badge and the edit action without horizontal overflow.

## Interaction rules

Collections & payments replaces separate Charges/Payments navigation with
`/app/collections/fees` and `/app/collections/payments`. The tabs retain their own
URL filters and support reload/back/forward. Legacy routes redirect preserving
their former filter semantics. Only the active tab fetches its directory; stale
responses and pagination appends are discarded after filter or workspace changes.
Shared payment entry supports a selected fee, a Member profile or an accessible
Member search. The same dialog shows entry then final review with the Member,
Branch, fee month, allocation and credit. Successful mutations refresh balances
and history without clearing filters. No database records are removed.

Users & permissions follows the same responsive directory table convention as
Members, charges and payments. Staff identity, role, Branch scope, state and
actions have separate columns. Expandable permission details reduce visual noise
without hiding scope restrictions. Create and edit use centered dialogs; the
table shows only actions allowed by the server directory contract in module 07.
Rows show one effective access badge: inactive, pending activation or active.
Branch assignments use compact labels. Edit and status actions use outlined
buttons in two columns; pending accounts have a full-width resend button below.
Permission disclosures keep their keyboard-accessible summary and visible border.

### Confirmation and reason dialogs

When required fields disable an action form's Save button, identify the first
missing field in visible localized feedback. Monthly billing-day fields use
BillingDayInput: a numeric keyboard, at most two digits, and an inline/native
validity message for values outside 1–31 for new schedules or 1–28 for legacy
enrollments. Audit reasons remain required.

Use `ActionDialog` through `useActionDialog` for action confirmations and reason
forms. Do not use browser `alert`, `confirm` or `prompt` calls. This convention
covers Member status, enrollment status/terms, cancelling Payments,
Charge adjustment/voiding, Contact unlinking, Plan deactivation and
User access changes. Navigation drawers and date/select popovers keep their
purpose-specific placement. Payment posting and monthly generation use dedicated
CenteredDialog entry/review flows; payment step changes focus the heading so
keyboard users review the new state before reaching the confirmation button.

"Add member" and "Add user" open their existing creation forms in the same
`CenteredDialog` presentation, with a wider desktop surface and vertical scroll
on mobile. Feature forms keep their field validation, Branch and permission
rules, submit handlers and error state. Their close/cancel controls are disabled
while saving; a successful creation closes the popup and refreshes the directory.
Editing existing User access retains its inline form.

"Edit member" opens the existing profile fields in `CenteredDialog`, prefilled
from the member record. Cancel/Close discards unsaved edits; successful saves
close the dialog and refresh the profile. Failed saves retain the entered values.
Saving disables fields and dismissal and guards against duplicate submissions.
Date popovers sit above the dialog and below their nested month/year selects.

`TextDragGuard` prevents native dragging of selected, non-editable page text,
including text in dialog portals, to mitigate Chromium losing mouse input after
selection drags. Selection and copying remain available. Inputs, textareas,
contenteditable regions and explicitly draggable widgets retain native dragging.
The guard does not suppress pointer/click events or change overlay focus rules.

The shared Base UI dialog is centered above a dimmed backdrop, has a translated
title and consequence, and identifies its confirmation action explicitly. The
header starts directly with the title, without decorative icon badges, and
reserves space for the Close button beside it. Gather
related fields in one form rather than a sequence of prompts. Reason fields are
required, trimmed and limited to 500 characters; numeric fields retain domain
bounds. The payment confirmation repeats its amount and allocation breakdown,
and retries within the dialog retain the same idempotency key and timestamp.

Cancel, Close, Escape and clicking the backdrop dismiss without saving. Clicking
inside the dialog or its nested controls keeps it open. While saving, all fields
and dismissal actions, including backdrop clicks, are disabled,
and the shared LoadingButton prevents duplicate submissions. Failed saves retain
the form and show translated feedback inside the dialog. Base UI traps focus;
opening focuses the heading to avoid immediately opening a mobile keyboard,
and closing restores the initiating control when it still exists. The popup
fits the dynamic viewport, scrolls vertically on short screens and stacks its
actions on mobile. Reduced motion disables its entrance/exit transitions.

### Forms and actions

Settings uses a consistent-width company summary, paired personal/company
language cards on desktop, the payment-method catalog and a billing-settings
card linking to Plans. Sections stack on mobile. Personal language changes save
automatically; company language has an explicit save action enabled for changes.
The payment-method Add action sits at the top-right of its card beside the title
on desktop. Its description spans the next row; on mobile the action follows
the description at full width. Method rows use translated status badges and
keep management actions separate from their names. Cash is the only built-in
choice; authorized company-wide administrators manage custom names in the shared
dialog and deactivate/reactivate them through action confirmations. The payment
composer loads active methods, exposes load failures and links managers to
Settings. History filters include inactive and previously used legacy methods;
payment rows display the recorded name snapshot rather than a later catalog name.

- One primary action per page region.
- Every Button or LoadingButton inside a form declares its `type`: save actions
  use `submit`, while secondary actions use `button`. Base UI's default is
  `button`, so an omitted type silently prevents form submission. The
  `test:forms` check guards this convention without changing primitive defaults.
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

## Manual WhatsApp reminders

Collections provides an Overdue accounts shortcut and an outline reminder action
on overdue rows, including partial payments. The shared CenteredDialog presents
a recipient selector, Branch debt/credit summary and editable localized draft.
Open WhatsApp refreshes ledger facts before handoff; changed facts require review
again. Skeletons, disabled pending actions, inline errors and focus restoration
follow existing conventions. A blocked or missing destination has a clear message.
Opening WhatsApp must never display a sent/delivered status.

## Member balance summary

Member detail leads with Amount still to pay, clamped to zero when net credit
covers debt. Supporting cards show gross unpaid fees and unallocated credit as
positive amounts. Contextual copy distinguishes no fees, sufficient credit and
remaining debt. No negative net balance or subtraction jargon is shown. Credit
is explicitly described as received money not yet assigned to fees; presentation
does not allocate credit, mutate payments or change ledger totals. At mobile
widths the result spans both columns above the supporting cards.

### Receipt clarity

Member history shows plan, billing month and applied amount for each receipt,
with date/time and payment method. Unassigned money is labelled Advance available;
receipt badges distinguish applied payments, advances, mixed receipts and reversals.
Collections payment rows reuse these application details and badges. A receipt's
application is not a claim that a partially covered Charge is fully paid.

### Monthly fee selection in every payment entry point

The Member and Collections composers always show Monthly fee to pay before the
amount. Options identify plan, billing month/year and remaining amount, and only
include created, open, unpaid Charges in the current Branch. The oldest unpaid
Charge is the default; a row-specific launch preserves its selected Charge.
Changing the selection refreshes the amount and invalidates preview/advance
consent. Several fees, oldest first selects assisted distribution and suggests
the sum of current outstanding balances; partial amounts remain editable.
An unavailable requested Charge is shown disabled rather than silently retargeted.
With no unpaid Charges, the selector is disabled and explains that fees must be
generated first; an explicitly confirmed advance remains possible.
