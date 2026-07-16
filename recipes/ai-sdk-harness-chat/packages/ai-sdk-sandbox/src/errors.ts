export class IsloSandboxError extends Error {
  readonly statusCode?: number;
  readonly code?: string;
  readonly sandboxName?: string;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      code?: string;
      sandboxName?: string;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = "IsloSandboxError";
    this.statusCode = options?.statusCode;
    this.code = options?.code;
    this.sandboxName = options?.sandboxName;
  }
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

export function isConflictError(error: unknown): boolean {
  if (error == null || typeof error !== "object") {
    return false;
  }
  if ("statusCode" in error && (error.statusCode === 409 || error.statusCode === 400)) {
    return true;
  }
  const body =
    "body" in error && error.body != null && typeof error.body === "object"
      ? (error.body as { code?: string })
      : undefined;
  return body?.code === "CONFLICT" || body?.code === "ALREADY_EXISTS";
}

export function formatIsloError(error: unknown): string {
  if (error instanceof IsloSandboxError) {
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

  if (
    error instanceof Error &&
    /Unexpected server response: 404/i.test(error.message)
  ) {
    return (
      "Codex bridge WebSocket upgrade failed (404 on share URL). " +
      "Verify the bridge is listening and share propagation has completed."
    );
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Islo request failed";
}

export function toIsloSandboxError(
  error: unknown,
  sandboxName?: string,
): IsloSandboxError {
  if (error instanceof IsloSandboxError) {
    return error;
  }

  const statusCode =
    error != null &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
      ? error.statusCode
      : undefined;
  const body =
    error != null &&
    typeof error === "object" &&
    "body" in error &&
    error.body != null &&
    typeof error.body === "object"
      ? (error.body as { code?: string; message?: string })
      : undefined;

  return new IsloSandboxError(
    formatIsloError(error),
    {
      statusCode,
      code: body?.code,
      sandboxName,
      cause: error,
    },
  );
}
