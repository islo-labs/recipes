import { posix } from "node:path";
import {
  extractLines,
  type Experimental_SandboxProcess,
  type Experimental_SandboxSession,
} from "@ai-sdk/provider-utils";
import type { IsloClientContext } from "./islo-sandbox.js";

const ISLO_CODEX_HOME = "/home/islo/.codex";

type ExecStreamEvent =
  | { type: "stdout"; data: string }
  | { type: "stderr"; data: string }
  | { type: "exit"; code: number };

const activeSpawnControllers = new Map<string, Set<AbortController>>();

export function clearActiveSpawnsForSandbox(sandboxName: string): void {
  const controllers = activeSpawnControllers.get(sandboxName);
  if (!controllers) {
    return;
  }
  for (const controller of controllers) {
    controller.abort();
  }
  activeSpawnControllers.delete(sandboxName);
}

/**
 * Tool-safe sandbox surface: file I/O, exec, spawn. Returned by
 * `IsloNetworkSandboxSession.restricted()`.
 */
export class IsloSandboxSession implements Experimental_SandboxSession {
  constructor(
    protected readonly ctx: IsloClientContext,
    protected readonly sandboxName: string,
    readonly defaultWorkingDirectory: string,
  ) {}

  get description(): string {
    return [
      `Islo sandbox (name: ${this.sandboxName}).`,
      `Workdir: ${this.defaultWorkingDirectory}.`,
      "Filesystem changes persist for the lifetime of the sandbox.",
    ].join("\n");
  }

  async run({
    command,
    workingDirectory,
    env,
    abortSignal,
  }: {
    command: string;
    workingDirectory?: string;
    env?: Record<string, string>;
    abortSignal?: AbortSignal;
  }): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    abortSignal?.throwIfAborted?.();

    let stdout = "";
    let stderr = "";
    const exitCode = await streamSandboxExec(this.ctx, this.sandboxName, {
      args: shellCommandArgs(command),
      workdir: workingDirectory ?? this.defaultWorkingDirectory,
      env,
      abortSignal,
      onEvent: (event) => {
        if (event.type === "stdout") {
          stdout += event.data;
        } else if (event.type === "stderr") {
          stderr += event.data;
        }
      },
    });

    return { exitCode, stdout, stderr };
  }

  async spawn({
    command,
    workingDirectory,
    env,
    abortSignal,
  }: {
    command: string;
    workingDirectory?: string;
    env?: Record<string, string>;
    abortSignal?: AbortSignal;
  }): Promise<Experimental_SandboxProcess> {
    abortSignal?.throwIfAborted?.();

    const killController = new AbortController();
    const linkedSignal = abortSignal
      ? AbortSignal.any([abortSignal, killController.signal])
      : killController.signal;

    let controllers = activeSpawnControllers.get(this.sandboxName);
    if (!controllers) {
      controllers = new Set();
      activeSpawnControllers.set(this.sandboxName, controllers);
    }
    controllers.add(killController);

    const wrappedCommand = [
      'export CODEX_API_KEY="${CODEX_API_KEY:-${OPENAI_API_KEY:-}}"',
      command,
    ].join("; ");

    return createSandboxProcessFromStream({
      ctx: this.ctx,
      sandboxName: this.sandboxName,
      args: shellCommandArgs(wrappedCommand),
      workdir: workingDirectory ?? this.defaultWorkingDirectory,
      env: {
        ...env,
        CODEX_HOME: ISLO_CODEX_HOME,
      },
      abortSignal: linkedSignal,
      kill: () => {
        killController.abort();
        controllers?.delete(killController);
      },
    });
  }

  async readFile({
    path,
    abortSignal,
  }: {
    path: string;
    abortSignal?: AbortSignal;
  }): Promise<ReadableStream<Uint8Array> | null> {
    const bytes = await this.readBinaryFile({ path, abortSignal });
    if (bytes == null) {
      return null;
    }
    return bytesToStream(bytes);
  }

  async readBinaryFile({
    path,
    abortSignal,
  }: {
    path: string;
    abortSignal?: AbortSignal;
  }): Promise<Uint8Array | null> {
    abortSignal?.throwIfAborted?.();
    return readSandboxFile(
      this.ctx,
      this.sandboxName,
      path,
      this.defaultWorkingDirectory,
      abortSignal,
    );
  }

  async readTextFile({
    path,
    encoding = "utf-8",
    startLine,
    endLine,
    abortSignal,
  }: {
    path: string;
    encoding?: string;
    startLine?: number;
    endLine?: number;
    abortSignal?: AbortSignal;
  }): Promise<string | null> {
    const bytes = await this.readBinaryFile({ path, abortSignal });
    if (bytes == null) {
      return null;
    }
    const text = new TextDecoder(encoding).decode(bytes);
    return extractLines({ text, startLine, endLine });
  }

  async writeFile({
    path,
    content,
    abortSignal,
  }: {
    path: string;
    content: ReadableStream<Uint8Array>;
    abortSignal?: AbortSignal;
  }): Promise<void> {
    const bytes = await collectStream(content, abortSignal);
    await this.writeBinaryFile({ path, content: bytes, abortSignal });
  }

  async writeBinaryFile({
    path,
    content,
    abortSignal,
  }: {
    path: string;
    content: Uint8Array;
    abortSignal?: AbortSignal;
  }): Promise<void> {
    abortSignal?.throwIfAborted?.();
    const resolved = resolveSandboxPath(path, this.defaultWorkingDirectory);
    const parent = posix.dirname(resolved);
    if (parent && parent !== "." && parent !== "/") {
      await this.run({
        command: `mkdir -p ${shellQuote(parent)}`,
        abortSignal,
      });
    }
    await writeSandboxFile(
      this.ctx,
      this.sandboxName,
      resolved,
      content,
      abortSignal,
    );
  }

  async writeTextFile({
    path,
    content,
    encoding = "utf-8",
    abortSignal,
  }: {
    path: string;
    content: string;
    encoding?: string;
    abortSignal?: AbortSignal;
  }): Promise<void> {
    await this.writeBinaryFile({
      path,
      content: new TextEncoder().encode(content),
      abortSignal,
    });
  }
}

function shellCommandArgs(command: string): string[] {
  return ["sh", "-lc", command];
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function resolveSandboxPath(path: string, defaultWorkingDirectory: string): string {
  if (path.startsWith("/")) {
    return path;
  }
  return `${defaultWorkingDirectory.replace(/\/$/, "")}/${path}`;
}

function filesUrl(sandboxName: string, path: string): string {
  const params = new URLSearchParams({ path });
  return `/sandboxes/${encodeURIComponent(sandboxName)}/files?${params}`;
}

async function readSandboxFile(
  ctx: IsloClientContext,
  sandboxName: string,
  path: string,
  defaultWorkingDirectory: string,
  abortSignal?: AbortSignal,
): Promise<Uint8Array | null> {
  const resolved = resolveSandboxPath(path, defaultWorkingDirectory);
  const url = new URL(filesUrl(sandboxName, resolved), ctx.computeUrl);
  const response = await ctx.client.fetch(
    url.toString(),
    { method: "GET", signal: abortSignal },
    { abortSignal },
  );

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      body || `Failed to read sandbox file with status ${response.status}`,
    );
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function writeSandboxFile(
  ctx: IsloClientContext,
  sandboxName: string,
  path: string,
  content: Uint8Array,
  abortSignal?: AbortSignal,
): Promise<void> {
  const form = new FormData();
  form.append(
    "file",
    new Blob([content], { type: "application/octet-stream" }),
    "file",
  );

  const url = new URL(filesUrl(sandboxName, path), ctx.computeUrl).toString();
  const response = await ctx.client.fetch(
    url,
    { method: "POST", body: form, signal: abortSignal },
    { abortSignal },
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      body || `Failed to write sandbox file with status ${response.status}`,
    );
  }
}

function extractExecSseEvent(buffer: string): {
  buffer: string;
  event: ExecStreamEvent | null;
} {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const separatorIndex = normalized.indexOf("\n\n");
  if (separatorIndex === -1) {
    return { buffer: normalized, event: null };
  }

  const rawEvent = normalized.slice(0, separatorIndex);
  const rest = normalized.slice(separatorIndex + 2);
  if (rawEvent.startsWith(":")) {
    return { buffer: rest, event: null };
  }

  let eventType: string | null = null;
  const dataLines: string[] = [];

  for (const line of rawEvent.split("\n")) {
    if (line.startsWith("event:")) {
      eventType = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return { buffer: rest, event: null };
  }

  const data = dataLines.join("\n");
  if (eventType === "stdout") {
    return { buffer: rest, event: { type: "stdout", data } };
  }
  if (eventType === "stderr") {
    return { buffer: rest, event: { type: "stderr", data } };
  }
  if (eventType === "exit") {
    const code = Number.parseInt(data, 10);
    return {
      buffer: rest,
      event: { type: "exit", code: Number.isNaN(code) ? 1 : code },
    };
  }

  return { buffer: rest, event: null };
}

async function streamSandboxExec(
  ctx: IsloClientContext,
  sandboxName: string,
  options: {
    args: string[];
    workdir?: string;
    env?: Record<string, string>;
    abortSignal?: AbortSignal;
    onEvent?: (event: ExecStreamEvent) => void;
  },
): Promise<number> {
  const url = new URL(
    `/sandboxes/${encodeURIComponent(sandboxName)}/exec/stream`,
    ctx.computeUrl,
  ).toString();

  const response = await ctx.client.fetch(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        args: options.args,
        workdir: options.workdir,
        env_vars: options.env ?? {},
      }),
      signal: options.abortSignal,
    },
    { abortSignal: options.abortSignal },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      body || `Exec stream failed with status ${response.status}`,
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Exec stream response has no body");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let exitCode: number | null = null;
  let sawOutput = false;

  const handleChunk = (chunk: string) => {
    buffer += chunk;
    while (true) {
      const parsed = extractExecSseEvent(buffer);
      buffer = parsed.buffer;
      if (!parsed.event) {
        break;
      }
      options.onEvent?.(parsed.event);
      if (parsed.event.type === "stdout" || parsed.event.type === "stderr") {
        sawOutput = true;
      }
      if (parsed.event.type === "exit") {
        exitCode = parsed.event.code;
        return true;
      }
    }
    return false;
  };

  try {
    while (true) {
      if (options.abortSignal?.aborted) {
        await reader.cancel().catch(() => undefined);
        throw new DOMException("Aborted", "AbortError");
      }

      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (handleChunk(decoder.decode(value, { stream: true }))) {
        await reader.cancel().catch(() => undefined);
        return exitCode ?? 0;
      }
    }

    handleChunk(decoder.decode());
  } catch (error) {
    if (options.abortSignal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    handleChunk(decoder.decode());
    if (exitCode !== null) {
      return exitCode;
    }
    if (sawOutput) {
      return 0;
    }
    throw error;
  }

  if (exitCode !== null) {
    return exitCode;
  }
  if (sawOutput) {
    return 0;
  }

  throw new Error(
    "Exec stream ended before an exit event was received. The command may still be running in the sandbox.",
  );
}

function createSandboxProcessFromStream(options: {
  ctx: IsloClientContext;
  sandboxName: string;
  args: string[];
  workdir?: string;
  env?: Record<string, string>;
  abortSignal?: AbortSignal;
  kill: () => void;
}): Experimental_SandboxProcess {
  const encoder = new TextEncoder();
  const controllers: {
    stdout?: ReadableStreamDefaultController<Uint8Array>;
    stderr?: ReadableStreamDefaultController<Uint8Array>;
  } = {};

  const stdout = new ReadableStream<Uint8Array>({
    start(controller) {
      controllers.stdout = controller;
    },
  });

  const stderr = new ReadableStream<Uint8Array>({
    start(controller) {
      controllers.stderr = controller;
    },
  });

  const { promise: waitPromise, resolve: resolveWait, reject: rejectWait } =
    Promise.withResolvers<{ exitCode: number }>();

  void streamSandboxExec(options.ctx, options.sandboxName, {
    args: options.args,
    workdir: options.workdir,
    env: options.env,
    abortSignal: options.abortSignal,
    onEvent: (event) => {
      if (event.type === "stdout") {
        controllers.stdout?.enqueue(encoder.encode(event.data));
      } else if (event.type === "stderr") {
        controllers.stderr?.enqueue(encoder.encode(event.data));
      }
    },
  })
    .then((exitCode) => {
      controllers.stdout?.close();
      controllers.stderr?.close();
      resolveWait({ exitCode });
    })
    .catch((error) => {
      controllers.stdout?.close();
      controllers.stderr?.close();
      if (options.abortSignal?.aborted) {
        resolveWait({ exitCode: 143 });
        return;
      }
      rejectWait(error);
    });

  return {
    stdout,
    stderr,
    wait: () => waitPromise,
    kill: async () => {
      options.kill();
      resolveWait({ exitCode: 143 });
    },
  };
}

function bytesToStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

async function collectStream(
  stream: ReadableStream<Uint8Array>,
  abortSignal?: AbortSignal,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    if (abortSignal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
