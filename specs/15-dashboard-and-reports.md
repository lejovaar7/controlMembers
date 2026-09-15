# Specification 15: Dashboard and Reports

[All specifications](README.md)

**Status:** Implemented and verified locally; remote pilot release remains pending.

## Purpose

Give owners and authorized Users a fast, reconcilable view of recurring
revenue and receivables without creating a separate analytics truth.

## Shared filters

Dashboard and reports accept an Organization-local period plus authorized
Branches, Plans and optional tags. The server constrains requested Branches to the
actor's accessible scope. Changing active Organization discards filters and
results from the previous tenant.

## Dashboard metrics

- **Expected:** total of non-void Charges for the selected billing period.
- **Collected:** posted Payments received during the selected calendar period.
- **Allocated to period:** active Allocations applied to Charges in the selected
  billing period, regardless of Payment date.
- **Outstanding:** remaining value of non-void Charges in the selected period.
- **Overdue Members:** distinct Members with at least one overdue Charge.
- **Collection rate:** allocated-to-period divided by expected; zero expected
  renders no percentage rather than division by zero.
- **Upcoming due:** outstanding Charges due within the configured next seven days.

Every card links to a filtered operational list. Cards include labels/tooltips
that distinguish collected cash from allocations.

## MVP reports

1. Receivables aging: current, 1–30, 31–60, 61–90 and 90+ days overdue.
2. Member balances: gross outstanding, credit and net position.
3. Payments received: date, receipt, Member, Branch, method, amount and state.
4. Period charges: Plan, expected, allocated and outstanding.
5. Branch summary: the same formulas grouped by authorized Branch.

CSV export uses the active filters, stable column names and Organization locale
only for presentation. Numeric exports include integer minor-unit or documented
decimal values without currency symbols in data columns.

## Performance and consistency

- Pagination is mandatory for operational lists.
- Aggregate endpoints use database aggregation instead of loading all rows.
- All metrics share ledger query helpers with specification 14.
- The response includes an `asOf` timestamp and normalized applied filters.
- MVP may calculate on demand; materialized summaries require measured need and
  reconciliation tests.

## Empty and exceptional states

- No configured Plans directs authorized users to setup.
- No Charges in the selected period explains how to generate them.
- Zero overdue Members is a successful state, not an empty/error state.
- Failed metrics never render cached values as if current; retry is available.
- Limited Branch scope is visible so a user does not mistake partial totals for
  company-wide results.

## Acceptance checks

- Every dashboard number can be reconciled to a report using identical filters.
- Reversed Payments and void Charges affect totals according to specs 13–14.
- Limited users see only permitted Branch aggregates with no foreign count leak.
- Date boundaries use Organization timezone consistently.
- CSV totals match the corresponding UI/API report.
- Responsive cards prioritize expected, collected, outstanding and overdue.
