import { HarnessAgent } from "@ai-sdk/harness/agent";
import { createCodex } from "@ai-sdk/harness-codex";
import { createIsloSandbox } from "@islo-labs/islo-ai-sdk-sandbox";

const gatewayProfile = process.env.ISLO_GATEWAY_PROFILE?.trim() || undefined;

function createAgent() {
  return new HarnessAgent({
    harness: createCodex({
      auth: {
        openaiCompatible: {
          baseUrl: "https://api.openai.com/v1",
          modelProviderName: "Islo",
        },
      },
    }),
    sandbox: createIsloSandbox({
      ...(gatewayProfile ? { gatewayProfile } : {}),
      lifecycle: {
        pause_after_idle: 1_800,
        auto_resume: "on_activity",
      },
    }),
    instructions:
      "You are a helpful coding assistant running inside an Islo sandbox. Be concise and practical.",
    permissionMode: "allow-all",
  });
}

let agent: ReturnType<typeof createAgent> | undefined;

export function getAgent() {
  agent ??= createAgent();
  return agent;
}
