import type {
  NcpAgentConversationStateManager,
  NcpAgentRuntime,
  NcpMessage,
  NcpRequestEnvelope,
} from "@nextclaw/ncp";
import type { EventPublisher } from "./event-publisher.js";

export type RuntimeFactoryParams = {
  sessionId: string;
  stateManager: NcpAgentConversationStateManager;
};

export type CreateRuntimeFn = (params: RuntimeFactoryParams) => NcpAgentRuntime;

export type AgentSessionRecord = {
  sessionId: string;
  messages: NcpMessage[];
  updatedAt: string;
};

export type LiveSessionExecution = {
  controller: AbortController;
  publisher: EventPublisher;
  requestEnvelope: NcpRequestEnvelope;
  abortHandled: boolean;
  closed: boolean;
};

export type LiveSessionState = {
  sessionId: string;
  runtime: NcpAgentRuntime;
  stateManager: NcpAgentConversationStateManager;
  activeExecution: LiveSessionExecution | null;
};

export interface AgentSessionStore {
  getSession(sessionId: string): Promise<AgentSessionRecord | null>;
  listSessions(): Promise<AgentSessionRecord[]>;
  saveSession(session: AgentSessionRecord): Promise<void>;
  deleteSession(sessionId: string): Promise<AgentSessionRecord | null>;
}
