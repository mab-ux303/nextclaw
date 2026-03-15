import type { NcpConversationSeed } from "@nextclaw/ncp-react";

export type SessionSummary = {
  sessionId: string;
  messageCount: number;
  updatedAt: string;
  status?: "idle" | "running";
  activeRunId?: string;
};

const SESSION_STORAGE_KEY = "ncp-demo-session-id";

export function getOrCreateSessionId(): string {
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing && existing.trim().length > 0) {
    return existing;
  }
  const next = createNewSessionId();
  window.localStorage.setItem(SESSION_STORAGE_KEY, next);
  return next;
}

export function createNewSessionId(): string {
  return `demo-${Math.random().toString(36).slice(2, 10)}`;
}

export function setCurrentSessionId(sessionId: string): void {
  window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
}

export async function refreshSessions(
  setter: (sessions: SessionSummary[]) => void,
): Promise<void> {
  const response = await fetch("/demo/sessions");
  if (!response.ok) {
    return;
  }
  const payload = (await response.json()) as SessionSummary[];
  setter(Array.isArray(payload) ? payload : []);
}

export async function loadConversationSeed(
  sessionId: string,
  signal: AbortSignal,
): Promise<NcpConversationSeed> {
  const response = await fetch(`/demo/sessions/${sessionId}/seed`, { signal });
  if (!response.ok) {
    throw new Error(`Failed to load conversation seed for ${sessionId}.`);
  }
  const payload = (await response.json()) as Partial<NcpConversationSeed> | null;
  return {
    messages: Array.isArray(payload?.messages) ? payload.messages : [],
    activeRunId: typeof payload?.activeRunId === "string" ? payload.activeRunId : null,
  };
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const response = await fetch(`/demo/sessions/${sessionId}`, { method: "DELETE" });
  return response.ok;
}
