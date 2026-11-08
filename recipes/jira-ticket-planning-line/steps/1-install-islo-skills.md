# Step 1 — Add the Islo skills to your coding agent

**Who:** a customer engineer. **Time:** 5 minutes. **Islo resources created:** none.

Every later step is a prompt you give your coding agent. Those prompts rely on
Islo's own skills to know how Islo works, so this package doesn't have to
describe it, and it keeps working as Islo changes.

## 1. Install the `islo` CLI and log in
Follow https://docs.islo.dev to install the CLI, then log in to your Islo
organization and select the Factory you will use for this line.

## 2. Add the Islo skills plugin
The `islo` plugin is published at https://github.com/islo-labs/skills (Islo
Labs, MIT). It adds the `using-islo` skill and the Islo docs MCP server
(`https://docs.islo.dev/_mcp/server`). It ships for Claude Code, Codex and
Cursor; install it the way that repository's README describes for your agent.

## 3. Check it — give your agent this prompt

> Using the Islo skill, confirm you can see it and the Islo docs server. Then
> run `islo --version` and `islo factory current`, and tell me the CLI
> version, the selected Factory, and whether `islo schema factory` and
> `islo schema agent` work. Do not create or change anything.

## Done when
- The agent names the `using-islo` skill and answers from the Islo docs.
- `islo factory current` shows the Factory you intend to use.

Next: [Step 2 — prepare](2-prepare.md).
