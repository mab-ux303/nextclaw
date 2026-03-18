import { type NcpEndpointEvent, type NcpMessage, type NcpSessionSummary, NcpEventType } from "@nextclaw/ncp";
import type { AgentSessionRecord, LiveSessionState } from "./agent-backend-types.js";

export function readMessages(
  snapshot: {
    messages: ReadonlyArray<NcpMessage>;
    streamingMessage: NcpMessage | null;
  },
): NcpMessage[] {
  const messages = snapshot.messages.map((message) => structuredClone(message));
  if (snapshot.streamingMessage) {
    messages.push(structuredClone(snapshot.streamingMessage));
  }

  return messages;
}

export function toSessionSummary(
  session: AgentSessionRecord,
  liveSession: LiveSessionState | null,
): NcpSessionSummary {
  return {
    sessionId: session.sessionId,
    messageCount: session.messages.length,
    updatedAt: session.updatedAt,
    status: liveSession?.activeExecution ? "running" : "idle",
    ...(session.metadata
      ? {
          metadata: structuredClone({
            ...session.metadata,
            ...(liveSession?.metadata ? liveSession.metadata : {}),
          }),
        }
      : liveSession?.metadata
        ? { metadata: structuredClone(liveSession.metadata) }
        : {}),
  };
}

export function toLiveSessionSummary(session: LiveSessionState): NcpSessionSummary {
  const snapshot = session.stateManager.getSnapshot();
  return {
    sessionId: session.sessionId,
    messageCount: readMessages(snapshot).length,
    updatedAt: now(),
    status: session.activeExecution ? "running" : "idle",
    ...(Object.keys(session.metadata).length > 0
      ? { metadata: structuredClone(session.metadata) }
      : session.activeExecution?.requestEnvelope.metadata
        ? { metadata: structuredClone(session.activeExecution.requestEnvelope.metadata) }
        : {}),
  };
}

export function now(): string {
  return new Date().toISOString();
}

export function isTerminalEvent(event: NcpEndpointEvent): boolean {
  switch (event.type) {
    case NcpEventType.MessageAbort:
    case NcpEventType.RunFinished:
    case NcpEventType.RunError:
      return true;
    default:
      return false;
  }
}
