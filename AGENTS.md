# AGENTS.md — islo-recipes

Instructions for AI coding agents working in this repository.

## What this repo is

A public cookbook of **runnable Islo recipes**. Each recipe demonstrates one integration pattern end-to-end. This is **not** the Islo SDK source and **not** the internal `islo-e2e` regression suite.

## Terminology

Use **computer** in all customer-facing prose (READMEs, comments for users, commit messages about docs).

The SDK uses `sandbox` identifiers — keep them in code:

```python
# Create an Islo computer (SDK: create_sandbox)
client.sandboxes.create_sandbox(...)
```

## How to run a recipe

1. Read [`recipes/catalog.yaml`](recipes/catalog.yaml) to pick a recipe.
2. Open that recipe's `README.md`.
3. Export `ISLO_API_KEY` in your shell (or copy `.env.example` to `.env`).
4. From the repo root:

```bash
uv sync
uv run python recipes/<recipe-id>/run.py
```

Or run the full local smoke suite:

```bash
export ISLO_API_KEY=ak_...
./scripts/test_local.sh
```

5. Success = README "Verify success" section matches (typically `PASS: <recipe-id>`).

## Required environment

| Variable | Required | Default |
|----------|----------|---------|
| `ISLO_API_KEY` | Yes | — |
| `ISLO_BASE_URL` | No | `https://api.islo.dev` |

Local smoke test: `./scripts/test_local.sh` (reads `ISLO_API_KEY` from the shell).

Harbor recipes also need `ISLO_API_URL` set to the same value as `ISLO_BASE_URL`.

GitSource recipes accept:

| Variable | Default |
|----------|---------|
| `ISLO_RECIPES_REPO_URL` | `https://github.com/islo-labs/islo-recipes` |
| `ISLO_RECIPES_REF` | remote HEAD |

## Rules

- Never commit `.env` files or API keys.
- Never add local absolute paths (`/Users/...`) to customer-facing files.
- Every recipe must have: `README.md`, `.env.example`, `run.py`.
- Add a `catalog.yaml` entry when adding a recipe.
- Use `computer` not `sandbox` in user-facing text.

## Adding or changing a recipe

Follow [`CONTRIBUTING.md`](CONTRIBUTING.md) and copy [`recipes/_template/`](recipes/_template/) as a starting point.

## External docs

- [Islo documentation](https://docs.islo.dev)
- [Harbor framework](https://harborframework.com/docs) (eval framework, not a Docker registry)
