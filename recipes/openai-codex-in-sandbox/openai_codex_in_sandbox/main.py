#!/usr/bin/env python3
"""Run Codex in an Islo computer (SDK example)."""

from __future__ import annotations

import os
import sys
import time
import uuid
from contextlib import contextmanager

from dotenv import load_dotenv
from islo import Islo, SetupScript
from islo.core.api_error import ApiError
from islo.custom.exec import exec_and_wait_sync

load_dotenv()

INSTALL_CODEX = SetupScript(
    name="install-codex",
    script="npm install -g @openai/codex",
)

PROMPT = "Create a hello world index.html"
CODEX_CMD = (
    "codex exec --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox "
    f"{PROMPT!r}"
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

    with computer(client, name=name, setup_scripts=[INSTALL_CODEX]):
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
