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

**Agent recipes** — Islo SDK + agent inside a computer:

```bash
cd recipes/claude-agent-sdk-in-sandbox
uv sync
uv run python claude_agent_sdk_in_sandbox/main.py
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

## Agent recipes

Run coding agents inside an Islo computer via the Python SDK.

| Recipe | Description |
|--------|-------------|
| [`anthropic-claude-code-in-sandbox`](recipes/anthropic-claude-code-in-sandbox/) | Claude Code CLI |
| [`openai-codex-in-sandbox`](recipes/openai-codex-in-sandbox/) | OpenAI Codex CLI |
| [`claude-agent-sdk-in-sandbox`](recipes/claude-agent-sdk-in-sandbox/) | Claude Agent SDK (`query()`) |

CLI alternative for Claude Code and Codex: `islo use --agent claude` / `--agent codex`. See [agent integration](https://docs.islo.dev/cli/agent-integration).

## Web app recipes

| Recipe | Description |
|--------|-------------|
| [`ai-sdk-harness-chat`](recipes/ai-sdk-harness-chat/) | Next.js chat using AI SDK HarnessAgent and Codex in an Islo sandbox |

## Testing

**Local validation** (no API keys):

```bash
uv sync --extra dev
./scripts/validate.sh
```

**Live smoke** (requires `ISLO_API_KEY`; agent/AWS recipes need extra secrets):

GitSource recipes (`playwright`, `docker-compose-fastapi-postgres`) clone this repo inside the computer. `./scripts/smoke.sh` sets `ISLO_RECIPES_REF` to your **current git branch** automatically — push the branch first. Override with `ISLO_RECIPES_REF=main` after merge.

```bash
export ISLO_API_KEY="..."
./scripts/smoke.sh all
```

CI runs `./scripts/validate.sh` on every PR ([`validate.yml`](.github/workflows/validate.yml)). Live smoke runs on a schedule and via workflow dispatch ([`recipes-smoke.yml`](.github/workflows/recipes-smoke.yml)).

## Add a recipe

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Links

- [Islo docs](https://docs.islo.dev)
- [Python SDK](https://pypi.org/project/islo/)
