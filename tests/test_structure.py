"""Static structure checks for every recipe — no Islo API calls."""

from __future__ import annotations

import ast
import subprocess
from pathlib import Path

import pytest
import yaml

from conftest import load_manifest, recipe_dir

SDK_FILES = ("README.md", ".env.example", "run.py", "pyproject.toml", "uv.lock")
AGENT_FILES = ("README.md", ".env.example", "pyproject.toml", "uv.lock")
AUTOMATION_FILES = ("README.md", ".env.example")

SDK_README_SECTIONS = ("## Goal", "## Quick start", "## Verify success")
AGENT_README_SECTIONS = ("## How to create", "## How to run example")
AUTOMATION_README_SECTIONS = ("## Quick start",)

MANIFEST = load_manifest()


def test_manifest_matches_disk(manifest: list[dict], disk_recipe_ids: set[str]) -> None:
    manifest_ids = {entry["id"] for entry in manifest}
    assert manifest_ids == disk_recipe_ids, (
        f"manifest/disk mismatch: "
        f"only in manifest={sorted(manifest_ids - disk_recipe_ids)}, "
        f"only on disk={sorted(disk_recipe_ids - manifest_ids)}"
    )


@pytest.mark.parametrize("entry", MANIFEST, ids=lambda e: e["id"])
def test_required_files(entry: dict) -> None:
    recipe_id = entry["id"]
    directory = recipe_dir(recipe_id)
    recipe_type = entry["type"]

    if recipe_type == "sdk":
        required = SDK_FILES
    elif recipe_type == "agent":
        required = AGENT_FILES
    elif recipe_type == "automation":
        required = AUTOMATION_FILES
    else:
        pytest.fail(f"unknown recipe type: {recipe_type}")

    for filename in required:
        assert (directory / filename).is_file(), f"recipes/{recipe_id}/ missing {filename}"

    if recipe_type == "sdk":
        assert entry.get("entrypoint") == "run.py"
        assert (directory / "run.py").is_file()
    elif recipe_type == "agent":
        entrypoint = entry["entrypoint"]
        assert (directory / entrypoint).is_file(), f"recipes/{recipe_id}/ missing {entrypoint}"


@pytest.mark.parametrize("entry", MANIFEST, ids=lambda e: e["id"])
def test_readme_sections(entry: dict) -> None:
    readme = (recipe_dir(entry["id"]) / "README.md").read_text()
    sections = {
        "sdk": SDK_README_SECTIONS,
        "agent": AGENT_README_SECTIONS,
        "automation": AUTOMATION_README_SECTIONS,
    }[entry["type"]]
    for section in sections:
        assert section in readme, f"recipes/{entry['id']}/README.md missing {section}"


@pytest.mark.parametrize("entry", MANIFEST, ids=lambda e: e["id"])
def test_python_syntax(entry: dict) -> None:
    directory = recipe_dir(entry["id"])
    if entry["type"] == "automation":
        pytest.skip("no Python entrypoint")
    paths: list[Path] = []
    if entry["type"] == "sdk":
        paths.append(directory / "run.py")
    else:
        paths.append(directory / entry["entrypoint"])
        agent_py = directory / Path(entry["entrypoint"]).parent / "agent.py"
        if agent_py.is_file():
            paths.append(agent_py)
    for path in paths:
        ast.parse(path.read_text(), filename=str(path))


@pytest.mark.parametrize(
    "entry",
    [e for e in MANIFEST if e["type"] in ("sdk", "agent")],
    ids=lambda e: e["id"],
)
def test_uv_sync(entry: dict) -> None:
    directory = recipe_dir(entry["id"])
    result = subprocess.run(
        ["uv", "sync"],
        cwd=directory,
        capture_output=True,
        text=True,
        timeout=180,
    )
    assert result.returncode == 0, f"uv sync failed for {entry['id']}:\n{result.stderr}"


@pytest.mark.parametrize(
    "entry",
    [e for e in MANIFEST if e["type"] == "automation"],
    ids=lambda e: e["id"],
)
def test_workflow_examples_parse(entry: dict) -> None:
    directory = recipe_dir(entry["id"])
    for rel_path in entry["workflow_examples"]:
        path = directory / rel_path
        assert path.is_file(), f"missing {rel_path}"
        yaml.safe_load(path.read_text())
    review_path = directory / entry["review_example"]
    assert review_path.is_file(), f"missing {entry['review_example']}"
