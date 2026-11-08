# Step 2 — Prepare

**Who:** a customer engineer and their agent, with admins for the accounts
and integrations. **Islo resources created:** none.

You don't edit any file. Your agent interviews you, looks up what it can, and
saves the answers to `settings.md`, which steps 3–5 and later upgrades reuse.

## 1. Put this package in a git repository
Copy this recipe folder into a git repository of your own. The line's Machine
clones it so its agents can read `roles/`, `contracts/`, `knowledge/` and
`settings.md`. A private repository in your GitHub organization is fine.

## 2. Settings interview — give your agent this prompt

> Using the Islo skill, collect the settings for the ticket-planning line in
> this package. For each setting below, first try to find the value yourself
> (where it says how); otherwise ask me, one short question at a time, and
> offer the default when there is one. Never invent a value. When done, show
> me the full list to confirm, then write it to `settings.md` in the
> package root as one table per section with the columns Key and Value, using
> exactly these section and key names. Do not create or change anything in
> Islo, Jira or GitHub.

| Section | Key | What it is | Find it / default |
|---|---|---|---|
| line | line_name | Name of the Islo line | default `ticket-planning` |
| line | budget_usd | Spend cap per run, USD | default `40` |
| jira | site | Jira site URL | ask, or read it from your Jira connection |
| jira | projects | Jira project keys the team will plan in | ask |
| jira | implementation_status | Status a person moves an approved ticket to | ask; default `In Progress` |
| jira | bot_account_email | Jira account the line posts comments as | ask; a dedicated bot user is best |
| jira | jira_mcp_url | Jira MCP server the line uses | default `https://mcp.atlassian.com/v1/mcp` |
| github | allowed_owners | GitHub orgs the planner may read | ask |
| islo | factory | Islo Factory for the line | `islo factory current` |
| islo | machine_name | Islo Machine for the line | default `planning` |
| islo | gateway_profile | Gateway profile with GitHub, Jira and model access | list existing profiles and ask which; default `planning` |
| islo | harness | Agent harness | default `claude` |
| islo | model_provider | Model provider | default `islo_inference` |
| islo | planner_model | Model for planning | default `claude-opus-5-5`; check it is valid |
| islo | review_model | Model for spec check and review | default `claude-opus-5-5`; check it is valid |
| islo | publisher_model | Model for posting comments | default `claude-haiku-4-5`; check it is valid |
| acceptance | jira_project | Test Jira project for step 4 | ask |
| acceptance | repository | Small test repo under `allowed_owners`, for step 4 | ask |

## 3. Accounts and integrations (humans only)
The agent's summary lists what is still missing. Typically:
- **Jira bot account** (`jira.bot_account_email`): Browse and Add Comments on
  `jira.projects` and `acceptance.jira_project`, Create Issues on
  `acceptance.jira_project`. Nothing else.
- **Gateway profile** (`islo.gateway_profile`):
  - GitHub read access to repositories under `github.allowed_owners` and to
    this package's repository;
  - the Jira MCP server at `jira.jira_mcp_url`, signed in as the bot account;
  - access to the three models.

Never paste tokens into a prompt, a file, or a sandbox.

## 4. Check — give your agent this prompt

> Using the Islo skill, check this package's prerequisites against
> `settings.md`, without creating or changing anything: the selected Factory
> is `islo.factory`; the gateway profile `islo.gateway_profile` exists and
> covers GitHub for `github.allowed_owners`, this package's repository, and
> `jira.jira_mcp_url`; and the three models are valid for `islo.harness`
> with `islo.model_provider`. Report each check as present or missing, and
> for anything missing, tell me what a human must connect.

## Done when
`settings.md` is committed to the package repository and every check reports
present.

Next: [Step 3 — create the line](3-create-line.md).
