# Spec review rubric: Task

Lightweight addendum to the shared definition of ready. Use this when the
Jira issue type is Task, Sub-task, Improvement, Chore, or equivalent.

## Blocking

- `missing-goal` when the operational outcome is unnamed.
- `missing-acceptance-criteria` when there is no concrete done check.
- `ambiguous-scope` when the task could equally mean a one-line change or a
  cross-repo migration.
- `missing-linked-context` when the task is explicitly a follow-up but names
  no parent, PR, or incident.
- `infeasible` or `contradicts-code` only with adoption-scoped file evidence.

## Non-blocking

Command snippets, file lists, and owner notes are helpful. Missing them is
`style-only` when the outcome and done check are already explicit. Do not
block a chore for missing conventional-commit guidance.
