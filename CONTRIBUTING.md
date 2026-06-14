# Contributing to islo-recipes

Thank you for helping improve customer-facing Islo examples.

There is **no central manifest**. Recipes are discovered from folder layout under `recipes/<id>/`. `./scripts/validate.sh` checks conventions; add a row to the root [`README.md`](README.md) table when you add a recipe.

## Recipe types (detected automatically)

| Type | How it's detected |
|------|-------------------|
| **SDK** | `run.py` at recipe root (+ `pyproject.toml` for Python) |
| **Agent** | `*/main.py` orchestrator, no root `run.py` |
| **Automation** | `examples/*.yml`, no `run.py` |

Set `lang` implicitly: `pyproject.toml` → Python, `go.mod` → Go, `package.json` → TypeScript.

## SDK recipes (Python)

| File | Purpose |
|------|---------|
| `README.md` | Customer docs (see section order below) |
| `.env.example` | Environment variables |
| `run.py` | Orchestrator — must print `PASS: <recipe-id>` |
| `pyproject.toml` | Dependencies |
| `uv.lock` | Locked deps |

## Agent recipes (Python)

| File | Purpose |
|------|---------|
| `README.md` | SDK snippet + "How to run example" |
| `.env.example` | API keys (used by smoke tests to know required env) |
| `pyproject.toml`, `uv.lock` | Orchestrator deps |
| `<package>/main.py` | Runnable entrypoint |

## Automation recipes

| File | Purpose |
|------|---------|
| `README.md` | Quick start + copy-paste steps |
| `.env.example` | GitHub secrets documentation |
| `examples/*.yml` | Workflow files to copy |

## README sections — SDK recipes

1. **Goal** · 2. **When to use** · 3. **Prerequisites** · 4. **Environment variables** · 5. **Quick start** · 6. **Verify success** · 7. **How it works** · 8. **Troubleshooting** · 9. **Related recipes**

## README sections — agent recipes

1. Title · 2. **How to create a computer with …** · 3. **How to run example** · 4. **Also available via Islo CLI** (optional) · 5. **Environment variables** · 6. **Troubleshooting** · 7. **Related recipes**

## Before opening a PR

1. `./scripts/validate.sh`
2. Optional: `ISLO_API_KEY=... ./scripts/smoke.sh <recipe-id>`
3. Do not commit `.env` or secrets.

## CI

| Workflow | Runs |
|----------|------|
| [`validate.yml`](.github/workflows/validate.yml) | `./scripts/validate.sh` |
| [`recipes-smoke.yml`](.github/workflows/recipes-smoke.yml) | `./scripts/smoke.sh` |

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) — `feat:`, `fix:`, `docs:`, `ci:`, etc.
