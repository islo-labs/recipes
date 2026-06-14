#!/usr/bin/env python3
"""Run FastAPI + Playwright browser E2E tests on an Islo computer."""

from __future__ import annotations

import sys
import time
import uuid

from islo import SetupScript

from recipekit.computer import (
    PYTHON_BOOTSTRAP_SCRIPT,
    assert_repo_cloned,
    assert_setup_steps,
    client_from_env,
    computer,
    exec_sh,
    git_source,
    must_exec,
    recipe_dir,
)

RECIPE_ID = "web-app-e2e"

# Bookworm marks system Python as externally managed — use a venv for pip deps.
VENV = "/tmp/recipe-venv"

SETUP_DEPS = f"""
set -euo pipefail
cd {recipe_dir(RECIPE_ID)}
python3 -m venv {VENV}
{VENV}/bin/pip install --quiet -r requirements.txt
{VENV}/bin/python -m playwright install chromium
"""


def wait_for_server(client, computer_name: str, *, timeout: float = 60.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = exec_sh(
            client,
            computer_name,
            "curl -sf http://127.0.0.1:8000/health >/dev/null",
            timeout=15,
        )
        if result.exit_code == 0:
            return
        time.sleep(2)
    raise TimeoutError("FastAPI server did not become ready")


def main() -> int:
    client = client_from_env()
    computer_name = f"recipes-e2e-{uuid.uuid4().hex[:8]}"

    with computer(
        client,
        name=computer_name,
        sources=[git_source()],
        setup_scripts=[PYTHON_BOOTSTRAP_SCRIPT, SetupScript(name="install-deps", script=SETUP_DEPS)],
        vcpus=2,
        memory_mb=4096,
        disk_gb=15,
        ready_timeout=300,
    ) as name:
        assert_repo_cloned(client, name, recipe_id=RECIPE_ID)
        assert_setup_steps(client, name, "python-bootstrap", "install-deps")
        recipe_path = recipe_dir(RECIPE_ID)
        must_exec(
            client,
            name,
            f"cd {recipe_path} && nohup {VENV}/bin/python -m uvicorn app.main:app "
            f"--host 127.0.0.1 --port 8000 > /tmp/web-app.log 2>&1 &",
            timeout=30,
        )
        wait_for_server(client, name)
        must_exec(
            client,
            name,
            f"cd {recipe_path} && {VENV}/bin/python -m pytest e2e/ -v",
            timeout=300,
        )

    print(f"PASS: {RECIPE_ID}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
