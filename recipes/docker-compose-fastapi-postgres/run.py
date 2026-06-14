#!/usr/bin/env python3
"""Run a FastAPI + Postgres Docker Compose stack on an Islo computer."""

from __future__ import annotations

import sys
import uuid

from recipekit.computer import (
    assert_repo_cloned,
    client_from_env,
    computer,
    git_source,
    must_exec,
    recipe_dir,
)

RECIPE_ID = "docker-compose-fastapi-postgres"


def main() -> int:
    client = client_from_env()
    computer_name = f"recipes-compose-{uuid.uuid4().hex[:8]}"

    with computer(
        client,
        name=computer_name,
        sources=[git_source()],
        vcpus=2,
        memory_mb=4096,
        disk_gb=15,
        ready_timeout=300,
    ) as name:
        assert_repo_cloned(client, name, recipe_id=RECIPE_ID)
        recipe_path = recipe_dir(RECIPE_ID)
        must_exec(client, name, "docker compose version", timeout=30)
        must_exec(
            client,
            name,
            f"cd {recipe_path} && docker compose up -d --wait",
            timeout=600,
        )
        must_exec(
            client,
            name,
            "curl -sf http://127.0.0.1:8000/health | grep -q '\"status\":\"ok\"'",
            timeout=30,
        )
        must_exec(
            client,
            name,
            "curl -sf http://127.0.0.1:8000/items | grep -q seed-item",
            timeout=30,
        )
        must_exec(client, name, f"cd {recipe_path} && docker compose down -v", timeout=120)

    print(f"PASS: {RECIPE_ID}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
