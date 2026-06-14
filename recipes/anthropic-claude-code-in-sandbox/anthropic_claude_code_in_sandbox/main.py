#!/usr/bin/env python3
"""Run Claude Code in an Islo computer (SDK example)."""

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

INSTALL_CLAUDE = "npm install -g @anthropic-ai/claude-code"
PROMPT = "Create a hello world index.html"
CLAUDE_CMD = (
    f"echo {PROMPT!r} | claude -p --dangerously-skip-permissions"
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
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    if not anthropic_key:
        print("Set ANTHROPIC_API_KEY in .env or your shell", file=sys.stderr)
        return 1

    client = Islo()
    name = f"recipes-claude-{uuid.uuid4().hex[:8]}"
    print(f"Creating computer {name!r}…")

    with computer(client, name=name):
        print("Installing Claude Code…")
        must_exec(client, name, INSTALL_CLAUDE, timeout=600)
        print("Running Claude Code…")
        result = exec_and_wait_sync(
            client,
            name,
            ["sh", "-c", CLAUDE_CMD],
            env={"ANTHROPIC_API_KEY": anthropic_key},
            timeout=600,
        )
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        if result.exit_code != 0:
            print(f"Claude Code exited with {result.exit_code}", file=sys.stderr)
            return result.exit_code

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
