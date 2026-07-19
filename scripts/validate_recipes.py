#!/usr/bin/env python3
"""Validate recipe folders — conventions only, no central manifest."""

from __future__ import annotations

import ast
import subprocess
import sys
from pathlib import Path

import yaml

from discover_recipes import RECIPES_DIR, discover_recipes, readme_sections, required_files

ROOT = Path(__file__).resolve().parent.parent


def err(msg: str) -> None:
    print(f"  - {msg}", file=sys.stderr)


def validate_recipe(recipe) -> list[str]:
    errors: list[str] = []
    directory = RECIPES_DIR / recipe.id

    for filename in required_files(recipe.type):
        if not (directory / filename).is_file():
            errors.append(f"recipes/{recipe.id}/ missing {filename}")

    readme = directory / "README.md"
    if readme.is_file():
        text = readme.read_text()
        for section in readme_sections(recipe.type):
            if section not in text:
                errors.append(f"recipes/{recipe.id}/README.md missing {section}")

    if recipe.type == "sdk":
        if recipe.lang == "python" and not (directory / "run.py").is_file():
            errors.append(f"recipes/{recipe.id}/ missing run.py")
        elif recipe.lang == "go" and not (directory / "go.mod").is_file():
            errors.append(f"recipes/{recipe.id}/ missing go.mod")
        elif recipe.lang == "typescript" and not (directory / "package.json").is_file():
            errors.append(f"recipes/{recipe.id}/ missing package.json")

    elif recipe.type == "agent":
        if not (directory / recipe.entrypoint).is_file():
            errors.append(f"recipes/{recipe.id}/ missing entrypoint {recipe.entrypoint}")

    elif recipe.type == "automation":
        workflows = sorted(directory.glob("examples/*.yml")) + sorted(
            directory.glob("examples/*.yaml")
        )
        if not workflows:
            errors.append(f"recipes/{recipe.id}/ missing examples/*.yml")
        for wf in workflows:
            yaml.safe_load(wf.read_text())

    elif recipe.type == "app":
        if not (directory / "app" / "page.tsx").is_file():
            errors.append(f"recipes/{recipe.id}/ missing app/page.tsx")

    if recipe.lang == "python" and recipe.type in ("sdk", "agent"):
        py_files: list[Path] = []
        if recipe.type == "sdk":
            py_files.append(directory / "run.py")
        else:
            ep = directory / recipe.entrypoint
            py_files.append(ep)
            agent_py = ep.parent / "agent.py"
            if agent_py.is_file():
                py_files.append(agent_py)
        for path in py_files:
            if not path.is_file():
                continue
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
                errors.append(f"recipes/{recipe.id}: uv sync failed:\n{result.stderr.strip()}")

    return errors


def main() -> int:
    recipes = discover_recipes()
    if not recipes:
        print("No recipes found under recipes/", file=sys.stderr)
        return 1

    errors: list[str] = []
    for recipe in recipes:
        errors.extend(validate_recipe(recipe))

    if errors:
        print("Recipe validation failed:", file=sys.stderr)
        for msg in errors:
            err(msg)
        return 1

    print(f"OK: {len(recipes)} recipes validated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
