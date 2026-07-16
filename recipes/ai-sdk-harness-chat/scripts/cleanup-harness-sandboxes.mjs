import { readFileSync } from "node:fs";
import { Islo } from "@islo-labs/sdk";

const PREFIX = "harness-chat-";

function loadEnv() {
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] ??= m[2].trim();
    }
  } catch {
    // ignore
  }
}

loadEnv();

const apiKey = process.env.ISLO_API_KEY ?? process.env.ISLO_API_TOKEN;
if (!apiKey) {
  console.error("Missing ISLO_API_KEY");
  process.exit(1);
}

const client = new Islo({
  apiKey,
  baseUrl: process.env.ISLO_BASE_URL ?? "https://api.islo.dev",
  computeUrl: process.env.ISLO_COMPUTE_URL,
});

const dryRun = process.argv.includes("--dry-run");

async function listAllHarnessSandboxes() {
  const sandboxes = [];
  let cursor;

  do {
    const page = await client.sandboxes.listSandboxes({
      name_prefix: PREFIX,
      limit: 100,
      cursor,
    });
    sandboxes.push(...(page.items ?? []));
    cursor = page.next_cursor ?? undefined;
  } while (cursor);

  return sandboxes;
}

const sandboxes = await listAllHarnessSandboxes();
console.log(`Found ${sandboxes.length} sandbox(es) with prefix "${PREFIX}"`);

if (sandboxes.length === 0) {
  process.exit(0);
}

for (const sandbox of sandboxes) {
  const label = `${sandbox.name} (${sandbox.status ?? "unknown"})`;
  if (dryRun) {
    console.log(`[dry-run] would delete ${label}`);
    continue;
  }
  try {
    await client.sandboxes.deleteSandbox({ sandbox_name: sandbox.name });
    console.log(`deleted ${label}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`failed to delete ${label}: ${message}`);
  }
}
