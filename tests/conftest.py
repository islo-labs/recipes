"""Shared fixtures for recipe tests."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parent.parent
RECIPES_DIR = ROOT / "recipes"
MANIFEST = Path(__file__).resolve().parent / "recipes.yaml"


def load_manifest() -> list[dict]:
    data = yaml.safe_load(MANIFEST.read_text())
    return data["recipes"]


def recipe_dir(recipe_id: str) -> Path:
    return RECIPES_DIR / recipe_id


@pytest.fixture(scope="session")
def manifest() -> list[dict]:
    return load_manifest()


@pytest.fixture(scope="session")
def manifest_by_id(manifest: list[dict]) -> dict[str, dict]:
    return {entry["id"]: entry for entry in manifest}


@pytest.fixture(scope="session")
def disk_recipe_ids() -> set[str]:
    return {path.name for path in RECIPES_DIR.iterdir() if path.is_dir()}
