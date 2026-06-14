#!/usr/bin/env bash
# Run live recipe smoke tests. Requires ISLO_API_KEY (and per-recipe secrets).
#
# Usage:
#   ./scripts/smoke.sh sdk              # SDK recipes (no AWS/agents)
#   ./scripts/smoke.sh agents           # agent recipes
#   ./scripts/smoke.sh all              # everything with available secrets
#   ./scripts/smoke.sh <recipe-id>      # single recipe
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SELECTION="${1:-sdk}"

if [[ -z "${ISLO_API_KEY:-}" ]]; then
  echo "ISLO_API_KEY is required for live smoke tests" >&2
  exit 1
fi

cd "$ROOT"

# GitSource recipes clone this repo — use the current branch when ISLO_RECIPES_REF
# is unset so local smoke matches your working tree (must be pushed to remote).
if [[ -z "${ISLO_RECIPES_REF:-}" ]] && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  branch="$(git -C "$ROOT" branch --show-current 2>/dev/null || true)"
  if [[ -n "$branch" ]]; then
    export ISLO_RECIPES_REF="$branch"
    echo "ISLO_RECIPES_REF=$ISLO_RECIPES_REF (current git branch)"
  fi
fi

run_python_smoke() {
  local id="$1" entrypoint="$2" expect="$3"
  local output exit_code
  echo "==> smoke: $id"
  set +e
  output="$(cd "recipes/$id" && uv run python "$entrypoint" 2>&1)"
  exit_code=$?
  set -e
  if (( exit_code != 0 )); then
    echo "$output" >&2
    echo "FAILED: $id (exit $exit_code)" >&2
    return 1
  fi
  if [[ "$output" != *"$expect"* ]]; then
    echo "$output" >&2
    echo "FAILED: $id (missing expected output: $expect)" >&2
    return 1
  fi
  echo "PASS: $id"
}

env_ok() {
  local var
  for var in "$@"; do
    [[ -z "$var" ]] && continue
    if [[ -z "${!var:-}" ]]; then
      echo "SKIP: missing $var"
      return 1
    fi
  done
  return 0
}

should_run() {
  local id="$1" live="$2"
  case "$SELECTION" in
    sdk)       [[ "$live" == "smoke" ]] ;;
    agents)    [[ "$live" == "agent" ]] ;;
    all)       [[ -n "$live" ]] ;;
    *)         [[ "$id" == "$SELECTION" ]] ;;
  esac
}

FAILURES=0
SKIPS=0

while IFS=$'\t' read -r id type live entrypoint expect lang env_required; do
  should_run "$id" "$live" || continue
  [[ -z "$live" ]] && continue

  if [[ "$type" == "automation" ]]; then
    echo "SKIP: $id (automation — no live smoke)"
    ((SKIPS++)) || true
    continue
  fi

  if [[ "$live" == "aws" ]]; then
    export ISLO_IAM_READY="${ISLO_IAM_READY:-1}"
  fi

  if [[ -n "$env_required" ]]; then
    IFS=',' read -ra vars <<< "$env_required"
    env_ok "${vars[@]}" || { ((SKIPS++)) || true; continue; }
  fi

  if [[ "$lang" != "python" ]]; then
    echo "SKIP: $id (lang=$lang — smoke runner not implemented yet)"
    ((SKIPS++)) || true
    continue
  fi

  if ! run_python_smoke "$id" "$entrypoint" "$expect"; then
    ((FAILURES++)) || true
  fi
done < <(PYTHONPATH=scripts uv run python "$ROOT/scripts/smoke_manifest.py")

if (( FAILURES > 0 )); then
  echo "$FAILURES recipe(s) failed" >&2
  exit 1
fi

echo "Smoke complete (${SKIPS} skipped)"
