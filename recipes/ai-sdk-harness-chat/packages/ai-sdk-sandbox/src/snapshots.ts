import type { IsloClientContext } from "./client.js";
import { snapshotNameForIdentity } from "./client.js";
import { isNotFoundError } from "./errors.js";
import { waitUntilSandboxReady } from "./exec.js";
import type { LifecyclePolicy } from "./types.js";

const snapshotReadyStatuses = new Set(["ready", "available", "completed"]);

export async function getReadySnapshot(
  ctx: IsloClientContext,
  identity: string,
  abortSignal?: AbortSignal,
): Promise<string | null> {
  const name = snapshotNameForIdentity(identity);
  try {
    const snapshot = await ctx.client.snapshots.getSnapshot(
      { name },
      { abortSignal },
    );
    if (snapshotReadyStatuses.has(snapshot.status.toLowerCase())) {
      return snapshot.name;
    }
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }
  return null;
}

export async function ensureSnapshotForIdentity(options: {
  ctx: IsloClientContext;
  identity: string;
  templateSandboxName: string;
  abortSignal?: AbortSignal;
}): Promise<string> {
  const existing = await getReadySnapshot(
    options.ctx,
    options.identity,
    options.abortSignal,
  );
  if (existing) {
    return existing;
  }

  const snapshotName = snapshotNameForIdentity(options.identity);

  try {
    const created = await options.ctx.client.snapshots.createSnapshot(
      {
        sandbox_name: options.templateSandboxName,
        name: snapshotName,
      },
      { abortSignal: options.abortSignal },
    );
    return created.name;
  } catch (error) {
    if (isNotFoundError(error)) {
      throw error;
    }
    const recovered = await getReadySnapshot(
      options.ctx,
      options.identity,
      options.abortSignal,
    );
    if (recovered) {
      return recovered;
    }
    throw error;
  }
}

export async function waitForSnapshotReady(
  ctx: IsloClientContext,
  snapshotName: string,
  abortSignal?: AbortSignal,
  timeoutMs = 300_000,
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    abortSignal?.throwIfAborted?.();
    const snapshot = await ctx.client.snapshots.getSnapshot(
      { name: snapshotName },
      { abortSignal },
    );
    if (snapshotReadyStatuses.has(snapshot.status.toLowerCase())) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Timed out waiting for snapshot '${snapshotName}' to be ready`);
}

export async function createSandboxFromSnapshotOrImage(options: {
  ctx: IsloClientContext;
  sandboxName: string;
  image: string;
  snapshotName?: string | null;
  gatewayProfile?: string | null;
  internetEnabled?: boolean;
  lifecycle?: LifecyclePolicy | null;
  setupScripts?: ReadonlyArray<{ name: string; script: string }> | null;
  abortSignal?: AbortSignal;
}): Promise<{ name: string; isFreshCreate: boolean }> {
  try {
    const existing = await options.ctx.client.sandboxes.getSandbox(
      { sandbox_name: options.sandboxName },
      { abortSignal: options.abortSignal },
    );
    return { name: existing.name, isFreshCreate: false };
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  const created = await options.ctx.client.sandboxes.createSandbox(
    {
      name: options.sandboxName,
      image: options.image,
      snapshot_name: options.snapshotName ?? null,
      gateway_profile: options.gatewayProfile ?? null,
      internet_enabled: options.internetEnabled ?? true,
      lifecycle: options.lifecycle ?? null,
      init: { type: "minimal" },
      setup_scripts: options.setupScripts ? [...options.setupScripts] : null,
    },
    { abortSignal: options.abortSignal },
  );

  const ready = await waitUntilSandboxReady(
    options.ctx,
    created.name,
    options.abortSignal,
  );

  return { name: ready.name, isFreshCreate: true };
}
