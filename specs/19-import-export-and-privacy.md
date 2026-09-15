# Specification 19: Import, Export and Privacy

[All specifications](README.md)

**Status:** Implemented and verified locally with bounded synchronous imports,
scoped exports and audit evidence. Remote pilot release remains pending.

## Purpose

Support practical onboarding and reporting while limiting personal-data leaks,
spreadsheet ambiguity and unsafe financial imports.

## Member CSV import

MVP imports Members and optional Contacts only. The flow is:

1. download a versioned template;
2. upload a bounded UTF-8 CSV;
3. parse into a preview without writes;
4. display row-level validation and duplicate warnings;
5. confirm valid rows;
6. create records under one Organization-scoped import batch;
7. provide created/skipped/failed results and audit evidence.

Required columns are Member name and Branch reference. Optional columns include
document, email, E.164-capable phone, status, external reference, Contact name,
relationship and billing-contact marker. Formulas are treated as text and are
never executed. Unknown columns are rejected or explicitly ignored with a
warning according to template version.

Plans, tags, Enrollments, Charges, Payments and opening balances are not imported
in MVP. Financial migration requires a separately reconciled specification.

## Exports

Exports are generated server-side from the actor's current authorized scope and
active filters. MVP supports Member directory, Member balances, receivables and
Payments received. Each export includes an `asOf` time and stable documented
columns. CSV output prevents spreadsheet formula injection in text fields.

Export requires the permission in spec 16 and creates an audit event containing
filters/count, not the exported personal rows.

## Privacy and retention

- Collect only data required for membership, billing or explicitly consented
  communication.
- Notes must not invite sensitive medical or payment-card data.
- Full card/bank credentials are never stored.
- UI and logs minimize document numbers, emails and phone numbers.
- Application logs never include CSV contents or exported rows.
- Organization data is isolated using specification 04.
- Hard deletion of financial history is prohibited. Anonymization, retention and
  legal deletion workflows are post-MVP decisions that must respect accounting
  obligations in the launch jurisdiction.
- Backups, access policies and incident handling are release responsibilities;
  a passing local test is not proof of regulatory compliance.

## Operational limits

Initial file size, row count and field length limits must be explicit before
implementation. Large asynchronous imports and downloadable stored export files
would require Queue/R2 boundaries and are deferred. MVP may process a bounded
request synchronously and return a generated CSV response.

## Acceptance checks

- Preview performs no database writes.
- Repeating a confirmed import with the same batch key cannot duplicate rows.
- Invalid rows do not corrupt valid records and results identify each outcome.
- Formula-like CSV text cannot execute when opened in common spreadsheet tools.
- Exports cannot include inaccessible Branch or foreign Organization data.
- Export and confirmed import actions are audited.
- No import path creates Better Auth users for customer Members.
