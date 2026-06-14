#!/usr/bin/env python3
"""Validate recipes/catalog.yaml against the filesystem."""

from __future__ import annotations

import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("Install dev deps: uv sync --extra dev", file=sys.stderr)
    raise

ROOT = Path(__file__).resolve().parents[1]
RECIPES = ROOT / "recipes"
CATALOG = RECIPES / "catalog.yaml"
SKIP = {"_template", "catalog.yaml"}
REQUIRED = ("README.md", ".env.example", "run.py")


def main() -> int:
    data = yaml.safe_load(CATALOG.read_text())
    entries = data.get("recipes", [])
    errors: list[str] = []

    catalog_ids = {e["id"] for e in entries}
    disk_ids = {
        p.name
        for p in RECIPES.iterdir()
        if p.is_dir() and p.name not in SKIP
    }

    for missing in sorted(catalog_ids - disk_ids):
        errors.append(f"catalog entry {missing!r} has no recipes/{missing}/ folder")
    for extra in sorted(disk_ids - catalog_ids):
        errors.append(f"recipes/{extra}/ exists but is missing from catalog.yaml")

    for entry in entries:
        rid = entry["id"]
        recipe_dir = RECIPES / rid
        for fname in REQUIRED:
            if not (recipe_dir / fname).is_file():
                errors.append(f"recipes/{rid}/ missing {fname}")
        if entry.get("entrypoint") != "run.py":
            errors.append(f"recipes/{rid}: entrypoint must be run.py")
        if not entry.get("pass_output", "").startswith("PASS:"):
            errors.append(f"recipes/{rid}: pass_output must start with PASS:")

    if errors:
        print("Catalog validation failed:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    print(f"OK: {len(entries)} recipes validated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
