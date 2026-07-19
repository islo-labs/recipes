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
const DEFAULT_SHARE_CONNECTION_TIMEOUT_MS = 15_000;
const SHARE_CONNECTION_INITIAL_DELAY_MS = 250;
const SHARE_CONNECTION_MAX_DELAY_MS = 2_000;

interface ShareCacheEntry {
  shareId: string;
  url: string;
  expiresAt?: string | null;
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
  private readonly shareConnectionTimeoutMs: number;
  private readonly ownsLifecycle: boolean;

  constructor(input: {
    ctx: IsloClientContext;
    sandboxName: string;
    defaultWorkingDirectory: string;
    ports: readonly number[];
    shareTtlSeconds: number;
    shareConnectionTimeoutMs?: number;
    ownsLifecycle: boolean;
  }) {
    super(input.ctx, input.sandboxName, input.defaultWorkingDirectory);
    this.id = input.sandboxName;
    this.exposedPorts = [...input.ports];
    this.ports = this.exposedPorts;
    this.shareTtlSeconds = input.shareTtlSeconds;
    this.shareConnectionTimeoutMs =
      input.shareConnectionTimeoutMs ?? DEFAULT_SHARE_CONNECTION_TIMEOUT_MS;
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
    let reusedExistingShare = false;
    if (!share) {
      const existing = await listReusableShare(
        this.ctx,
        this.sandboxName,
        options.port,
      );
      if (existing) {
        share = existing;
        reusedExistingShare = true;
      }
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

    // Reused shares were already validated when first created. Fresh shares
    // still need a reachability check before handing the URL to the harness.
    if (!reusedExistingShare) {
      await verifyShareReachable(
        share,
        protocol === "ws" ? "ws" : protocol,
        this.shareConnectionTimeoutMs,
      );
    }

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

async function verifyShareReachable(
  share: ShareCacheEntry,
  protocol: "http" | "https" | "ws",
  timeoutMs: number,
  abortSignal?: AbortSignal,
): Promise<void> {
  const target = shareUrlToWebSocketUrl(share.url, protocol === "ws" ? "ws" : protocol);
  const controller = new AbortController();
  const onAbort = () => controller.abort(abortSignal?.reason);
  abortSignal?.throwIfAborted?.();
  abortSignal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const deadline = Date.now() + timeoutMs;
  let delayMs = SHARE_CONNECTION_INITIAL_DELAY_MS;

  try {
    while (!controller.signal.aborted) {
      const reachable =
        protocol === "ws"
          ? await probeWebSocketShare(target, controller.signal)
          : await probeHttpShare(target, controller.signal);
      if (reachable) {
        return;
      }

      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        break;
      }
      await sleep(Math.min(delayMs, remainingMs), controller.signal);
      delayMs = Math.min(delayMs * 2, SHARE_CONNECTION_MAX_DELAY_MS);
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      throw error;
    }
  } finally {
    clearTimeout(timer);
    abortSignal?.removeEventListener("abort", onAbort);
  }

  abortSignal?.throwIfAborted?.();
  throw new Error(
    `Timed out connecting to share ${share.shareId} over ${protocol} within ${timeoutMs}ms`,
  );
}

async function sleep(ms: number, abortSignal: AbortSignal): Promise<void> {
  abortSignal.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      abortSignal.removeEventListener("abort", onAbort);
      reject(abortSignal.reason);
    };
    const timer = setTimeout(() => {
      abortSignal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    abortSignal.addEventListener("abort", onAbort, { once: true });
  });
}

async function probeHttpShare(
  url: string,
  abortSignal: AbortSignal,
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

    let ws: WebSocket;
    try {
      ws = new WebSocketCtor(wssUrl);
    } catch {
      resolve(false);
      return;
    }

    let settled = false;
    const finish = (reachable: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      ws.removeEventListener("open", onOpen);
      ws.removeEventListener("error", onError);
      ws.removeEventListener("close", onClose);
      abortSignal?.removeEventListener("abort", onAbort);
      try {
        ws.close();
      } catch {
        // The probe is already settled.
      }
      resolve(reachable);
    };
    const onOpen = () => finish(true);
    const onError = () => finish(false);
    const onClose = (event: CloseEvent) => {
      // Harness bridges reject unauthenticated probes with 1008. That still
      // proves the share routes to a live bridge listener.
      if (event.code === 1008) {
        finish(true);
      }
    };
    const onAbort = () => finish(false);

    ws.addEventListener("open", onOpen, { once: true });
    ws.addEventListener("error", onError, { once: true });
    ws.addEventListener("close", onClose, { once: true });
    abortSignal?.addEventListener("abort", onAbort, { once: true });
  });
}
