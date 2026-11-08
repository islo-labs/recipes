# Step 5 — Plan tickets

**Who:** anyone on the team with a coding agent set up as in step 1.

## Plan a ticket — give your agent this prompt

> Using the Islo skill, start the ticket-planning line (`line.line_name` in
> `settings.md`) for Jira ticket ABC-123. Use the command in
> `build/LINE-REPORT.md`. Tell me the run id, then wait for the run and tell
> me its outcome and link the Jira comment it posted.

Add a note for the planner if it helps, e.g. "…with the note: the API change
must stay backwards compatible". The planner reads it with the ticket.

The outcome is one comment on the ticket: a reviewed plan, questions that
block planning, an answer (when no code change is needed), or a failure
notice. The line never edits, transitions or labels the ticket.

## After the plan
- **Approve:** move the ticket to `jira.implementation_status` and implement.
- **Questions or changes:** answer in a ticket comment or edit the
  description, then ask your agent to plan the ticket again. A new run reads
  the latest description and comments.

## Upgrade to a new package version
1. Pull the new version into your package repository (your `settings.md`
   stays).
2. Repeat [step 3](3-create-line.md) — it updates the existing Agents and
   deploys a new line version — then [step 4](4-acceptance.md).
3. If acceptance fails, give your agent this prompt:

   > Using the Islo skill, redeploy the previous line version and restore the
   > previous Agent configuration recorded in the last good
   > `build/LINE-REPORT.md`, then confirm the line's current version.
