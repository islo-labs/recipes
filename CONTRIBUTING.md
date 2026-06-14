# Contributing to islo-recipes

Thank you for helping improve customer-facing Islo examples.

## Recipe types

### SDK recipes

Programmatic orchestration with the Islo Python SDK. Lives in `recipes/<recipe-id>/` and must include:

| File | Purpose |
|------|---------|
| `README.md` | Customer docs (see section order below) |
| `.env.example` | Required and optional environment variables |
| `run.py` | Single orchestrator entrypoint |
| `pyproject.toml` | Recipe-local Python dependencies |
| `uv.lock` | Locked deps (`uv lock` in the recipe dir) |

Success is verified by `PASS: <recipe-id>` in stdout.

### Agent recipes (Claude Code, Codex)

SDK-first examples modeled on the [E2B cookbook](https://github.com/e2b-dev/e2b-cookbook) agent examples. Must include:

| File | Purpose |
|------|---------|
| `README.md` | SDK snippet + "How to run example" steps |
| `.env.example` | API keys for the SDK example |
| `pyproject.toml` | Recipe-local Python dependencies |
| `uv.lock` | Locked deps (`uv lock` in the recipe dir) |
| `*/main.py` | Runnable SDK script (like E2B's `anthropic_claude_code_in_sandbox/main.py`) |

No `run.py` or `PASS:` convention required. CLI workflow goes in an optional "Also available via Islo CLI" section.

## README sections — SDK recipes (required order)

1. **Goal**
2. **When to use**
3. **Prerequisites**
4. **Environment variables**
5. **Quick start**
6. **Verify success**
7. **How it works**
8. **Troubleshooting**
9. **Related recipes**

## README sections — agent recipes

Follow the E2B pattern:

1. Title + one-line description
2. **How to create a computer with \<Agent\>** — inline SDK snippet
3. **How to run example** — env setup, `uv sync`, run `main.py`
4. **Also available via Islo CLI** — optional `islo use --agent …` commands
5. **Environment variables**
6. **Troubleshooting**
7. **Related recipes**

Add the new recipe to the appropriate table in the root [`README.md`](README.md).

## Before opening a PR

1. SDK recipe: `cd recipes/<id> && uv sync && uv run python run.py` — confirm `PASS: <recipe-id>`.
2. Agent recipe: verify README steps are accurate; run SDK example if present.
3. From repo root: `uv sync --extra dev && uv run ruff check recipes`
4. Do not commit `.env`, secrets, or internal-only paths.

## CI

SDK recipes run in the nightly [`recipes-smoke.yml`](.github/workflows/recipes-smoke.yml) workflow. Agent recipes are manual (require provider API keys).

## Python dependencies

- Orchestrator deps go in the recipe's `pyproject.toml`.
- On-computer deps (installed via setup scripts) can use a recipe-local `requirements.txt`.

After changing deps: `cd recipes/<id> && uv lock`.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
feat: add anthropic-claude-code-in-sandbox recipe
fix: install Playwright system deps on Bookworm
docs: update agent recipe quick start
```

Use lowercase types (`feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `ci`). No period at the end of the subject line.
