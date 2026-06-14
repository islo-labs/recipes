#!/usr/bin/env python3
"""Restrict computer egress to package registries and verify allow/deny behavior."""

from __future__ import annotations

import sys
import uuid

from recipekit.computer import (
    DEBIAN_APT_GATEWAY_RULES,
    bootstrap_python,
    client_from_env,
    computer,
    exec_sh,
    must_exec,
)

RECIPE_ID = "gateway-allowlist"
PROFILE_NAME = "recipes-deps-only"

ALLOW_RULES = [
    *DEBIAN_APT_GATEWAY_RULES,
    (3, "pypi.org", "allow"),
    (4, "files.pythonhosted.org", "allow"),
    (5, "registry.npmjs.org", "allow"),
    (10, "*", "deny"),
]

# Bookworm marks system Python as externally managed — use a venv for pip demo.
VENV = "/tmp/recipe-venv"


def ensure_gateway_rules(client, profile_id: str, existing_rules) -> None:
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


def ensure_gateway_profile(client):
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
    client = client_from_env()
    profile = ensure_gateway_profile(client)
    computer_name = f"recipes-gw-{uuid.uuid4().hex[:8]}"

    with computer(
        client,
        name=computer_name,
        gateway_profile=profile.name,
        vcpus=2,
        memory_mb=2048,
        ready_timeout=300,
    ) as name:
        bootstrap_python(client, name)
        must_exec(
            client,
            name,
            f"python3 -m venv {VENV} && {VENV}/bin/pip install --quiet httpx",
            timeout=180,
        )
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
