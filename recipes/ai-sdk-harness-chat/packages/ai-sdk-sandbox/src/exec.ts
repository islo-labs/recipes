import type { Experimental_SandboxProcess } from "@ai-sdk/provider-utils";
import type { IsloClientContext } from "./client.js";
import { readSandboxFile, shellQuote } from "./files.js";

export interface ExecCommandOptions {
  ctx: IsloClientContext;
  sandboxName: string;
  command: string;
  defaultWorkingDirectory: string;
  workingDirectory?: string;
  env?: Record<string, string>;
  abortSignal?: AbortSignal;
}

/** Run a shell command string the way harness adapters expect. */
export function shellCommandArgs(command: string): string[] {
  return ["sh", "-lc", command];
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted?.();
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function createGrowingFileStream(
  ctx: IsloClientContext,
  sandboxName: string,
  path: string,
  defaultWorkingDirectory: string,
  abortSignal?: AbortSignal,
): ReadableStream<Uint8Array> {
  let offset = 0;
  let idleDelayMs = 50;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  const schedule = (delayMs: number) => {
    if (closed) return;
    timer = setTimeout(() => {
      void tick();
    }, delayMs);
  };

  const tick = async () => {
    if (closed || abortSignal?.aborted) {
      closed = true;
      return;
    }
    try {
      const bytes = await readSandboxFile(
        ctx,
        sandboxName,
        path,
        defaultWorkingDirectory,
        abortSignal,
      );
      if (bytes && bytes.byteLength > offset) {
        controller.enqueue(bytes.subarray(offset));
        offset = bytes.byteLength;
        idleDelayMs = 50;
      } else {
        idleDelayMs = Math.min(idleDelayMs * 2, 1_000);
      }
      schedule(idleDelayMs);
    } catch (error) {
      closed = true;
      controller.error(error);
    }
  };

  let controller!: ReadableStreamDefaultController<Uint8Array>;

  return new ReadableStream({
    start(ctrl) {
      controller = ctrl;
      void tick();
      abortSignal?.addEventListener(
        "abort",
        () => {
          closed = true;
          if (timer) clearTimeout(timer);
          controller.close();
        },
        { once: true },
      );
    },
    cancel() {
      closed = true;
      if (timer) clearTimeout(timer);
    },
  });
}

export async function runSandboxCommand(
  options: ExecCommandOptions,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  options.abortSignal?.throwIfAborted?.();

  const started = await options.ctx.client.sandboxes.execInSandbox(
    {
      sandbox_name: options.sandboxName,
      command: shellCommandArgs(options.command),
      env: options.env ?? undefined,
      workdir:
        options.workingDirectory ?? options.defaultWorkingDirectory ?? undefined,
    },
    { abortSignal: options.abortSignal },
  );

  const timeoutAt = Date.now() + 300_000;
  while (Date.now() < timeoutAt) {
    options.abortSignal?.throwIfAborted?.();

    const result = await options.ctx.client.sandboxes.getExecResult(
      {
        sandbox_name: options.sandboxName,
        exec_id: started.exec_id,
      },
      { abortSignal: options.abortSignal },
    );

    if (["completed", "failed", "timeout"].includes(result.status)) {
      return {
        exitCode: result.exit_code ?? 1,
        stdout: result.stdout,
        stderr: result.stderr,
      };
    }

    await sleep(500, options.abortSignal);
  }

  throw new Error("Timed out waiting for sandbox command to finish");
}

interface ActiveSpawn {
  spawnId: string;
  wait: Promise<{ exitCode: number }>;
  kill: () => Promise<void>;
}

const activeSpawns = new Map<string, ActiveSpawn>();

function spawnKey(sandboxName: string, spawnId: string): string {
  return `${sandboxName}:${spawnId}`;
}

async function waitForExecCompletion(
  options: ExecCommandOptions,
  execId: string,
  timeoutMs = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    options.abortSignal?.throwIfAborted?.();
    const result = await options.ctx.client.sandboxes.getExecResult(
      {
        sandbox_name: options.sandboxName,
        exec_id: execId,
      },
      { abortSignal: options.abortSignal },
    );
    if (["completed", "failed", "timeout"].includes(result.status)) {
      if ((result.exit_code ?? 1) !== 0) {
        throw new Error(
          `Failed to start background sandbox process (exit ${result.exit_code ?? 1}): ${result.stderr || result.stdout}`,
        );
      }
      return;
    }
    await sleep(100, options.abortSignal);
  }
  throw new Error("Timed out waiting for background process launcher to finish");
}

export async function spawnSandboxCommand(
  options: ExecCommandOptions,
): Promise<Experimental_SandboxProcess> {
  options.abortSignal?.throwIfAborted?.();

  const id = crypto.randomUUID();
  const spawnId = `islo-spawn-${id}`;
  const stdoutLog = `/tmp/islo-spawn-${id}.stdout`;
  const stderrLog = `/tmp/islo-spawn-${id}.stderr`;
  const exitFile = `/tmp/islo-spawn-${id}.exit`;
  const pidFile = `/tmp/islo-spawn-${id}.pid`;
  const key = spawnKey(options.sandboxName, spawnId);

  // Line-buffer stdout/stderr so bridge-ready is visible before the process exits.
  const shellCommand = `sh -lc ${shellQuote(options.command)}`;
  const runCommand =
    `if command -v stdbuf >/dev/null 2>&1; then stdbuf -oL -eL ${shellCommand}; else ${shellCommand}; fi`;

  const processCommand = `(${runCommand}) > ${shellQuote(stdoutLog)} 2> ${shellQuote(stderrLog)}; echo $? > ${shellQuote(exitFile)}`;
  const launcherCommand = [
    `rm -f ${shellQuote(stdoutLog)} ${shellQuote(stderrLog)} ${shellQuote(exitFile)} ${shellQuote(pidFile)}`,
    `(${processCommand}) & echo $! > ${shellQuote(pidFile)}`,
  ].join("; ");

  // createSession detached PTYs do not run non-interactive redirects reliably;
  // fire-and-forget exec with a background shell job does.
  const started = await options.ctx.client.sandboxes.execInSandbox(
    {
      sandbox_name: options.sandboxName,
      command: shellCommandArgs(launcherCommand),
      workdir:
        options.workingDirectory ?? options.defaultWorkingDirectory ?? undefined,
      env: options.env ?? undefined,
    },
    { abortSignal: options.abortSignal },
  );
  void waitForExecCompletion(options, started.exec_id).catch(() => {
    // The launcher should return immediately; if it does not, stdout polling
    // still observes the background bridge process.
  });

  const stdout = createGrowingFileStream(
    options.ctx,
    options.sandboxName,
    stdoutLog,
    options.defaultWorkingDirectory,
    options.abortSignal,
  );
  const stderr = createGrowingFileStream(
    options.ctx,
    options.sandboxName,
    stderrLog,
    options.defaultWorkingDirectory,
    options.abortSignal,
  );

  const { promise: wait, resolve: exitResolve, reject: exitReject } =
    Promise.withResolvers<{ exitCode: number }>();

  let killed = false;
  const kill = async () => {
    if (killed) return;
    killed = true;
    try {
      const pidBytes = await readSandboxFile(
        options.ctx,
        options.sandboxName,
        pidFile,
        options.defaultWorkingDirectory,
        options.abortSignal,
      );
      const pid = pidBytes
        ? new TextDecoder().decode(pidBytes).trim()
        : "";
      if (/^\d+$/.test(pid)) {
        await runSandboxCommand({
          ctx: options.ctx,
          sandboxName: options.sandboxName,
          command: `kill -TERM ${pid} 2>/dev/null || kill -KILL ${pid} 2>/dev/null || true`,
          defaultWorkingDirectory: options.defaultWorkingDirectory,
          workingDirectory:
            options.workingDirectory ?? options.defaultWorkingDirectory,
          abortSignal: options.abortSignal,
        });
      }
    } catch {
      // Best-effort kill.
    }
    activeSpawns.delete(key);
    exitResolve({ exitCode: 143 });
  };

  activeSpawns.set(key, { spawnId, wait, kill });

  void (async () => {
    try {
      let idleDelayMs = 250;
      while (!killed) {
        options.abortSignal?.throwIfAborted?.();
        const exitBytes = await readSandboxFile(
          options.ctx,
          options.sandboxName,
          exitFile,
          options.defaultWorkingDirectory,
          options.abortSignal,
        );
        if (exitBytes && exitBytes.byteLength > 0) {
          const exitCode = Number.parseInt(
            new TextDecoder().decode(exitBytes).trim(),
            10,
          );
          activeSpawns.delete(key);
          exitResolve({ exitCode: Number.isNaN(exitCode) ? 1 : exitCode });
          return;
        }
        await sleep(idleDelayMs, options.abortSignal);
        idleDelayMs = Math.min(idleDelayMs * 2, 2_000);
      }
    } catch (error) {
      exitReject(error);
      activeSpawns.delete(key);
    }
  })();

  if (options.abortSignal) {
    options.abortSignal.addEventListener(
      "abort",
      () => {
        void kill();
      },
      { once: true },
    );
  }

  return {
    stdout,
    stderr,
    wait: () => wait,
    kill,
  };
}

export async function waitUntilSandboxReady(
  ctx: IsloClientContext,
  sandboxName: string,
  abortSignal?: AbortSignal,
  timeoutMs = 120_000,
): Promise<{ name: string; status: string; workdir?: string | null }> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    abortSignal?.throwIfAborted?.();

    const sandbox = await ctx.client.sandboxes.getSandbox(
      { sandbox_name: sandboxName },
      { abortSignal },
    );

    if (sandbox.status === "running") {
      return sandbox;
    }
    if (sandbox.status === "paused") {
      await ctx.client.sandboxes.resumeSandbox(
        { sandbox_name: sandboxName },
        { abortSignal },
      );
      continue;
    }
    if (sandbox.status === "failed" || sandbox.status === "deleted") {
      throw new Error(`Sandbox '${sandboxName}' is ${sandbox.status}`);
    }

    await sleep(2_000, abortSignal);
  }

  throw new Error(`Timed out waiting for sandbox '${sandboxName}' to be ready`);
}

export function clearActiveSpawnsForSandbox(sandboxName: string): void {
  for (const [key, spawn] of activeSpawns) {
    if (key.startsWith(`${sandboxName}:`)) {
      void spawn.kill();
      activeSpawns.delete(key);
    }
  }
}
