#!/usr/bin/env python3
"""Create an Islo computer and run a Claude Agent SDK script inside it."""

from __future__ import annotations

import base64
import os
import sys
import time
import uuid
from contextlib import contextmanager
from pathlib import Path

from dotenv import load_dotenv
from islo import Islo, SetupScript
from islo.core.api_error import ApiError
from islo.custom.exec import exec_and_wait_sync

load_dotenv()

PACKAGE_DIR = Path(__file__).resolve().parent
AGENT_SCRIPT = PACKAGE_DIR / "agent.py"
VENV = "/tmp/agent-venv"
REMOTE_AGENT = "/tmp/claude_agent.py"

INSTALL_AGENT_SDK = SetupScript(
    name="install-claude-agent-sdk",
    script=(
        "python3 -m venv /tmp/agent-venv && "
        "/tmp/agent-venv/bin/pip install -q claude-agent-sdk"
    ),
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


def upload_agent_script(client: Islo, name: str) -> None:
    encoded = base64.b64encode(AGENT_SCRIPT.read_bytes()).decode()
    cmd = f"echo {encoded} | base64 -d > {REMOTE_AGENT}"
    result = exec_and_wait_sync(client, name, ["sh", "-c", cmd], timeout=60)
    if result.exit_code != 0:
        raise RuntimeError(f"failed to upload agent script: {result.stderr}")


def main() -> int:
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    if not anthropic_key:
        print("Set ANTHROPIC_API_KEY in .env or your shell", file=sys.stderr)
        return 1

    client = Islo()
    sandbox_name = f"recipes-agent-sdk-{uuid.uuid4().hex[:8]}"
    print(f"Creating computer {sandbox_name!r}…")

    with computer(client, name=sandbox_name, setup_scripts=[INSTALL_AGENT_SDK]):
        upload_agent_script(client, sandbox_name)
        print("Running Claude Agent SDK…")
        result = exec_and_wait_sync(
            client,
            sandbox_name,
            ["sh", "-c", f"{VENV}/bin/python {REMOTE_AGENT}"],
            env={"ANTHROPIC_API_KEY": anthropic_key},
            timeout=900,
        )
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        if result.exit_code != 0:
            print(f"Agent SDK exited with {result.exit_code}", file=sys.stderr)
            return result.exit_code

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
