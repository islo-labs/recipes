"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";

const CHAT_ID_STORAGE_KEY = "harness-chat-id";

function loadChatId(): string {
  if (typeof window === "undefined") {
    return crypto.randomUUID();
  }
  const stored = sessionStorage.getItem(CHAT_ID_STORAGE_KEY);
  if (stored) {
    return stored;
  }
  const id = crypto.randomUUID();
  sessionStorage.setItem(CHAT_ID_STORAGE_KEY, id);
  return id;
}

export default function ChatPage() {
  const [chatId, setChatId] = useState(loadChatId);
  const [input, setInput] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const { messages, sendMessage, setMessages, status, error } = useChat({
    id: chatId,
  });

  async function startNewChat() {
    setIsResetting(true);
    try {
      await fetch("/api/chat", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: chatId }),
      });
      const nextChatId = crypto.randomUUID();
      sessionStorage.setItem(CHAT_ID_STORAGE_KEY, nextChatId);
      setChatId(nextChatId);
      setMessages([]);
      setInput("");
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 py-8">
      <header className="mb-6 flex items-start justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Islo Harness Chat
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Codex via AI SDK HarnessAgent — one sandbox per chat, resumed across turns
          </p>
        </div>
        <button
          type="button"
          onClick={startNewChat}
          disabled={
            isResetting || status === "submitted" || status === "streaming"
          }
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {isResetting ? "Resetting..." : "New chat"}
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto pb-28">
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Ask anything to start a Codex session in an Islo sandbox.
          </p>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap ${
              message.role === "user"
                ? "ml-12 bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                : "mr-12 border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
            }`}
          >
            {message.parts.map((part, index) => {
              if (part.type === "text") {
                return <span key={`${message.id}-${index}`}>{part.text}</span>;
              }
              if (part.type === "reasoning") {
                return (
                  <details
                    key={`${message.id}-${index}`}
                    className="mb-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    <summary className="cursor-pointer font-medium">
                      Reasoning
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap">{part.text}</p>
                  </details>
                );
              }
              return null;
            })}
          </div>
        ))}

        {status === "submitted" || status === "streaming" ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Thinking...</p>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error.message}
          </p>
        ) : null}
      </div>

      <form
        className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/90 p-4 backdrop-blur dark:border-zinc-800 dark:bg-black/90"
        onSubmit={(event) => {
          event.preventDefault();
          const text = input.trim();
          if (!text || status === "submitted" || status === "streaming") {
            return;
          }
          sendMessage({ text });
          setInput("");
        }}
      >
        <div className="mx-auto flex w-full max-w-2xl gap-3">
          <input
            className="flex-1 rounded-full border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"
            value={input}
            placeholder="Message Codex..."
            onChange={(event) => setInput(event.target.value)}
          />
          <button
            type="submit"
            disabled={
              !input.trim() || status === "submitted" || status === "streaming"
            }
            className="rounded-full bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
