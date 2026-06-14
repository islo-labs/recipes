# AGENTS.md — islo-recipes

Instructions for AI coding agents working in this repository.

## What this repo is

A public cookbook of **Islo examples** under `recipes/<id>/`. This is **not** the Islo SDK source.

There are two recipe styles:

| Style | Entrypoint | Success signal |
|-------|------------|----------------|
| **SDK** | `run.py` | `PASS: <recipe-id>` in stdout |
| **Agent** (Claude Code, Codex) | `*/main.py` (SDK); CLI optional | README expected output |

## How to run an SDK recipe

1. Open the recipe's `README.md`.
2. Export `ISLO_API_KEY` (or copy `.env.example` to `.env`).
3. From the recipe directory:

```bash
cd recipes/<recipe-id>
uv sync
uv run python run.py
```

4. Success = `PASS: <recipe-id>`.

## How to run an agent recipe

1. Open the recipe's `README.md`.
2. Copy `.env.example` to `.env` and set API keys.
3. From the recipe directory:

```bash
cd recipes/<recipe-id>
uv sync
uv run python <package>/main.py
```

4. For interactive use, see the "Also available via Islo CLI" section in the README.

## Required environment

| Variable | Required | Default |
|----------|----------|---------|
| `ISLO_API_KEY` | SDK recipes + agent SDK examples | — |
| `ISLO_BASE_URL` | No | `https://api.islo.dev` |

GitSource SDK recipes also accept:

| Variable | Default |
|----------|---------|
| `ISLO_RECIPES_REPO_URL` | `https://github.com/islo-labs/recipes` |
| `ISLO_RECIPES_REF` | `main` |

Agent recipes may require `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` — see each recipe's README.

## Rules

- Never commit `.env` files or API keys.
- Never add local absolute paths (`/Users/...`) to customer-facing files.
- SDK recipes must have: `README.md`, `.env.example`, `run.py`, `pyproject.toml`, `uv.lock`.
- Agent recipes must have: `README.md`, `.env.example` (at minimum).
- Keep each recipe self-contained — no shared Python library.

## Adding or changing a recipe

Follow [`CONTRIBUTING.md`](CONTRIBUTING.md).

## External docs

- [Islo documentation](https://docs.islo.dev)
- [Agent integration](https://docs.islo.dev/cli/agent-integration)
