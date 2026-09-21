# Specification 18: Manual Reminders and Notification Boundary

[All specifications](README.md)

**Status:** User-reviewed WhatsApp drafts implemented. Automated delivery deferred.

## Manual reminder scope

Collections exposes an **Overdue accounts** shortcut and **Remind via WhatsApp**
for overdue open Charges, including partially paid Charges. The shortcut clears
the month filter so older debts remain visible; other search filters still apply.
A centered, responsive dialog shows the Member, Branch, overdue amount,
unallocated credit and net amount to request. It includes every overdue Charge
for that Member in the target Branch, independently of the list's month or plan.

`GET /api/charges/:id/reminder` authenticates the user, validates Organization and
active/access-permitted Branch, and reads current posted Payments/Allocations.
Voided Charges, paid Charges and future deadlines do not qualify. Existing
unallocated posted credit in the same Member/Branch is subtracted for the draft;
this does not allocate or mutate it. Credit covering all debt blocks the draft.
Reversed Payments and other Members' or Branches' credit never reduce this debt.

The recipient selector contains normalized international phones from the Member
and linked primary/billing Contacts, with eligible Contacts first for guardians.
Missing or invalid phones block opening WhatsApp and explain where to add one.
Phone presence never changes or implies recorded automated-messaging consent.

Staff review an editable, localized message (maximum 2,000 characters). Opening
WhatsApp rechecks current facts. Changed balance/recipient facts replace the draft
and require review again. A user-initiated tab receives an encoded `https://wa.me/`
link; the user presses Send inside WhatsApp. Blocked popups have a retry hint.
The application does not send, store a delivery result or claim the message was
sent/read. No provider library, credentials, database migration or queue is needed.
The check cannot prevent changes after WhatsApp opens; the user retains final
review responsibility. Opening the same draft again is possible and deliberate.

## Deferred automated delivery

Billing exposes financial facts; it does not call a messaging provider.
Future automated reminders require separately authorized scope covering:

- Applicable recorded consent and recipient/channel preferences;
- organization policies, quiet hours and localized versioned templates;
- provider-neutral messaging service with Worker-only credentials;
- tenant-scoped jobs, deduplication, bounded retries and delivery attempts;
- queues/cron, verified provider webhooks and scoped notification history;
- balance/consent rechecks immediately before sending.

## Acceptance checks

- Partially paid overdue Charges remain discoverable before pagination.
- Drafts never include another Organization's or Branch's financial data.
- Full payment, voiding and sufficient credit prevent requesting another payment.
- No phone means no handoff; phone presence never grants consent.
- The real interface works with keyboard, at mobile widths, and in both locales.
- Tests and UI verification use synthetic records and do not send real messages.
