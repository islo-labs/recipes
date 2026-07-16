# @islo-labs/ai-sdk-sandbox

`HarnessV1SandboxProvider` implementation for [Islo](https://islo.dev) sandboxes.

Bridge-capable: `getPortUrl({ port, protocol: 'ws' })` returns a `wss://` share URL for Codex and Claude Code harness adapters.

This is a **customer handoff package**, not a published npm module. Copy the folder into your app or install it from a local path.

## Install

```bash
# from your app root, after copying this folder to ./packages/ai-sdk-sandbox
npm install ./packages/ai-sdk-sandbox
npm run build -w @islo-labs/ai-sdk-sandbox
```

Or add a workspace dependency in `package.json`:

```json
{
  "dependencies": {
    "@islo-labs/ai-sdk-sandbox": "file:./packages/ai-sdk-sandbox"
  }
}
```

## Usage

```ts
import { HarnessAgent } from "@ai-sdk/harness/agent";
import { createCodex } from "@ai-sdk/harness-codex";
import { createIsloSandbox } from "@islo-labs/ai-sdk-sandbox";

export const agent = new HarnessAgent({
  harness: createCodex(),
  sandbox: createIsloSandbox({
    apiKey: process.env.ISLO_API_KEY,
    image: "ghcr.io/islo-labs/islo-ai-sdk-runner:latest",
  }),
  permissionMode: "allow-all",
});
```

## Settings

| Setting | Description |
| --- | --- |
| `apiKey` | Islo API key (`ISLO_API_KEY`) |
| `baseUrl` | Control plane URL |
| `computeUrl` | Compute plane URL |
| `sandboxName` | Wrap an existing sandbox (caller owns lifecycle) |
| `image` | Runner image for created sandboxes |
| `snapshotName` | Restore from snapshot |
| `gatewayProfile` | Gateway profile at create time |
| `lifecycle` | Pause/delete/auto-resume policy |
| `ports` | Bridge ports (default `4000`) |
| `shareTtlSeconds` | Public share TTL |

## Known limitations

- **`setNetworkPolicy` is not implemented.** Islo gateway profiles are attached at sandbox creation only.
- **Public share URLs** expose the bridge port until revoked or TTL expires. The bridge token is the auth boundary.
- **Cross-process resume state** must be persisted by the host application (Redis/DB).

## Image (required)

Sandboxes **must** use `ghcr.io/islo-labs/islo-ai-sdk-runner:latest`. The image ships pre-warmed Node, pnpm, the Codex bridge, and headless Codex defaults under `/opt/islo/codex-config/`. Platform auth lives in `~/.codex/config.toml` (managed by Islo).
