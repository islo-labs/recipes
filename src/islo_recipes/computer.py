"""Helpers for driving Islo computers from recipe orchestrators."""

from __future__ import annotations

import os
import time
from contextlib import contextmanager
from typing import Iterator

from dotenv import load_dotenv
from islo import GitSource, Islo, SetupScript
from islo.core.api_error import ApiError
from islo.custom.exec import ExecResult, exec_and_wait_sync

_READY_STATUSES = frozenset({"running"})
DEFAULT_REPO_URL = "https://github.com/islo-labs/islo-recipes"

# islo-runner ships a Docker apt source; disable it so apt update only hits Debian
# mirrors allowed by the gateway profile.
PYTHON_BOOTSTRAP_CMD = (
    "sudo rm -f /etc/apt/sources.list.d/docker.list && "
    "sudo apt-get update -qq && "
    "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "
    "python3 python3-pip python3-venv"
)

PYTHON_BOOTSTRAP_SCRIPT = SetupScript(
    name="python-bootstrap",
    script=PYTHON_BOOTSTRAP_CMD,
)

# Apt CDN redirects (e.g. cdn-fastly.deb.debian.org) require a wildcard.
DEBIAN_APT_GATEWAY_RULES: list[tuple[int, str, str]] = [
    (1, "*.debian.org", "allow"),
]


def load_recipe_env() -> None:
    load_dotenv()


def client_from_env() -> Islo:
    load_recipe_env()
    return Islo()


def recipes_repo_url() -> str:
    return os.environ.get("ISLO_RECIPES_REPO_URL", DEFAULT_REPO_URL)


def recipes_ref() -> str | None:
    return os.environ.get("ISLO_RECIPES_REF") or None


def git_source(*, target_path: str = "islo-recipes") -> GitSource:
    kwargs: dict[str, str] = {"repo_url": recipes_repo_url(), "target_path": target_path}
    ref = recipes_ref()
    if ref:
        kwargs["branch"] = ref
    return GitSource(**kwargs)


def wait_ready(client: Islo, computer_name: str, *, timeout: float = 180.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        resp = client.sandboxes.get_sandbox(computer_name)
        if resp.status in _READY_STATUSES:
            return
        time.sleep(2.0)
    raise TimeoutError(f"computer {computer_name!r} not ready after {timeout}s")


def exec_sh(
    client: Islo,
    computer_name: str,
    cmd: str,
    *,
    timeout: float = 300.0,
    workdir: str | None = None,
) -> ExecResult:
    return exec_and_wait_sync(
        client,
        computer_name,
        ["sh", "-c", cmd],
        timeout=timeout,
        workdir=workdir,
    )


def must_exec(
    client: Islo,
    computer_name: str,
    cmd: str,
    *,
    timeout: float = 300.0,
    workdir: str | None = None,
) -> ExecResult:
    result = exec_sh(client, computer_name, cmd, timeout=timeout, workdir=workdir)
    if result.exit_code != 0:
        raise RuntimeError(
            f"command failed (exit={result.exit_code}, timed_out={result.timed_out})\n"
            f"  cmd: {cmd!r}\n  stdout: {result.stdout[-2000:]}\n  stderr: {result.stderr[-2000:]}"
        )
    return result


def bootstrap_python(client: Islo, computer_name: str, *, timeout: float = 300.0) -> None:
    """Install Python on the default islo-runner image via apt."""
    must_exec(client, computer_name, PYTHON_BOOTSTRAP_CMD, timeout=timeout)
    must_exec(client, computer_name, "command -v python3", timeout=30)


def assert_setup_steps(client: Islo, computer_name: str, *step_names: str) -> None:
    """Fail fast when init setup scripts did not succeed."""
    resp = client.sandboxes.get_sandbox(computer_name)
    steps = {s.name: s for s in (resp.setup_steps or [])}
    missing = [name for name in step_names if name not in steps]
    if missing:
        raise RuntimeError(f"setup steps missing on computer {computer_name!r}: {missing}")
    for name in step_names:
        step = steps[name]
        if step.status != "succeeded":
            raise RuntimeError(
                f"setup step {name!r} status={step.status!r}\n"
                f"stdout: {(step.stdout or '')[-2000:]}\n"
                f"stderr: {(step.stderr or '')[-2000:]}"
            )


def delete_computer(client: Islo, computer_name: str) -> None:
    try:
        client.sandboxes.delete_sandbox(computer_name)
    except ApiError:
        pass


@contextmanager
def computer(
    client: Islo,
    *,
    name: str | None = None,
    wait: bool = True,
    ready_timeout: float = 180.0,
    **create_kwargs,
) -> Iterator[str]:
    """Create an Islo computer (SDK: sandbox) and delete it on exit."""
    kwargs = dict(create_kwargs)
    if name is not None:
        kwargs["name"] = name
    resp = client.sandboxes.create_sandbox(**kwargs)
    computer_name = resp.name
    try:
        if wait:
            wait_ready(client, computer_name, timeout=ready_timeout)
        yield computer_name
    finally:
        delete_computer(client, computer_name)
