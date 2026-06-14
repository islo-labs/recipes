# AGENTS.md — islo-recipes

Instructions for AI coding agents working in this repository.

## What this repo is

A public cookbook of **runnable Islo recipes**. Each recipe is a self-contained folder under `recipes/<id>/` with its own `pyproject.toml`, `uv.lock`, and `run.py`. This is **not** the Islo SDK source.

## How to run a recipe

1. Read [`recipes/catalog.yaml`](recipes/catalog.yaml) to pick a recipe.
2. Open that recipe's `README.md`.
3. Export `ISLO_API_KEY` in your shell (or copy `.env.example` to `.env` in the recipe folder).
4. From the recipe directory:

```bash
cd recipes/<recipe-id>
uv sync
uv run python run.py
```

Or run the full local smoke suite from the repo root:

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

GitSource recipes also accept:

| Variable | Default |
|----------|---------|
| `ISLO_RECIPES_REPO_URL` | `https://github.com/islo-labs/islo-recipes` |
| `ISLO_RECIPES_REF` | `main` |

## Rules

- Never commit `.env` files or API keys.
- Never add local absolute paths (`/Users/...`) to customer-facing files.
- Every recipe must have: `README.md`, `.env.example`, `run.py`, `pyproject.toml`, `uv.lock`.
- Add a `catalog.yaml` entry when adding a recipe.
- Keep each recipe self-contained — no shared Python library.

## Adding or changing a recipe

Follow [`CONTRIBUTING.md`](CONTRIBUTING.md) and copy [`recipes/_template/`](recipes/_template/) as a starting point.

## External docs

- [Islo documentation](https://docs.islo.dev)
- [Harbor framework](https://harborframework.com/docs) (eval framework, not a Docker registry)
