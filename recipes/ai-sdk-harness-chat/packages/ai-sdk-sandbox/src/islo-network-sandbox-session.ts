import {
  HarnessCapabilityUnsupportedError,
  type HarnessV1NetworkSandboxSession,
} from "@ai-sdk/harness";
import type { Experimental_SandboxSession } from "@ai-sdk/provider-utils";
import type { IsloClientContext } from "./islo-sandbox.js";
import {
  clearActiveSpawnsForSandbox,
  IsloSandboxSession,
} from "./islo-sandbox-session.js";

const ISLO_PROVIDER_ID = "islo";

const DEFAULT_SHARE_READINESS = {
  initialDelayMs: 250,
  maxDelayMs: 2_000,
  timeoutMs: 60_000,
  pollIntervalMs: 500,
} as const;

interface ShareCacheEntry {
  shareId: string;
  url: string;
  expiresAt?: string | null;
}

interface ShareReadinessOptions {
  initialDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

/**
 * Network sandbox session: ports, shares, lifecycle. Extends the tool-safe
 * {@link IsloSandboxSession} surface with bridge URL exposure.
 */
export class IsloNetworkSandboxSession
  extends IsloSandboxSession
  implements HarnessV1NetworkSandboxSession
{
  readonly id: string;
  readonly ports: readonly number[];
  private readonly shareCache = new Map<number, ShareCacheEntry>();
  private exposedPorts: number[];
  private readonly shareTtlSeconds: number;
  private readonly shareReadiness: ShareReadinessOptions;
  private readonly ownsLifecycle: boolean;

  constructor(input: {
    ctx: IsloClientContext;
    sandboxName: string;
    defaultWorkingDirectory: string;
    ports: readonly number[];
    shareTtlSeconds: number;
    shareReadiness: ShareReadinessOptions;
    ownsLifecycle: boolean;
  }) {
    super(input.ctx, input.sandboxName, input.defaultWorkingDirectory);
    this.id = input.sandboxName;
    this.exposedPorts = [...input.ports];
    this.ports = this.exposedPorts;
    this.shareTtlSeconds = input.shareTtlSeconds;
    this.shareReadiness = input.shareReadiness;
    this.ownsLifecycle = input.ownsLifecycle;
  }

  restricted(): Experimental_SandboxSession {
    return new IsloSandboxSession(
      this.ctx,
      this.sandboxName,
      this.defaultWorkingDirectory,
    );
  }

  getPortUrl = async (options: {
    port: number;
    protocol?: "http" | "https" | "ws";
  }): Promise<string> => {
    if (!this.exposedPorts.includes(options.port)) {
      throw new HarnessCapabilityUnsupportedError({
        harnessId: ISLO_PROVIDER_ID,
        message:
          `Port ${options.port} is not exposed on this sandbox. ` +
          `Exposed ports: [${this.exposedPorts.join(", ")}].`,
      });
    }

    const protocol = options.protocol ?? "https";
    let share = this.shareCache.get(options.port);
    if (!share) {
      share =
        (await listReusableShare(this.ctx, this.sandboxName, options.port)) ??
        undefined;
    }
    if (!share) {
      share = await createShareForPort(
        this.ctx,
        this.sandboxName,
        options.port,
        this.shareTtlSeconds,
      );
    }
    this.shareCache.set(options.port, share);

    await waitForShareReady(
      share,
      protocol === "ws" ? "ws" : protocol,
      this.shareReadiness,
    );

    return shareUrlToWebSocketUrl(share.url, protocol === "ws" ? "ws" : protocol);
  };

  setPorts = async (
    ports: readonly number[],
    options?: { abortSignal?: AbortSignal },
  ): Promise<void> => {
    options?.abortSignal?.throwIfAborted?.();
    const next = [...ports];
    for (const port of this.exposedPorts) {
      if (!next.includes(port)) {
        const cached = this.shareCache.get(port);
        if (cached) {
          await revokeShare(this.ctx, this.sandboxName, cached);
          this.shareCache.delete(port);
        }
      }
    }
    this.exposedPorts = next;
    (this as { ports: readonly number[] }).ports = this.exposedPorts;
  };

  stop = async (): Promise<void> => {
    clearActiveSpawnsForSandbox(this.sandboxName);
    await this.revokeShares();
    if (!this.ownsLifecycle) {
      return;
    }
    await this.ctx.client.sandboxes
      .stopSandbox({ sandbox_name: this.sandboxName })
      .catch(() => undefined);
  };

  destroy = async (): Promise<void> => {
    clearActiveSpawnsForSandbox(this.sandboxName);
    await this.revokeShares();
    if (!this.ownsLifecycle) {
      return;
    }
    await this.ctx.client.sandboxes
      .deleteSandbox({ sandbox_name: this.sandboxName })
      .catch(() => undefined);
  };

  private async revokeShares(): Promise<void> {
    for (const [, share] of this.shareCache) {
      await revokeShare(this.ctx, this.sandboxName, share);
    }
    this.shareCache.clear();
  }
}

function shareUrlToWebSocketUrl(
  shareUrl: string,
  protocol: "http" | "https" | "ws",
): string {
  const url = new URL(shareUrl);
  if (protocol === "ws") {
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
  }
  if (protocol === "https") {
    url.protocol = "https:";
    return url.toString();
  }
  url.protocol = "http:";
  return url.toString();
}

function isShareExpired(entry: {
  expiresAt?: string | null;
  expires_at?: string | null;
}): boolean {
  const expiresAt = entry.expiresAt ?? entry.expires_at;
  if (!expiresAt) {
    return false;
  }
  return Date.parse(expiresAt) <= Date.now();
}

async function listReusableShare(
  ctx: IsloClientContext,
  sandboxName: string,
  port: number,
  abortSignal?: AbortSignal,
): Promise<ShareCacheEntry | null> {
  const shares = await ctx.client.shares.listShares(
    { sandbox_name: sandboxName },
    { abortSignal },
  );
  const match = shares.find(
    (share) => share.port === port && !isShareExpired(share),
  );
  if (!match) {
    return null;
  }
  return {
    shareId: match.share_id,
    url: match.url,
    expiresAt: match.expires_at,
  };
}

async function createShareForPort(
  ctx: IsloClientContext,
  sandboxName: string,
  port: number,
  ttlSeconds?: number,
  abortSignal?: AbortSignal,
): Promise<ShareCacheEntry> {
  const share = await ctx.client.shares.createShare(
    {
      sandbox_name: sandboxName,
      port,
      ttl_seconds: ttlSeconds ?? null,
    },
    { abortSignal },
  );
  return {
    shareId: share.share_id,
    url: share.url,
    expiresAt: share.expires_at,
  };
}

async function revokeShare(
  ctx: IsloClientContext,
  sandboxName: string,
  share: ShareCacheEntry,
): Promise<void> {
  try {
    await ctx.client.shares.revokeShare({
      sandbox_name: sandboxName,
      share_id: share.shareId,
    });
  } catch {
    // Best-effort cleanup.
  }
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

async function probeHttpShare(
  url: string,
  abortSignal?: AbortSignal,
): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "GET", signal: abortSignal });
    return response.status !== 404;
  } catch {
    return false;
  }
}

async function probeWebSocketShare(
  wssUrl: string,
  abortSignal?: AbortSignal,
): Promise<boolean> {
  return new Promise((resolve) => {
    if (abortSignal?.aborted) {
      resolve(false);
      return;
    }
    const WebSocketCtor = globalThis.WebSocket;
    if (!WebSocketCtor) {
      resolve(false);
      return;
    }

    const ws = new WebSocketCtor(wssUrl);
    const timer = setTimeout(() => {
      ws.close();
      resolve(false);
    }, 5_000);

    const cleanup = (result: boolean) => {
      clearTimeout(timer);
      resolve(result);
    };

    ws.addEventListener("open", () => {
      ws.close();
      cleanup(true);
    }, { once: true });
    ws.addEventListener("error", () => cleanup(false), { once: true });
    abortSignal?.addEventListener(
      "abort",
      () => {
        ws.close();
        cleanup(false);
      },
      { once: true },
    );
  });
}

async function waitForShareReady(
  share: ShareCacheEntry,
  protocol: "http" | "https" | "ws",
  readiness: ShareReadinessOptions = {},
  abortSignal?: AbortSignal,
): Promise<void> {
  const config = { ...DEFAULT_SHARE_READINESS, ...readiness };
  const startedAt = Date.now();
  let delayMs = config.initialDelayMs;

  while (Date.now() - startedAt < config.timeoutMs) {
    abortSignal?.throwIfAborted?.();
    if (protocol === "ws") {
      if (await probeWebSocketShare(shareUrlToWebSocketUrl(share.url, "ws"), abortSignal)) {
        return;
      }
    } else if (
      await probeHttpShare(
        shareUrlToWebSocketUrl(share.url, protocol),
        abortSignal,
      )
    ) {
      return;
    }
    await sleep(delayMs, abortSignal);
    delayMs = Math.min(delayMs * 2, config.maxDelayMs);
  }

  throw new Error(
    `Timed out waiting for share ${share.shareId} to become reachable over ${protocol}`,
  );
}
