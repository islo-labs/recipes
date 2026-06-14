# Islo Recipes

Customer-facing, copy-paste examples for building on [Islo](https://islo.dev). Each recipe is a self-contained folder with one entrypoint (`run.py`), explicit environment variables, and a deterministic success line.

This repository is optimized for **AI coding agents** and human developers alike. Read [`AGENTS.md`](AGENTS.md) first if you are an agent.

## Terminology

Customer-facing docs use **computer**. The Islo Python SDK still uses `sandbox` identifiers (`create_sandbox`, `delete_sandbox`) — recipe code keeps those names.

## Quick start

```bash
git clone https://github.com/islo-labs/islo-recipes
cd islo-recipes
uv sync

export ISLO_API_KEY="your-api-key"   # from https://app.islo.dev/api-keys
export ISLO_BASE_URL="https://api.islo.dev"  # optional; this is the default
```

Pick a recipe from [`recipes/catalog.yaml`](recipes/catalog.yaml), then:

```bash
uv run python recipes/<recipe-id>/run.py
```

Or run the full local smoke suite (requires `ISLO_API_KEY` in your shell):

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

Assumes `ISLO_API_KEY` is already exported in your shell:

```bash
export ISLO_API_KEY=ak_...
uv sync --extra dev --extra web-app-e2e
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

GitSource recipes clone [github.com/islo-labs/islo-recipes](https://github.com/islo-labs/islo-recipes) — push `main` before running `web-app-e2e` or `docker-compose-fastapi-postgres`. Override branch with `ISLO_RECIPES_REF` if needed.

Optional: `mount-s3` runs automatically when `AWS_ROLE_ARN` and `S3_BUCKET` are set. Install Harbor for the `harbor-evals` step: `uv tool install 'harbor[islo]'`.

### CI

Structure checks run on every pull request. Live smoke tests run nightly — see [`.github/workflows/recipes-smoke.yml`](.github/workflows/recipes-smoke.yml).

## Add a recipe

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Roadmap

| Priority | Recipe |
|----------|--------|
| P1 | `computer-lifecycle` — create, exec, stop, delete |
| P1 | `git-sources-setup` — clone repo + setup scripts at init |
| P1 | `custom-docker-image` — build and use any OCI image |
| P2 | `snapshots`, `ssh-development`, `gateway-block-cheat-sources` |
| P2 | `docker-compose-multi-service` |
| P3 | `ci-github-actions` — reusable GitHub Actions workflow |

## Links

- [Islo docs](https://docs.islo.dev)
- [Python SDK](https://pypi.org/project/islo/)
- [Harbor + Islo integration](https://docs.islo.dev/integrations/harbor)
