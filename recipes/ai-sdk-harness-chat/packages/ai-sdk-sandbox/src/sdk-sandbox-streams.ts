import type { Islo, IsloApi } from "@islo-labs/sdk";
import type { ExecStreamRequest } from "./islo-sdk-streams.js";
import type { IsloClientContext } from "./islo-sandbox.js";

export type ExecStreamEvent =
  | { type: "stdout"; data: string }
  | { type: "stderr"; data: string }
  | { type: "exit"; code: number }
  | { type: "error"; message: string };

export type CreationStreamEvent =
  | { type: "sandbox_ready"; sandbox: IsloApi.SandboxResponse }
  | { type: "created"; sandbox: IsloApi.SandboxResponse }
  | { type: "error"; message: string }
  | { type: "ignored" };

type SandboxSseEvent = {
  event?: string;
  data: string;
  id?: string;
};

type StreamingSandboxesClient = {
  execInSandboxStream(
    request: ExecStreamRequest,
    requestOptions?: { abortSignal?: AbortSignal },
  ): AsyncIterable<SandboxSseEvent>;
  createSandboxStream(
    request?: IsloApi.CreateSandboxRequest,
    requestOptions?: { abortSignal?: AbortSignal },
  ): AsyncIterable<SandboxSseEvent>;
  streamSandboxCreationEvents(
    request: { sandbox_name: string },
    requestOptions?: { abortSignal?: AbortSignal },
  ): AsyncIterable<SandboxSseEvent>;
};

function requireStreamingSandboxesClient(
  client: IsloClientContext["client"],
): StreamingSandboxesClient {
  const sandboxes = client.sandboxes as Partial<StreamingSandboxesClient>;

  if (
    typeof sandboxes.execInSandboxStream !== "function" ||
    typeof sandboxes.createSandboxStream !== "function" ||
    typeof sandboxes.streamSandboxCreationEvents !== "function"
  ) {
    throw new Error(
      "Streaming sandbox APIs are unavailable. Regenerate @islo-labs/sdk from the latest compute OpenAPI spec.",
    );
  }

  return sandboxes as StreamingSandboxesClient;
}

function parseExecFrame(frame: { event?: string; data: string }): ExecStreamEvent | null {
  const event = frame.event?.trim();
  const data = frame.data ?? "";
  if (event === "stdout") {
    return { type: "stdout", data };
  }
  if (event === "stderr") {
    return { type: "stderr", data };
  }
  if (event === "exit") {
    const code = Number.parseInt(data, 10);
    return { type: "exit", code: Number.isNaN(code) ? 1 : code };
  }
  if (event === "error") {
    return { type: "error", message: data || "Sandbox exec failed" };
  }
  return null;
}

function parseCreationFrame(
  frame: { event?: string; data: string },
): CreationStreamEvent | null {
  const event = frame.event?.trim();
  const data = frame.data ?? "";
  if (!event) {
    return null;
  }

  if (event === "sandbox_ready" || event === "created") {
    try {
      const sandbox = JSON.parse(data) as IsloApi.SandboxResponse;
      return event === "created"
        ? { type: "created", sandbox }
        : { type: "sandbox_ready", sandbox };
    } catch {
      return { type: "error", message: `Invalid ${event} event payload` };
    }
  }

  if (event === "error") {
    return { type: "error", message: data || "Sandbox creation failed" };
  }

  return { type: "ignored" };
}

export async function streamSandboxExec(
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
  const sandboxes = requireStreamingSandboxesClient(ctx.client);
  const stream = sandboxes.execInSandboxStream(
    {
      sandbox_name: sandboxName,
      args: options.args,
      workdir: options.workdir ?? null,
      env_vars: options.env ?? null,
    },
    { abortSignal: options.abortSignal },
  );

  for await (const frame of stream) {
    options.abortSignal?.throwIfAborted?.();
    const event = parseExecFrame(frame);
    if (!event) {
      continue;
    }
    options.onEvent?.(event);
    if (event.type === "exit") {
      return event.code;
    }
    if (event.type === "error") {
      throw new Error(event.message);
    }
  }

  return 1;
}

export async function waitForSandboxCreation(
  ctx: IsloClientContext,
  sandboxName: string,
  abortSignal?: AbortSignal,
  timeoutMs = 120_000,
): Promise<IsloApi.SandboxResponse> {
  const sandboxes = requireStreamingSandboxesClient(ctx.client);
  const startedAt = Date.now();

  const consume = async function* (
    stream: AsyncIterable<{ event?: string; data: string }>,
  ): AsyncGenerator<CreationStreamEvent> {
    for await (const frame of stream) {
      const event = parseCreationFrame(frame);
      if (event) {
        yield event;
      }
    }
  };

  let stream = sandboxes.streamSandboxCreationEvents(
    { sandbox_name: sandboxName },
    { abortSignal },
  );

  while (Date.now() - startedAt < timeoutMs) {
    abortSignal?.throwIfAborted?.();

    for await (const event of consume(stream)) {
      if (event.type === "sandbox_ready" || event.type === "created") {
        if (event.sandbox.status === "running") {
          return event.sandbox;
        }
      }
      if (event.type === "error") {
        throw new Error(event.message);
      }
    }

    const latest = await ctx.client.sandboxes.getSandbox(
      { sandbox_name: sandboxName },
      { abortSignal },
    );
    if (latest.status === "running") {
      return latest;
    }
    if (latest.status === "failed" || latest.status === "deleted") {
      throw new Error(`Sandbox '${sandboxName}' is ${latest.status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000));
    stream = sandboxes.streamSandboxCreationEvents(
      { sandbox_name: sandboxName },
      { abortSignal },
    );
  }

  throw new Error(`Timed out waiting for sandbox '${sandboxName}' to be ready`);
}

export async function createSandboxWithStream(
  ctx: IsloClientContext,
  request: IsloApi.CreateSandboxRequest,
  abortSignal?: AbortSignal,
): Promise<IsloApi.SandboxResponse> {
  const sandboxes = requireStreamingSandboxesClient(ctx.client);
  const stream = sandboxes.createSandboxStream(request, { abortSignal });

  let latest: IsloApi.SandboxResponse | undefined;
  for await (const frame of stream) {
    const event = parseCreationFrame(frame);
    if (!event || event.type === "ignored") {
      continue;
    }
    if (event.type === "error") {
      throw new Error(event.message);
    }
    latest = event.sandbox;
    if (latest.status === "running") {
      return latest;
    }
  }

  if (latest) {
    return latest;
  }

  throw new Error("Sandbox creation stream ended without a sandbox response");
}
