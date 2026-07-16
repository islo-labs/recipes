import {
  DEFAULT_SHARE_READINESS,
  shareUrlToWebSocketUrl,
  type IsloClientContext,
} from "./client.js";

export interface ShareCacheEntry {
  shareId: string;
  url: string;
  expiresAt?: string | null;
}

export interface ShareReadinessOptions {
  initialDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

function isShareExpired(entry: { expiresAt?: string | null; expires_at?: string | null }): boolean {
  const expiresAt = entry.expiresAt ?? entry.expires_at;
  if (!expiresAt) {
    return false;
  }
  return Date.parse(expiresAt) <= Date.now();
}

export async function listReusableShare(
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

export async function createShareForPort(
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
    const response = await fetch(url, {
      method: "GET",
      signal: abortSignal,
    });
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

    ws.addEventListener(
      "open",
      () => {
        ws.close();
        cleanup(true);
      },
      { once: true },
    );
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

export async function waitForShareReady(
  share: ShareCacheEntry,
  protocol: "http" | "https" | "ws",
  readiness: ShareReadinessOptions = {},
  abortSignal?: AbortSignal,
): Promise<void> {
  const config = {
    ...DEFAULT_SHARE_READINESS,
    ...readiness,
  };

  const startedAt = Date.now();
  let delayMs = config.initialDelayMs;

  while (Date.now() - startedAt < config.timeoutMs) {
    abortSignal?.throwIfAborted?.();

    if (protocol === "ws") {
      const wssUrl = shareUrlToWebSocketUrl(share.url, "ws");
      if (await probeWebSocketShare(wssUrl, abortSignal)) {
        return;
      }
    } else {
      const httpUrl = shareUrlToWebSocketUrl(
        share.url,
        protocol === "https" ? "https" : "http",
      );
      if (await probeHttpShare(httpUrl, abortSignal)) {
        return;
      }
    }

    await sleep(delayMs, abortSignal);
    delayMs = Math.min(delayMs * 2, config.maxDelayMs);
  }

  throw new Error(
    `Timed out waiting for share ${share.shareId} to become reachable over ${protocol}`,
  );
}

export async function revokeShare(
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
