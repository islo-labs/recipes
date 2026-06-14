# Playwright

Run Playwright browser tests against a small FastAPI app on an Islo computer.

## Goal

Show how to run your application's browser E2E tests on Islo: clone source via Git, start a web server, drive Chromium with Playwright, assert UI behavior.

## When to use

- CI-style browser tests for a Python web app
- Validating Playwright on Islo before porting your own test suite
- Learning `GitSource` + exec-based setup on an Islo computer

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
cd recipes/playwright
uv sync
cp .env.example .env
# edit .env

uv run python run.py
```

### Local (no Islo)

Install deps and Playwright, then run tests against a locally started server:

```bash
cd recipes/playwright
uv sync --extra app
uv run playwright install chromium
uv run playwright install-deps chromium
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 &
uv run pytest e2e/ -v
```

## Verify success

```
PASS: playwright
```

Pytest output should show one passing test (`test_counter_increments`).

## How it works

1. Creates a computer with `GitSource`, then installs Python deps, Chromium, and Playwright OS libraries via exec.
2. Starts FastAPI with uvicorn in the background on port 8000.
3. Runs `pytest e2e/` which opens Chromium, clicks **Increment**, and asserts the counter updates.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Playwright browser missing | Setup runs `playwright install chromium` and `playwright install-deps` |
| Server not ready | Check `/tmp/web-app.log` via exec; increase poll timeout |
| Hangs during setup | Playwright browser download can take several minutes; progress prints show each phase |
| Git clone fails | Verify repo URL, ref, and that `recipes/playwright` exists on that branch |

## Related recipes

- [`docker-compose-fastapi-postgres`](../docker-compose-fastapi-postgres/) — multi-container stack
