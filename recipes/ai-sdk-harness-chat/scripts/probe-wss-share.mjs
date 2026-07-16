#!/usr/bin/env node
/**
 * Live probe: create an Islo sandbox, open a share for port 4000,
 * and verify HTTP + WSS reachability through the public share URL.
 *
 * Usage:
 *   ISLO_API_KEY=... node scripts/probe-wss-share.mjs
 */
import { Islo } from "@islo-labs/sdk";
import WebSocket from "ws";

const BRIDGE_PORT = 4000;
const RUNNER_IMAGE =
  process.env.ISLO_HARNESS_IMAGE ??
  "ghcr.io/islo-labs/islo-ai-sdk-runner:latest";
const computeUrl = process.env.ISLO_COMPUTE_URL ?? "https://ca.compute.islo.dev";
const controlUrl = process.env.ISLO_BASE_URL ?? "https://api.islo.dev";
const apiKey = process.env.ISLO_API_KEY ?? process.env.ISLO_API_TOKEN;

if (!apiKey) {
  console.error("Missing ISLO_API_KEY");
  process.exit(1);
}

const sandboxName = `probe-wss-${Date.now()}`;
const sdk = new Islo({ apiKey, baseUrl: controlUrl, computeUrl });

function shareUrlToWebSocketUrl(shareUrl) {
  const url = new URL(shareUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

async function sleep(ms, signal) {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

async function runCommand(command) {
  const started = await sdk.sandboxes.execInSandbox({
    sandbox_name: sandboxName,
    command: ["sh", "-lc", command],
  });

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await sdk.sandboxes.getExecResult({
      sandbox_name: sandboxName,
      exec_id: started.exec_id,
    });
    if (["completed", "failed", "timeout"].includes(result.status)) {
      return result;
    }
    await sleep(500);
  }

  throw new Error("Timed out waiting for command");
}

async function waitForHttpReady(httpsUrl, timeoutMs = 15_000) {
  const startedAt = Date.now();
  let delayMs = 250;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(httpsUrl);
      if (response.status !== 404) {
        return response;
      }
    } catch {
      // retry
    }
    await sleep(delayMs);
    delayMs = Math.min(delayMs * 2, 2_000);
  }
  throw new Error(`Timed out waiting for HTTP share readiness at ${httpsUrl}`);
}

async function waitForWebSocketReady(wssUrl, timeoutMs = 15_000) {
  const startedAt = Date.now();
  let delayMs = 250;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      await probeWebSocket(wssUrl, 5_000);
      return;
    } catch {
      // retry
    }
    await sleep(delayMs);
    delayMs = Math.min(delayMs * 2, 2_000);
  }
  throw new Error(`Timed out waiting for WSS share readiness at ${wssUrl}`);
}

function probeWebSocket(wssUrl, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wssUrl);
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error("WebSocket probe timed out"));
    }, timeoutMs);

    socket.once("open", () => {
      clearTimeout(timer);
      socket.close();
      resolve();
    });

    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function main() {
  console.log(`Creating sandbox ${sandboxName} with image ${RUNNER_IMAGE}...`);
  await sdk.sandboxes.createSandbox({
    name: sandboxName,
    image: RUNNER_IMAGE,
    init: { type: "minimal" },
    internet_enabled: true,
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < 120_000) {
    const sandbox = await sdk.sandboxes.getSandbox({ sandbox_name: sandboxName });
    if (sandbox.status === "running") break;
    await sleep(2_000);
  }

  console.log(`Starting WebSocket server on 0.0.0.0:${BRIDGE_PORT}...`);
  const result = await runCommand(
    `node -e "const http=require('http'),crypto=require('crypto');const server=http.createServer((req,res)=>{res.writeHead(426);res.end('Upgrade Required');});server.on('upgrade',(req,socket)=>{const key=req.headers['sec-websocket-key'];const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');socket.write('HTTP/1.1 101 Switching Protocols\\r\\nUpgrade: websocket\\r\\nConnection: Upgrade\\r\\nSec-WebSocket-Accept: '+accept+'\\r\\n\\r\\n');});server.listen(${BRIDGE_PORT},'0.0.0.0');" >/tmp/probe-ws.log 2>&1 & sleep 1; curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:${BRIDGE_PORT}/`,
  );
  console.log("In-sandbox HTTP status:", result.stdout.trim() || result.stderr.trim());

  const share = await sdk.shares.createShare({
    sandbox_name: sandboxName,
    port: BRIDGE_PORT,
  });
  const httpsUrl = share.url;
  const wssUrl = shareUrlToWebSocketUrl(share.url);
  console.log(`Share URL: ${httpsUrl}`);

  console.log("Waiting for share propagation (bounded retries)...");
  const httpResponse = await waitForHttpReady(httpsUrl);
  console.log(`HTTP via share: ${httpResponse.status} ${httpResponse.statusText}`);
  if (httpResponse.ok) {
    console.log("HTTP body:", (await httpResponse.text()).slice(0, 80));
  }

  console.log(`Probing ${wssUrl} ...`);
  await waitForWebSocketReady(wssUrl);
  console.log("WebSocket upgrade succeeded");

  console.log("Cleaning up...");
  await sdk.sandboxes.deleteSandbox({ sandbox_name: sandboxName });
  console.log("Probe passed");
}

main().catch(async (error) => {
  console.error("Probe failed:", error.message ?? error);
  console.error(
    "\nHarnessAgent + Codex needs wss:// to the in-sandbox bridge. " +
      "The probe retries share propagation with bounded backoff. " +
      "Inspect bear-agent traces if the upgrade still fails.",
  );
  try {
    await sdk.sandboxes.deleteSandbox({ sandbox_name: sandboxName });
  } catch {
    // ignore cleanup errors
  }
  process.exit(1);
});
