# Spec review rubric: Bug

Lightweight addendum to the shared definition of ready. Use this when the
Jira issue type is Bug, Defect, or equivalent.

## Blocking

- `missing-repro-steps` when a new reader cannot reproduce the failure from
  the description (environment, trigger, observed result).
- `missing-success-signal` when there is no expected result or regression
  check.
- `missing-goal` when the broken behavior is unnamed.
- `infeasible` or `contradicts-code` only with a file or URL showing why the
  reported behavior cannot exist as described.

## Non-blocking

Stack traces, screenshots, and log excerpts are helpful. Their absence is
`style-only` when repro steps and expected result are already clear.
Suggested description cleanup is advisory.
