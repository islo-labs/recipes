import type {
  HarnessAgentResumeSessionState,
  HarnessAgentSession,
} from "@ai-sdk/harness/agent";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
  type UIMessageStreamWriter,
} from "ai";
import { getAgent } from "@/lib/agent";
import { latestUserMessage } from "@/lib/chat-messages";
import {
  clearHarnessResumeState,
  clearLiveHarnessSession,
  getHarnessResumeState,
  getLiveHarnessSession,
  setHarnessResumeState,
  setLiveHarnessSession,
} from "@/lib/harness-session";
import {
  HARNESS_STATUS_DATA_TYPE,
  harnessStatus,
} from "@/lib/harness-status";
import { createChatLogger, createRequestId } from "@/lib/chat-log";
import {
  deleteSandboxByName,
  sandboxNameForSession,
} from "@islo-labs/islo-ai-sdk-sandbox";

export const maxDuration = 300;

function writeHarnessStatus(
  writer: UIMessageStreamWriter<UIMessage>,
  stage: Parameters<typeof harnessStatus>[0],
  message?: string,
): void {
  writer.write({
    type: HARNESS_STATUS_DATA_TYPE,
    id: "harness-status",
    data: harnessStatus(stage, message),
    transient: true,
  });
}

function isBridgePortConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("EADDRINUSE") && message.includes("4000");
}

function isRecoverableSandboxState(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    isBridgePortConflict(error) ||
    /sandbox '[^']+' is stopped/i.test(message)
  );
}

async function detachHarnessSession(
  session: HarnessAgentSession,
  chatId: string,
  log: ReturnType<typeof createChatLogger>,
): Promise<HarnessAgentResumeSessionState | undefined> {
  try {
    const resumeFrom = await session.detach();
    setHarnessResumeState(chatId, resumeFrom);
    log.info("harness session detached", { chatId });
    return resumeFrom;
  } catch (error) {
    log.warn("harness session detach failed", {
      chatId,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  } finally {
    clearLiveHarnessSession(chatId);
  }
}

async function createHarnessSession(options: {
  agent: ReturnType<typeof getAgent>;
  chatId: string;
  resumeFrom?: HarnessAgentResumeSessionState;
  sandboxName: string;
  abortSignal: AbortSignal;
  log: ReturnType<typeof createChatLogger>;
}): Promise<HarnessAgentSession> {
  const create = () =>
    options.agent.createSession(
      options.resumeFrom
        ? {
            sessionId: options.chatId,
            resumeFrom: options.resumeFrom,
            abortSignal: options.abortSignal,
          }
        : { sessionId: options.chatId, abortSignal: options.abortSignal },
    );

  try {
    return await create();
  } catch (error) {
    if (options.resumeFrom || !isRecoverableSandboxState(error)) {
      throw error;
    }

    // Dev-server restarts drop in-memory resume state while the sandbox bridge
    // keeps listening on :4000. A failed turn can also leave a stopped sandbox.
    options.log.warn("resetting orphan harness sandbox", {
      chatId: options.chatId,
      sandboxName: options.sandboxName,
      error: error instanceof Error ? error.message : String(error),
    });
    clearHarnessResumeState(options.chatId);
    await deleteSandboxByName(
      options.sandboxName,
      {},
      options.abortSignal,
    ).catch(() => undefined);
    return await create();
  }
}

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

  const lastUser = latestUserMessage(messages);
  if (!lastUser) {
    return new Response("Missing user message", { status: 400 });
  }

  log.info("harness chat request", {
    chatId,
    messageCount: messages.length,
    turnMessageCount: 1,
  });

  const agent = getAgent();
  const resumeFrom = getHarnessResumeState(chatId);
  const sandboxName = sandboxNameForSession(chatId);

  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      let session = getLiveHarnessSession(chatId);
      let createdSession = false;

      try {
        if (session) {
          writeHarnessStatus(writer, "ready", "Reusing live harness session");
        } else {
          writeHarnessStatus(writer, "starting");
          writeHarnessStatus(
            writer,
            resumeFrom ? "bridge" : "sandbox",
            resumeFrom
              ? "Reconnecting to Codex bridge…"
              : "Creating Islo sandbox…",
          );

          if (!resumeFrom) {
            writeHarnessStatus(writer, "bootstrap");
          }

          session = await createHarnessSession({
            agent,
            chatId,
            resumeFrom,
            sandboxName,
            abortSignal: req.signal,
            log,
          });
          createdSession = true;
          setLiveHarnessSession(chatId, session);
          writeHarnessStatus(writer, "ready");
        }

        writeHarnessStatus(writer, "streaming");

        const modelMessages = await convertToModelMessages([lastUser]);
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

        if (session) {
          const detached = await detachHarnessSession(session, chatId, log);
          if (!detached) {
            try {
              await session.destroy();
            } catch {
              // Ignore cleanup errors after a failed turn.
            }
            if (!resumeFrom && createdSession) {
              try {
                await deleteSandboxByName(sandboxName, {}, req.signal);
                log.info("deleted sandbox after failed turn", { sandboxName });
              } catch {
                // Best-effort cleanup.
              }
            }
            clearHarnessResumeState(chatId);
          }
        }

        throw error;
      }
    },
    onFinish: async () => {
      const session = getLiveHarnessSession(chatId);
      if (session) {
        await detachHarnessSession(session, chatId, log);
      }

      log.info("harness turn complete", { chatId });
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
  const liveSession = getLiveHarnessSession(chatId);

  if (liveSession) {
    try {
      await liveSession.destroy();
      log.info("destroyed live harness session", { chatId, sandboxName });
    } catch (error) {
      log.warn("live harness destroy failed; deleting sandbox directly", {
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
    clearHarnessResumeState(chatId);
    return new Response(null, { status: 204 });
  }

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
