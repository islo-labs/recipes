# @islo-labs/islo-ai-sdk-sandbox

Islo sandbox provider for the [AI SDK HarnessAgent](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent).

## Install

Install this package alongside your AI SDK harness dependencies. You bring your own `@ai-sdk/harness` version — this package declares it as a **peer dependency**, so npm will use whatever version your app already has.

```bash
npm install @islo-labs/islo-ai-sdk-sandbox @ai-sdk/harness @ai-sdk/provider-utils
```

`@islo-labs/sdk` is installed automatically. You also need an Islo API key.

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

## Peer dependencies

| Package | Range | Notes |
| --- | --- | --- |
| `@ai-sdk/harness` | `^1.0.0` | Installed by your app |
| `@ai-sdk/provider-utils` | `^5.0.0` | Installed by your app |

You do **not** need a new `@islo-labs/islo-ai-sdk-sandbox` release when AI SDK ships a patch or minor update within those ranges. Upgrade `@ai-sdk/harness` in your app as usual.

This package lists the same modules in `devDependencies` for local development and type-checking ([peer deps are not auto-installed](https://dev.to/jody/a-tip-on-using-peer-dependencies-with-typescript-2bji)).

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
