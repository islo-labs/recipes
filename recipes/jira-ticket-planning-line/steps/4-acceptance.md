# Step 4 — Prove it with the acceptance cases

**Who:** a customer engineer. **Writes to:** the test Jira project only.

## Give your agent this prompt

> Using the Islo skill, run every case in `acceptance/cases.md` against the
> Jira project `acceptance.jira_project` from `settings.md`. For each case:
> create the test ticket, start the line manually for it, wait for the run to
> finish, and compare its stage path and the comment it posted with the
> expected row. Also apply the global checks in that file. Record pass or
> fail with the run id and evidence for each case in
> `build/ACCEPTANCE-REPORT.md`. If a case fails, stop and report it — do not
> change any prompt, role or setting to make a case pass.

## Done when
All six cases pass. If one fails, send `build/LINE-REPORT.md` and
`build/ACCEPTANCE-REPORT.md` to your package provider.

Next: [Step 5 — plan tickets](5-plan-tickets.md).
