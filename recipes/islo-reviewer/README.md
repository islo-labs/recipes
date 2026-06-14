# islo-reviewer on Islo

Wire up [islo-reviewer](https://github.com/islo-labs/islo-reviewer) — automated PR review and CI babysitting in Islo sandboxes using the Claude Agent SDK.

## Quick start

**1. Add secrets to your GitHub repo**

| Secret | Description |
|--------|-------------|
| `ISLO_API_KEY` | API key from [app.islo.dev/api-keys](https://app.islo.dev/api-keys) |

**2. Copy the workflow files**

Copy the examples from this folder into your repo:

```bash
mkdir -p .github/workflows
cp recipes/islo-reviewer/examples/islo-review.yml .github/workflows/
cp recipes/islo-reviewer/examples/islo-babysit.yml .github/workflows/
```

Update `islo-babysit.yml` — set `workflows:` to match your CI workflow name (e.g. `"Validate"` for this repo).

**3. Optional: add review context**

Copy `examples/REVIEW.md` to your repo root and customize architecture notes, focus areas, and cross-repo paths. islo-reviewer injects this into the review prompt automatically.

**4. Open a PR**

The review workflow runs on `pull_request` open/reopen. The babysit workflow runs when your CI workflow fails on a PR branch.

## What you get

| Action | Trigger | Behavior |
|--------|---------|----------|
| `islo-labs/islo-reviewer/review@v1` | PR opened/reopened | Reads diff, explores code, posts a GitHub review |
| `islo-labs/islo-reviewer/babysit@v1` | CI failure on PR | Fixes mechanical issues (lint, types, tests) and pushes a commit |

Both actions create an ephemeral Islo computer, run the agent, and clean up. See the [islo-reviewer README](https://github.com/islo-labs/islo-reviewer) for inputs (`model`, `max_budget_usd`, `islo_config`, etc.).

## Example: review workflow

```yaml
name: PR Review
on:
  pull_request:
    types: [opened, reopened]
jobs:
  review:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: islo-labs/islo-reviewer/review@v1
        with:
          pr_number: ${{ github.event.pull_request.number }}
        env:
          ISLO_API_KEY: ${{ secrets.ISLO_API_KEY }}
```

Full copy-paste versions are in [`examples/islo-review.yml`](examples/islo-review.yml) and [`examples/islo-babysit.yml`](examples/islo-babysit.yml).

## Environment variables

| Variable | Where | Required |
|----------|-------|----------|
| `ISLO_API_KEY` | GitHub Actions secret | Yes |

No local `.env` is required unless you run islo-reviewer scripts manually inside a sandbox.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Review workflow never runs | Check `pull_request` trigger and that `ISLO_API_KEY` secret exists |
| Babysit never triggers | Ensure `workflows:` lists the exact name of your failing CI workflow |
| Review misses context | Add or expand `REVIEW.md` at the repo root |
| High cost | Pass `model: claude-sonnet-4` and `max_budget_usd: '2.00'` to the action |

## Related recipes

- [`claude-agent-sdk-in-sandbox`](../claude-agent-sdk-in-sandbox/) — minimal Agent SDK example in a computer
- [`gateway-allowlist`](../gateway-allowlist/) — restrict egress for agent workloads
