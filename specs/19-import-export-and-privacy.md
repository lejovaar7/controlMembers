# Specification 19: Import, Export and Privacy

[All specifications](README.md)

**Status:** Implemented and verified locally with bounded synchronous imports,
scoped exports and audit evidence. Remote pilot release remains pending.

## Purpose

Support practical onboarding and reporting while limiting personal-data leaks,
spreadsheet ambiguity and unsafe financial imports.

## Member CSV import

Member import uses a review-first wizard in Members > Import CSV:

1. upload a UTF-8 CSV with headers (the version 3 template is optional);
2. match the same personal details used by Add member: name, document number,
   email, phone and WhatsApp; select a Plan and enrollment dates when needed;
3. review each Member, edit those details or exclude rows;
4. validate selected rows against current permissions, Plans and existing Members;
5. explicitly save the reviewed rows as one atomic Organization-scoped batch;
6. show the committed count and return to the directory.

The browser supports exactly eight source fields: name, document number, email,
phone, WhatsApp, Plan, start date and first due date. There are no More details
sections, previous/external codes, document types, Contacts, relationship fields
or status controls. A shared allowlist filters suggestions and the mapping used
for draft creation, so removed fields are not imported invisibly from old files.
New Members are active, as in Add member; the screen states that only the shown
fields are imported. Existing records are not modified. The current authorized
Branch is displayed and applies to the whole batch; an input Branch column cannot
change the destination. Version 3 downloads include only these eight headings.

The parser accepts comma, semicolon and tab delimiters, BOM, CRLF, quoted cells
and escaped quotes. It rejects inconsistent row widths, unfinished quotes, more
than 50 rows or 100 KB. Spanish/English header aliases suggest supported mappings;
ambiguous matches require selection. Each field shows up to two nonempty examples.
Only the name mapping is required to enter review. Saving without enrollment
requires an explicit choice; a missing Plan never silently defaults to that choice.

Selected files can be removed before confirmation, including files that fail
parsing. Removal resets draft rows, mappings, errors and the common Plan choice;
obsolete reads cannot restore removed/replaced files. The same corrected file can
be selected again. Removal is disabled during validation/save or an uncertain save
outcome. Empty files, header-only templates, invalid headers, inconsistent columns,
malformed quoting and size/row limits have separate actionable messages. Templates
contain headings only and must be filled with Member rows before import.

Phone and WhatsApp may be the same or separate. Missing/blank WhatsApp defaults to
the phone, and equal normalized numbers use the same-phone flag. The row editor
reuses Add member's phone/WhatsApp fields and can clear a separate WhatsApp number.
Colombian national numbers receive +57; existing +/00 and full Colombian prefixes
are preserved. Other international numbers must include + and the country code.
Date order appears only for mapped day/month/year-style dates; ISO dates need no
format choice. Spreadsheet formulas are always text.

Plans must exist, be active and belong to the destination Branch. Unique exact
normalized names/IDs match and display the current Plan price; unknown or ambiguous
values require choosing a Plan in review. Missing file Plans remain unresolved by
default, even when only one Plan is available. Every review row has a Plan selector
with clear missing/unmatched feedback; changing it immediately updates the displayed
price and invalidates validation. Unresolved selected rows cannot be saved.
A common Plan fills rows without a file Plan, and a Plan can be applied to selected
rows during review. Assign later explicitly creates only Member details. Enrollment
date controls appear when a nonempty file Plan or common Plan is present. Date
pickers fill only missing file values; every date can be edited per Member.

The existing enrollment transaction applies the current Plan price. An immediate
first due date creates the first unpaid Charge; a later first due date schedules
the Enrollment. Import does not record Payments or historical debt. Preview does
not write. Duplicate document numbers are checked against selected rows and the
company; any error blocks the entire selection. Edits/exclusions invalidate preview.
The server revalidates on confirm and requires the review fingerprint, including
current Plan prices. Stable submission keys make uncertain retries idempotent.
The batch, Members, Enrollments, first Charges and audit commit atomically. Exact
replays return the same result; changed payloads conflict. Personal rows are never
logged or included in audit details.

Legacy version 1 exact-column CSV API requests and richer structured drafts retain
their previous Member/Contact/status/reference semantics and validation. These are
not exposed by the simplified browser workflow. Only the two import endpoints
accept bodies up to 128 KB; other API limits are unchanged. Tags, historical
financial imports and automatic creation of unknown Plans remain outside scope.

## Exports

Exports are generated server-side from the actor's current authorized scope and
active filters. MVP supports Member directory, Member balances, receivables and
Payments received. Each export includes an `asOf` time and stable documented
columns. CSV output prevents spreadsheet formula injection in text fields.
When a session Branch is active, directory and financial exports are limited to
that Branch. A shared Member's exported balance includes only that Branch's
Charges and Payments. The wizard imports into its explicit current Branch; the
legacy CSV API retains its authorized per-row Branch assignment.

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
- Invalid or changed reviewed rows block the whole selection without partial writes.
- Column mapping and row edits do not write records; confirmation uses those exact edits.
- Same-phone, separate and absent WhatsApp choices survive import.
- Unknown, inactive, foreign-company and unavailable-Branch Plans cannot enroll Members.
- Repeated submissions cannot duplicate Members or their first Charges.
- Formula-like CSV text cannot execute when opened in common spreadsheet tools.
- Exports cannot include inaccessible Branch or foreign Organization data.
- Export and confirmed import actions are audited.
- No import path creates Better Auth users for customer Members.
