#!/usr/bin/env python3
"""Run Codex in an Islo computer (SDK example)."""

from __future__ import annotations

import os
import shlex
import sys
import time
import uuid
from contextlib import contextmanager

from dotenv import load_dotenv
from islo import Islo
from islo.core.api_error import ApiError
from islo.custom.exec import exec_and_wait_sync

load_dotenv()

AGENT_USER = "agent"
ENV_FILE = "/tmp/agent-env"
POLL_INTERVAL = 0.5
PROMPT = "Create a hello world index.html"

AGENT_SETUP = """
set -eu
sudo rm -f /etc/apt/sources.list.d/docker.list
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends nodejs npm
id -u agent >/dev/null 2>&1 || useradd -m -s /bin/bash agent
npm install -g --no-fund --no-audit --loglevel=error @openai/codex
"""

CODEX_CMD = (
    "cd ~ && codex exec --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox "
    f"{PROMPT!r}"
)


def write_agent_env(client: Islo, name: str, variables: dict[str, str]) -> None:
    lines = "\n".join(f"export {key}={shlex.quote(val)}" for key, val in variables.items())
    must_exec(
        client,
        name,
        f"cat > {ENV_FILE} <<'AGENT_ENV_EOF'\n{lines}\nAGENT_ENV_EOF\n"
        f"chmod 600 {ENV_FILE} && chown {AGENT_USER}:{AGENT_USER} {ENV_FILE}",
        timeout=30,
    )


def run_as_agent(cmd: str) -> str:
    inner = f". {ENV_FILE} && {cmd}"
    return f"sudo -u {AGENT_USER} -H sh -c {shlex.quote(inner)}"


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


def main() -> int:
    openai_key = os.environ.get("OPENAI_API_KEY")
    if not openai_key:
        print("Set OPENAI_API_KEY in .env or your shell", file=sys.stderr)
        return 1

    client = Islo()
    name = f"recipes-codex-{uuid.uuid4().hex[:8]}"
    print(f"Creating computer {name!r}…")

    with computer(client, name=name):
        print("Installing Node.js and Codex…")
        must_exec(client, name, AGENT_SETUP, timeout=600)
        print("Running Codex…")
        # codex exec reads CODEX_API_KEY, not OPENAI_API_KEY (see OpenAI Codex docs).
        write_agent_env(client, name, {"CODEX_API_KEY": openai_key})
        result = exec_and_wait_sync(
            client,
            name,
            ["sh", "-c", run_as_agent(CODEX_CMD)],
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
