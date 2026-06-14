#!/usr/bin/env python3
"""Restrict computer egress to package registries and verify allow/deny behavior."""

from __future__ import annotations

import sys
import time
import uuid
from contextlib import contextmanager

from dotenv import load_dotenv
from islo import Islo
from islo.core.api_error import ApiError
from islo.custom.exec import exec_and_wait_sync

load_dotenv()

RECIPE_ID = "gateway-allowlist"
PROFILE_NAME = "recipes-deps-only"
VENV = "/tmp/recipe-venv"
POLL_INTERVAL = 0.5

ALLOW_RULES = [
    (1, "*.debian.org", "allow"),
    (3, "pypi.org", "allow"),
    (4, "files.pythonhosted.org", "allow"),
    (5, "registry.npmjs.org", "allow"),
    (10, "*", "deny"),
]

SETUP = f"""
set -eu
sudo rm -f /etc/apt/sources.list.d/docker.list
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \\
  python3 python3-pip python3-venv
python3 -m venv {VENV}
{VENV}/bin/pip install --disable-pip-version-check --no-cache-dir -q httpx
"""


def must_exec(client: Islo, name: str, cmd: str, *, timeout: float = 300) -> None:
    result = exec_and_wait_sync(client, name, ["sh", "-c", cmd], timeout=timeout)
    if result.exit_code != 0:
        raise RuntimeError(
            f"command failed (exit={result.exit_code})\n  cmd: {cmd!r}\n"
            f"  stdout: {result.stdout[-2000:]}\n  stderr: {result.stderr[-2000:]}"
        )


def exec_sh(client: Islo, name: str, cmd: str, *, timeout: float = 300):
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


def ensure_gateway_rules(client: Islo, profile_id: str, existing_rules) -> None:
    existing_hosts = {r.host_pattern for r in (existing_rules or [])}
    for priority, host_pattern, action in ALLOW_RULES:
        if host_pattern in existing_hosts:
            continue
        client.gateway_profiles.create_gateway_rule(
            profile_id,
            host_pattern=host_pattern,
            priority=priority,
            action=action,
        )
        print(f"  rule priority={priority} host={host_pattern!r} action={action}")


def ensure_gateway_profile(client: Islo):
    existing = next(
        (p for p in client.gateway_profiles.list_gateway_profiles() if p.name == PROFILE_NAME),
        None,
    )
    if existing:
        print(f"Reusing gateway profile name={existing.name} id={existing.id}")
        detail = client.gateway_profiles.get_gateway_profile(existing.id)
        ensure_gateway_rules(client, existing.id, detail.rules)
        return existing

    created = client.gateway_profiles.create_gateway_profile(
        name=PROFILE_NAME,
        description="islo-recipes: allow apt + PyPI/npm only",
        internet_enabled=True,
        default_action="deny",
    )
    print(f"Created gateway profile name={created.name} id={created.id}")
    ensure_gateway_rules(client, created.id, [])
    return created


def main() -> int:
    client = Islo()
    profile = ensure_gateway_profile(client)
    name = f"recipes-gw-{uuid.uuid4().hex[:8]}"

    with computer(client, name=name, gateway_profile=profile.name, vcpus=2, memory_mb=2048):
        must_exec(client, name, SETUP, timeout=300)
        must_exec(client, name, f'{VENV}/bin/python -c "import httpx; print(\'ok\')"', timeout=30)

        blocked = exec_sh(
            client,
            name,
            "curl -sf --max-time 10 https://example.com >/dev/null",
            timeout=30,
        )
        if blocked.exit_code == 0:
            raise RuntimeError("expected curl to example.com to be blocked by gateway")
        print("Blocked curl to example.com as expected")

    print(f"PASS: {RECIPE_ID}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
