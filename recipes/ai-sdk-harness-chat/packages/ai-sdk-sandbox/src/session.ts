import type {
  Experimental_SandboxProcess,
  Experimental_SandboxSession,
} from "@ai-sdk/provider-utils";
import { HarnessCapabilityUnsupportedError } from "@ai-sdk/harness";
import type { HarnessV1NetworkSandboxSession } from "@ai-sdk/harness";
import {
  DEFAULT_SHARE_TTL_SECONDS,
  formatIsloError,
  ISLO_AI_SDK_BRIDGE_PORT,
  ISLO_AI_SDK_RUNNER_IMAGE,
  ISLO_DEFAULT_WORKDIR,
  isNotFoundError,
  shareUrlToWebSocketUrl,
  type IsloClientContext,
} from "./client.js";
import {
  readSandboxFile,
  resolveSandboxPath,
  writeSandboxFile,
} from "./files.js";
import {
  clearActiveSpawnsForSandbox,
  runSandboxCommand,
  spawnSandboxCommand,
  waitUntilSandboxReady,
} from "./exec.js";
import {
  createShareForPort,
  listReusableShare,
  revokeShare,
  waitForShareReady,
  type ShareCacheEntry,
} from "./shares.js";
import { ensureRunnerHarnessReady, ISLO_CODEX_HOME } from "./toolchain.js";
import type { IsloSandboxSettings, LifecyclePolicy } from "./types.js";

export class IsloNetworkSandboxSession implements HarnessV1NetworkSandboxSession {
  readonly id: string;
  readonly defaultWorkingDirectory: string;
  readonly ports: readonly number[];
  readonly description: string;

  private readonly shareCache = new Map<number, ShareCacheEntry>();
  private exposedPorts: number[];

  constructor(
    private readonly ctx: IsloClientContext,
    readonly sandboxName: string,
    defaultWorkingDirectory: string,
    ports: readonly number[],
    private readonly settings: ResolvedSessionSettings,
    private readonly ownsLifecycle: boolean,
  ) {
    this.id = sandboxName;
    this.defaultWorkingDirectory = defaultWorkingDirectory;
    this.exposedPorts = [...ports];
    this.ports = this.exposedPorts;
    this.description = [
      "Islo sandbox",
      `name: ${sandboxName}`,
      `workdir: ${defaultWorkingDirectory}`,
      `bridge ports: ${this.exposedPorts.join(", ")}`,
      `ownsLifecycle: ${ownsLifecycle}`,
    ].join("\n");
  }

  readonly readFile = async (options: {
    path: string;
    abortSignal?: AbortSignal;
  }): Promise<ReadableStream<Uint8Array> | null> => {
    options.abortSignal?.throwIfAborted?.();
    const bytes = await this.readBinaryFile(options);
    if (bytes === null) return null;
    return new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
  };

  readonly readBinaryFile = async (options: {
    path: string;
    abortSignal?: AbortSignal;
  }): Promise<Uint8Array | null> => {
    options.abortSignal?.throwIfAborted?.();
    return readSandboxFile(
      this.ctx,
      this.sandboxName,
      options.path,
      this.defaultWorkingDirectory,
      options.abortSignal,
    );
  };

  readonly readTextFile = async (options: {
    path: string;
    abortSignal?: AbortSignal;
    encoding?: string;
    startLine?: number;
    endLine?: number;
  }): Promise<string | null> => {
    options.abortSignal?.throwIfAborted?.();
    const bytes = await this.readBinaryFile(options);
    if (bytes === null) return null;
    const decoder = new TextDecoder(options.encoding ?? "utf-8");
    const text = decoder.decode(bytes);
    const startLine = options.startLine ?? 1;
    const endLine = options.endLine;
    const lines = text.split("\n");
    const slice = lines.slice(startLine - 1, endLine);
    return slice.join("\n");
  };

  readonly writeFile = async (options: {
    path: string;
    content: ReadableStream<Uint8Array>;
    abortSignal?: AbortSignal;
  }): Promise<void> => {
    options.abortSignal?.throwIfAborted?.();
    const reader = options.content.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      if (options.abortSignal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    await this.writeBinaryFile({
      path: options.path,
      content: merged,
      abortSignal: options.abortSignal,
    });
  };

  readonly writeBinaryFile = async (options: {
    path: string;
    content: Uint8Array;
    abortSignal?: AbortSignal;
  }): Promise<void> => {
    options.abortSignal?.throwIfAborted?.();
    await writeSandboxFile(
      this.ctx,
      this.sandboxName,
      options.path,
      this.defaultWorkingDirectory,
      options.content,
      options.abortSignal,
    );
  };

  readonly writeTextFile = async (options: {
    path: string;
    content: string;
    abortSignal?: AbortSignal;
    encoding?: string;
  }): Promise<void> => {
    options.abortSignal?.throwIfAborted?.();
    const bytes = new TextEncoder().encode(options.content);
    await this.writeBinaryFile({
      path: options.path,
      content: bytes,
      abortSignal: options.abortSignal,
    });
  };

  readonly spawn = async (options: {
    command: string;
    workingDirectory?: string;
    env?: Record<string, string>;
    abortSignal?: AbortSignal;
  }): Promise<Experimental_SandboxProcess> => {
    options.abortSignal?.throwIfAborted?.();
    return spawnSandboxCommand({
      ctx: this.ctx,
      sandboxName: this.sandboxName,
      command: [
        'export CODEX_API_KEY="${CODEX_API_KEY:-${OPENAI_API_KEY:-}}"',
        options.command,
      ].join("; "),
      defaultWorkingDirectory: this.defaultWorkingDirectory,
      workingDirectory:
        options.workingDirectory ?? this.defaultWorkingDirectory,
      env: {
        ...options.env,
        CODEX_HOME: ISLO_CODEX_HOME,
      },
      abortSignal: options.abortSignal,
    });
  };

  readonly run = async (options: {
    command: string;
    workingDirectory?: string;
    env?: Record<string, string>;
    abortSignal?: AbortSignal;
  }): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
    options.abortSignal?.throwIfAborted?.();
    return runSandboxCommand({
      ctx: this.ctx,
      sandboxName: this.sandboxName,
      command: options.command,
      defaultWorkingDirectory: this.defaultWorkingDirectory,
      workingDirectory:
        options.workingDirectory ?? this.defaultWorkingDirectory,
      env: options.env,
      abortSignal: options.abortSignal,
    });
  };

  readonly setPorts = async (
    ports: readonly number[],
    options?: { abortSignal?: AbortSignal },
  ): Promise<void> => {
    options?.abortSignal?.throwIfAborted?.();
    const next = [...ports];
    const removed = this.exposedPorts.filter((port) => !next.includes(port));
    for (const port of removed) {
      const cached = this.shareCache.get(port);
      if (cached) {
        await revokeShare(this.ctx, this.sandboxName, cached);
        this.shareCache.delete(port);
      }
    }
    this.exposedPorts = next;
    (this as { ports: readonly number[] }).ports = this.exposedPorts;
  };

  readonly getPortUrl = async (options: {
    port: number;
    protocol?: "http" | "https" | "ws";
  }): Promise<string> => {
    if (!this.exposedPorts.includes(options.port)) {
      throw new HarnessCapabilityUnsupportedError({
        harnessId: "islo",
        message:
          `Port ${options.port} is not exposed by this sandbox. ` +
          `Exposed ports: ${this.exposedPorts.join(", ") || "(none)"}`,
      });
    }

    const protocol = options.protocol ?? "https";
    let share = this.shareCache.get(options.port);
    if (!share) {
      share =
        (await listReusableShare(
          this.ctx,
          this.sandboxName,
          options.port,
        )) ?? undefined;
    }
    if (!share) {
      share = await createShareForPort(
        this.ctx,
        this.sandboxName,
        options.port,
        this.settings.shareTtlSeconds,
      );
    }
    this.shareCache.set(options.port, share);

    await waitForShareReady(
      share,
      protocol === "ws" ? "ws" : protocol,
      this.settings.shareReadiness,
    );

    if (protocol === "ws") {
      return shareUrlToWebSocketUrl(share.url, "ws");
    }
    return shareUrlToWebSocketUrl(share.url, protocol);
  };

  readonly stop = async (): Promise<void> => {
    clearActiveSpawnsForSandbox(this.sandboxName);
    await this.revokeShares();
    await this.ctx.client.sandboxes
      .stopSandbox({ sandbox_name: this.sandboxName })
      .catch(() => undefined);
  };

  readonly destroy = async (): Promise<void> => {
    clearActiveSpawnsForSandbox(this.sandboxName);
    await this.revokeShares();
    if (!this.ownsLifecycle) {
      return;
    }
    await this.ctx.client.sandboxes
      .deleteSandbox({ sandbox_name: this.sandboxName })
      .catch(() => undefined);
  };

  readonly restricted = (): Experimental_SandboxSession => {
    const {
      readFile,
      readBinaryFile,
      readTextFile,
      writeFile,
      writeBinaryFile,
      writeTextFile,
      spawn,
      run,
      description,
    } = this;
    return {
      description,
      readFile,
      readBinaryFile,
      readTextFile,
      writeFile,
      writeBinaryFile,
      writeTextFile,
      spawn,
      run,
    };
  };

  private async revokeShares(): Promise<void> {
    for (const [, share] of this.shareCache) {
      await revokeShare(this.ctx, this.sandboxName, share);
    }
    this.shareCache.clear();
  }
}

interface ResolvedSessionSettings {
  image: string;
  gatewayProfile?: string | null;
  internetEnabled: boolean;
  lifecycle?: IsloSandboxSettings["lifecycle"];
  shareTtlSeconds: number;
  shareReadiness: NonNullable<IsloSandboxSettings["shareReadiness"]>;
}

function resolveSessionSettings(
  settings: IsloSandboxSettings,
): ResolvedSessionSettings {
  return {
    image: settings.image ?? ISLO_AI_SDK_RUNNER_IMAGE,
    gatewayProfile: settings.gatewayProfile,
    internetEnabled: settings.internetEnabled ?? true,
    lifecycle: settings.lifecycle,
    shareTtlSeconds: settings.shareTtlSeconds ?? DEFAULT_SHARE_TTL_SECONDS,
    shareReadiness: settings.shareReadiness ?? {},
  };
}

async function createOrReuseSandbox(options: {
  ctx: IsloClientContext;
  sandboxName: string;
  image: string;
  snapshotName?: string | null;
  gatewayProfile?: string | null;
  internetEnabled?: boolean;
  lifecycle?: LifecyclePolicy | null;
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

export async function createIsloHarnessSandboxSession(options: {
  ctx: IsloClientContext;
  sandboxName: string;
  settings: IsloSandboxSettings;
  abortSignal?: AbortSignal;
  ports?: readonly number[];
  onFirstCreate?: (
    session: Experimental_SandboxSession,
    opts: { abortSignal?: AbortSignal },
  ) => Promise<void>;
  ownsLifecycle: boolean;
}): Promise<{ session: IsloNetworkSandboxSession; isFreshCreate: boolean }> {
  options.abortSignal?.throwIfAborted?.();

  const sessionSettings = resolveSessionSettings(options.settings);
  const ports = options.ports ?? options.settings.ports ?? [ISLO_AI_SDK_BRIDGE_PORT];
  let isFreshCreate = false;
  let sandboxName = options.sandboxName;

  try {
    const result = await createOrReuseSandbox({
      ctx: options.ctx,
      sandboxName,
      image: sessionSettings.image,
      snapshotName: options.settings.snapshotName,
      gatewayProfile: sessionSettings.gatewayProfile,
      internetEnabled: sessionSettings.internetEnabled,
      lifecycle: sessionSettings.lifecycle,
      abortSignal: options.abortSignal,
    });
    sandboxName = result.name;
    isFreshCreate = result.isFreshCreate;
  } catch (error) {
    throw new Error(formatIsloError(error));
  }

  try {
    const ready = await waitUntilSandboxReady(
      options.ctx,
      sandboxName,
      options.abortSignal,
    );

    const defaultWorkingDirectory =
      options.settings.workingDirectory ??
      ready.workdir ??
      ISLO_DEFAULT_WORKDIR;

    await ensureRunnerHarnessReady(
      options.ctx,
      ready.name,
      defaultWorkingDirectory,
      options.abortSignal,
    );

    const session = new IsloNetworkSandboxSession(
      options.ctx,
      ready.name,
      defaultWorkingDirectory,
      ports,
      sessionSettings,
      options.ownsLifecycle,
    );

    if (isFreshCreate && options.onFirstCreate) {
      try {
        await options.onFirstCreate(session.restricted(), {
          abortSignal: options.abortSignal,
        });
      } catch (error) {
        await session.destroy().catch(() => undefined);
        throw error;
      }
    }

    return { session, isFreshCreate };
  } catch (error) {
    if (isFreshCreate && options.ownsLifecycle) {
      await options.ctx.client.sandboxes
        .deleteSandbox({ sandbox_name: sandboxName })
        .catch(() => undefined);
    }
    throw new Error(formatIsloError(error));
  }
}

export async function resumeIsloHarnessSandboxSession(options: {
  ctx: IsloClientContext;
  sandboxName: string;
  settings: IsloSandboxSettings;
  abortSignal?: AbortSignal;
  ports?: readonly number[];
  ownsLifecycle: boolean;
}): Promise<IsloNetworkSandboxSession> {
  options.abortSignal?.throwIfAborted?.();

  const ready = await waitUntilSandboxReady(
    options.ctx,
    options.sandboxName,
    options.abortSignal,
  );

  const defaultWorkingDirectory =
    options.settings.workingDirectory ??
    ready.workdir ??
    ISLO_DEFAULT_WORKDIR;

  await ensureRunnerHarnessReady(
    options.ctx,
    ready.name,
    defaultWorkingDirectory,
    options.abortSignal,
  );

  const sessionSettings = resolveSessionSettings(options.settings);
  const ports = options.ports ?? options.settings.ports ?? [ISLO_AI_SDK_BRIDGE_PORT];

  return new IsloNetworkSandboxSession(
    options.ctx,
    ready.name,
    defaultWorkingDirectory,
    ports,
    sessionSettings,
    options.ownsLifecycle,
  );
}

export { resolveSandboxPath };
