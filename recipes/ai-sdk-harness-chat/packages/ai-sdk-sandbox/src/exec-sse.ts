export interface ExecSseMessage {
  eventType: string | null;
  data: string;
}

export function extractExecSseMessage(buffer: string): {
  buffer: string;
  message: ExecSseMessage | null;
} {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const separatorIndex = normalized.indexOf("\n\n");
  if (separatorIndex === -1) {
    return { buffer: normalized, message: null };
  }

  const rawEvent = normalized.slice(0, separatorIndex);
  const rest = normalized.slice(separatorIndex + 2);

  let eventType: string | null = null;
  const dataLines: string[] = [];

  for (const line of rawEvent.split("\n")) {
    if (line.startsWith("event:")) {
      eventType = line.slice("event:".length).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return { buffer: rest, message: null };
  }

  return {
    buffer: rest,
    message: {
      eventType,
      data: dataLines.join("\n"),
    },
  };
}
