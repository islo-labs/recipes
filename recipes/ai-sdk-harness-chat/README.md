# AI SDK HarnessAgent chat on Islo

Next.js chat app that runs **Codex** through the experimental AI SDK [`HarnessAgent`](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent) inside an **Islo sandbox**.

```
useChat → /api/chat → HarnessAgent({ harness: codex, sandbox: createIsloSandbox() })
  → @islo-labs/ai-sdk-sandbox → wss:// share bridge → browser
```

Resume state is stored in memory keyed by the `useChat` id. Persist `HarnessAgentResumeSessionState` in Redis or a database before running multiple app instances.

## Prerequisites

- Node.js 22+
- Islo API key with sandbox access
- [`@islo-labs/ai-sdk-sandbox`](https://github.com/islo-labs/ai-sdk-sandbox) — install from the package repo (not vendored in this recipe)

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
| `lib/agent.ts` | `HarnessAgent` wired to `createIsloSandbox()` |
| `lib/harness-session.ts` | In-memory `resumeFrom` store between HTTP requests |
| `app/api/chat/route.ts` | Chat stream, detach/resume, sandbox cleanup |
| `app/page.tsx` | `useChat` UI |

## Verify success

Send a message in the browser. A successful request streams a Codex response, and a second message resumes the same harness session.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Missing Islo credentials | Set `ISLO_API_KEY` in `.env.local` and restart Next.js |
| `@islo-labs/ai-sdk-sandbox` not found | Install from `github:islo-labs/ai-sdk-sandbox#main` |
| Share readiness timeout | Verify compute-plane share access and runner image bootstrap |
| Stale test sandboxes | Delete orphaned `harness-chat-*` sandboxes from the Islo dashboard |

## Related recipes

- [`openai-codex-in-sandbox`](../openai-codex-in-sandbox/) — run Codex directly through the CLI
