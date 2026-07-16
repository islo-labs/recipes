import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatIsloError } from "./client.js";
import { resolveSandboxPath } from "./files.js";
import { IsloNetworkSandboxSession } from "./session.js";

describe("resolveSandboxPath", () => {
  it("keeps absolute paths unchanged", () => {
    assert.equal(resolveSandboxPath("/tmp/file.txt", "/workspace"), "/tmp/file.txt");
  });

  it("resolves relative paths under the default workdir", () => {
    assert.equal(
      resolveSandboxPath("src/index.ts", "/workspace"),
      "/workspace/src/index.ts",
    );
  });
});

describe("formatIsloError", () => {
  it("formats rate-limit errors for operators", () => {
    const message = formatIsloError({ statusCode: 429, body: { code: "RATE_LIMITED" } });
    assert.match(message, /sandbox limit/i);
  });

  it("preserves Error messages", () => {
    assert.equal(formatIsloError(new Error("boom")), "boom");
  });
});

describe("IsloNetworkSandboxSession lifecycle ownership", () => {
  it("skips deleteSandbox when the caller owns lifecycle", async () => {
    let deleteCalls = 0;
    const ctx = {
      client: {
        sandboxes: {
          async deleteSandbox() {
            deleteCalls += 1;
          },
          async stopSandbox() {
            return undefined;
          },
        },
        shares: {
          async revokeShare() {
            return undefined;
          },
        },
      },
      computeUrl: "https://compute.example",
    };

    const session = new IsloNetworkSandboxSession(
      ctx as never,
      "wrapped-sandbox",
      "/workspace",
      [4000],
      {
        image: "ghcr.io/islo-labs/islo-ai-sdk-runner:latest",
        internetEnabled: true,
        shareTtlSeconds: 3600,
        shareReadiness: {},
      },
      false,
    );

    await session.destroy();
    assert.equal(deleteCalls, 0);
  });

  it("deletes provider-owned sandboxes on destroy", async () => {
    let deleteCalls = 0;
    const ctx = {
      client: {
        sandboxes: {
          async deleteSandbox() {
            deleteCalls += 1;
          },
          async stopSandbox() {
            return undefined;
          },
        },
        shares: {
          async revokeShare() {
            return undefined;
          },
        },
      },
      computeUrl: "https://compute.example",
    };

    const session = new IsloNetworkSandboxSession(
      ctx as never,
      "provider-owned",
      "/workspace",
      [4000],
      {
        image: "ghcr.io/islo-labs/islo-ai-sdk-runner:latest",
        internetEnabled: true,
        shareTtlSeconds: 3600,
        shareReadiness: {},
      },
      true,
    );

    await session.destroy();
    assert.equal(deleteCalls, 1);
  });
});
