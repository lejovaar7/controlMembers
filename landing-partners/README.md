# ControlMembers partner landing

Independent Spanish-language marketing site for resellers. It has no application,
database, authentication, build, or dependency requirements. All runtime assets
are local. This directory can be moved to a separate repository unchanged.

Run from this directory with `npm run dev`, then open http://127.0.0.1:5180.
Run calculator checks with `npm test`. No installation is needed.

The mobile-first layout adapts from 320px phones to wide desktop screens.
Below 700px, the hero and calculator stack with full-width price choices.
From 700px, tablets use two balanced hero/calculator columns, horizontal feature
cards, and row-based price choices. From 1000px, content and prices use three
columns. Full desktop navigation appears at 1200px; smaller screens use a native
disclosure menu whose height is bounded for landscape phone screens.
Multi-column cards share grid rows so wrapped headings do not shift paragraph
alignment. Calculator panels share top alignment and inner gutters; price rows
and result breakdowns keep amounts in a consistent right-hand column.
Touch controls are at least 44px tall; numeric inputs use 16px text to avoid
automatic input zoom on mobile Safari. Menu links close the disclosure, Escape
returns focus to its trigger, and switching to desktop closes the mobile menu.

The user confirmed COP and monthly recurring commissions. The 30% rate and
COP 99,900 / 149,900 / 199,900 price scenarios are proposals. Plan names do not
promise different features or limits. The annual estimate holds the same paying
portfolio constant for twelve months; it does not assume additional sales each
month. Results are gross, rounded to whole COP per customer payment.

Edit price scenarios in `calculator.mjs` and their matching labels in `index.html`.
The hero and FAQ contain illustrative 30% examples, independent of simulator edits.
There is no lead submission endpoint or payment/commission processing. The
floating WhatsApp button and partner CTA use the supplied +57 311 768 8035 number.
Both open WhatsApp with a professional Spanish inquiry about program requirements,
commercial terms, recurring commissions, and next steps. The visitor reviews and
sends the message in WhatsApp; the site never automatically sends it.
The direct links also work without JavaScript. The floating button becomes a
56px icon on phones and tablets, and respects device safe areas.

Responsive browser checks cover 320, 375, 390, 430, 700, 768, 820, 834, 844,
1024, 1180, and 1440px widths, including portrait and landscape viewports.
Checks include horizontal overflow, maximum calculator values, menu links,
Escape focus restoration, and closing the menu on the desktop breakpoint.
These are browser viewport checks, not physical-device certification.

To publish separately, upload only `index.html`, `styles.css`, `app.mjs`,
`calculator.mjs`, and `assets/` to a static host. Do not publish the parent app,
its environment files, or build output. No deployment has been configured here.

Product claims come from `PROJECT_SPEC.md` and `README.md` in the parent project.
Manual WhatsApp reminders are described accurately; automated messaging, online
payments, attendance, and scheduling are not advertised.

The official platform logo is copied unchanged from
`src/react-app/assets/controlmembers-logo.svg`. Keep the copy synchronized when
the platform's brand asset changes. [Reference review](REFERENCE_REVIEW.md)
documents the source-grounded copy and partner-program section review.
