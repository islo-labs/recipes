# Step 3 — Create the line

**Who:** a customer engineer with the agent from step 1, from the root of this
package. **Islo resources created:** a Machine, 4 Agents, 1 knowledge item,
1 Line — only after you approve the generated configuration.

Give your agent everything below the line. It describes **what** the line
must do; the agent uses the Islo skill to work out **how**.

---

Using the Islo skill, create an Islo Factory Line that plans Jira tickets.
This package holds no Islo configuration on purpose: you write it now, for
the Islo version you are talking to. Read every file in this package before
you start.

## Ground rules
- Follow the Islo skill and the Islo docs for every Islo command and file
  format. Where they disagree with this prompt, the skill and live schema
  win — report the conflict in your report.
- Take every customer value from `settings.md` (written in step 2). Never
  invent a value, and stop if one is missing.
- Write generated config only under `build/` (create it). Never edit the
  package's own files.
- Create nothing in Islo until the human has seen the generated files and the
  dry-run output and said to go ahead.
- Validate before you create: `islo agent validate` for each Agent, then
  `islo factory line validate`, then `islo factory line deploy --dry-run`.

## What to build

### Shared Machine
One Factory Machine named `islo.machine_name`, using gateway profile
`islo.gateway_profile`, with this package's git repository checked out so
agents can read `contracts/`, `knowledge/` and `roles/`. Source level is
enough; nothing is built.

### Four prompt Agents
Create one prompt Agent per file in `roles/`. The Agent's prompt is the role
file's text below the `---` line, with each `<<name>>` replaced by the
matching key's value in `settings.md` (lists comma-separated). Every Agent uses the
shared Machine, harness `islo.harness`, model provider `islo.model_provider`,
and an MCP server named `jira` at `jira.jira_mcp_url`.

| Agent | Model | Effort |
|---|---|---|
| planning-spec-checker | `islo.review_model` | medium |
| planning-planner | `islo.planner_model` | high |
| planning-reviewer | `islo.review_model` | high |
| planning-publisher | `islo.publisher_model` | low |

If `islo agent validate` rejects a model for the harness and provider, stop
and ask the human for a valid one; do not pick a substitute.

### Knowledge item
Upload `knowledge/planning-line-routing.md` as a knowledge item with slug
`planning-line-routing`. The line's Manager uses it as its routing policy.

### The Line
- Name `line.line_name`, category `software-factory`, description "Plans one
  Jira ticket: checks the specification, writes a plan, reviews it, and posts
  the outcome."
- Limits: timeout 2 hours, budget `line.budget_usd`, at most 12 iterations.
- Trigger: manual. A person starts each run from their coding agent for one
  Jira ticket (step 5), passing two inputs: `ticket_key` (required, e.g.
  `ABC-123`) and `trigger_note` (optional, why they are asking — default
  empty).
- Manager: the built-in Manager, with the `planning-line-routing` knowledge
  item as its instructions.
- Every stage runs in one shared sandbox per run (a sandbox name that includes
  the line run id), so files written by one stage are read by the next. Agent
  sessions stay separate.

Stages:

| Stage | Agent | Attempts | Stage prompt override |
|---|---|---|---|
| check-spec | planning-spec-checker | 2 | — |
| write-plan | planning-planner | 2 | — |
| review-plan | planning-reviewer | 2 | — |
| revise-plan | planning-planner | 2 | "Revision round. Read /workspace/planning/review.md and revise /workspace/planning/plan.md to resolve every finding, following the 'Revising' section of your instructions." |
| post-plan | planning-publisher | 3 | "Outcome: plan_ready. Post the approved plan from /workspace/planning/plan.md." |
| post-answer | planning-publisher | 3 | "Outcome: no_plan_needed. Post the answer from /workspace/planning/answer.md." |
| ask-for-input | planning-publisher | 3 | "Outcome: needs_input. Post the blocking questions from /workspace/planning/questions.md." |
| report-failure | planning-publisher | 3 | "Outcome: technical_failure. Post a short failure notice; the failed stage's reason is in the failure_reason parameter." |

Routing. Each work stage ends its message with `VERDICT: <value>`; the
Manager chooses the next stage from that value (agent-decided routing with
named options). Outcome stages and the revise loop use fixed routing.

| From | On | To |
|---|---|---|
| (trigger) | always | check-spec |
| check-spec | `plannable` | write-plan |
| check-spec | `needs_input` | ask-for-input |
| check-spec | `no_plan_needed` | post-answer |
| write-plan | `drafted` | review-plan |
| write-plan | `needs_input` | ask-for-input |
| review-plan | `approved` | post-plan |
| review-plan | `changes_requested`, rounds 1–2 | revise-plan |
| review-plan | `changes_requested` round 3, or `human_needed` | ask-for-input |
| revise-plan | succeeded (at most 3 times) | review-plan |
| post-plan, post-answer, ask-for-input, report-failure | always | done |
| check-spec, write-plan, review-plan, revise-plan | failed after its attempts | report-failure, passing the failure reason as `failure_reason` |

Parameters: pass `ticket_key` (from the run input) into **every** stage,
on every transition — a stage does not inherit it from the previous one. Pass
`trigger_note` into check-spec.

## Finished when
- All four Agents, the Machine, the knowledge item and the Line exist and
  validate, and `islo factory line get` shows the line.
- You have written `build/LINE-REPORT.md`: the Islo CLI version, every command
  you ran with its result, the generated files, the exact command that starts a run for one ticket, and every
  point where the schema made you deviate from this prompt and why.

Stop there.

---

## Done when
`build/LINE-REPORT.md` exists and gives the command that starts a run.

Next: [Step 4 — acceptance](4-acceptance.md).
