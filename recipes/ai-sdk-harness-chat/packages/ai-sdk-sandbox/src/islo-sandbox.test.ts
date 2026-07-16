import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ISLO_SANDBOX_NAME_PREFIX,
  sandboxNameForSession,
  shareUrlToWebSocketUrl,
} from "./client.js";
import { extractExecSseMessage } from "./exec-sse.js";
import { shellCommandArgs } from "./exec.js";

describe("shellCommandArgs", () => {
  it("wraps commands for shell execution", () => {
    assert.deepEqual(shellCommandArgs("pnpm --version"), [
      "sh",
      "-lc",
      "pnpm --version",
    ]);
  });
});

describe("extractExecSseMessage", () => {
  it("parses stdout and exit events from an SSE buffer", () => {
    const input = "event: stdout\ndata: hello\n\nevent: exit\ndata: 0\n\n";
    let buffer = input;
    const first = extractExecSseMessage(buffer);
    assert.equal(first.message?.eventType, "stdout");
    assert.equal(first.message?.data, "hello");
    buffer = first.buffer;
    const second = extractExecSseMessage(buffer);
    assert.equal(second.message?.eventType, "exit");
    assert.equal(second.message?.data, "0");
  });
});

describe("shareUrlToWebSocketUrl", () => {
  it("converts https share URLs to wss", () => {
    assert.equal(
      shareUrlToWebSocketUrl("https://share.example.com/abc"),
      "wss://share.example.com/abc",
    );
  });

  it("converts http share URLs to ws", () => {
    assert.equal(
      shareUrlToWebSocketUrl("http://share.example.com/abc"),
      "ws://share.example.com/abc",
    );
  });
});

describe("sandboxNameForSession", () => {
  it("creates deterministic names for the same chat id", () => {
    const chatId = "550e8400-e29b-41d4-a716-446655440000";
    assert.equal(
      sandboxNameForSession(chatId),
      sandboxNameForSession(chatId),
    );
    assert.match(sandboxNameForSession(chatId), new RegExp(`^${ISLO_SANDBOX_NAME_PREFIX}`));
  });

  it("uses a hash suffix when names exceed 63 characters", () => {
    const longId = "a".repeat(80);
    const name = sandboxNameForSession(longId);
    assert.equal(name.length, 63);
    assert.match(name, /-[a-f0-9]{10}$/);
  });
});
