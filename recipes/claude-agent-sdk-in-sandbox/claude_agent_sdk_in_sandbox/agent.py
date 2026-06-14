#!/usr/bin/env python3
"""Run in Islo — Claude Agent SDK example."""

from __future__ import annotations

import asyncio
import sys

from claude_agent_sdk import ClaudeAgentOptions, query


async def run() -> None:
    async for message in query(
        prompt="Create a hello world index.html in the current directory.",
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Edit", "Bash", "Write"],
            permission_mode="acceptEdits",
            max_turns=15,
        ),
    ):
        print(message)


def main() -> int:
    asyncio.run(run())
    return 0


if __name__ == "__main__":
    sys.exit(main())
