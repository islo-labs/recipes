# OpenAI Codex in Islo Sandbox (Python)

This example shows how to run OpenAI's [Codex](https://github.com/openai/codex) in an Islo computer.

## How to create a computer with Codex

Create a computer, install Codex via a setup script, and run a prompt:

```python
from islo import Islo
from islo.custom.exec import exec_and_wait_sync

client = Islo()
name = "my-codex-computer"

client.sandboxes.create_sandbox(name=name)

exec_and_wait_sync(
    client, name, ["sh", "-c", "npm install -g @openai/codex"], timeout=600
)

# Run a prompt with Codex
result = exec_and_wait_sync(
    client,
    name,
    ["sh", "-c", "codex exec --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox 'Create a hello world index.html'"],
    env={"OPENAI_API_KEY": "<your api key>"},
    timeout=600,
)
print(result.stdout)

client.sandboxes.delete_sandbox(name)
```

---

## How to run example

**1. Set API keys**

Set `ISLO_API_KEY` and `OPENAI_API_KEY` in `.env` (copy from `.env.example`):

- `ISLO_API_KEY` — from [app.islo.dev/api-keys](https://app.islo.dev/api-keys)
- `OPENAI_API_KEY` — from [OpenAI Platform](https://platform.openai.com/api-keys)

**2. Install dependencies**

```bash
cd recipes/openai-codex-in-sandbox
uv sync
```

**3. Run the example**

```bash
uv run python openai_codex_in_sandbox/main.py
```

---

## Also available via Islo CLI

For interactive sessions and background tasks, use `islo use --agent codex`:

```bash
export OPENAI_API_KEY="sk-..."
islo use my-project --agent codex
islo use my-project --agent codex --task "Create a hello world index.html"
```

See [Agent integration](https://docs.islo.dev/cli/agent-integration).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ISLO_API_KEY` | Yes | Islo API key |
| `OPENAI_API_KEY` | Yes | OpenAI API key passed into the computer |
| `ISLO_BASE_URL` | No | Control-plane URL (default `https://api.islo.dev`) |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `codex: command not found` | Setup script failed — check stderr; ensure npm registry is reachable |
| Auth errors | Verify `OPENAI_API_KEY` is set and valid |
| Codex exits immediately | `--skip-git-repo-check` is included in the example command |

## Related recipes

- [`anthropic-claude-code-in-sandbox`](../anthropic-claude-code-in-sandbox/) — Claude Code on Islo
- [`gateway-allowlist`](../gateway-allowlist/) — Restrict egress for agent workloads
