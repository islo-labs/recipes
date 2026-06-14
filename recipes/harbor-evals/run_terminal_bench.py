#!/usr/bin/env python3
"""Optional: run a full Terminal-Bench eval on Islo via Harbor."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys

from recipekit.computer import load_recipe_env

DATASET = os.environ.get("HARBOR_DATASET", "terminal-bench@2.0")
AGENT = os.environ.get("HARBOR_AGENT", "oracle")
CONCURRENCY = os.environ.get("HARBOR_CONCURRENCY", "10")


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
        DATASET,
        "--agent",
        AGENT,
        "--env",
        "islo",
        "-n",
        CONCURRENCY,
    ]
    print(f"$ {' '.join(cmd)}")
    return subprocess.run(cmd, env=env).returncode


if __name__ == "__main__":
    sys.exit(main())
