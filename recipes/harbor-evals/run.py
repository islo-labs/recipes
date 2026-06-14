#!/usr/bin/env python3
"""Smoke-test Harbor hello-world eval on Islo."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys

from islo_recipes.computer import load_recipe_env

RECIPE_ID = "harbor-evals"


def main() -> int:
    load_recipe_env()
    if shutil.which("harbor") is None:
        print("Install Harbor: uv tool install 'harbor[islo]'", file=sys.stderr)
        return 1

    base_url = os.environ.get("ISLO_BASE_URL", "https://api.islo.dev")
    env = {
        **os.environ,
        "ISLO_BASE_URL": base_url,
        "ISLO_API_URL": os.environ.get("ISLO_API_URL", base_url),
    }

    cmd = [
        "harbor",
        "run",
        "--dataset",
        "hello-world",
        "--agent",
        "oracle",
        "--env",
        "islo",
    ]
    print(f"$ {' '.join(cmd)}")
    proc = subprocess.run(cmd, env=env, text=True)
    if proc.returncode != 0:
        print(f"harbor exited {proc.returncode}", file=sys.stderr)
        return proc.returncode

    print(f"PASS: {RECIPE_ID}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
