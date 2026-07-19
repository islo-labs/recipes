export type HarnessStatusStage =
  | "starting"
  | "sandbox"
  | "bootstrap"
  | "bridge"
  | "ready"
  | "streaming";

export interface HarnessStatusData {
  stage: HarnessStatusStage;
  message: string;
}

export const HARNESS_STATUS_DATA_TYPE = "data-harness-status" as const;

const STATUS_LABELS: Record<HarnessStatusStage, string> = {
  starting: "Starting harness session…",
  sandbox: "Provisioning Islo sandbox…",
  bootstrap: "Preparing Codex harness…",
  bridge: "Starting Codex bridge…",
  ready: "Session ready",
  streaming: "Waiting for Codex…",
};

export function harnessStatus(
  stage: HarnessStatusStage,
  message?: string,
): HarnessStatusData {
  return {
    stage,
    message: message ?? STATUS_LABELS[stage],
  };
}
