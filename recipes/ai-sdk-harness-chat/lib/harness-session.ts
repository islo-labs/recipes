import type { HarnessAgentResumeSessionState } from "@ai-sdk/harness/agent";

const resumeStateByChatId = new Map<string, HarnessAgentResumeSessionState>();

export function getHarnessResumeState(
  chatId: string,
): HarnessAgentResumeSessionState | undefined {
  return resumeStateByChatId.get(chatId);
}

export function setHarnessResumeState(
  chatId: string,
  resumeFrom: HarnessAgentResumeSessionState,
): void {
  resumeStateByChatId.set(chatId, resumeFrom);
}

export function clearHarnessResumeState(chatId: string): void {
  resumeStateByChatId.delete(chatId);
}

export function listHarnessChatIds(): string[] {
  return [...resumeStateByChatId.keys()];
}
