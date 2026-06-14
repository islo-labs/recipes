#!/usr/bin/env bash
# Validate all recipes (structure only, no Islo API calls).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
uv run ruff check recipes scripts/validate_recipes.py
uv run python scripts/validate_recipes.py
