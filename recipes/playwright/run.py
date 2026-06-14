#!/usr/bin/env python3
"""Run FastAPI + Playwright browser E2E tests in Islo."""

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

RECIPE_ID = "playwright"
REPO_URL = os.environ.get("ISLO_RECIPES_REPO_URL", "https://github.com/islo-labs/recipes")
REPO_REF = os.environ.get("ISLO_RECIPES_REF", "main")
RECIPE_PATH = f"/workspace/islo-recipes/recipes/{RECIPE_ID}"
VENV = "/tmp/recipe-venv"
POLL_INTERVAL = 0.5

# One exec: apt + venv + pip + Playwright browser/OS deps (fewer round trips).
SETUP = f"""
set -eu
sudo rm -f /etc/apt/sources.list.d/docker.list
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \\
  python3 python3-pip python3-venv curl
cd {RECIPE_PATH}
python3 -m venv {VENV}
{VENV}/bin/pip install --disable-pip-version-check --no-cache-dir -q -r requirements.txt
{VENV}/bin/python -m playwright install --with-deps chromium
"""


def must_exec(client: Islo, name: str, cmd: str, *, timeout: float = 300) -> None:
    result = exec_and_wait_sync(client, name, ["sh", "-c", cmd], timeout=timeout)
    if result.exit_code != 0:
        raise RuntimeError(
            f"command failed (exit={result.exit_code})\n  cmd: {cmd!r}\n"
            f"  stdout: {result.stdout[-2000:]}\n  stderr: {result.stderr[-2000:]}"
        )


def exec_sh(client: Islo, name: str, cmd: str, *, timeout: float = 10):
    return exec_and_wait_sync(client, name, ["sh", "-c", cmd], timeout=timeout)


@contextmanager
def computer(client: Islo, *, name: str, ready_timeout: float = 300, **kwargs):
    client.sandboxes.create_sandbox(name=name, **kwargs)
    deadline = time.monotonic() + ready_timeout
    while time.monotonic() < deadline:
        if client.sandboxes.get_sandbox(name).status == "running":
            break
        time.sleep(POLL_INTERVAL)
    else:
        raise TimeoutError(f"computer {name!r} not ready")
    try:
        yield name
    finally:
        try:
            client.sandboxes.delete_sandbox(name)
        except ApiError:
            pass


def wait_for_path(client: Islo, name: str, path: str, *, timeout: float = 300) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if exec_sh(client, name, f"test -d '{path}'").exit_code == 0:
            return
        time.sleep(POLL_INTERVAL)
    raise TimeoutError(f"path {path!r} not found after git clone")


def wait_for_server(client: Islo, name: str, *, timeout: float = 60) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if exec_sh(client, name, "curl -sf http://127.0.0.1:8000/health >/dev/null").exit_code == 0:
            return
        time.sleep(POLL_INTERVAL)
    raise TimeoutError("FastAPI server did not become ready")


def main() -> int:
    client = Islo()
    name = f"recipes-playwright-{uuid.uuid4().hex[:8]}"
    sources = [GitSource(repo_url=REPO_URL, target_path="islo-recipes", branch=REPO_REF)]

    print(f"Creating {name!r} in Islo…")
    with computer(
        client,
        name=name,
        sources=sources,
        vcpus=2,
        memory_mb=4096,
        disk_gb=15,
    ):
        print("Waiting for GitSource clone…")
        wait_for_path(client, name, RECIPE_PATH)
        print("Installing deps and Playwright…")
        must_exec(client, name, SETUP, timeout=900)
        print("Starting FastAPI…")
        must_exec(
            client,
            name,
            f"cd {RECIPE_PATH} && nohup {VENV}/bin/python -m uvicorn app.main:app "
            f"--host 127.0.0.1 --port 8000 > /tmp/web-app.log 2>&1 &",
            timeout=30,
        )
        wait_for_server(client, name)
        print("Running Playwright tests…")
        must_exec(client, name, f"cd {RECIPE_PATH} && {VENV}/bin/python -m pytest e2e/ -q", timeout=300)

    print(f"PASS: {RECIPE_ID}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
