# OpenAI Codex in Islo (Python)

This example shows how to run OpenAI's [Codex](https://github.com/openai/codex) in Islo.

## How to run in Islo

Install Codex and run a prompt in Islo:

```python
from islo import Islo
from islo.custom.exec import exec_and_wait_sync

client = Islo()
name = "my-codex-computer"

client.sandboxes.create_sandbox(name=name)

exec_and_wait_sync(
    client,
    name,
    ["sh", "-c", "sudo apt-get update -qq && sudo apt-get install -y nodejs npm"],
    timeout=600,
)
exec_and_wait_sync(
    client, name, ["sh", "-c", "npm install -g @openai/codex"], timeout=600
)

exec_and_wait_sync(
    client,
    name,
    ["sh", "-c", "id -u agent >/dev/null 2>&1 || useradd -m -s /bin/bash agent"],
    timeout=60,
)

# Write API keys to a file owned by agent — sudo does not reliably preserve env vars.
exec_and_wait_sync(
    client,
    name,
    [
        "sh",
        "-c",
        "cat > /tmp/agent-env <<'EOF'\n"
        "export CODEX_API_KEY='sk-...'\n"
        "EOF\n"
        "chmod 600 /tmp/agent-env && chown agent:agent /tmp/agent-env",
    ],
    timeout=60,
)

result = exec_and_wait_sync(
    client,
    name,
    [
        "sh",
        "-c",
        "sudo -u agent -H sh -c "
        "\". /tmp/agent-env && cd ~ && codex exec --skip-git-repo-check "
        "--dangerously-bypass-approvals-and-sandbox 'Create a hello world index.html'\"",
    ],
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
- `OPENAI_API_KEY` — from [OpenAI Platform](https://platform.openai.com/api-keys). The example maps this to `CODEX_API_KEY` in Islo (`codex exec` requires that name).

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
| `OPENAI_API_KEY` | Yes | Your OpenAI API key; written as `CODEX_API_KEY` for `codex exec` |
| `ISLO_BASE_URL` | No | Control-plane URL (default `https://api.islo.dev`) |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `codex: command not found` | Setup script failed — check stderr; ensure npm registry is reachable |
| `401 Unauthorized: Missing bearer` | `codex exec` needs `CODEX_API_KEY`, not `OPENAI_API_KEY` — see `main.py` |
| Auth errors | Verify `OPENAI_API_KEY` is set and valid |
| Codex exits immediately | `--skip-git-repo-check` is included in the example command |

## Related recipes

- [`anthropic-claude-code-in-sandbox`](../anthropic-claude-code-in-sandbox/) — Claude Code on Islo
- [`gateway-allowlist`](../gateway-allowlist/) — Restrict egress for agent workloads
