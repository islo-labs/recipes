import { createHash } from "node:crypto";
import { Islo } from "@islo-labs/sdk";
import type { IsloSandboxSettings } from "./types.js";

/** Codex harness bridge port exposed via Islo shares. */
export const ISLO_AI_SDK_BRIDGE_PORT = 4000;

/** Pre-warmed AI SDK Harness runner image. */
export const ISLO_AI_SDK_RUNNER_IMAGE =
  "ghcr.io/islo-labs/islo-ai-sdk-runner:latest";

/** Fallback when the sandbox record has no workdir. */
export const ISLO_DEFAULT_WORKDIR = "/workspace";

export const ISLO_SANDBOX_NAME_PREFIX = "harness-chat-";

export const DEFAULT_SHARE_TTL_SECONDS = 86_400;

export const DEFAULT_SHARE_READINESS = {
  initialDelayMs: 250,
  maxDelayMs: 2_000,
  timeoutMs: 60_000,
  pollIntervalMs: 500,
} as const;

const SANDBOX_NAME_MAX_LENGTH = 63;
const HASH_SUFFIX_LENGTH = 10;

export interface IsloClientContext {
  readonly client: Islo;
  readonly computeUrl: string;
  readonly controlUrl: string;
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

export function shareUrlToWebSocketUrl(
  shareUrl: string,
  protocol: "http" | "https" | "ws" = "ws",
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

export function resolveIsloSettings(
  settings: IsloSandboxSettings = {},
): Required<
  Pick<IsloSandboxSettings, "apiKey" | "baseUrl" | "computeUrl">
> &
  IsloSandboxSettings {
  const apiKey =
    settings.apiKey ??
    process.env.ISLO_API_KEY ??
    process.env.ISLO_API_TOKEN ??
    "";

  if (!apiKey) {
    throw new Error("Missing Islo API key. Set ISLO_API_KEY or pass apiKey.");
  }

  return {
    ...settings,
    apiKey,
    baseUrl: settings.baseUrl ?? process.env.ISLO_BASE_URL ?? "https://api.islo.dev",
    computeUrl:
      settings.computeUrl ??
      process.env.ISLO_COMPUTE_URL ??
      "https://ca.compute.islo.dev",
  };
}

export function createIsloClientContext(
  settings: IsloSandboxSettings = {},
): IsloClientContext {
  const resolved = resolveIsloSettings(settings);

  if (resolved.client) {
    return {
      client: resolved.client,
      computeUrl: resolved.computeUrl,
      controlUrl: resolved.baseUrl,
    };
  }

  return {
    client: new Islo({
      apiKey: resolved.apiKey,
      baseUrl: resolved.baseUrl,
      computeUrl: resolved.computeUrl,
    }),
    computeUrl: resolved.computeUrl,
    controlUrl: resolved.baseUrl,
  };
}

export async function fetchCompute(
  ctx: IsloClientContext,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = new URL(path.replace(/^\//, ""), ctx.computeUrl).toString();
  const response = await ctx.client.fetch(url, init, {
    abortSignal: init.signal ?? undefined,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      body || `Islo compute request failed with status ${response.status}`,
    );
  }

  return response;
}

export function isNotFoundError(error: unknown): boolean {
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
