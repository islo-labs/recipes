import type { Islo } from "@islo-labs/sdk";

export interface LifecyclePolicy {
  auto_resume?: "never" | "on_activity";
  delete_after?: number | null;
  pause_after?: number | null;
  pause_after_idle?: number | null;
}

export interface IsloSandboxSettings {
  /** Islo API key. Defaults to ISLO_API_KEY / ISLO_API_TOKEN. */
  apiKey?: string;
  /** Control plane URL. Defaults to ISLO_BASE_URL or https://api.islo.dev */
  baseUrl?: string;
  /** Compute plane URL. Defaults to ISLO_COMPUTE_URL or https://ca.compute.islo.dev */
  computeUrl?: string;
  /** Inject a preconfigured Islo client instead of constructing one. */
  client?: Islo;
  /** Wrap an existing sandbox by name instead of creating one. */
  sandboxName?: string;
  /** Runner image for created sandboxes. */
  image?: string;
  /** Restore from snapshot instead of fresh image create. */
  snapshotName?: string;
  /** Gateway profile attached at sandbox creation. */
  gatewayProfile?: string | null;
  /** Internet egress for created sandboxes. Default true. */
  internetEnabled?: boolean;
  /** Lifecycle policy applied at sandbox creation. */
  lifecycle?: LifecyclePolicy | null;
  /** Setup scripts run once at sandbox creation. */
  setupScripts?: ReadonlyArray<{ name: string; script: string }>;
  /** Default workdir for relative file/exec paths. */
  workingDirectory?: string;
  /** Ports exposed for bridge harnesses. */
  ports?: readonly number[];
  /** Share TTL in seconds. Default 24h. */
  shareTtlSeconds?: number;
  /** Share readiness polling for WSS upgrades. */
  shareReadiness?: {
    initialDelayMs?: number;
    maxDelayMs?: number;
    timeoutMs?: number;
    pollIntervalMs?: number;
  };
  /** Sandbox name prefix for create-new mode. */
  sandboxNamePrefix?: string;
  /** Default lifecycle ownership: provider deletes on destroy. */
  ownsLifecycle?: boolean;
}

export interface CreateSessionInternalOptions {
  sandboxName: string;
  abortSignal?: AbortSignal;
  ports?: readonly number[];
  identity?: string;
  onFirstCreate?: (
    session: import("@ai-sdk/provider-utils").Experimental_SandboxSession,
    opts: { abortSignal?: AbortSignal },
  ) => Promise<void>;
  ownsLifecycle: boolean;
  defaultWorkingDirectory: string;
}
