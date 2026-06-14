"""Live smoke tests — require Islo API key and optional provider/AWS secrets."""

from __future__ import annotations

import os
import subprocess

import pytest

from conftest import load_manifest, recipe_dir

HAS_ISLO = bool(os.environ.get("ISLO_API_KEY"))


def _missing_env(vars: list[str]) -> list[str]:
    return [name for name in vars if not os.environ.get(name)]


def _run_recipe(recipe_id: str, entrypoint: str, *, timeout: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["uv", "run", "python", entrypoint],
        cwd=recipe_dir(recipe_id),
        capture_output=True,
        text=True,
        timeout=timeout,
        env=os.environ.copy(),
    )


@pytest.mark.live
@pytest.mark.parametrize(
    "entry",
    [e for e in load_manifest() if e.get("live") == "smoke"],
    ids=lambda e: e["id"],
)
def test_sdk_smoke(entry: dict) -> None:
    if not HAS_ISLO:
        pytest.skip("ISLO_API_KEY not set")
    recipe_id = entry["id"]
    result = _run_recipe(recipe_id, entry["entrypoint"], timeout=3600)
    output = result.stdout + result.stderr
    assert result.returncode == 0, f"{recipe_id} failed (exit {result.returncode}):\n{output}"
    assert entry["pass_output"] in output, f"{recipe_id} missing {entry['pass_output']!r}"


@pytest.mark.live
@pytest.mark.live_aws
@pytest.mark.parametrize(
    "entry",
    [e for e in load_manifest() if e.get("live") == "aws"],
    ids=lambda e: e["id"],
)
def test_aws_smoke(entry: dict) -> None:
    if not HAS_ISLO:
        pytest.skip("ISLO_API_KEY not set")
    missing = _missing_env(["AWS_ROLE_ARN", "S3_BUCKET"])
    if missing:
        pytest.skip(f"missing env: {', '.join(missing)}")
    os.environ.setdefault("ISLO_IAM_READY", "1")
    recipe_id = entry["id"]
    result = _run_recipe(recipe_id, entry["entrypoint"], timeout=3600)
    output = result.stdout + result.stderr
    assert result.returncode == 0, f"{recipe_id} failed:\n{output}"
    assert entry["pass_output"] in output


@pytest.mark.live
@pytest.mark.live_agent
@pytest.mark.parametrize(
    "entry",
    [e for e in load_manifest() if e.get("live") == "agent"],
    ids=lambda e: e["id"],
)
def test_agent_smoke(entry: dict) -> None:
    if not HAS_ISLO:
        pytest.skip("ISLO_API_KEY not set")
    missing = _missing_env(entry.get("env_required", []))
    if missing:
        pytest.skip(f"missing env: {', '.join(missing)}")
    recipe_id = entry["id"]
    result = _run_recipe(recipe_id, entry["entrypoint"], timeout=3600)
    output = result.stdout + result.stderr
    assert result.returncode == 0, f"{recipe_id} failed:\n{output}"
    assert entry["success_pattern"] in output
