# Islo Recipes

Customer-facing, copy-paste examples for building on [Islo](https://islo.dev). Each recipe is a **self-contained folder** with its own `pyproject.toml`, `uv.lock`, and `run.py`.

This repository is optimized for **AI coding agents** and human developers alike. Read [`AGENTS.md`](AGENTS.md) first if you are an agent.

## Quick start

Pick a recipe from [`recipes/catalog.yaml`](recipes/catalog.yaml), then:

```bash
git clone https://github.com/islo-labs/islo-recipes
cd islo-recipes/recipes/gateway-allowlist   # example

export ISLO_API_KEY="your-api-key"   # from https://app.islo.dev/api-keys
export ISLO_BASE_URL="https://api.islo.dev"  # optional; this is the default

uv sync
uv run python run.py
```

Or run the full local smoke suite from the repo root (requires `ISLO_API_KEY` in your shell):

```bash
./scripts/test_local.sh
```

## v1 recipes

| Recipe | Description |
|--------|-------------|
| [`gateway-allowlist`](recipes/gateway-allowlist/) | Restrict computer egress to package registries (PyPI, npm) |
| [`docker-compose-fastapi-postgres`](recipes/docker-compose-fastapi-postgres/) | Run a FastAPI + Postgres stack with Docker Compose |
| [`web-app-e2e`](recipes/web-app-e2e/) | FastAPI app + Playwright browser tests on an Islo computer |
| [`harbor-evals`](recipes/harbor-evals/) | Run Harbor agent evals on Islo (`hello-world` smoke test) |
| [`mount-s3`](recipes/mount-s3/) | Mount an S3 bucket on a computer with a custom image + gateway |

## How we test these recipes

Every recipe prints `PASS: <recipe-id>` on success.

### Local (your laptop + live Islo)

```bash
export ISLO_API_KEY=ak_...
./scripts/test_local.sh
```

Run one recipe:

```bash
./scripts/test_local.sh gateway-allowlist
```

Structure checks only (no Islo):

```bash
./scripts/test_local.sh --validate-only
```

GitSource recipes clone [github.com/islo-labs/islo-recipes](https://github.com/islo-labs/islo-recipes) — push `main` before running `web-app-e2e` or `docker-compose-fastapi-postgres`.

Optional: `mount-s3` runs when `AWS_ROLE_ARN` and `S3_BUCKET` are set. Install Harbor for `harbor-evals`: `uv tool install 'harbor[islo]'`.

### CI

Structure checks run on every pull request. Live smoke tests run nightly — see [`.github/workflows/recipes-smoke.yml`](.github/workflows/recipes-smoke.yml).

## Add a recipe

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Links

- [Islo docs](https://docs.islo.dev)
- [Python SDK](https://pypi.org/project/islo/)
- [Harbor + Islo integration](https://docs.islo.dev/integrations/harbor)
