# AI SDK HarnessAgent chat on Islo

This Next.js example runs **Codex** through the experimental AI SDK [`HarnessAgent`](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent) inside an **Islo sandbox**, using the bundled `@islo-labs/ai-sdk-sandbox` provider in `packages/ai-sdk-sandbox/`.

```
useChat → /api/chat → HarnessAgent({ harness: codex, sandbox: createIsloSandbox() })
  → @islo-labs/ai-sdk-sandbox
  → Codex bridge via wss:// share URL
  → toUIMessageStream → browser
```

Harness resume state is stored in memory keyed by the `useChat` id. Persist `HarnessAgentResumeSessionState` in Redis or a database before running multiple app instances.

## Requirements

- Node.js 22+
- Islo API key with sandbox access
- Codex auth is automatic inside Islo sandboxes (phantom tokens + gateway); optional `ISLO_GATEWAY_PROFILE` overrides the team default

## Setup

```bash
cp .env.example .env.local
# set ISLO_API_KEY

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `ISLO_API_KEY` | yes | Islo API key (or `ISLO_API_TOKEN`) |
| `ISLO_BASE_URL` | no | Control plane URL (default `https://api.islo.dev`) |
| `ISLO_COMPUTE_URL` | no | Compute plane URL (default `https://ca.compute.islo.dev`) |
| `ISLO_CHAT_DEBUG` | no | Set `true` to log chat route diagnostics |
| `ISLO_HARNESS_IMAGE` | no | Override runner image (default `ghcr.io/islo-labs/islo-ai-sdk-runner:latest`) |

## Scripts

```bash
npm run dev          # local dev server
npm run build        # Next production build
npm run lint         # eslint
npm run test         # app tests
```

## Example layout

| Path | Role |
|------|------|
| `packages/ai-sdk-sandbox/` | Bundled Islo sandbox provider (customer handoff, not published to npm) |
| `lib/agent.ts` | `HarnessAgent` wired to `createIsloSandbox()` |
| `lib/harness-session.ts` | In-memory `resumeFrom` store between HTTP requests |
| `app/api/chat/route.ts` | Chat stream, detach/resume, sandbox cleanup |

## Provider features

`createIsloSandbox()` implements `HarnessV1SandboxProvider` with:

- **Create / resume** — deterministic `harness-chat-<sessionId>` names, paused sandbox auto-resume
- **Minimal init** — `{ type: "minimal" }` at create (no SSH/Docker bootstrap; faster than Full on `islo-runner`)
- **Snapshot identity** — `onFirstCreate` runs once, then snapshots a reusable template keyed by harness identity
- **Wrap-existing mode** — pass `sandboxName` to attach to a caller-owned sandbox (`destroy` does not delete it)
- **Shares + WSS** — `getPortUrl({ protocol: 'ws' })` with bounded readiness retries (no fixed propagation sleep)
- **Persistent spawn** — `createSession` / `killSession` instead of `nohup` polling loops
- **Gateway at create** — `gatewayProfile` and `internetEnabled` on sandbox creation
- **Lifecycle defaults** — provider-owned sandboxes pause after idle and auto-resume on activity

### Known limitations

- **`setNetworkPolicy` is not supported.** Islo gateway profiles are selected at sandbox creation only.
- **Public share URLs** expose the bridge port until revoked or TTL expires. Treat the bridge token as the auth boundary.
- **Resume state** must be persisted by the host app for multi-instance deployments.

## Runner image

Sandboxes default to `ghcr.io/islo-labs/islo-ai-sdk-runner:latest`, a pre-warmed derivative of `islo-runner` with:

- Node 22 + pnpm 10
- Pre-installed Codex harness bridge dependencies under `/tmp/harness/codex`
- A feature fragment that disables plugin marketplace discovery without replacing Islo's platform-managed Codex auth/provider config

Pin production workloads to immutable `sha-*` tags or digests. Override with `ISLO_HARNESS_IMAGE` or `createIsloSandbox({ image })`.

## WebSocket shares

Codex's harness bridge expects the **host** (this Next.js server) to dial `wss://` into the sandbox via an Islo **share** in `getPortUrl()`.

The provider retries share propagation with exponential backoff instead of a fixed sleep.

## Experimental caveat

`@ai-sdk/harness` and `@ai-sdk/harness-codex` are **experimental**. Expect API movement.

## Verify success

Send a message in the browser. A successful request streams a Codex response, and a second message resumes the same harness session.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Missing Islo credentials | Set `ISLO_API_KEY` in `.env.local` and restart Next.js |
| Share readiness timeout | Verify compute-plane share access and runner image bootstrap |
| Stale test sandboxes | Delete orphaned `harness-chat-*` sandboxes from the Islo dashboard |

## Related recipes

- [`openai-codex-in-sandbox`](../openai-codex-in-sandbox/) — run Codex directly through the CLI
