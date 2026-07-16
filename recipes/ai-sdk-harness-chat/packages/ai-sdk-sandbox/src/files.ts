import type { IsloClientContext } from "./client.js";
import { fetchCompute } from "./client.js";

function filesUrl(sandboxName: string, path: string): string {
  const params = new URLSearchParams({ path });
  return `/sandboxes/${encodeURIComponent(sandboxName)}/files?${params}`;
}

function resolveSandboxPath(
  path: string,
  defaultWorkingDirectory: string,
): string {
  if (path.startsWith("/")) {
    return path;
  }
  return `${defaultWorkingDirectory.replace(/\/$/, "")}/${path}`;
}

function parentDirectory(path: string): string {
  const index = path.lastIndexOf("/");
  if (index <= 0) {
    return "/";
  }
  return path.slice(0, index);
}

export async function readSandboxFile(
  ctx: IsloClientContext,
  sandboxName: string,
  path: string,
  defaultWorkingDirectory: string,
  abortSignal?: AbortSignal,
): Promise<Uint8Array | null> {
  abortSignal?.throwIfAborted?.();

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

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function writeSandboxFile(
  ctx: IsloClientContext,
  sandboxName: string,
  path: string,
  defaultWorkingDirectory: string,
  content: Uint8Array | string,
  abortSignal?: AbortSignal,
): Promise<void> {
  abortSignal?.throwIfAborted?.();

  const resolved = resolveSandboxPath(path, defaultWorkingDirectory);
  const parent = parentDirectory(resolved);
  if (parent !== "/" && parent !== resolved) {
    const parentQuoted = shellQuote(parent);
    await ctx.client.sandboxes.execInSandbox(
      {
        sandbox_name: sandboxName,
        command: ["sh", "-lc", `mkdir -p ${parentQuoted}`],
        workdir: defaultWorkingDirectory,
      },
      { abortSignal },
    );
  }

  const bytes =
    typeof content === "string" ? new TextEncoder().encode(content) : content;
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" }),
    "file",
  );

  await fetchCompute(ctx, filesUrl(sandboxName, resolved), {
    method: "POST",
    body: form,
    signal: abortSignal,
  });
}

export async function deleteSandboxByName(
  ctx: IsloClientContext,
  sandboxName: string,
  abortSignal?: AbortSignal,
): Promise<void> {
  await ctx.client.sandboxes.deleteSandbox(
    { sandbox_name: sandboxName },
    { abortSignal },
  );
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export { resolveSandboxPath };
