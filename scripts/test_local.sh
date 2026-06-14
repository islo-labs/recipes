#!/usr/bin/env bash
# Run recipe smoke tests from your laptop against live Islo.
#
# Requires ISLO_API_KEY in the shell (a .env file is optional — load_dotenv
# in recipes will pick it up, but the shell export takes precedence).
#
# Usage:
#   export ISLO_API_KEY=ak_...
#   ./scripts/test_local.sh              # all smoke recipes
#   ./scripts/test_local.sh gateway-allowlist   # one recipe
#   ./scripts/test_local.sh --validate-only     # structure checks only, no Islo

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SMOKE_RECIPES=(
  gateway-allowlist
  harbor-evals
  docker-compose-fastapi-postgres
  web-app-e2e
)

run_validate() {
  echo "==> Catalog + structure validation"
  uv run python scripts/validate_catalog.py
  echo "==> Ruff"
  uv run ruff check src recipes scripts
}

require_islo_env() {
  if [ -z "${ISLO_API_KEY:-}" ]; then
    echo "error: ISLO_API_KEY must be set in your shell" >&2
    echo "  export ISLO_API_KEY=ak_..." >&2
    exit 1
  fi
  export ISLO_BASE_URL="${ISLO_BASE_URL:-https://api.islo.dev}"
  export ISLO_API_URL="${ISLO_API_URL:-$ISLO_BASE_URL}"
  export ISLO_RECIPES_REPO_URL="${ISLO_RECIPES_REPO_URL:-https://github.com/islo-labs/islo-recipes}"
  export ISLO_RECIPES_REF="${ISLO_RECIPES_REF:-main}"
  echo "==> Islo env"
  echo "    ISLO_BASE_URL=$ISLO_BASE_URL"
  echo "    ISLO_RECIPES_REPO_URL=$ISLO_RECIPES_REPO_URL"
  echo "    ISLO_RECIPES_REF=$ISLO_RECIPES_REF"
}

run_recipe() {
  local id=$1
  echo ""
  echo "==> recipes/$id/run.py"
  if [ "$id" = harbor-evals ] && ! command -v harbor >/dev/null 2>&1; then
    echo "skipped: harbor not on PATH (uv tool install 'harbor[islo]')"
    return 0
  fi
  uv run python "recipes/$id/run.py"
}

if [ "${1:-}" = "--validate-only" ]; then
  uv sync --extra dev --quiet
  run_validate
  echo ""
  echo "Validate-only passed."
  exit 0
fi

uv sync --extra dev --extra web-app-e2e --quiet
run_validate
require_islo_env

if [ $# -gt 0 ]; then
  for id in "$@"; do
    run_recipe "$id"
  done
else
  for id in "${SMOKE_RECIPES[@]}"; do
    run_recipe "$id"
  done
  if [ -n "${AWS_ROLE_ARN:-}" ] && [ -n "${S3_BUCKET:-}" ]; then
    run_recipe mount-s3
  else
    echo ""
    echo "==> mount-s3 (skipped: set AWS_ROLE_ARN and S3_BUCKET to include)"
  fi
fi

echo ""
echo "Local Islo smoke tests passed."
