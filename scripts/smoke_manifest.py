#!/usr/bin/env python3
"""Print tab-separated smoke rows from recipes.yaml for scripts/smoke.sh."""

from __future__ import annotations

from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
entries = yaml.safe_load((ROOT / "recipes.yaml").read_text())["recipes"]

for entry in entries:
    live = entry.get("live", "")
    entrypoint = entry.get("entrypoint", "")
    if entry["type"] == "sdk":
        expect = entry.get("pass_output", "")
    elif entry["type"] == "agent":
        expect = entry.get("success_pattern", "")
    else:
        expect = ""
    lang = entry.get("lang", "python")
    env_required = ",".join(entry.get("env_required", []))
    aws_extra = "AWS_ROLE_ARN,S3_BUCKET" if live == "aws" else ""
    if aws_extra and env_required:
        env_required = f"{env_required},{aws_extra}"
    elif aws_extra:
        env_required = aws_extra
    print(f"{entry['id']}\t{entry['type']}\t{live}\t{entrypoint}\t{expect}\t{lang}\t{env_required}")
