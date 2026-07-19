type LogLevel = "debug" | "info" | "warn" | "error";

export interface ChatLogger {
  debug: (message: string, data?: Record<string, unknown>) => void;
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
}

function isLoggingEnabled(): boolean {
  return (
    process.env.ISLO_CHAT_DEBUG === "true" ||
    process.env.NODE_ENV === "development"
  );
}

function writeLog(
  requestId: string,
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>,
): void {
  const alwaysLog = level === "error" || level === "warn";
  if (!alwaysLog && !isLoggingEnabled()) return;

  const prefix = `[islo-chat:${requestId}]`;
  const payload = data ? ` ${JSON.stringify(data)}` : "";
  const line = `${prefix} ${message}${payload}`;

  switch (level) {
    case "debug":
      console.debug(line);
      break;
    case "info":
      console.info(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "error":
      console.error(line);
      break;
  }
}

export function createChatLogger(requestId: string): ChatLogger {
  return {
    debug: (message, data) => writeLog(requestId, "debug", message, data),
    info: (message, data) => writeLog(requestId, "info", message, data),
    warn: (message, data) => writeLog(requestId, "warn", message, data),
    error: (message, data) => writeLog(requestId, "error", message, data),
  };
}

export function createRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function previewText(text: string, maxLength = 120): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}
