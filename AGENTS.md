# AGENTS.md — islo-recipes

Instructions for AI coding agents working in this repository.

## What this repo is

A public cookbook of **Islo examples** under `recipes/<id>/`. This is **not** the Islo SDK source.

Recipe types:

| Style | Entrypoint | Success signal |
|-------|------------|----------------|
| **SDK** | `run.py` | `PASS: <recipe-id>` in stdout |
| **Agent** | `*/main.py` | `Done.` in stdout (live smoke) |
| **Automation** | workflow YAML in `examples/` | Structure tests only |

All recipes are listed in [`tests/recipes.yaml`](tests/recipes.yaml).

## How to run an SDK recipe

```bash
cd recipes/<recipe-id>
uv sync
uv run python run.py
```

Success = `PASS: <recipe-id>`.

## How to run an agent recipe

```bash
cd recipes/<recipe-id>
uv sync
uv run python <package>/main.py
```

See the README for API keys. Optional CLI: `islo use --agent …`.

## How to test (no API keys)

From repo root:

```bash
uv sync --extra dev
uv run pytest tests/test_structure.py -v
uv run ruff check recipes tests
```

Live smoke (needs `ISLO_API_KEY`):

```bash
uv run pytest tests/test_smoke_live.py -v -k <recipe-id>
```

## Required environment

| Variable | Required | Default |
|----------|----------|---------|
| `ISLO_API_KEY` | Live tests + SDK/agent recipes | — |
| `ISLO_BASE_URL` | No | `https://api.islo.dev` |

GitSource SDK recipes also accept `ISLO_RECIPES_REPO_URL` (default `https://github.com/islo-labs/recipes`) and `ISLO_RECIPES_REF` (default `main`).

Agent recipes may require `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`.

## Rules

- Never commit `.env` files or API keys.
- Never add local absolute paths (`/Users/...`) to customer-facing files.
- Register new recipes in `tests/recipes.yaml`.
- Keep each recipe self-contained — no shared Python library.

## External docs

- [Islo documentation](https://docs.islo.dev)
- [Agent integration](https://docs.islo.dev/cli/agent-integration)
- [islo-reviewer](https://github.com/islo-labs/islo-reviewer)
