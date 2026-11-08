# Formats

Plain Markdown. Jira comments are posted as Markdown through the Jira MCP
add-comment tool.

## Spec verdict (`spec-verdict.md`)

```
# Spec verdict — <TICKET-KEY>
Verdict: plannable | needs_input | no_plan_needed
Issue type rubric: bug | feature | task
Blocking gaps: <reason code — one sentence>, or "none"
Notes for the planner: <facts from comments/Epic the description lacks>
```

Reason codes: `missing-goal`, `missing-acceptance-criteria`,
`missing-repro-steps`, `missing-success-signal`, `missing-linked-context`,
`contradicts-code`, `infeasible`, `human-decision-required`. Style issues are
never blocking.

## Plan document (`plan.md`)

```
# Plan — <TICKET-KEY>: <ticket summary>
Round: <n>

## Summary
Two to four sentences: what changes and why.

## Delivery strategy
single | independent | stacked — why, and why not the other two.

## Units
### U1 — <title>
Repository: <owner/repo>
Change areas: <files / modules, verified>
Steps: ordered, concrete
Depends on: <unit ids or none>
Verification: <tests to add or run, manual checks>
Risk: low | medium | high — <why>

## Testing and verification
How the integrated result is proved.

## Rollout and rollback
Proportionate to the risk.

## Open questions
Decisions a human must make, or "none".

## Changed since last round
Round 2+: what changed and what was retired, or "first round".
```

## Review (`review.md`)

```
# Review — <TICKET-KEY>, round <n> of 3
Verdict: approved | changes_requested | human_needed
Findings:
- <reason code> — <one sentence>. Evidence: <path or URL>
Next action: <what the planner or a human does next>
```

Reason codes: `missing-executable-steps`, `unverified-files-or-interfaces`,
`missing-testing-strategy`, `unresolved-dependencies`,
`missing-rollout-or-rollback`, `infeasible`, `human-decision-required`.

## Jira comments

### Plan comment
```
## Implementation plan (agent-reviewed, round <n>)
<the plan's Summary and Delivery strategy>
<the full plan.md below a divider>
Next step: review the plan; move the ticket to <implementation status> to start.
```

### Questions comment
```
## Planning needs input
<numbered questions from questions.md>
Reply in a comment, or update the description, then start planning again for
this ticket.
```

### Answer comment
```
## No implementation plan needed
<answer.md>
```

### Failure comment
```
## Planning could not finish
Stage: <stage> — <reason in one sentence>
Start planning again for this ticket to retry.
```

### Comment footer
Every comment ends with:

```
— Planning line · run <contents of run-id.txt>
```

The publisher uses this marker to avoid posting twice for the same run.
