# ControlMembers Delivery Planning

This directory translates the canonical product specifications into executable
work. It does not redefine product behavior.

- [`USER_STORIES.md`](USER_STORIES.md) is the prioritized MVP backlog.
- [`DELIVERY_PLAN.md`](DELIVERY_PLAN.md) groups stories into vertical milestones.
- [`COLLECTIONS_WORKSPACE_PLAN.md`](COLLECTIONS_WORKSPACE_PLAN.md) records the plan for the implemented
  consolidation of Charges and Payments navigation and payment entry.
- [`DECISION_LOG.md`](DECISION_LOG.md) records settled assumptions and decisions
  that still require product validation.

The numbered files in [`../specs/`](../specs/README.md) remain authoritative for
behavior, data rules, authorization and acceptance criteria. After a feature is
implemented, actual test and release evidence belongs in
[`../specs/VERIFICATION.md`](../specs/VERIFICATION.md).

## Working agreement

1. Select one milestone and its stories.
2. Confirm any decision marked `Open` that can materially change that milestone.
3. Update the responsible specification before changing behavior.
4. Implement one end-to-end slice: schema, server authorization, API, UI and
   tests together.
5. Run the repository quality gate and record verified evidence.
6. Do not begin a later milestone to hide an incomplete earlier workflow.
