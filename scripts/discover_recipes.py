#!/usr/bin/env python3
"""Discover recipes from recipes/ folder conventions — no central manifest."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RECIPES_DIR = ROOT / "recipes"

TYPE_FILES: dict[str, tuple[str, ...]] = {
    "sdk": ("README.md", ".env.example", "pyproject.toml", "uv.lock"),
    "agent": ("README.md", ".env.example", "pyproject.toml", "uv.lock"),
    "automation": ("README.md", ".env.example"),
}

TYPE_README: dict[str, tuple[str, ...]] = {
    "sdk": ("## Goal", "## Quick start", "## Verify success"),
    "agent": ("## How to run in Islo", "## How to run example"),
    "automation": ("## Quick start",),
}

SKIP_ENV = frozenset({"ISLO_API_KEY", "ISLO_BASE_URL", "ISLO_RECIPES_REPO_URL", "ISLO_RECIPES_REF"})


@dataclass(frozen=True)
class Recipe:
    id: str
    type: str
    lang: str
    entrypoint: str
    live: str
    expect: str
    env_required: tuple[str, ...]


def _detect_lang(directory: Path) -> str | None:
    if (directory / "pyproject.toml").is_file():
        return "python"
    if (directory / "go.mod").is_file():
        return "go"
    if (directory / "package.json").is_file():
        return "typescript"
    return None


def _find_agent_entrypoint(directory: Path) -> str | None:
    matches = sorted(p for p in directory.glob("*/main.py") if p.is_file())
    if len(matches) == 1:
        return str(matches[0].relative_to(directory))
    return None


def _detect_type(directory: Path) -> tuple[str, str, str] | None:
    """Return (type, lang, entrypoint) or None if not a recipe."""
    if not (directory / "README.md").is_file():
        return None

    if (directory / "run.py").is_file():
        lang = _detect_lang(directory) or "python"
        entrypoint = "run.py" if lang == "python" else "main.go" if lang == "go" else "src/index.ts"
        return "sdk", lang, entrypoint

    workflows = sorted(directory.glob("examples/*.yml")) + sorted(directory.glob("examples/*.yaml"))
    if workflows and not (directory / "run.py").is_file():
        return "automation", "yaml", ""

    entrypoint = _find_agent_entrypoint(directory)
    if entrypoint:
        lang = _detect_lang(directory) or "python"
        return "agent", lang, entrypoint

    return None


def _live_tier(recipe_type: str, recipe_id: str) -> str:
    if recipe_type == "automation":
        return ""
    if recipe_type == "agent":
        return "agent"
    if recipe_id == "mount-s3":
        return "aws"
    return "smoke"


def _expect_output(recipe_type: str, recipe_id: str) -> str:
    if recipe_type == "sdk":
        return f"PASS: {recipe_id}"
    if recipe_type == "agent":
        return "Done."
    return ""


def _env_required(directory: Path) -> tuple[str, ...]:
    env_file = directory / ".env.example"
    if not env_file.is_file():
        return ()
    required: list[str] = []
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        match = re.match(r"^([A-Z][A-Z0-9_]*)=", line)
        if match and match.group(1) not in SKIP_ENV:
            required.append(match.group(1))
    return tuple(required)


def discover_recipes() -> list[Recipe]:
    recipes: list[Recipe] = []
    for path in sorted(RECIPES_DIR.iterdir()):
        if not path.is_dir() or path.name.startswith("."):
            continue
        detected = _detect_type(path)
        if detected is None:
            continue
        recipe_type, lang, entrypoint = detected
        recipe_id = path.name
        recipes.append(
            Recipe(
                id=recipe_id,
                type=recipe_type,
                lang=lang,
                entrypoint=entrypoint,
                live=_live_tier(recipe_type, recipe_id),
                expect=_expect_output(recipe_type, recipe_id),
                env_required=_env_required(path),
            )
        )
    return recipes


def required_files(recipe_type: str) -> tuple[str, ...]:
    return TYPE_FILES[recipe_type]


def readme_sections(recipe_type: str) -> tuple[str, ...]:
    return TYPE_README[recipe_type]
