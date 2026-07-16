import type { IsloClientContext } from "./client.js";
import { runSandboxCommand } from "./exec.js";

const WORKSPACE_TOOLCHAIN_MARKER = "/workspace/.islo-ai-sdk-toolchain.ok";
const IMAGE_BOOTSTRAP_MARKER = "/tmp/harness/codex/.bootstrap-image.ok";
const CODEX_SEED_CONFIG = "/opt/islo/codex-config/config.toml";
/** Islo's platform-managed Codex config and phantom-auth directory. */
export const ISLO_CODEX_HOME = "/home/islo/.codex";

/**
 * Append headless feature flags to the platform Codex config when present.
 * Islo sandboxes ship ~/.codex/config.toml with phantom-token auth — do not
 * relocate CODEX_HOME, replace that file, or copy the image seed as a full config.
 */
export async function ensureCodexHeadlessConfig(
  ctx: IsloClientContext,
  sandboxName: string,
  defaultWorkingDirectory: string,
  abortSignal?: AbortSignal,
): Promise<void> {
  abortSignal?.throwIfAborted?.();

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

async function hasPnpm(
  ctx: IsloClientContext,
  sandboxName: string,
  defaultWorkingDirectory: string,
  abortSignal?: AbortSignal,
): Promise<boolean> {
  const probe = await runSandboxCommand({
    ctx,
    sandboxName,
    command: "pnpm --version >/dev/null 2>&1",
    defaultWorkingDirectory,
    abortSignal,
  });
  return probe.exitCode === 0;
}

async function installPnpm(
  ctx: IsloClientContext,
  sandboxName: string,
  defaultWorkingDirectory: string,
  abortSignal?: AbortSignal,
  options?: { skipCorepack?: boolean },
): Promise<void> {
  if (!options?.skipCorepack) {
    const corepack = await runSandboxCommand({
      ctx,
      sandboxName,
      command: "corepack enable && corepack prepare pnpm@10.15.0 --activate",
      defaultWorkingDirectory,
      abortSignal,
    });
    if (
      corepack.exitCode === 0 &&
      (await hasPnpm(ctx, sandboxName, defaultWorkingDirectory, abortSignal))
    ) {
      return;
    }
  }

  const npmGlobal = await runSandboxCommand({
    ctx,
    sandboxName,
    command: "npm install -g pnpm@10",
    defaultWorkingDirectory,
    abortSignal,
  });
  if (
    npmGlobal.exitCode === 0 &&
    (await hasPnpm(ctx, sandboxName, defaultWorkingDirectory, abortSignal))
  ) {
    return;
  }

  throw new Error(
    `Failed to install pnpm in sandbox (npm: ${npmGlobal.stderr || npmGlobal.stdout})`,
  );
}

export async function ensureHarnessToolchain(
  ctx: IsloClientContext,
  sandboxName: string,
  defaultWorkingDirectory: string,
  abortSignal?: AbortSignal,
): Promise<void> {
  abortSignal?.throwIfAborted?.();

  await ensureCodexHeadlessConfig(
    ctx,
    sandboxName,
    defaultWorkingDirectory,
    abortSignal,
  );

  const workspaceMarker = await runSandboxCommand({
    ctx,
    sandboxName,
    command: `test -f ${WORKSPACE_TOOLCHAIN_MARKER}`,
    defaultWorkingDirectory,
    abortSignal,
  });
  if (workspaceMarker.exitCode === 0) {
    return;
  }

  const imageMarker = await runSandboxCommand({
    ctx,
    sandboxName,
    command: `test -f ${IMAGE_BOOTSTRAP_MARKER}`,
    defaultWorkingDirectory,
    abortSignal,
  });
  const imagePrebootstrapped = imageMarker.exitCode === 0;

  if (
    imagePrebootstrapped &&
    (await hasPnpm(ctx, sandboxName, defaultWorkingDirectory, abortSignal))
  ) {
    await runSandboxCommand({
      ctx,
      sandboxName,
      command: `touch ${WORKSPACE_TOOLCHAIN_MARKER}`,
      defaultWorkingDirectory,
      abortSignal,
    });
    return;
  }

  const hasNode = await runSandboxCommand({
    ctx,
    sandboxName,
    command: "command -v node >/dev/null 2>&1",
    defaultWorkingDirectory,
    abortSignal,
  });
  if (hasNode.exitCode !== 0) {
    throw new Error(
      "Sandbox is missing Node.js required by the AI SDK harness. " +
        "Use the islo-ai-sdk-runner image or enable Node in setup scripts.",
    );
  }

  if (!(await hasPnpm(ctx, sandboxName, defaultWorkingDirectory, abortSignal))) {
    await installPnpm(
      ctx,
      sandboxName,
      defaultWorkingDirectory,
      abortSignal,
      { skipCorepack: imagePrebootstrapped },
    );
  }

  if (!(await hasPnpm(ctx, sandboxName, defaultWorkingDirectory, abortSignal))) {
    throw new Error("pnpm is still unavailable after installation.");
  }

  await runSandboxCommand({
    ctx,
    sandboxName,
    command: `touch ${WORKSPACE_TOOLCHAIN_MARKER}`,
    defaultWorkingDirectory,
    abortSignal,
  });
}
