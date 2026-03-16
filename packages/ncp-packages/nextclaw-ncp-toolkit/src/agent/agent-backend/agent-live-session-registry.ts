import type { NcpMessage } from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager } from "../agent-conversation-state-manager.js";
import type {
  AgentSessionStore,
  CreateRuntimeFn,
  LiveSessionState,
} from "./agent-backend-types.js";

export class AgentLiveSessionRegistry {
  private readonly sessions = new Map<string, LiveSessionState>();

  constructor(
    private readonly sessionStore: AgentSessionStore,
    private readonly createRuntime: CreateRuntimeFn,
  ) {}

  async ensureSession(sessionId: string): Promise<LiveSessionState> {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      return existing;
    }

    const storedSession = await this.sessionStore.getSession(sessionId);
    const stateManager = new DefaultNcpAgentConversationStateManager();
    stateManager.hydrate({
      sessionId,
      messages: cloneMessages(storedSession?.messages ?? []),
    });

    const session: LiveSessionState = {
      sessionId,
      stateManager,
      runtime: this.createRuntime({ sessionId, stateManager }),
      activeExecution: null,
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): LiveSessionState | null {
    return this.sessions.get(sessionId) ?? null;
  }

  deleteSession(sessionId: string): LiveSessionState | null {
    const session = this.sessions.get(sessionId) ?? null;
    if (session) {
      this.sessions.delete(sessionId);
    }
    return session;
  }

  clear(): void {
    this.sessions.clear();
  }

  listSessions(): LiveSessionState[] {
    return [...this.sessions.values()];
  }
}

function cloneMessages(messages: ReadonlyArray<NcpMessage>): NcpMessage[] {
  return messages.map((message) => structuredClone(message));
}
