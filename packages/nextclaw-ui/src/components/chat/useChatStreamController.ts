import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ChatRunView, SessionEventView } from '@/api/types';
import { sendChatTurnStream, stopChatTurn, streamChatRun } from '@/api/config';

type PendingChatMessage = {
  id: number;
  message: string;
  sessionKey: string;
  agentId: string;
  model?: string;
  requestedSkills?: string[];
  stopSupported?: boolean;
  stopReason?: string;
};

type ActiveRunState = {
  localRunId: number;
  sessionKey: string;
  agentId?: string;
  requestAbortController: AbortController;
  backendRunId?: string;
  backendStopSupported: boolean;
  backendStopReason?: string;
};

type SendMessageParams = {
  message: string;
  sessionKey: string;
  agentId: string;
  model?: string;
  requestedSkills?: string[];
  stopSupported?: boolean;
  stopReason?: string;
  restoreDraftOnError?: boolean;
};

type UseChatStreamControllerParams = {
  nextOptimisticUserSeq: number;
  selectedSessionKeyRef: MutableRefObject<string | null>;
  setSelectedSessionKey: Dispatch<SetStateAction<string | null>>;
  setDraft: Dispatch<SetStateAction<string>>;
  refetchSessions: () => Promise<unknown>;
  refetchHistory: () => Promise<unknown>;
};

function formatSendError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) {
      return message;
    }
  }
  const raw = String(error ?? '').trim();
  return raw || 'Failed to send message';
}

type StreamSetters = {
  setOptimisticUserEvent: Dispatch<SetStateAction<SessionEventView | null>>;
  setStreamingSessionEvents: Dispatch<SetStateAction<SessionEventView[]>>;
  setStreamingAssistantText: Dispatch<SetStateAction<string>>;
  setStreamingAssistantTimestamp: Dispatch<SetStateAction<string | null>>;
  setIsSending: Dispatch<SetStateAction<boolean>>;
  setIsAwaitingAssistantOutput: Dispatch<SetStateAction<boolean>>;
  setCanStopCurrentRun: Dispatch<SetStateAction<boolean>>;
  setStopDisabledReason: Dispatch<SetStateAction<string | null>>;
  setLastSendError: Dispatch<SetStateAction<string | null>>;
};

function clearStreamingState(setters: StreamSetters) {
  setters.setIsSending(false);
  setters.setOptimisticUserEvent(null);
  setters.setStreamingSessionEvents([]);
  setters.setStreamingAssistantText('');
  setters.setStreamingAssistantTimestamp(null);
  setters.setIsAwaitingAssistantOutput(false);
  setters.setCanStopCurrentRun(false);
  setters.setStopDisabledReason(null);
  setters.setLastSendError(null);
}

function normalizeRequestedSkills(value: string[] | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const deduped = new Set<string>();
  for (const item of value) {
    const trimmed = item.trim();
    if (trimmed) {
      deduped.add(trimmed);
    }
  }
  return [...deduped];
}

function isAbortLikeError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return true;
    }
    const lower = error.message.toLowerCase();
    if (lower.includes('aborted') || lower.includes('abort')) {
      return true;
    }
  }
  return false;
}

function buildLocalAssistantEvent(content: string, eventType = 'message.assistant.local'): SessionEventView {
  const timestamp = new Date().toISOString();
  return {
    seq: Date.now(),
    type: eventType,
    timestamp,
    message: {
      role: 'assistant',
      content,
      timestamp
    }
  };
}

async function refetchIfSessionVisible(params: {
  selectedSessionKeyRef: MutableRefObject<string | null>;
  currentSessionKey: string;
  resultSessionKey?: string;
  refetchSessions: () => Promise<unknown>;
  refetchHistory: () => Promise<unknown>;
}): Promise<void> {
  await params.refetchSessions();
  const activeSessionKey = params.selectedSessionKeyRef.current;
  if (
    !activeSessionKey ||
    activeSessionKey === params.currentSessionKey ||
    (params.resultSessionKey && activeSessionKey === params.resultSessionKey)
  ) {
    await params.refetchHistory();
  }
}

function upsertStreamingEvent(
  setStreamingSessionEvents: Dispatch<SetStateAction<SessionEventView[]>>,
  event: SessionEventView
) {
  setStreamingSessionEvents((prev) => {
    const next = [...prev];
    const hit = next.findIndex((streamEvent) => streamEvent.seq === event.seq);
    if (hit >= 0) {
      next[hit] = event;
    } else {
      next.push(event);
    }
    return next;
  });
}

type ExecuteStreamRunParams = {
  runId: number;
  runIdRef: MutableRefObject<number>;
  activeRunRef: MutableRefObject<ActiveRunState | null>;
  selectedSessionKeyRef: MutableRefObject<string | null>;
  setSelectedSessionKey: Dispatch<SetStateAction<string | null>>;
  setDraft: Dispatch<SetStateAction<string>>;
  refetchSessions: () => Promise<unknown>;
  refetchHistory: () => Promise<unknown>;
  restoreDraftOnError?: boolean;
  sourceSessionKey: string;
  sourceAgentId?: string;
  sourceMessage?: string;
  sourceStopSupported?: boolean;
  sourceStopReason?: string;
  optimisticUserEvent: SessionEventView | null;
  openStream: (params: {
    signal: AbortSignal;
    onReady: (event: { runId?: string; stopSupported?: boolean; stopReason?: string; sessionKey: string }) => void;
    onDelta: (event: { delta: string }) => void;
    onSessionEvent: (event: { data: SessionEventView }) => void;
  }) => Promise<{ sessionKey: string }>;
  setters: StreamSetters;
};

async function executeStreamRun(params: ExecuteStreamRunParams): Promise<void> {
  const {
    runId,
    runIdRef,
    activeRunRef,
    selectedSessionKeyRef,
    setSelectedSessionKey,
    setDraft,
    refetchSessions,
    refetchHistory,
    restoreDraftOnError,
    sourceSessionKey,
    sourceAgentId,
    sourceMessage,
    sourceStopSupported,
    sourceStopReason,
    optimisticUserEvent,
    openStream,
    setters
  } = params;

  const requestAbortController = new AbortController();
  activeRunRef.current = {
    localRunId: runId,
    sessionKey: sourceSessionKey,
    ...(sourceAgentId ? { agentId: sourceAgentId } : {}),
    requestAbortController,
    backendStopSupported: Boolean(sourceStopSupported),
    ...(sourceStopReason ? { backendStopReason: sourceStopReason } : {})
  };

  setters.setStreamingSessionEvents([]);
  setters.setStreamingAssistantText('');
  setters.setStreamingAssistantTimestamp(null);
  setters.setOptimisticUserEvent(optimisticUserEvent);
  setters.setIsSending(true);
  setters.setIsAwaitingAssistantOutput(true);
  setters.setCanStopCurrentRun(false);
  setters.setStopDisabledReason(sourceStopSupported ? '__preparing__' : sourceStopReason ?? null);
  setters.setLastSendError(null);

  let streamText = '';
  try {
    let hasAssistantSessionEvent = false;
    const streamTimestamp = new Date().toISOString();
    setters.setStreamingAssistantTimestamp(streamTimestamp);

    const result = await openStream({
      signal: requestAbortController.signal,
      onReady: (event) => {
        if (runId !== runIdRef.current) {
          return;
        }
        const activeRun = activeRunRef.current;
        if (activeRun && activeRun.localRunId === runId) {
          activeRun.backendRunId = event.runId?.trim() || undefined;
          if (typeof event.stopSupported === 'boolean') {
            activeRun.backendStopSupported = event.stopSupported;
          }
          if (typeof event.stopReason === 'string' && event.stopReason.trim().length > 0) {
            activeRun.backendStopReason = event.stopReason.trim();
          }
          const canStopNow = Boolean(activeRun.backendStopSupported && activeRun.backendRunId);
          setters.setCanStopCurrentRun(canStopNow);
          setters.setStopDisabledReason(
            canStopNow
              ? null
              : activeRun.backendStopReason ?? (activeRun.backendStopSupported ? '__preparing__' : null)
          );
        }
        if (event.sessionKey) {
          setSelectedSessionKey((prev) => (prev === event.sessionKey ? prev : event.sessionKey));
        }
      },
      onDelta: (event) => {
        if (runId !== runIdRef.current) {
          return;
        }
        streamText += event.delta;
        setters.setStreamingAssistantText(streamText);
        setters.setIsAwaitingAssistantOutput(false);
      },
      onSessionEvent: (event) => {
        if (runId !== runIdRef.current) {
          return;
        }
        if (event.data.message?.role === 'user') {
          setters.setOptimisticUserEvent(null);
        }
        upsertStreamingEvent(setters.setStreamingSessionEvents, event.data);
        if (event.data.message?.role === 'assistant') {
          hasAssistantSessionEvent = true;
          streamText = '';
          setters.setStreamingAssistantText('');
          setters.setIsAwaitingAssistantOutput(false);
        }
      }
    });
    if (runId !== runIdRef.current) {
      return;
    }
    setters.setOptimisticUserEvent(null);
    if (result.sessionKey !== sourceSessionKey) {
      setSelectedSessionKey(result.sessionKey);
    }

    const localAssistantText = !hasAssistantSessionEvent ? streamText.trim() : '';
    await refetchIfSessionVisible({
      selectedSessionKeyRef,
      currentSessionKey: sourceSessionKey,
      resultSessionKey: result.sessionKey,
      refetchSessions,
      refetchHistory
    });

    setters.setStreamingSessionEvents(localAssistantText ? [buildLocalAssistantEvent(localAssistantText)] : []);

    setters.setStreamingAssistantText('');
    setters.setStreamingAssistantTimestamp(null);
    setters.setIsAwaitingAssistantOutput(false);
    setters.setIsSending(false);
    setters.setCanStopCurrentRun(false);
    setters.setStopDisabledReason(null);
    setters.setLastSendError(null);
    activeRunRef.current = null;
  } catch (error) {
    if (runId !== runIdRef.current) {
      return;
    }
    const wasAborted = requestAbortController.signal.aborted || isAbortLikeError(error);
    runIdRef.current += 1;
    if (wasAborted) {
      clearStreamingState(setters);
      activeRunRef.current = null;
      await refetchIfSessionVisible({
        selectedSessionKeyRef,
        currentSessionKey: sourceSessionKey,
        refetchSessions,
        refetchHistory
      });
      return;
    }

    clearStreamingState(setters);
    const sendError = formatSendError(error);
    setters.setLastSendError(sendError);
    setters.setStreamingSessionEvents([buildLocalAssistantEvent(sendError, 'message.assistant.error.local')]);
    activeRunRef.current = null;
    if (restoreDraftOnError) {
      setDraft((prev) => (prev.trim().length === 0 && sourceMessage ? sourceMessage : prev));
    }
  }
}

export function useChatStreamController(params: UseChatStreamControllerParams) {
  const [optimisticUserEvent, setOptimisticUserEvent] = useState<SessionEventView | null>(null);
  const [streamingSessionEvents, setStreamingSessionEvents] = useState<SessionEventView[]>([]);
  const [streamingAssistantText, setStreamingAssistantText] = useState('');
  const [streamingAssistantTimestamp, setStreamingAssistantTimestamp] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isAwaitingAssistantOutput, setIsAwaitingAssistantOutput] = useState(false);
  const [queuedMessages, setQueuedMessages] = useState<PendingChatMessage[]>([]);
  const [canStopCurrentRun, setCanStopCurrentRun] = useState(false);
  const [stopDisabledReason, setStopDisabledReason] = useState<string | null>(null);
  const [lastSendError, setLastSendError] = useState<string | null>(null);

  const streamRunIdRef = useRef(0);
  const queueIdRef = useRef(0);
  const activeRunRef = useRef<ActiveRunState | null>(null);

  const resetStreamState = useCallback(() => {
    streamRunIdRef.current += 1;
    setQueuedMessages([]);
    activeRunRef.current?.requestAbortController.abort();
    activeRunRef.current = null;
    clearStreamingState({
      setOptimisticUserEvent,
      setStreamingSessionEvents,
      setStreamingAssistantText,
      setStreamingAssistantTimestamp,
      setIsSending,
      setIsAwaitingAssistantOutput,
      setCanStopCurrentRun,
      setStopDisabledReason,
      setLastSendError
    });
  }, []);

  useEffect(() => {
    return () => {
      streamRunIdRef.current += 1;
      activeRunRef.current?.requestAbortController.abort();
      activeRunRef.current = null;
    };
  }, []);

  const runSend = useCallback(
    async (item: PendingChatMessage, options?: { restoreDraftOnError?: boolean }) => {
      setLastSendError(null);
      streamRunIdRef.current += 1;
      const requestedSkills = normalizeRequestedSkills(item.requestedSkills);
      await executeStreamRun({
        runId: streamRunIdRef.current,
        runIdRef: streamRunIdRef,
        activeRunRef,
        selectedSessionKeyRef: params.selectedSessionKeyRef,
        setSelectedSessionKey: params.setSelectedSessionKey,
        setDraft: params.setDraft,
        refetchSessions: params.refetchSessions,
        refetchHistory: params.refetchHistory,
        restoreDraftOnError: options?.restoreDraftOnError,
        sourceSessionKey: item.sessionKey,
        sourceAgentId: item.agentId,
        sourceMessage: item.message,
        sourceStopSupported: item.stopSupported,
        sourceStopReason: item.stopReason,
        optimisticUserEvent: {
          seq: params.nextOptimisticUserSeq,
          type: 'message.user.optimistic',
          timestamp: new Date().toISOString(),
          message: {
            role: 'user',
            content: item.message,
            timestamp: new Date().toISOString()
          }
        },
        openStream: ({ signal, onReady, onDelta, onSessionEvent }) =>
          sendChatTurnStream(
            {
              message: item.message,
              sessionKey: item.sessionKey,
              agentId: item.agentId,
              ...(item.model ? { model: item.model } : {}),
              ...(requestedSkills.length > 0
                ? {
                    metadata: {
                      requested_skills: requestedSkills
                    }
                  }
                : {}),
              channel: 'ui',
              chatId: 'web-ui'
            },
            { signal, onReady, onDelta, onSessionEvent }
          ),
        setters: {
          setOptimisticUserEvent,
          setStreamingSessionEvents,
          setStreamingAssistantText,
          setStreamingAssistantTimestamp,
          setIsSending,
          setIsAwaitingAssistantOutput,
          setCanStopCurrentRun,
          setStopDisabledReason,
          setLastSendError
        }
      });
    },
    [params]
  );

  const resumeRun = useCallback(
    async (run: ChatRunView) => {
      const runId = run.runId?.trim();
      const sessionKey = run.sessionKey?.trim();
      if (!runId || !sessionKey) {
        return;
      }
      const active = activeRunRef.current;
      if (active?.backendRunId === runId) {
        return;
      }
      if (isSending && active) {
        return;
      }

      setLastSendError(null);
      streamRunIdRef.current += 1;
      await executeStreamRun({
        runId: streamRunIdRef.current,
        runIdRef: streamRunIdRef,
        activeRunRef,
        selectedSessionKeyRef: params.selectedSessionKeyRef,
        setSelectedSessionKey: params.setSelectedSessionKey,
        setDraft: params.setDraft,
        refetchSessions: params.refetchSessions,
        refetchHistory: params.refetchHistory,
        sourceSessionKey: sessionKey,
        sourceAgentId: run.agentId,
        sourceStopSupported: run.stopSupported,
        sourceStopReason: run.stopReason,
        optimisticUserEvent: null,
        openStream: ({ signal, onReady, onDelta, onSessionEvent }) =>
          streamChatRun(
            {
              runId
            },
            { signal, onReady, onDelta, onSessionEvent }
          ),
        setters: {
          setOptimisticUserEvent,
          setStreamingSessionEvents,
          setStreamingAssistantText,
          setStreamingAssistantTimestamp,
          setIsSending,
          setIsAwaitingAssistantOutput,
          setCanStopCurrentRun,
          setStopDisabledReason,
          setLastSendError
        }
      });
    },
    [isSending, params]
  );

  useEffect(() => {
    if (isSending || queuedMessages.length === 0) {
      return;
    }
    const [next, ...rest] = queuedMessages;
    setQueuedMessages(rest);
    void runSend(next, { restoreDraftOnError: true });
  }, [isSending, queuedMessages, runSend]);

  const sendMessage = useCallback(
    async (payload: SendMessageParams) => {
      setLastSendError(null);
      queueIdRef.current += 1;
      const item: PendingChatMessage = {
        id: queueIdRef.current,
        message: payload.message,
        sessionKey: payload.sessionKey,
        agentId: payload.agentId,
        ...(payload.model ? { model: payload.model } : {}),
        ...(payload.requestedSkills && payload.requestedSkills.length > 0
          ? { requestedSkills: payload.requestedSkills }
          : {}),
        ...(typeof payload.stopSupported === 'boolean' ? { stopSupported: payload.stopSupported } : {}),
        ...(payload.stopReason ? { stopReason: payload.stopReason } : {})
      };
      if (isSending) {
        setQueuedMessages((prev) => [...prev, item]);
        return;
      }
      await runSend(item, { restoreDraftOnError: payload.restoreDraftOnError });
    },
    [isSending, runSend]
  );

  const stopCurrentRun = useCallback(async () => {
    const activeRun = activeRunRef.current;
    if (!activeRun) {
      return;
    }
    if (!activeRun.backendStopSupported) {
      return;
    }

    setCanStopCurrentRun(false);
    setQueuedMessages([]);
    if (activeRun.backendRunId) {
      try {
        await stopChatTurn({
          runId: activeRun.backendRunId,
          sessionKey: activeRun.sessionKey,
          ...(activeRun.agentId ? { agentId: activeRun.agentId } : {})
        });
      } catch {
        // Keep local abort as fallback even if stop API fails.
      }
    }
    activeRun.requestAbortController.abort();
  }, []);

  return {
    optimisticUserEvent,
    streamingSessionEvents,
    streamingAssistantText,
    streamingAssistantTimestamp,
    isSending,
    isAwaitingAssistantOutput,
    queuedCount: queuedMessages.length,
    canStopCurrentRun,
    stopDisabledReason,
    lastSendError,
    activeBackendRunId: activeRunRef.current?.backendRunId ?? null,
    sendMessage,
    resumeRun,
    stopCurrentRun,
    resetStreamState
  };
}
