# Islo Recipes

Customer-facing, copy-paste examples for building on [Islo](https://islo.dev). Each recipe is a **self-contained folder** under `recipes/`.

This repository is optimized for **AI coding agents** and human developers alike. Read [`AGENTS.md`](AGENTS.md) first if you are an agent.

## Quick start

**SDK recipes** — programmatic orchestration with `run.py`:

```bash
git clone https://github.com/islo-labs/recipes
cd recipes/gateway-allowlist

export ISLO_API_KEY="your-api-key"   # from https://app.islo.dev/api-keys

uv sync
uv run python run.py
```

**Agent recipes** — SDK examples with an optional CLI workflow:

```bash
cd recipes/anthropic-claude-code-in-sandbox
uv sync
uv run python anthropic_claude_code_in_sandbox/main.py
```

See each recipe's `README.md` for full steps.

## SDK recipes

Programmatic examples using the [Islo Python SDK](https://pypi.org/project/islo/). Each prints `PASS: <recipe-id>` on success.

| Recipe | Description |
|--------|-------------|
| [`gateway-allowlist`](recipes/gateway-allowlist/) | Restrict computer egress to package registries (PyPI, npm) |
| [`docker-compose-fastapi-postgres`](recipes/docker-compose-fastapi-postgres/) | Run a FastAPI + Postgres stack with Docker Compose |
| [`playwright`](recipes/playwright/) | FastAPI app + Playwright browser tests on an Islo computer |
| [`mount-s3`](recipes/mount-s3/) | Mount an S3 bucket on a computer with a custom image + gateway |

GitSource recipes clone this repo — push `main` before running `playwright` or `docker-compose-fastapi-postgres`.

## Claude Code recipes

Run [Claude Code](https://docs.anthropic.com/en/docs/claude-code) in Islo with `islo use --agent claude`. See [agent integration docs](https://docs.islo.dev/cli/agent-integration).

| Recipe | Description |
|--------|-------------|
| [`anthropic-claude-code-in-sandbox`](recipes/anthropic-claude-code-in-sandbox/) | Run Claude Code in a computer via the Islo Python SDK |

## Codex recipes

Run [OpenAI Codex](https://github.com/openai/codex) in Islo with `islo use --agent codex`.

| Recipe | Description |
|--------|-------------|
| [`openai-codex-in-sandbox`](recipes/openai-codex-in-sandbox/) | Run Codex in a computer via the Islo Python SDK |

## Validation

From the repo root (requires `uv sync --extra dev`):

```bash
uv run ruff check recipes
```

## Add a recipe

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Links

- [Islo docs](https://docs.islo.dev)
- [Python SDK](https://pypi.org/project/islo/)
