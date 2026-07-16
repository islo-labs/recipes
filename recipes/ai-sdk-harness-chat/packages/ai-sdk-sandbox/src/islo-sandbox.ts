import { createHash } from "node:crypto";
import type {
  HarnessV1NetworkSandboxSession,
  HarnessV1SandboxProvider,
} from "@ai-sdk/harness";
import type { Experimental_SandboxSession } from "@ai-sdk/provider-utils";
import { Islo } from "@islo-labs/sdk";
import { IsloNetworkSandboxSession } from "./islo-network-sandbox-session.js";

/** Codex harness bridge port exposed via Islo shares. */
export const ISLO_AI_SDK_BRIDGE_PORT = 4000;

/** Pre-warmed AI SDK Harness runner image. */
export const ISLO_AI_SDK_RUNNER_IMAGE =
  "ghcr.io/islo-labs/islo-ai-sdk-runner:latest";

/** Fallback when the sandbox record has no workdir. */
export const ISLO_DEFAULT_WORKDIR = "/workspace";

export const ISLO_SANDBOX_NAME_PREFIX = "harness-chat-";

const DEFAULT_SHARE_TTL_SECONDS = 86_400;
const ISLO_PROVIDER_ID = "islo";
const SANDBOX_NAME_MAX_LENGTH = 63;
const HASH_SUFFIX_LENGTH = 10;

export interface LifecyclePolicy {
  auto_resume?: "never" | "on_activity";
  delete_after?: number | null;
  pause_after?: number | null;
  pause_after_idle?: number | null;
}

export interface IsloSandboxSettings {
  apiKey?: string;
  baseUrl?: string;
  computeUrl?: string;
  client?: Islo;
  sandboxName?: string;
  image?: string;
  snapshotName?: string;
  gatewayProfile?: string | null;
  internetEnabled?: boolean;
  lifecycle?: LifecyclePolicy | null;
  workingDirectory?: string;
  ports?: readonly number[];
  shareTtlSeconds?: number;
  shareReadiness?: {
    initialDelayMs?: number;
    maxDelayMs?: number;
    timeoutMs?: number;
    pollIntervalMs?: number;
  };
}

export interface IsloClientContext {
  readonly client: Islo;
  readonly computeUrl: string;
  readonly controlUrl: string;
}

export function createIsloSandbox(
  settings: IsloSandboxSettings = {},
): HarnessV1SandboxProvider {
  return new IsloSandboxProvider(settings);
}

export class IsloSandboxProvider implements HarnessV1SandboxProvider {
  readonly specificationVersion = "harness-sandbox-v1" as const;
  readonly providerId = ISLO_PROVIDER_ID;
  readonly bridgePorts: readonly number[];

  private readonly ctx: IsloClientContext;
  private readonly settings: IsloSandboxSettings;
  private readonly ownsLifecycle: boolean;
  private readonly wrapExisting: boolean;

  constructor(settings: IsloSandboxSettings = {}) {
    this.settings = settings;
    this.ctx = createIsloClientContext(settings);
    this.ownsLifecycle = settings.sandboxName == null;
    this.wrapExisting = settings.sandboxName != null;
    this.bridgePorts = settings.ports ?? [ISLO_AI_SDK_BRIDGE_PORT];
  }

  createSession = async (options?: {
    sessionId?: string;
    abortSignal?: AbortSignal;
    onFirstCreate?: (
      session: Experimental_SandboxSession,
      opts: { abortSignal?: AbortSignal },
    ) => Promise<void>;
  }): Promise<HarnessV1NetworkSandboxSession> => {
    options?.abortSignal?.throwIfAborted?.();

    const sandboxName = this.wrapExisting
      ? this.settings.sandboxName!
      : sandboxNameForSession(options?.sessionId ?? crypto.randomUUID());

    let isFreshCreate = false;
    try {
      const result = await createOrReuseSandbox({
        ctx: this.ctx,
        sandboxName,
        settings: this.settings,
        abortSignal: options?.abortSignal,
      });
      isFreshCreate = result.isFreshCreate;
    } catch (error) {
      throw new Error(formatIsloError(error));
    }

    try {
      const ready = await waitUntilSandboxReady(
        this.ctx,
        sandboxName,
        options?.abortSignal,
      );
      const defaultWorkingDirectory =
        this.settings.workingDirectory ??
        ready.workdir ??
        ISLO_DEFAULT_WORKDIR;

      const session = new IsloNetworkSandboxSession({
        ctx: this.ctx,
        sandboxName: ready.name,
        defaultWorkingDirectory,
        ports: this.bridgePorts,
        shareTtlSeconds:
          this.settings.shareTtlSeconds ?? DEFAULT_SHARE_TTL_SECONDS,
        shareReadiness: this.settings.shareReadiness ?? {},
        ownsLifecycle: this.ownsLifecycle,
      });

      if (isFreshCreate && options?.onFirstCreate) {
        try {
          await options.onFirstCreate(session.restricted(), {
            abortSignal: options?.abortSignal,
          });
        } catch (error) {
          await session.destroy().catch(() => undefined);
          throw error;
        }
      }

      return session;
    } catch (error) {
      if (isFreshCreate && this.ownsLifecycle) {
        await this.ctx.client.sandboxes
          .deleteSandbox({ sandbox_name: sandboxName })
          .catch(() => undefined);
      }
      throw new Error(formatIsloError(error));
    }
  };

  resumeSession = async (options: {
    sessionId: string;
    abortSignal?: AbortSignal;
  }): Promise<HarnessV1NetworkSandboxSession> => {
    options.abortSignal?.throwIfAborted?.();

    const sandboxName = this.wrapExisting
      ? this.settings.sandboxName!
      : sandboxNameForSession(options.sessionId);

    const ready = await waitUntilSandboxReady(
      this.ctx,
      sandboxName,
      options.abortSignal,
    );

    return new IsloNetworkSandboxSession({
      ctx: this.ctx,
      sandboxName: ready.name,
      defaultWorkingDirectory:
        this.settings.workingDirectory ??
        ready.workdir ??
        ISLO_DEFAULT_WORKDIR,
      ports: this.bridgePorts,
      shareTtlSeconds: this.settings.shareTtlSeconds ?? DEFAULT_SHARE_TTL_SECONDS,
      shareReadiness: this.settings.shareReadiness ?? {},
      ownsLifecycle: this.ownsLifecycle,
    });
  };
}

export function sandboxNameForSession(sessionId: string): string {
  const normalized = sessionId
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const suffix = normalized || "chat";
  const base = `${ISLO_SANDBOX_NAME_PREFIX}${suffix}`;

  if (base.length <= SANDBOX_NAME_MAX_LENGTH) {
    return base;
  }

  const hash = createHash("sha256")
    .update(sessionId)
    .digest("hex")
    .slice(0, HASH_SUFFIX_LENGTH);
  const trimmed = base.slice(
    0,
    SANDBOX_NAME_MAX_LENGTH - HASH_SUFFIX_LENGTH - 1,
  );
  return `${trimmed}-${hash}`;
}

export function formatIsloError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (error == null || typeof error !== "object") {
    return "Islo request failed";
  }

  const statusCode =
    "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : undefined;
  const body =
    "body" in error && error.body != null && typeof error.body === "object"
      ? (error.body as { code?: string; message?: string })
      : undefined;

  if (statusCode === 429 || body?.code === "RATE_LIMITED") {
    return (
      "Islo sandbox limit reached. Delete unused sandboxes or run cleanup " +
      "for orphaned harness-chat-* resources."
    );
  }

  if (body?.message) {
    return body.message;
  }

  return "Islo request failed";
}

export async function deleteSandboxByName(
  sandboxName: string,
  settings: IsloSandboxSettings = {},
  abortSignal?: AbortSignal,
): Promise<void> {
  const ctx = createIsloClientContext(settings);
  await ctx.client.sandboxes.deleteSandbox(
    { sandbox_name: sandboxName },
    { abortSignal },
  );
}

export function createIsloClientContext(
  settings: IsloSandboxSettings = {},
): IsloClientContext {
  const apiKey =
    settings.apiKey ??
    process.env.ISLO_API_KEY ??
    process.env.ISLO_API_TOKEN ??
    "";

  if (!apiKey && !settings.client) {
    throw new Error("Missing Islo API key. Set ISLO_API_KEY or pass apiKey.");
  }

  const baseUrl =
    settings.baseUrl ?? process.env.ISLO_BASE_URL ?? "https://api.islo.dev";
  const computeUrl =
    settings.computeUrl ??
    process.env.ISLO_COMPUTE_URL ??
    "https://ca.compute.islo.dev";

  if (settings.client) {
    return {
      client: settings.client,
      computeUrl,
      controlUrl: baseUrl,
    };
  }

  return {
    client: new Islo({
      apiKey: apiKey!,
      baseUrl,
      computeUrl,
    }),
    computeUrl,
    controlUrl: baseUrl,
  };
}

function isNotFoundError(error: unknown): boolean {
  if (error == null || typeof error !== "object") {
    return false;
  }
  if ("statusCode" in error && error.statusCode === 404) {
    return true;
  }
  if (error instanceof Error && /not found/i.test(error.message)) {
    return true;
  }
  const body =
    "body" in error && error.body != null && typeof error.body === "object"
      ? (error.body as { code?: string; message?: string })
      : undefined;
  return body?.code === "NOT_FOUND" || /not found/i.test(body?.message ?? "");
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted?.();
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function waitUntilSandboxReady(
  ctx: IsloClientContext,
  sandboxName: string,
  abortSignal?: AbortSignal,
  timeoutMs = 120_000,
): Promise<{ name: string; status: string; workdir?: string | null }> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    abortSignal?.throwIfAborted?.();

    const sandbox = await ctx.client.sandboxes.getSandbox(
      { sandbox_name: sandboxName },
      { abortSignal },
    );

    if (sandbox.status === "running") {
      return sandbox;
    }
    if (sandbox.status === "paused") {
      await ctx.client.sandboxes.resumeSandbox(
        { sandbox_name: sandboxName },
        { abortSignal },
      );
      continue;
    }
    if (sandbox.status === "failed" || sandbox.status === "deleted") {
      throw new Error(`Sandbox '${sandboxName}' is ${sandbox.status}`);
    }

    await sleep(2_000, abortSignal);
  }

  throw new Error(`Timed out waiting for sandbox '${sandboxName}' to be ready`);
}

async function createOrReuseSandbox(options: {
  ctx: IsloClientContext;
  sandboxName: string;
  settings: IsloSandboxSettings;
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
      image: options.settings.image ?? ISLO_AI_SDK_RUNNER_IMAGE,
      snapshot_name: options.settings.snapshotName ?? null,
      gateway_profile: options.settings.gatewayProfile ?? null,
      internet_enabled: options.settings.internetEnabled ?? true,
      lifecycle: options.settings.lifecycle ?? null,
      init: { type: "minimal" },
      setup_scripts: null,
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
