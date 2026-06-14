#!/usr/bin/env python3
"""Run Codex in an Islo computer (SDK example)."""

from __future__ import annotations

import os
import sys
import time
import uuid
from contextlib import contextmanager

from dotenv import load_dotenv
from islo import Islo
from islo.core.api_error import ApiError
from islo.custom.exec import exec_and_wait_sync

load_dotenv()

NODE_BOOTSTRAP = (
    "sudo rm -f /etc/apt/sources.list.d/docker.list && "
    "sudo apt-get update -qq && "
    "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "
    "nodejs npm"
)
INSTALL_CODEX = "npm install -g @openai/codex"
PROMPT = "Create a hello world index.html"
CODEX_CMD = (
    "codex exec --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox "
    f"{PROMPT!r}"
)


def must_exec(client: Islo, name: str, cmd: str, *, timeout: float = 600) -> None:
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
    openai_key = os.environ.get("OPENAI_API_KEY")
    if not openai_key:
        print("Set OPENAI_API_KEY in .env or your shell", file=sys.stderr)
        return 1

    client = Islo()
    name = f"recipes-codex-{uuid.uuid4().hex[:8]}"
    print(f"Creating computer {name!r}…")

    with computer(client, name=name):
        print("Installing Node.js…")
        must_exec(client, name, NODE_BOOTSTRAP, timeout=600)
        print("Installing Codex…")
        must_exec(client, name, INSTALL_CODEX, timeout=600)
        print("Running Codex…")
        result = exec_and_wait_sync(
            client,
            name,
            ["sh", "-c", CODEX_CMD],
            env={"OPENAI_API_KEY": openai_key},
            timeout=600,
        )
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        if result.exit_code != 0:
            print(f"Codex exited with {result.exit_code}", file=sys.stderr)
            return result.exit_code

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
