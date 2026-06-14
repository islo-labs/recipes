# Web app browser E2E

Run Playwright browser tests against a small FastAPI app on an Islo computer.

## Goal

Show how to run your application's browser E2E tests on Islo: clone source via Git, start a web server, drive Chromium with Playwright, assert UI behavior.

## When to use

- CI-style browser tests for a Python web app
- Validating Playwright on Islo before porting your own test suite
- Learning `GitSource` + `setup_scripts` at computer init

## Prerequisites

- Islo account and API key
- Python 3.10+ and [uv](https://docs.astral.sh/uv/)
- This repository reachable via HTTPS Git

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ISLO_API_KEY` | Yes | API key from [app.islo.dev/api-keys](https://app.islo.dev/api-keys) |
| `ISLO_BASE_URL` | No | Control-plane URL (default `https://api.islo.dev`) |
| `ISLO_RECIPES_REPO_URL` | Yes* | Git URL for this repo |
| `ISLO_RECIPES_REF` | No | Branch, tag, or commit to clone |

## Quick start

### On Islo (orchestrated)

```bash
cd islo-recipes
uv sync --extra web-app-e2e
cp recipes/web-app-e2e/.env.example .env
# edit .env

uv run python recipes/web-app-e2e/run.py
```

### Local (no Islo)

Install deps and Playwright, then run tests against a locally started server:

```bash
cd islo-recipes
uv sync --extra web-app-e2e
cd recipes/web-app-e2e
uv run playwright install chromium
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 &
uv run pytest e2e/ -v
```

## Verify success

```
PASS: web-app-e2e
```

Pytest output should show one passing test (`test_counter_increments`).

## How it works

1. Creates a computer with `GitSource` and a setup script that `pip install`s deps and `playwright install chromium`.
2. Starts FastAPI with uvicorn in the background on port 8000.
3. Runs `pytest e2e/` which opens Chromium, clicks **Increment**, and asserts the counter updates.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Playwright browser missing | Setup script runs `playwright install chromium`; ensure enough disk (15GB) |
| Server not ready | Check `/tmp/web-app.log` via exec; increase poll timeout |
| Git clone fails | Verify public repo URL and ref |

## Related recipes

- [`docker-compose-fastapi-postgres`](../docker-compose-fastapi-postgres/) — multi-container stack
