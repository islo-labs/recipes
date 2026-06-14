#!/usr/bin/env python3
"""Run FastAPI + Playwright browser E2E tests on an Islo computer."""

from __future__ import annotations

import os
import sys
import time
import uuid
from contextlib import contextmanager

from dotenv import load_dotenv
from islo import GitSource, Islo, SetupScript
from islo.core.api_error import ApiError
from islo.custom.exec import exec_and_wait_sync

load_dotenv()

RECIPE_ID = "playwright"
REPO_URL = os.environ.get("ISLO_RECIPES_REPO_URL", "https://github.com/islo-labs/recipes")
REPO_REF = os.environ.get("ISLO_RECIPES_REF", "main")
RECIPE_PATH = f"/workspace/islo-recipes/recipes/{RECIPE_ID}"
VENV = "/tmp/recipe-venv"

PYTHON_BOOTSTRAP = SetupScript(
    name="python-bootstrap",
    script=(
        "sudo rm -f /etc/apt/sources.list.d/docker.list && "
        "sudo apt-get update -qq && "
        "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "
        "python3 python3-pip python3-venv"
    ),
)

INSTALL_DEPS = SetupScript(
    name="install-deps",
    script=f"""
set -euo pipefail
cd {RECIPE_PATH}
python3 -m venv {VENV}
{VENV}/bin/pip install --quiet -r requirements.txt
{VENV}/bin/python -m playwright install chromium
sudo DEBIAN_FRONTEND=noninteractive {VENV}/bin/python -m playwright install-deps chromium
""",
)


def must_exec(client: Islo, name: str, cmd: str, *, timeout: float = 300) -> None:
    result = exec_and_wait_sync(client, name, ["sh", "-c", cmd], timeout=timeout)
    if result.exit_code != 0:
        raise RuntimeError(
            f"command failed (exit={result.exit_code})\n  cmd: {cmd!r}\n"
            f"  stdout: {result.stdout[-2000:]}\n  stderr: {result.stderr[-2000:]}"
        )


def exec_sh(client: Islo, name: str, cmd: str, *, timeout: float = 15):
    return exec_and_wait_sync(client, name, ["sh", "-c", cmd], timeout=timeout)


_SETUP_DONE = frozenset({"completed", "skipped"})


def wait_for_setup(client: Islo, name: str, *, timeout: float = 900) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        steps = client.sandboxes.get_sandbox(name).setup_steps or []
        if not steps:
            return
        if all(step.status in _SETUP_DONE for step in steps):
            for step in steps:
                if step.status == "failed":
                    raise RuntimeError(
                        f"setup step {step.name!r} failed:\n{step.stderr or step.stdout}"
                    )
            return
        time.sleep(2)
    raise TimeoutError(f"setup did not finish for {name!r}")


@contextmanager
def computer(client: Islo, *, name: str, ready_timeout: float = 300, **kwargs):
    has_setup = bool(kwargs.get("setup_scripts"))
    client.sandboxes.create_sandbox(name=name, **kwargs)
    deadline = time.monotonic() + ready_timeout
    while time.monotonic() < deadline:
        if client.sandboxes.get_sandbox(name).status == "running":
            break
        time.sleep(2)
    else:
        raise TimeoutError(f"computer {name!r} not ready")
    if has_setup:
        wait_for_setup(client, name)
    try:
        yield name
    finally:
        try:
            client.sandboxes.delete_sandbox(name)
        except ApiError:
            pass


def wait_for_server(client: Islo, name: str, *, timeout: float = 60) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if exec_sh(client, name, "curl -sf http://127.0.0.1:8000/health >/dev/null").exit_code == 0:
            return
        time.sleep(2)
    raise TimeoutError("FastAPI server did not become ready")


def main() -> int:
    client = Islo()
    name = f"recipes-playwright-{uuid.uuid4().hex[:8]}"
    sources = [GitSource(repo_url=REPO_URL, target_path="islo-recipes", branch=REPO_REF)]

    with computer(
        client,
        name=name,
        sources=sources,
        setup_scripts=[PYTHON_BOOTSTRAP, INSTALL_DEPS],
        vcpus=2,
        memory_mb=4096,
        disk_gb=15,
    ):
        must_exec(client, name, f"test -d '{RECIPE_PATH}'", timeout=30)
        must_exec(
            client,
            name,
            f"cd {RECIPE_PATH} && nohup {VENV}/bin/python -m uvicorn app.main:app "
            f"--host 127.0.0.1 --port 8000 > /tmp/web-app.log 2>&1 &",
            timeout=30,
        )
        wait_for_server(client, name)
        must_exec(client, name, f"cd {RECIPE_PATH} && {VENV}/bin/python -m pytest e2e/ -v", timeout=300)

    print(f"PASS: {RECIPE_ID}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
