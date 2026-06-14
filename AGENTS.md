# AGENTS.md — islo-recipes

Instructions for AI coding agents working in this repository.

## What this repo is

A public cookbook of **Islo examples** under `recipes/<id>/`. Multi-language (`python` today; `go` and `typescript` planned). This is **not** the Islo SDK source.

Recipe registry: discovered from `recipes/<id>/` folder conventions (see [`CONTRIBUTING.md`](CONTRIBUTING.md)).

| Style | Entrypoint | Success signal |
|-------|------------|----------------|
| **SDK** | `run.py` (Python) | `PASS: <recipe-id>` |
| **Agent** | `*/main.py` | `Done.` in stdout |

## How to run a Python SDK recipe

```bash
cd recipes/<recipe-id>
uv sync
uv run python run.py
```

## How to run a Python agent recipe

```bash
cd recipes/<recipe-id>
uv sync
uv run python <package>/main.py
```

## Validation (no API keys)

```bash
uv sync --extra dev
./scripts/validate.sh
```

## Live smoke (needs ISLO_API_KEY)

```bash
./scripts/smoke.sh <recipe-id>
```

## Rules

- Never commit `.env` files or API keys.
- Never add local absolute paths (`/Users/...`) to customer-facing files.
- Register new recipes as `recipes/<id>/` with the right layout (see below).
- Keep each recipe self-contained — no shared library.

## External docs

- [Islo documentation](https://docs.islo.dev)
- [Agent integration](https://docs.islo.dev/cli/agent-integration)
