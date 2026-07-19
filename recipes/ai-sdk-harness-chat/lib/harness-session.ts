import type {
  HarnessAgentResumeSessionState,
  HarnessAgentSession,
} from "@ai-sdk/harness/agent";

const resumeStateByChatId = new Map<string, HarnessAgentResumeSessionState>();
const liveSessionByChatId = new Map<string, HarnessAgentSession>();

export function getLiveHarnessSession(
  chatId: string,
): HarnessAgentSession | undefined {
  return liveSessionByChatId.get(chatId);
}

export function setLiveHarnessSession(
  chatId: string,
  session: HarnessAgentSession,
): void {
  liveSessionByChatId.set(chatId, session);
}

export function clearLiveHarnessSession(chatId: string): void {
  liveSessionByChatId.delete(chatId);
}

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
  liveSessionByChatId.delete(chatId);
}

export function listHarnessChatIds(): string[] {
  return [...resumeStateByChatId.keys()];
}
