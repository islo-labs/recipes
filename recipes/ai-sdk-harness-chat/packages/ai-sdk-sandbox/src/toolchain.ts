import type { IsloClientContext } from "./client.js";
import { runSandboxCommand } from "./exec.js";

const IMAGE_BOOTSTRAP_MARKER = "/tmp/harness/codex/.bootstrap-image.ok";
const CODEX_SEED_CONFIG = "/opt/islo/codex-config/config.toml";

/** Islo's platform-managed Codex config and phantom-auth directory. */
export const ISLO_CODEX_HOME = "/home/islo/.codex";

/**
 * Require the pre-warmed runner image and append optional headless feature flags
 * to the platform Codex config. Customer handoff assumes islo-ai-sdk-runner.
 */
export async function ensureRunnerHarnessReady(
  ctx: IsloClientContext,
  sandboxName: string,
  defaultWorkingDirectory: string,
  abortSignal?: AbortSignal,
): Promise<void> {
  abortSignal?.throwIfAborted?.();

  const marker = await runSandboxCommand({
    ctx,
    sandboxName,
    command: `test -f ${IMAGE_BOOTSTRAP_MARKER}`,
    defaultWorkingDirectory,
    abortSignal,
  });
  if (marker.exitCode !== 0) {
    throw new Error(
      "Sandbox is missing the AI SDK runner bootstrap. " +
        "Use ghcr.io/islo-labs/islo-ai-sdk-runner:latest.",
    );
  }

  await runSandboxCommand({
    ctx,
    sandboxName,
    command: [
      `if [ ! -f ${CODEX_SEED_CONFIG} ]; then exit 0; fi`,
      `codex_home="${ISLO_CODEX_HOME}"`,
      'if [ ! -f "$codex_home/config.toml" ]; then exit 0; fi',
      'if ! grep -q "^\\[features\\]" "$codex_home/config.toml"; then',
      `  cat ${CODEX_SEED_CONFIG} >> "$codex_home/config.toml"`,
      "fi",
    ].join("\n"),
    defaultWorkingDirectory,
    abortSignal,
  });
}
