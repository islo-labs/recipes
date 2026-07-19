# AI SDK HarnessAgent chat on Islo

Next.js chat app that runs **Codex** through the experimental AI SDK [`HarnessAgent`](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent) inside an **Islo sandbox**.

```
useChat → /api/chat → HarnessAgent({ harness: codex, sandbox: createIsloSandbox() })
  → packages/islo-ai-sdk-sandbox (bundled source, not published to npm)
  → wss:// share bridge → browser
```

Resume state is stored in memory keyed by the `useChat` id. Persist `HarnessAgentResumeSessionState` in Redis or a database before running multiple app instances.

## Requirements

- Node.js 22+
- Islo API key with sandbox access

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

## Layout

| Path | Role |
|------|------|
| `packages/islo-ai-sdk-sandbox/src/` | Bundled Islo sandbox provider (sync `createSandbox`, exec SSE) |
| `lib/agent.ts` | `HarnessAgent` wired to `createIsloSandbox()` |
| `lib/harness-session.ts` | In-memory live sessions + `resumeFrom` store between HTTP requests |
| `lib/harness-status.ts` | Transient setup status events streamed to the browser |
| `lib/chat-messages.ts` | Sends only the latest user turn to the harness |
| `app/api/chat/route.ts` | Chat stream, live session reuse, sandbox cleanup |
| `app/page.tsx` | `useChat` UI |

## Verify success

Send a message in the browser. The UI should show setup status ("Provisioning Islo sandbox…", "Starting Codex bridge…") while the stream is open, then Codex tokens. A second message in the same tab reuses the live harness session.

Cold starts use the pre-baked `ghcr.io/islo-labs/islo-ai-sdk-runner:latest` image so the Codex bridge dependencies are already installed in `/tmp/harness/codex`.

## Latency

| Phase | Typical time |
| --- | --- |
| First byte (status UI) | Immediate — setup runs inside the open SSE stream |
| First Codex token (cold chat) | ~15–30s (sandbox boot + bridge) |
| Follow-up message (same process) | ~1–5s to first token |

Improvements baked into this recipe: early streaming status, live in-process session reuse, latest-user-message-only turns, and the `islo-ai-sdk-runner` image with preinstalled bridge deps.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Missing Islo credentials | Set `ISLO_API_KEY` in `.env.local` and restart Next.js |
| Share readiness timeout | Verify compute-plane share access and runner image bootstrap |
| Stale test sandboxes | Delete orphaned `harness-chat-*` sandboxes from the Islo dashboard |

## Related recipes

- [`openai-codex-in-sandbox`](../openai-codex-in-sandbox/) — run Codex directly through the CLI
