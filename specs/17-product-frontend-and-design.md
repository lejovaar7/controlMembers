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

## Terminology and navigation

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
- Loading skeletons preserve layout; errors, empty data and zero results are
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
