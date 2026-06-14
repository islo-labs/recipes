# Contributing to islo-recipes

Thank you for helping improve customer-facing Islo examples.

## Recipe types

### SDK recipes

Programmatic orchestration with the Islo SDK. Lives in `recipes/<recipe-id>/` and must include:

| File | Purpose |
|------|---------|
| `README.md` | Customer docs (see section order below) |
| `.env.example` | Required and optional environment variables |
| Entrypoint | `run.py` (Python), `main.go` (Go), etc. — set in `recipes.yaml` |
| Lockfile | `uv.lock`, `go.sum`, `package-lock.json`, … per language |

Python SDK recipes also require `pyproject.toml`. Success is verified by `PASS: <recipe-id>` in stdout.

### Agent recipes

SDK-first examples for running coding agents in an Islo computer. Python recipes use `pyproject.toml`, `uv.lock`, and `*/main.py`.

### Automation recipes

GitHub Actions wiring. Requires `README.md`, `.env.example`, and `examples/*.yml`.

## Register every recipe

Add an entry to [`recipes.yaml`](recipes.yaml) with `id`, `type`, and `lang` (`python`, `go`, or `typescript`). Add a row in the root [`README.md`](README.md). `./scripts/validate.sh` fails if manifest and disk diverge.

## README sections — SDK recipes (required order)

1. **Goal**
2. **When to use**
3. **Prerequisites**
4. **Environment variables**
5. **Quick start**
6. **Verify success**
7. **How it works**
8. **Troubleshooting**
9. **Related recipes**

## README sections — agent recipes

1. Title + one-line description
2. **How to create a computer with …** — inline SDK snippet
3. **How to run example**
4. **Also available via Islo CLI** — optional
5. **Environment variables**
6. **Troubleshooting**
7. **Related recipes**

## README sections — automation recipes

1. Title + one-line description
2. **Quick start**
3. **Environment variables**
4. **Troubleshooting**
5. **Related recipes**

## Before opening a PR

1. Register the recipe in `recipes.yaml`.
2. From repo root: `./scripts/validate.sh`
3. If you have API keys: `ISLO_API_KEY=... ./scripts/smoke.sh <recipe-id>`
4. Do not commit `.env`, secrets, or internal-only paths.

## CI

| Workflow | Runs |
|----------|------|
| [`validate.yml`](.github/workflows/validate.yml) | `./scripts/validate.sh` on every PR |
| [`recipes-smoke.yml`](.github/workflows/recipes-smoke.yml) | `./scripts/smoke.sh` (SDK nightly; agents/AWS via workflow dispatch) |

## Python dependencies

Orchestrator deps go in the recipe's `pyproject.toml`. After changing deps: `cd recipes/<id> && uv lock`.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
feat: add claude-agent-sdk-in-sandbox recipe
ci: add language-agnostic recipe validation scripts
docs: update agent recipe quick start
```
