# Specification 18: Notification Boundary

[All specifications](README.md)

**Status:** Post-MVP boundary only; no outbound messaging is authorized.

## Purpose

Preserve a safe path to future WhatsApp/email reminders without coupling billing
logic to one provider or sending messages during the MVP.

## Boundary

Billing emits or exposes facts such as `charge.overdue`; it does not call a
messaging provider. A future notification module will transform an authorized
rule and current ledger state into a deduplicated delivery request.

Candidate components:

- Organization notification policy and quiet hours;
- recipient and channel consent resolver;
- versioned message templates per locale;
- provider-neutral `MessagingService`;
- tenant-scoped notification job and delivery-attempt records;
- Cloudflare Queues for delivery/retries and Cron Triggers for scheduled scans;
- provider webhook verification and status updates.

## Required future rules

- No reminder without recorded, applicable consent and a normalized destination.
- Re-check Charge balance immediately before send; paid/void Charges are skipped.
- One logical reminder key prevents duplicate sends across retries.
- Provider credentials remain Worker secrets and never enter D1 or browser code.
- Templates escape user-entered values and respect recipient locale.
- Retry transient failures with bounds; permanent failures require action rather
  than infinite retry.
- Delivery status is operational evidence, not proof that a person read a message.
- Limited Team users see notification history only for Members in scope.

## MVP preparation

MVP may store Contact phone normalization and explicit consent evidence. It must
not include an enabled toggle, fake “send reminder” action, provider dependency,
Queue binding or Cron Trigger until a messaging specification is approved.

## Acceptance checks for the boundary

- Billing modules have no WhatsApp/provider imports.
- Contact consent is never inferred from the presence of a phone number.
- No current product action claims to send automated reminders.
- Future message jobs can reference Organization, Member, Contact and Charge by
  opaque IDs without copying financial truth into notification tables.
