# Contributing to islo-recipes

Thank you for helping improve customer-facing Islo examples.

## Recipe requirements

Every recipe lives in `recipes/<recipe-id>/` and must include:

| File | Purpose |
|------|---------|
| `README.md` | Customer docs with fixed sections (see template) |
| `.env.example` | Required and optional environment variables |
| `run.py` | Single orchestrator entrypoint |
| `pyproject.toml` | Recipe-local Python dependencies |
| `uv.lock` | Locked deps for reproducible runs (`uv lock` in the recipe dir) |

Also add an entry to [`recipes/catalog.yaml`](recipes/catalog.yaml).

Each recipe is a **full standalone example** — no shared Python library. Copy SDK boilerplate into `run.py` as needed.

## README sections (required order)

1. **Goal**
2. **When to use**
3. **Prerequisites**
4. **Environment variables**
5. **Quick start**
6. **Verify success**
7. **How it works**
8. **Troubleshooting**
9. **Related recipes**

## Before opening a PR

1. From the recipe directory: `uv sync && uv run python run.py` — confirm `PASS: <recipe-id>`.
2. Run structure validation from repo root: `./scripts/test_local.sh --validate-only`
3. Do not commit `.env`, secrets, or internal-only paths.

## CI tiers (`catalog.yaml`)

| Tier | Meaning |
|------|---------|
| `smoke` | Runs in nightly live smoke workflow |
| `manual` | Opt-in (e.g. requires AWS secrets) |
| `none` | Docs-only or not yet wired to CI |

## Python dependencies

- **Orchestrator deps** (`islo`, `python-dotenv`, etc.) go in the recipe's `pyproject.toml`.
- **On-computer deps** (installed via setup scripts during init) can use a recipe-local `requirements.txt`.

After changing deps: `cd recipes/<id> && uv lock`.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
feat: add mount-s3 recipe
fix: install Playwright system deps on Bookworm
refactor: simplify gateway-allowlist run.py
docs: update web-app-e2e quick start
chore: bump islo SDK in gateway-allowlist lockfile
```

Use lowercase types (`feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `ci`). No period at the end of the subject line.
