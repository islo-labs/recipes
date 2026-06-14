#!/usr/bin/env python3
"""Run a FastAPI + Postgres Docker Compose stack on an Islo computer."""

from __future__ import annotations

import sys
import uuid

from islo_recipes.computer import client_from_env, computer, git_source, must_exec

RECIPE_ID = "docker-compose-fastapi-postgres"
RECIPE_DIR = "/workspace/islo-recipes/recipes/docker-compose-fastapi-postgres"

INSTALL_COMPOSE = """
set -euo pipefail
if docker compose version >/dev/null 2>&1; then
  exit 0
fi
COMPOSE_VERSION="${COMPOSE_VERSION:-v2.34.0}"
mkdir -p "$HOME/.docker/cli-plugins"
arch=$(uname -m)
curl -fsSL \
  "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-${arch}" \
  -o "$HOME/.docker/cli-plugins/docker-compose"
chmod +x "$HOME/.docker/cli-plugins/docker-compose"
docker compose version
"""


def main() -> int:
    client = client_from_env()
    computer_name = f"recipes-compose-{uuid.uuid4().hex[:8]}"

    with computer(
        client,
        name=computer_name,
        sources=[git_source()],
        init_capabilities=["docker"],
        vcpus=2,
        memory_mb=4096,
        disk_gb=15,
        ready_timeout=300,
    ) as name:
        must_exec(client, name, INSTALL_COMPOSE, timeout=120)
        must_exec(
            client,
            name,
            f"cd {RECIPE_DIR} && docker compose up -d --wait",
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
        must_exec(client, name, f"cd {RECIPE_DIR} && docker compose down -v", timeout=120)

    print(f"PASS: {RECIPE_ID}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
