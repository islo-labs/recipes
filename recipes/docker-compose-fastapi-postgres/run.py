#!/usr/bin/env python3
"""Run a FastAPI + Postgres Docker Compose stack on an Islo computer."""

from __future__ import annotations

import os
import sys
import time
import uuid
from contextlib import contextmanager

from dotenv import load_dotenv
from islo import GitSource, Islo
from islo.core.api_error import ApiError
from islo.custom.exec import exec_and_wait_sync

load_dotenv()

RECIPE_ID = "docker-compose-fastapi-postgres"
REPO_URL = os.environ.get("ISLO_RECIPES_REPO_URL", "https://github.com/islo-labs/islo-recipes")
REPO_REF = os.environ.get("ISLO_RECIPES_REF", "main")
RECIPE_PATH = f"/workspace/islo-recipes/recipes/{RECIPE_ID}"


def must_exec(client: Islo, name: str, cmd: str, *, timeout: float = 300) -> None:
    result = exec_and_wait_sync(client, name, ["sh", "-c", cmd], timeout=timeout)
    if result.exit_code != 0:
        raise RuntimeError(
            f"command failed (exit={result.exit_code})\n  cmd: {cmd!r}\n"
            f"  stdout: {result.stdout[-2000:]}\n  stderr: {result.stderr[-2000:]}"
        )


@contextmanager
def computer(client: Islo, *, name: str, ready_timeout: float = 300, **kwargs):
    client.sandboxes.create_sandbox(name=name, **kwargs)
    deadline = time.monotonic() + ready_timeout
    while time.monotonic() < deadline:
        if client.sandboxes.get_sandbox(name).status == "running":
            break
        time.sleep(2)
    else:
        raise TimeoutError(f"computer {name!r} not ready")
    try:
        yield name
    finally:
        try:
            client.sandboxes.delete_sandbox(name)
        except ApiError:
            pass


def main() -> int:
    client = Islo()
    name = f"recipes-compose-{uuid.uuid4().hex[:8]}"
    sources = [
        GitSource(repo_url=REPO_URL, target_path="islo-recipes", branch=REPO_REF),
    ]

    with computer(
        client,
        name=name,
        sources=sources,
        vcpus=2,
        memory_mb=4096,
        disk_gb=15,
    ):
        must_exec(client, name, f"test -d '{RECIPE_PATH}'", timeout=30)
        must_exec(client, name, "docker compose version", timeout=30)
        must_exec(client, name, f"cd {RECIPE_PATH} && docker compose up -d --wait", timeout=600)
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
        must_exec(client, name, f"cd {RECIPE_PATH} && docker compose down -v", timeout=120)

    print(f"PASS: {RECIPE_ID}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
