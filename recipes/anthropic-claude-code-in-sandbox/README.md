# Anthropic Claude Code in Islo Sandbox (Python)

This example shows how to run Anthropic's [Claude Code](https://github.com/anthropics/claude-code) in an Islo computer.

## How to create a computer with Claude Code

Create a computer, install Claude Code via a setup script, and run a prompt:

```python
from islo import Islo
from islo.custom.exec import exec_and_wait_sync

client = Islo()
name = "my-claude-computer"

client.sandboxes.create_sandbox(name=name)

exec_and_wait_sync(
    client,
    name,
    ["sh", "-c", "sudo apt-get update -qq && sudo apt-get install -y nodejs npm"],
    timeout=600,
)
exec_and_wait_sync(
    client, name, ["sh", "-c", "npm install -g @anthropic-ai/claude-code"], timeout=600
)

# Run a prompt with Claude Code
result = exec_and_wait_sync(
    client,
    name,
    ["sh", "-c", "echo 'Create a hello world index.html' | claude -p --dangerously-skip-permissions"],
    env={"ANTHROPIC_API_KEY": "<your api key>"},
    timeout=600,
)
print(result.stdout)

client.sandboxes.delete_sandbox(name)
```

---

## How to run example

**1. Set API keys**

Set `ISLO_API_KEY` and `ANTHROPIC_API_KEY` in `.env` (copy from `.env.example`):

- `ISLO_API_KEY` — from [app.islo.dev/api-keys](https://app.islo.dev/api-keys)
- `ANTHROPIC_API_KEY` — from [Anthropic Console](https://console.anthropic.com/)

**2. Install dependencies**

```bash
cd recipes/anthropic-claude-code-in-sandbox
uv sync
```

**3. Run the example**

```bash
uv run python anthropic_claude_code_in_sandbox/main.py
```

---

## Also available via Islo CLI

For interactive sessions and background tasks, use `islo use --agent claude`:

```bash
islo login --tool claude
islo use my-project --agent claude
islo use my-project --agent claude --task "Create a hello world index.html"
```

See [Agent integration](https://docs.islo.dev/cli/agent-integration).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ISLO_API_KEY` | Yes | Islo API key |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key passed into the computer |
| `ISLO_BASE_URL` | No | Control-plane URL (default `https://api.islo.dev`) |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `claude: command not found` | Setup script failed — check stderr; ensure npm registry is reachable |
| Auth errors | Verify `ANTHROPIC_API_KEY` is set and valid |
| Computer not ready | Wait for setup scripts to finish before running Claude Code |

## Related recipes

- [`openai-codex-in-sandbox`](../openai-codex-in-sandbox/) — OpenAI Codex on Islo
- [`playwright`](../playwright/) — SDK recipe with GitSource + browser tests
