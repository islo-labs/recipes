# Contributing to islo-recipes

Thank you for helping improve customer-facing Islo examples.

## Recipe types

### SDK recipes

Programmatic orchestration with the Islo Python SDK. Lives in `recipes/<recipe-id>/` and must include:

| File | Purpose |
|------|---------|
| `README.md` | Customer docs (see section order below) |
| `.env.example` | Required and optional environment variables |
| `run.py` | Single orchestrator entrypoint |
| `pyproject.toml` | Recipe-local Python dependencies |
| `uv.lock` | Locked deps (`uv lock` in the recipe dir) |

Success is verified by `PASS: <recipe-id>` in stdout.

### Agent recipes

SDK-first examples for running coding agents in an Islo computer. Must include:

| File | Purpose |
|------|---------|
| `README.md` | SDK snippet + "How to run example" steps |
| `.env.example` | API keys for the SDK example |
| `pyproject.toml` | Recipe-local Python dependencies |
| `uv.lock` | Locked deps (`uv lock` in the recipe dir) |
| `*/main.py` | Runnable orchestrator (e.g. `claude_agent_sdk_in_sandbox/main.py`) |

No `run.py` or `PASS:` convention required. CLI workflow goes in an optional "Also available via Islo CLI" section.

### Automation recipes

GitHub Actions wiring (no live Islo run from the recipe folder). Must include:

| File | Purpose |
|------|---------|
| `README.md` | Quick start + copy-paste workflow steps |
| `.env.example` | Documents required GitHub secrets |
| `examples/*.yml` | Workflow files to copy into `.github/workflows/` |

## Register every recipe

Add an entry to [`tests/recipes.yaml`](tests/recipes.yaml) and a row in the root [`README.md`](README.md). Structure tests fail if manifest and disk diverge.

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
3. **How to run example** — env setup, `uv sync`, run `main.py`
4. **Also available via Islo CLI** — optional
5. **Environment variables**
6. **Troubleshooting**
7. **Related recipes**

## README sections — automation recipes

1. Title + one-line description
2. **Quick start** — secrets, copy workflow files
3. **Environment variables**
4. **Troubleshooting**
5. **Related recipes**

## Before opening a PR

1. Register the recipe in `tests/recipes.yaml`.
2. From repo root:

```bash
uv sync --extra dev
uv run pytest tests/test_structure.py -v
uv run ruff check recipes tests
```

3. If you have API keys, run the live smoke test for your recipe:

```bash
export ISLO_API_KEY=...
uv run pytest tests/test_smoke_live.py -v -k <recipe-id>
```

4. Do not commit `.env`, secrets, or internal-only paths.

## CI

| Workflow | Runs |
|----------|------|
| [`validate.yml`](.github/workflows/validate.yml) | Ruff + structure tests on every PR |
| [`recipes-smoke.yml`](.github/workflows/recipes-smoke.yml) | Live smoke (SDK nightly; agents/AWS via workflow dispatch) |

## Python dependencies

- Orchestrator deps go in the recipe's `pyproject.toml`.
- On-computer deps (installed via setup scripts) can use a recipe-local `requirements.txt`.

After changing deps: `cd recipes/<id> && uv lock`.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
feat: add claude-agent-sdk-in-sandbox recipe
test: add recipe structure and smoke tests
docs: update agent recipe quick start
```

Use lowercase types (`feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `ci`). No period at the end of the subject line.
