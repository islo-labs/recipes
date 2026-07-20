# @islo-labs/islo-ai-sdk-sandbox

Islo sandbox provider for the [AI SDK HarnessAgent](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent).

## Install

Install this package alongside your AI SDK harness dependencies. **Use the same version for `@islo-labs/islo-ai-sdk-sandbox` and `@ai-sdk/harness`** so peer dependency ranges stay aligned.

```bash
npm install @islo-labs/islo-ai-sdk-sandbox@1.0.36 @ai-sdk/harness@1.0.36 @ai-sdk/provider-utils
```

You also need `@islo-labs/sdk` (installed automatically) and an Islo API key.

## Usage

```ts
import { HarnessAgent } from "@ai-sdk/harness";
import { codex } from "@ai-sdk/harness-codex";
import { createIsloSandbox } from "@islo-labs/islo-ai-sdk-sandbox";

const agent = new HarnessAgent({
  harness: codex(),
  sandbox: createIsloSandbox({
    apiKey: process.env.ISLO_API_KEY,
  }),
});
```

## Versioning

This package tracks **`@ai-sdk/harness` releases**:

| Package | Versioning |
| --- | --- |
| `@islo-labs/islo-ai-sdk-sandbox` | Mirrors `@ai-sdk/harness` (e.g. `1.0.36`) |
| `@ai-sdk/harness` | Peer dependency — you install it |
| `@ai-sdk/provider-utils` | Peer dependency — version resolved from harness |

When you upgrade the AI SDK harness, upgrade this package to the same version:

```bash
npm install @islo-labs/islo-ai-sdk-sandbox@1.0.36 @ai-sdk/harness@1.0.36
```

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `ISLO_API_KEY` | yes | Islo API key (or pass `apiKey` to `createIsloSandbox`) |
| `ISLO_BASE_URL` | no | Control plane URL (default `https://api.islo.dev`) |
| `ISLO_COMPUTE_URL` | no | Compute plane URL (default `https://ca.compute.islo.dev`) |

## Example app

See the [ai-sdk-harness-chat recipe](https://github.com/islo-labs/recipes/tree/main/recipes/ai-sdk-harness-chat) for a full Next.js chat app.

## Requirements

- Node.js 22+
