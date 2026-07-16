import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  snapshotNameForIdentity,
  SNAPSHOT_NAME_PREFIX,
} from "./client.js";
import {
  formatIsloError,
  isConflictError,
  isNotFoundError,
  IsloSandboxError,
} from "./errors.js";
import { resolveSandboxPath } from "./files.js";
import { createSandboxFromSnapshotOrImage } from "./snapshots.js";
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

describe("snapshotNameForIdentity", () => {
  it("creates stable hashed snapshot names", () => {
    const identity = "codex-bootstrap-v1";
    assert.equal(
      snapshotNameForIdentity(identity),
      snapshotNameForIdentity(identity),
    );
    assert.match(
      snapshotNameForIdentity(identity),
      new RegExp(`^${SNAPSHOT_NAME_PREFIX}[a-f0-9]{12}$`),
    );
  });
});

describe("Islo error helpers", () => {
  it("detects not-found errors", () => {
    assert.equal(isNotFoundError({ statusCode: 404 }), true);
    assert.equal(isNotFoundError({ body: { code: "NOT_FOUND" } }), true);
    assert.equal(isNotFoundError(new Error("Sandbox not found")), true);
    assert.equal(isNotFoundError({ statusCode: 500 }), false);
  });

  it("detects conflict errors", () => {
    assert.equal(isConflictError({ statusCode: 409 }), true);
    assert.equal(isConflictError({ body: { code: "ALREADY_EXISTS" } }), true);
    assert.equal(isConflictError({ statusCode: 404 }), false);
  });

  it("formats rate-limit errors for operators", () => {
    const message = formatIsloError({ statusCode: 429, body: { code: "RATE_LIMITED" } });
    assert.match(message, /sandbox limit/i);
  });

  it("preserves IsloSandboxError messages", () => {
    const error = new IsloSandboxError("boom", { sandboxName: "harness-chat-1" });
    assert.equal(formatIsloError(error), "boom");
  });
});

describe("createSandboxFromSnapshotOrImage", () => {
  it("reuses an existing sandbox without creating a new one", async () => {
    let createCalls = 0;
    const ctx = {
      client: {
        sandboxes: {
          async getSandbox() {
            return { name: "harness-chat-existing", status: "running" };
          },
          async createSandbox() {
            createCalls += 1;
            return { name: "harness-chat-existing" };
          },
        },
      },
      computeUrl: "https://compute.example",
    };

    const result = await createSandboxFromSnapshotOrImage({
      ctx: ctx as never,
      sandboxName: "harness-chat-existing",
      image: "ghcr.io/islo-labs/islo-ai-sdk-runner:latest",
    });

    assert.equal(result.name, "harness-chat-existing");
    assert.equal(result.isFreshCreate, false);
    assert.equal(createCalls, 0);
  });

  it("creates a sandbox when none exists", async () => {
    let createCalls = 0;
    let created = false;
    const ctx = {
      client: {
        sandboxes: {
          async getSandbox() {
            if (!created) {
              throw { statusCode: 404, body: { code: "NOT_FOUND" } };
            }
            return { name: "harness-chat-new", status: "running", workdir: "/workspace" };
          },
          async createSandbox() {
            createCalls += 1;
            created = true;
            return { name: "harness-chat-new" };
          },
        },
      },
      computeUrl: "https://compute.example",
    };

    const result = await createSandboxFromSnapshotOrImage({
      ctx: ctx as never,
      sandboxName: "harness-chat-new",
      image: "ghcr.io/islo-labs/islo-ai-sdk-runner:latest",
    });

    assert.equal(result.name, "harness-chat-new");
    assert.equal(result.isFreshCreate, true);
    assert.equal(createCalls, 1);
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
        setupScripts: [],
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
        setupScripts: [],
        shareTtlSeconds: 3600,
        shareReadiness: {},
      },
      true,
    );

    await session.destroy();
    assert.equal(deleteCalls, 1);
  });
});
