# Jira ticket planning line

A prompt-only recipe: your coding agent, with the Islo skills installed, builds
an Islo Factory Line that turns a Jira ticket into a reviewed implementation
plan. The recipe has **no code and no Islo configuration files**, only
prompts, agent roles, rubrics, formats and acceptance cases. Your agent writes
the Islo configuration for the Islo version you run.

## Goal

Ask your agent to "plan ABC-123". The line checks whether the ticket is ready
to plan, writes a plan from the real code, has a separate agent review it (up
to 3 rounds), and posts the result as one Jira comment. People approve plans;
the line never implements, transitions, labels or edits tickets.

## When to use

- You track work in Jira and code in GitHub, and want plans that name real
  files, tests and rollout steps before anyone starts implementing.
- You want an independent review of every plan before a person sees it.
- You want to install a multi-stage Islo line from prompts instead of
  maintaining line and agent definitions by hand.

## Prerequisites

- An Islo organization with a Factory, and the `islo` CLI.
- A coding agent (Claude Code, Codex or Cursor) with the
  [Islo skills](https://github.com/islo-labs/skills) installed.
- Jira Cloud with a bot account, connected through the Atlassian MCP server.
- GitHub read access, through an Islo gateway profile, to the repositories
  the planner may read.
- A test Jira project and a small test repository for the acceptance cases.

## Quick start

Copy this folder into a git repository of your own (the line's Machine clones
it), then follow the steps. Each step has the prompt to give your agent and a
"Done when" check.

| Step | Who | What | Creates in Islo |
|---|---|---|---|
| [1. Add the Islo skills](steps/1-install-islo-skills.md) | Engineer | Install the `islo` CLI and the Islo skills plugin in your coding agent | — |
| [2. Prepare](steps/2-prepare.md) | Engineer + agent + admins | The agent interviews you and saves `settings.md`; admins create the Jira bot and connect GitHub, Jira and models | — |
| [3. Create the line](steps/3-create-line.md) | Engineer + agent | One prompt: the agent generates the config, you approve, the agent creates it | Machine, 4 Agents, knowledge item, Line |
| [4. Acceptance](steps/4-acceptance.md) | Engineer + agent | One prompt: run the 6 cases in the test project | Test runs |
| [5. Plan tickets](steps/5-plan-tickets.md) | Anyone | One prompt per ticket; also upgrade and roll back | A run per ticket |

Steps 1–4 are a one-time install. Nothing in Jira changes for the install: no
workflow status and no automation rules. Runs start manually, from your agent.

## Verify success

- Step 4 passes all six cases in [`acceptance/cases.md`](acceptance/cases.md).
- Asking your agent to plan a real ticket posts one comment on it: a reviewed
  plan, blocking questions, an answer, or a failure notice.

## How it works

```
"plan ABC-123" ──▶ check-spec ─┬─ plannable ──▶ write-plan ──▶ review-plan ─┬─ approved ──▶ post-plan
                               ├─ needs_input ─────────────┐               ├─ changes ──▶ revise-plan ─▶ review-plan (≤3)
                               └─ no_plan ──▶ post-answer   └──▶ ask-for-input ◀── human_needed / round 3
any work stage out of attempts ──▶ report-failure
```

- Four prompt Agents (spec checker, planner, reviewer, publisher) share one
  sandbox per run and hand off through Markdown files.
- Each work stage ends with a `VERDICT:` line; the line's Manager routes on it.
- The publisher posts exactly once per run, using a run marker in the comment
  footer, so retries never duplicate comments.

| Path | What it is |
|---|---|
| `steps/` | The five steps, each with the prompt to give your agent |
| `roles/*.md` | Instructions for the 4 Agents |
| `contracts/agent-rules.md` | Scope and safety rules all agents follow |
| `contracts/formats.md` | Working-file and Jira comment formats |
| `knowledge/` | Rubrics (spec readiness, plan review, PR strategy) and the Manager routing policy |
| `acceptance/cases.md` | 6 behavioural cases that must pass before first use and after upgrades |

## Status

Draft. The design was checked with `islo` CLI 0.77.0 as hand-written config:
all four Agents passed `islo agent validate`, and the line's routing graph
passed `islo factory line validate` with a stand-in job. The prompts have not
yet been run end to end. Still to confirm in a test Factory:

1. An agent following step 3 produces config equivalent to the checked design.
2. Agent stages accept the shared `sandbox_name`, per-stage prompt overrides,
   and a `failure_reason` param.
3. `ticket_key` and `trigger_note` given at manual run start reach the entry
   transition.
4. The Manager routes reliably on the `VERDICT:` line. Fallback: a `decision`
   Agent after each work stage, with conditional edges on its typed output.
5. The Atlassian MCP server works through a gateway profile with a bot account.
6. Where Machine repositories are mounted, so agents find `roles/`,
   `contracts/` and `knowledge/`.

Known gaps:

- Two people can start runs for the same ticket at once; each posts a comment.
- New ticket comments don't re-plan automatically; ask your agent to plan again.
- No Slack notifications or metrics beyond Islo run history.
- Plans are posted as comments, so very large plans may hit Jira's comment
  size limit.

## Troubleshooting

| Symptom | What to do |
|---|---|
| `islo agent validate` rejects a model | Pick a model valid for your harness and provider; step 3 stops and asks rather than substituting. |
| Agents can't find `roles/` or `contracts/` | Check the Machine has your copy of this folder checked out, and where it is mounted. |
| A run posts nothing | Read the run's events in Islo; a failed work stage should end in `report-failure`. |
| The plan names files that don't exist | Check the gateway profile's GitHub access covers the repository. |
| An acceptance case fails | Don't tune prompts to pass it; send `build/LINE-REPORT.md` and `build/ACCEPTANCE-REPORT.md` with your report. |

## Related recipes

- [`anthropic-claude-code-in-sandbox`](../anthropic-claude-code-in-sandbox/) — run Claude Code inside an Islo computer.
- [`gateway-allowlist`](../gateway-allowlist/) — restrict a computer's network egress through the gateway.
