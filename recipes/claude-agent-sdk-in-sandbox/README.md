# Claude Agent SDK in Islo Sandbox (Python)

Build a programmatic agent with Anthropic's [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk) running inside an Islo computer.

## How to create a computer with the Agent SDK

Create a computer, install the Agent SDK, and run an agent script:

```python
from islo import Islo
from islo.custom.exec import exec_and_wait_sync

client = Islo()
name = "my-agent-computer"

client.sandboxes.create_sandbox(name=name)

exec_and_wait_sync(
    client,
    name,
    ["sh", "-c", "python3 -m venv /tmp/agent-venv && /tmp/agent-venv/bin/pip install -q claude-agent-sdk"],
    timeout=600,
)

result = exec_and_wait_sync(
    client,
    name,
    ["sh", "-c", "/tmp/agent-venv/bin/python /tmp/claude_agent.py"],
    env={"ANTHROPIC_API_KEY": "<your api key>"},
    timeout=900,
)
print(result.stdout)

client.sandboxes.delete_sandbox(name)
```

The agent script uses `query()` from `claude_agent_sdk` — see `claude_agent_sdk_in_sandbox/agent.py` in this folder.

---

## How to run example

**1. Set API keys**

Copy `.env.example` to `.env`:

- `ISLO_API_KEY` — from [app.islo.dev/api-keys](https://app.islo.dev/api-keys)
- `ANTHROPIC_API_KEY` — from [Anthropic Console](https://console.anthropic.com/)

**2. Install dependencies**

```bash
cd recipes/claude-agent-sdk-in-sandbox
uv sync
```

**3. Run the example**

```bash
uv run python claude_agent_sdk_in_sandbox/main.py
```

---

## Also available via Islo CLI

For interactive Claude Code sessions (CLI, not Agent SDK), see [`anthropic-claude-code-in-sandbox`](../anthropic-claude-code-in-sandbox/) or use `islo use --agent claude`. See [Agent integration](https://docs.islo.dev/cli/agent-integration).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ISLO_API_KEY` | Yes | Islo API key |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key passed into the computer |
| `ISLO_BASE_URL` | No | Control-plane URL (default `https://api.islo.dev`) |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ModuleNotFoundError: claude_agent_sdk` | Setup script failed — check pip install stderr |
| Agent times out | Increase `timeout` on `exec_and_wait_sync`; reduce `max_turns` in `agent.py` |
| Permission errors | Adjust `permission_mode` / `allowed_tools` in `agent.py` |

## Related recipes

- [`anthropic-claude-code-in-sandbox`](../anthropic-claude-code-in-sandbox/) — Claude Code CLI in a computer
