import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DefaultNcpAgentConversationStateManager } from "@nextclaw/ncp-toolkit";
import {
  type NcpAgentClientEndpoint,
  type NcpAgentConversationSnapshot,
  type NcpEndpointEvent,
  type NcpMessage,
} from "@nextclaw/ncp";

export type UseNcpAgentResult = {
  snapshot: NcpAgentConversationSnapshot;
  visibleMessages: readonly NcpMessage[];
  activeRunId: string | null;
  isRunning: boolean;
  isSending: boolean;
  send: (content: string) => Promise<void>;
  abort: () => Promise<void>;
  streamRun: () => Promise<void>;
};

type UseNcpAgentRuntimeOptions = {
  sessionId: string;
  client: NcpAgentClientEndpoint;
  manager: DefaultNcpAgentConversationStateManager;
};

type ScopedManagerRef = {
  sessionId: string;
  manager: DefaultNcpAgentConversationStateManager;
};

function shouldDispatchEventToSession(event: NcpEndpointEvent, sessionId: string): boolean {
  const payload = "payload" in event ? event.payload : null;
  if (!payload || typeof payload !== "object") {
    return true;
  }
  if (!("sessionId" in payload) || typeof payload.sessionId !== "string") {
    return true;
  }
  return payload.sessionId === sessionId;
}

export function useScopedAgentManager(sessionId: string): DefaultNcpAgentConversationStateManager {
  const managerRef = useRef<ScopedManagerRef>();
  if (!managerRef.current || managerRef.current.sessionId !== sessionId) {
    managerRef.current = {
      sessionId,
      manager: new DefaultNcpAgentConversationStateManager(),
    };
  }
  return managerRef.current.manager;
}

export function useNcpAgentRuntime({
  sessionId,
  client,
  manager,
}: UseNcpAgentRuntimeOptions): UseNcpAgentResult {
  const snapshot = useSyncExternalStore(
    (onStoreChange) => manager.subscribe(() => onStoreChange()),
    () => manager.getSnapshot(),
    () => manager.getSnapshot(),
  );
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setIsSending(false);
  }, [sessionId]);

  useEffect(() => {
    const unsubscribeClient = client.subscribe((event) => {
      if (!shouldDispatchEventToSession(event, sessionId)) {
        return;
      }
      void manager.dispatch(event);
    });

    return () => {
      unsubscribeClient();
      void client.stop();
    };
  }, [client, manager, sessionId]);

  const visibleMessages: readonly NcpMessage[] = snapshot.streamingMessage
    ? [...snapshot.messages, snapshot.streamingMessage]
    : snapshot.messages;

  const activeRunId = snapshot.activeRun?.runId ?? null;
  const isRunning = !!snapshot.activeRun;

  const send = async (content: string) => {
    if (!content.trim() || isSending || isRunning) {
      return;
    }

    setIsSending(true);
    try {
      await client.send({
        sessionId,
        message: {
          id: `user-${Date.now().toString(36)}`,
          sessionId,
          role: "user",
          status: "final",
          parts: [{ type: "text", text: content.trim() }],
          timestamp: new Date().toISOString(),
        },
      });
    } finally {
      setIsSending(false);
    }
  };

  const abort = async () => {
    if (!snapshot.activeRun) {
      return;
    }

    await client.abort({ sessionId });
  };

  const streamRun = async () => {
    if (!snapshot.activeRun) {
      return;
    }

    await client.stream({ sessionId });
  };

  return {
    snapshot,
    visibleMessages,
    activeRunId,
    isRunning,
    isSending,
    send,
    abort,
    streamRun,
  };
}
