import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { getAgent } from "@/lib/agent";
import {
  clearHarnessResumeState,
  getHarnessResumeState,
  setHarnessResumeState,
} from "@/lib/harness-session";
import { createChatLogger, createRequestId } from "@/lib/chat-log";
import {
  deleteSandboxByName,
  formatIsloError,
  sandboxNameForSession,
} from "@islo-labs/ai-sdk-sandbox";

export const maxDuration = 300;

export async function POST(req: Request) {
  const requestId = createRequestId();
  const log = createChatLogger(requestId);
  const body = (await req.json()) as {
    messages: UIMessage[];
    id?: string;
  };
  const { messages, id: chatId } = body;

  if (!chatId) {
    return new Response("Missing chat id", { status: 400 });
  }

  if (!messages?.length) {
    return new Response("Missing messages", { status: 400 });
  }

  log.info("harness chat request", {
    chatId,
    messageCount: messages.length,
  });

  const agent = getAgent();
  const resumeFrom = getHarnessResumeState(chatId);
  const sandboxName = sandboxNameForSession(chatId);

  let session;
  try {
    session = await agent.createSession(
      resumeFrom
        ? { sessionId: chatId, resumeFrom, abortSignal: req.signal }
        : { sessionId: chatId, abortSignal: req.signal },
    );
  } catch (error) {
    log.error("harness createSession failed", {
      chatId,
      sandboxName,
      error: error instanceof Error ? error.message : String(error),
    });
    if (!resumeFrom) {
      try {
        await deleteSandboxByName(sandboxName, {}, req.signal);
        log.info("deleted sandbox after failed createSession", { sandboxName });
      } catch {
        // Best-effort cleanup.
      }
    }
    clearHarnessResumeState(chatId);
    return new Response(formatIsloError(error), {
      status:
        error != null &&
        typeof error === "object" &&
        "statusCode" in error &&
        error.statusCode === 429
          ? 429
          : 500,
    });
  }

  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      try {
        const modelMessages = await convertToModelMessages(messages);
        const result = await agent.stream({
          session,
          messages: modelMessages,
          abortSignal: req.signal,
        });

        writer.merge(
          toUIMessageStream({
            stream: result.stream,
            originalMessages: messages,
          }),
        );

        await result.text;
      } catch (error) {
        log.error("harness stream failed", {
          chatId,
          error: error instanceof Error ? error.message : String(error),
        });
        try {
          await session.destroy();
        } catch {
          // Ignore cleanup errors after a failed turn.
        }
        clearHarnessResumeState(chatId);
        throw error;
      }
    },
    onFinish: async () => {
      try {
        const resumeState = await session.detach();
        setHarnessResumeState(chatId, resumeState);
        log.info("harness session detached", { chatId });
      } catch (error) {
        log.error("failed to detach harness session", {
          chatId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    onError: (error) =>
      error instanceof Error ? error.message : "Harness request failed",
  });

  return createUIMessageStreamResponse({ stream });
}

export async function DELETE(req: Request) {
  const log = createChatLogger(createRequestId());
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  const chatId =
    body.id ?? new URL(req.url).searchParams.get("id") ?? undefined;

  if (!chatId) {
    return new Response("Missing chat id", { status: 400 });
  }

  const resumeFrom = getHarnessResumeState(chatId);
  const sandboxName = sandboxNameForSession(chatId);

  if (resumeFrom) {
    try {
      const agent = getAgent();
      const session = await agent.createSession({
        sessionId: chatId,
        resumeFrom,
        abortSignal: req.signal,
      });
      await session.destroy();
      log.info("destroyed harness session", { chatId, sandboxName });
    } catch (error) {
      log.warn("harness destroy failed; deleting sandbox directly", {
        chatId,
        sandboxName,
        error: error instanceof Error ? error.message : String(error),
      });
      try {
        await deleteSandboxByName(sandboxName, {}, req.signal);
      } catch (deleteError) {
        log.warn("sandbox delete failed", {
          sandboxName,
          error:
            deleteError instanceof Error
              ? deleteError.message
              : String(deleteError),
        });
      }
    }
  } else {
    try {
      await deleteSandboxByName(sandboxName, {}, req.signal);
      log.info("deleted sandbox", { chatId, sandboxName });
    } catch (error) {
      log.warn("sandbox delete skipped", {
        sandboxName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  clearHarnessResumeState(chatId);

  return new Response(null, { status: 204 });
}
