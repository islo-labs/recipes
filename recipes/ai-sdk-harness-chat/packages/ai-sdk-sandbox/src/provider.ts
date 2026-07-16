import type { HarnessV1SandboxProvider } from "@ai-sdk/harness";
import {
  createIsloClientContext,
  ISLO_AI_SDK_BRIDGE_PORT,
  sandboxNameForSession,
} from "./client.js";
import {
  createIsloHarnessSandboxSession,
  resumeIsloHarnessSandboxSession,
} from "./session.js";
import type { IsloSandboxSettings } from "./types.js";

export function createIsloSandbox(
  settings: IsloSandboxSettings = {},
): HarnessV1SandboxProvider {
  const ctx = createIsloClientContext(settings);
  const ownsLifecycle = settings.sandboxName == null;
  const wrapExisting = settings.sandboxName != null;

  return {
    specificationVersion: "harness-sandbox-v1",
    providerId: "islo",
    bridgePorts: settings.ports ?? [ISLO_AI_SDK_BRIDGE_PORT],
    createSession: async (options) => {
      options?.abortSignal?.throwIfAborted?.();

      const sandboxName = wrapExisting
        ? settings.sandboxName!
        : sandboxNameForSession(options?.sessionId ?? crypto.randomUUID());

      const { session, isFreshCreate } = await createIsloHarnessSandboxSession({
        ctx,
        sandboxName,
        settings,
        abortSignal: options?.abortSignal,
        ports: settings.ports ?? [ISLO_AI_SDK_BRIDGE_PORT],
        identity: options?.identity,
        onFirstCreate: options?.onFirstCreate,
        ownsLifecycle,
      });

      return session;
    },
    resumeSession: async (options) => {
      options.abortSignal?.throwIfAborted?.();

      const sandboxName = wrapExisting
        ? settings.sandboxName!
        : sandboxNameForSession(options.sessionId);

      return resumeIsloHarnessSandboxSession({
        ctx,
        sandboxName,
        settings,
        abortSignal: options.abortSignal,
        ports: settings.ports ?? [ISLO_AI_SDK_BRIDGE_PORT],
        ownsLifecycle,
      });
    },
  };
}
