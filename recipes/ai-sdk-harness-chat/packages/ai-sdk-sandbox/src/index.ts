import { createIsloClientContext } from "./client.js";
import { deleteSandboxByName as deleteSandboxByNameWithContext } from "./files.js";

export { createIsloSandbox } from "./provider.js";
export {
  IsloNetworkSandboxSession,
  createIsloHarnessSandboxSession,
  resumeIsloHarnessSandboxSession,
} from "./session.js";
export {
  ISLO_AI_SDK_BRIDGE_PORT,
  ISLO_AI_SDK_RUNNER_IMAGE,
  ISLO_DEFAULT_WORKDIR,
  ISLO_SANDBOX_NAME_PREFIX,
  sandboxNameForSession,
  shareUrlToWebSocketUrl,
} from "./client.js";
export {
  formatIsloError,
  IsloSandboxError,
  isNotFoundError,
  toIsloSandboxError,
} from "./errors.js";
export { shellCommandArgs } from "./exec.js";
export { extractExecSseMessage } from "./exec-sse.js";
export type { IsloSandboxSettings } from "./types.js";

export async function deleteSandboxByName(
  sandboxName: string,
  settings: import("./types.js").IsloSandboxSettings = {},
  abortSignal?: AbortSignal,
): Promise<void> {
  const ctx = createIsloClientContext(settings);
  await deleteSandboxByNameWithContext(ctx, sandboxName, abortSignal);
}
