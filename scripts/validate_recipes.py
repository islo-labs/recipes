#!/usr/bin/env python3
"""Validate recipe structure from recipes.yaml — no pytest, language-aware."""

from __future__ import annotations

import ast
import subprocess
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("Install dev deps: uv sync --extra dev", file=sys.stderr)
    raise

ROOT = Path(__file__).resolve().parent.parent
RECIPES_DIR = ROOT / "recipes"
MANIFEST = ROOT / "recipes.yaml"

TYPE_FILES: dict[str, tuple[str, ...]] = {
    "sdk": ("README.md", ".env.example", "pyproject.toml", "uv.lock"),
    "agent": ("README.md", ".env.example", "pyproject.toml", "uv.lock"),
    "automation": ("README.md", ".env.example"),
}

TYPE_README: dict[str, tuple[str, ...]] = {
    "sdk": ("## Goal", "## Quick start", "## Verify success"),
    "agent": ("## How to create", "## How to run example"),
    "automation": ("## Quick start",),
}

SDK_ENTRYPOINTS: dict[str, str] = {
    "python": "run.py",
    "go": "main.go",
    "typescript": "src/index.ts",
}


def load_manifest() -> list[dict]:
    data = yaml.safe_load(MANIFEST.read_text())
    return data["recipes"]


def err(msg: str) -> None:
    print(f"  - {msg}", file=sys.stderr)


def validate_manifest_disk(entries: list[dict]) -> list[str]:
    errors: list[str] = []
    manifest_ids = {e["id"] for e in entries}
    disk_ids = {p.name for p in RECIPES_DIR.iterdir() if p.is_dir()}
    for missing in sorted(manifest_ids - disk_ids):
        errors.append(f"recipes.yaml entry {missing!r} has no recipes/{missing}/ folder")
    for extra in sorted(disk_ids - manifest_ids):
        errors.append(f"recipes/{extra}/ exists but is missing from recipes.yaml")
    return errors


def validate_entry(entry: dict) -> list[str]:
    errors: list[str] = []
    recipe_id = entry["id"]
    recipe_type = entry["type"]
    directory = RECIPES_DIR / recipe_id
    lang = entry.get("lang", "python")

    if recipe_type not in TYPE_FILES:
        return [f"recipes/{recipe_id}: unknown type {recipe_type!r}"]

    for filename in TYPE_FILES[recipe_type]:
        if not (directory / filename).is_file():
            errors.append(f"recipes/{recipe_id}/ missing {filename}")

    readme = directory / "README.md"
    if readme.is_file():
        text = readme.read_text()
        for section in TYPE_README[recipe_type]:
            if section not in text:
                errors.append(f"recipes/{recipe_id}/README.md missing {section}")

    if recipe_type == "sdk":
        expected = SDK_ENTRYPOINTS.get(lang, entry.get("entrypoint"))
        entrypoint = entry.get("entrypoint", expected)
        if lang == "python" and entrypoint != "run.py":
            errors.append(f"recipes/{recipe_id}: python SDK entrypoint must be run.py")
        if not (directory / entrypoint).is_file():
            errors.append(f"recipes/{recipe_id}/ missing entrypoint {entrypoint}")

    elif recipe_type == "agent":
        entrypoint = entry["entrypoint"]
        if not (directory / entrypoint).is_file():
            errors.append(f"recipes/{recipe_id}/ missing entrypoint {entrypoint}")

    elif recipe_type == "automation":
        for rel in entry.get("workflow_examples", []):
            if not (directory / rel).is_file():
                errors.append(f"recipes/{recipe_id}/ missing {rel}")
            else:
                yaml.safe_load((directory / rel).read_text())
        review = entry.get("review_example")
        if review and not (directory / review).is_file():
            errors.append(f"recipes/{recipe_id}/ missing {review}")

    if lang == "python" and recipe_type in ("sdk", "agent"):
        py_files = []
        if recipe_type == "sdk":
            py_files.append(directory / entry.get("entrypoint", "run.py"))
        else:
            ep = directory / entry["entrypoint"]
            py_files.append(ep)
            agent_py = ep.parent / "agent.py"
            if agent_py.is_file():
                py_files.append(agent_py)
        for path in py_files:
            try:
                ast.parse(path.read_text(), filename=str(path))
            except SyntaxError as exc:
                errors.append(f"{path}: syntax error: {exc}")

        if (directory / "pyproject.toml").is_file():
            result = subprocess.run(
                ["uv", "sync"],
                cwd=directory,
                capture_output=True,
                text=True,
                timeout=180,
            )
            if result.returncode != 0:
                errors.append(f"recipes/{recipe_id}: uv sync failed:\n{result.stderr.strip()}")

    return errors


def main() -> int:
    if not MANIFEST.is_file():
        print(f"Missing {MANIFEST}", file=sys.stderr)
        return 1

    entries = load_manifest()
    errors = validate_manifest_disk(entries)
    for entry in entries:
        errors.extend(validate_entry(entry))

    if errors:
        print("Recipe validation failed:", file=sys.stderr)
        for msg in errors:
            err(msg)
        return 1

    print(f"OK: {len(entries)} recipes validated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
