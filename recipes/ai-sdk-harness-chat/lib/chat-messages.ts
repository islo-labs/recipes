import type { UIMessage } from "ai";

/** HarnessAgent only needs the latest user turn; skip replaying full history. */
export function latestUserMessage(
  messages: UIMessage[],
): UIMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user") {
      return message;
    }
  }
  return undefined;
}
