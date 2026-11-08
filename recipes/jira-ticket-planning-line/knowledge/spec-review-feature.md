# Spec review rubric: Feature

Lightweight addendum to the shared definition of ready. Use this when the
Jira issue type is Story, Feature, New Feature, or equivalent.

## Blocking

- `missing-goal` when the user/business outcome is unnamed.
- `missing-acceptance-criteria` when done-ness is not testable.
- `ambiguous-scope` when in/out of scope would change the implementation
  shape.
- `missing-success-signal` when there is no verification or observable.
- `infeasible` or `contradicts-code` only with adoption-scoped file evidence.

## Non-blocking

UX copy, mockups, rollout sequencing, and analytics event names are useful.
Missing them is `style-only` when the outcome, scope, and acceptance tests
are already stated. Do not reject a feature for documentation tone.
