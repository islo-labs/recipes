# Contributing to islo-recipes

Thank you for helping improve customer-facing Islo examples.

## Recipe requirements

Every recipe lives in `recipes/<recipe-id>/` and must include:

| File | Purpose |
|------|---------|
| `README.md` | Customer docs with fixed sections (see template) |
| `.env.example` | Required and optional environment variables |
| `run.py` | Single orchestrator entrypoint |

Also add an entry to [`recipes/catalog.yaml`](recipes/catalog.yaml).

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

## Terminology

Customer-facing copy uses **computer**, not sandbox. SDK method names (`create_sandbox`, etc.) stay unchanged in code.

## Before opening a PR

1. Run the recipe locally against Islo and confirm `PASS: <recipe-id>`.
2. Run structure validation: `uv run python scripts/validate_catalog.py`
3. Do not commit `.env`, secrets, or internal-only paths.

## CI tiers (`catalog.yaml`)

| Tier | Meaning |
|------|---------|
| `smoke` | Runs in nightly live smoke workflow |
| `manual` | Opt-in (e.g. requires AWS secrets) |
| `none` | Docs-only or not yet wired to CI |

## Python dependencies

Add shared deps to root [`pyproject.toml`](pyproject.toml). Recipe-specific deps can use optional extras or a recipe-local `requirements.txt` referenced by setup scripts inside the computer.
