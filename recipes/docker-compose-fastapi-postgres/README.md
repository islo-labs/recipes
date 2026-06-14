# Docker Compose — FastAPI + Postgres

Run a two-service stack (API + database) on an Islo computer using Docker Compose.

## Goal

Clone this repo onto a computer with Docker enabled, start FastAPI and Postgres via Compose, and verify HTTP health and database reads.

## When to use

- Multi-container workloads on Islo (similar to Harbor compose tasks)
- Integration tests that need Postgres beside your app
- Learning Docker Compose on the default islo-runner image (Docker preinstalled)

## Prerequisites

- Islo account and API key
- Python 3.10+ and [uv](https://docs.astral.sh/uv/)
- This repository reachable via HTTPS Git (`ISLO_RECIPES_REPO_URL`)

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ISLO_API_KEY` | Yes | API key from [app.islo.dev/api-keys](https://app.islo.dev/api-keys) |
| `ISLO_BASE_URL` | No | Control-plane URL (default `https://api.islo.dev`) |
| `ISLO_RECIPES_REPO_URL` | Yes* | Git URL for this repo (*default: `https://github.com/islo-labs/islo-recipes`) |
| `ISLO_RECIPES_REF` | No | Branch, tag, or commit to clone |

## Quick start

```bash
cd islo-recipes
uv sync
cp recipes/docker-compose-fastapi-postgres/.env.example .env
# edit .env

uv run python recipes/docker-compose-fastapi-postgres/run.py
```

## Verify success

```
PASS: docker-compose-fastapi-postgres
```

## How it works

1. Creates a computer with `GitSource` (clones this repo to `/workspace/islo-recipes`). The default islo-runner image includes Docker.
2. Verifies `docker compose` (preinstalled on islo-runner).
3. Runs `docker compose up -d --wait` in this recipe directory.
4. Curls `/health` and `/items` (seed row from `db/init.sql`).
5. Tears down with `docker compose down -v`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Git clone fails | Ensure `ISLO_RECIPES_REPO_URL` is public HTTPS and `ISLO_RECIPES_REF` exists |
| Compose build slow | First run builds the API image; allow several minutes |
| `docker compose` missing | Use the default islo-runner image; it ships the Compose v2 plugin |

## Related recipes

- [`web-app-e2e`](../web-app-e2e/) — browser tests without Compose
- [`gateway-allowlist`](../gateway-allowlist/) — restrict egress for dependency installs
