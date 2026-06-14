#!/usr/bin/env python3
"""Print tab-separated smoke rows for scripts/smoke.sh."""

from __future__ import annotations

from discover_recipes import discover_recipes

for recipe in discover_recipes():
    env_required = ",".join(recipe.env_required)
    print(
        f"{recipe.id}\t{recipe.type}\t{recipe.live}\t{recipe.entrypoint}\t"
        f"{recipe.expect}\t{recipe.lang}\t{env_required}"
    )
