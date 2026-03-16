import type { NcpMessage } from "./message.js";

export type NcpSessionStatus = "idle" | "running";

export type NcpSessionSummary = {
  sessionId: string;
  messageCount: number;
  updatedAt: string;
  status?: NcpSessionStatus;
};

export type ListSessionsOptions = {
  limit?: number;
  cursor?: string;
};

export type ListMessagesOptions = {
  limit?: number;
  cursor?: string;
};

/**
 * API for session list, message history, and session lifecycle.
 * Implementations that support persistence can provide this alongside NcpAgentClientEndpoint.
 */
export interface NcpSessionApi {
  listSessions(options?: ListSessionsOptions): Promise<NcpSessionSummary[]>;
  listSessionMessages(sessionId: string, options?: ListMessagesOptions): Promise<NcpMessage[]>;
  getSession(sessionId: string): Promise<NcpSessionSummary | null>;
  deleteSession(sessionId: string): Promise<void>;
}
