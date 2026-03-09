import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

export type QueuedChatMessageView = {
  id: number;
  message: string;
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
  interruptIfSending?: boolean;
};

type UseChatStreamControllerParams = {
  nextOptimisticUserSeq: number;
  selectedSessionKeyRef: MutableRefObject<string | null>;
  setSelectedSessionKey: Dispatch<SetStateAction<string | null>>;
  setDraft: Dispatch<SetStateAction<string>>;
  refetchSessions: () => Promise<unknown>;
  refetchHistory: () => Promise<unknown>;
};

type StreamSetters = {
  setOptimisticUserEvent: Dispatch<SetStateAction<SessionEventView | null>>;
  setStreamingSessionEvents: Dispatch<SetStateAction<SessionEventView[]>>;
  setStreamingAssistantText: Dispatch<SetStateAction<string>>;
  setStreamingAssistantTimestamp: Dispatch<SetStateAction<string | null>>;
  setActiveBackendRunId: Dispatch<SetStateAction<string | null>>;
  setIsSending: Dispatch<SetStateAction<boolean>>;
  setIsAwaitingAssistantOutput: Dispatch<SetStateAction<boolean>>;
  setCanStopCurrentRun: Dispatch<SetStateAction<boolean>>;
  setStopDisabledReason: Dispatch<SetStateAction<string | null>>;
  setLastSendError: Dispatch<SetStateAction<string | null>>;
};

type StreamReadyEvent = {
  runId?: string;
  stopSupported?: boolean;
  stopReason?: string;
  sessionKey: string;
};

type StreamDeltaEvent = {
  delta: string;
};

type StreamSessionEvent = {
  data: SessionEventView;
};

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
    onReady: (event: StreamReadyEvent) => void;
    onDelta: (event: StreamDeltaEvent) => void;
    onSessionEvent: (event: StreamSessionEvent) => void;
  }) => Promise<{ sessionKey: string; reply: string }>;
  setters: StreamSetters;
};

type StreamProgress = {
  streamText: string;
  hasAssistantSessionEvent: boolean;
  hasUserSessionEvent: boolean;
};

type RunContext = {
  params: UseChatStreamControllerParams;
  runIdRef: MutableRefObject<number>;
  activeRunRef: MutableRefObject<ActiveRunState | null>;
  setters: StreamSetters;
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

function clearStreamingState(setters: StreamSetters) {
  setters.setIsSending(false);
  setters.setOptimisticUserEvent(null);
  setters.setStreamingSessionEvents([]);
  setters.setStreamingAssistantText('');
  setters.setStreamingAssistantTimestamp(null);
  setters.setActiveBackendRunId(null);
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

function buildOptimisticUserEvent(seq: number, message: string): SessionEventView {
  const timestamp = new Date().toISOString();
  return {
    seq,
    type: 'message.user.optimistic',
    timestamp,
    message: {
      role: 'user',
      content: message,
      timestamp
    }
  };
}

function buildPendingChatMessage(queueId: number, payload: SendMessageParams): PendingChatMessage {
  return {
    id: queueId,
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
}

function buildSendTurnPayload(item: PendingChatMessage, requestedSkills: string[]) {
  return {
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

function activateRun(params: ExecuteStreamRunParams, requestAbortController: AbortController) {
  params.activeRunRef.current = {
    localRunId: params.runId,
    sessionKey: params.sourceSessionKey,
    ...(params.sourceAgentId ? { agentId: params.sourceAgentId } : {}),
    requestAbortController,
    backendStopSupported: Boolean(params.sourceStopSupported),
    ...(params.sourceStopReason ? { backendStopReason: params.sourceStopReason } : {})
  };
}

function applyRunStartState(params: ExecuteStreamRunParams) {
  const { setters, optimisticUserEvent, sourceStopSupported, sourceStopReason } = params;
  setters.setStreamingSessionEvents([]);
  setters.setStreamingAssistantText('');
  setters.setStreamingAssistantTimestamp(null);
  setters.setActiveBackendRunId(null);
  setters.setOptimisticUserEvent(optimisticUserEvent);
  setters.setIsSending(true);
  setters.setIsAwaitingAssistantOutput(true);
  setters.setCanStopCurrentRun(false);
  setters.setStopDisabledReason(sourceStopSupported ? '__preparing__' : sourceStopReason ?? null);
  setters.setLastSendError(null);
}

function buildExecuteHandlers(params: ExecuteStreamRunParams, progress: StreamProgress) {
  const { runId, runIdRef, activeRunRef, setSelectedSessionKey, setters } = params;

  const onReady = (event: StreamReadyEvent) => {
    if (runId !== runIdRef.current) {
      return;
    }
    const activeRun = activeRunRef.current;
    if (activeRun && activeRun.localRunId === runId) {
      activeRun.backendRunId = event.runId?.trim() || undefined;
      setters.setActiveBackendRunId(activeRun.backendRunId ?? null);
      if (typeof event.stopSupported === 'boolean') {
        activeRun.backendStopSupported = event.stopSupported;
      }
      if (typeof event.stopReason === 'string' && event.stopReason.trim()) {
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
  };

  const onDelta = (event: StreamDeltaEvent) => {
    if (runId !== runIdRef.current) {
      return;
    }
    progress.streamText += event.delta;
    setters.setStreamingAssistantText(progress.streamText);
    setters.setIsAwaitingAssistantOutput(false);
  };

  const onSessionEvent = (event: StreamSessionEvent) => {
    if (runId !== runIdRef.current) {
      return;
    }
    if (event.data.message?.role === 'user') {
      progress.hasUserSessionEvent = true;
      setters.setOptimisticUserEvent(null);
    }
    upsertStreamingEvent(setters.setStreamingSessionEvents, event.data);
    if (event.data.message?.role === 'assistant') {
      progress.hasAssistantSessionEvent = true;
      progress.streamText = '';
      setters.setStreamingAssistantText('');
      setters.setIsAwaitingAssistantOutput(false);
    }
  };

  return { onReady, onDelta, onSessionEvent };
}

function buildLocalEventsAfterSuccess(params: {
  optimisticUserEvent: SessionEventView | null;
  sourceMessage?: string;
  hasUserSessionEvent: boolean;
  hasAssistantSessionEvent: boolean;
  streamText: string;
  finalReply: string;
}): SessionEventView[] {
  const {
    optimisticUserEvent,
    sourceMessage,
    hasUserSessionEvent,
    hasAssistantSessionEvent,
    streamText,
    finalReply
  } = params;
  const localEvents: SessionEventView[] = [];
  const isSlashCommandMessage = typeof sourceMessage === 'string' && sourceMessage.trim().startsWith('/');
  const shouldKeepLocalUserCommand =
    !hasUserSessionEvent &&
    optimisticUserEvent?.message?.role === 'user' &&
    isSlashCommandMessage;

  if (shouldKeepLocalUserCommand && optimisticUserEvent) {
    localEvents.push(optimisticUserEvent);
  }

  const localAssistantText = !hasAssistantSessionEvent ? (streamText.trim() || finalReply) : '';
  if (localAssistantText) {
    localEvents.push(buildLocalAssistantEvent(localAssistantText));
  }
  return localEvents;
}

async function finalizeExecuteSuccess(params: ExecuteStreamRunParams, result: { sessionKey: string; reply: string }, progress: StreamProgress) {
  if (params.runId !== params.runIdRef.current) {
    return;
  }

  params.setters.setOptimisticUserEvent(null);
  if (result.sessionKey !== params.sourceSessionKey) {
    params.setSelectedSessionKey(result.sessionKey);
  }

  await refetchIfSessionVisible({
    selectedSessionKeyRef: params.selectedSessionKeyRef,
    currentSessionKey: params.sourceSessionKey,
    resultSessionKey: result.sessionKey,
    refetchSessions: params.refetchSessions,
    refetchHistory: params.refetchHistory
  });

  const localEvents = buildLocalEventsAfterSuccess({
    optimisticUserEvent: params.optimisticUserEvent,
    sourceMessage: params.sourceMessage,
    hasUserSessionEvent: progress.hasUserSessionEvent,
    hasAssistantSessionEvent: progress.hasAssistantSessionEvent,
    streamText: progress.streamText,
    finalReply: typeof result.reply === 'string' ? result.reply.trim() : ''
  });

  params.setters.setStreamingSessionEvents(localEvents);
  params.setters.setStreamingAssistantText('');
  params.setters.setStreamingAssistantTimestamp(null);
  params.setters.setIsAwaitingAssistantOutput(false);
  params.setters.setIsSending(false);
  params.setters.setCanStopCurrentRun(false);
  params.setters.setStopDisabledReason(null);
  params.setters.setActiveBackendRunId(null);
  params.setters.setLastSendError(null);
  params.activeRunRef.current = null;
}

async function handleExecuteError(params: ExecuteStreamRunParams, requestAbortController: AbortController, error: unknown) {
  if (params.runId !== params.runIdRef.current) {
    return;
  }

  const wasAborted = requestAbortController.signal.aborted || isAbortLikeError(error);
  params.runIdRef.current += 1;
  if (wasAborted) {
    clearStreamingState(params.setters);
    params.activeRunRef.current = null;
    await refetchIfSessionVisible({
      selectedSessionKeyRef: params.selectedSessionKeyRef,
      currentSessionKey: params.sourceSessionKey,
      refetchSessions: params.refetchSessions,
      refetchHistory: params.refetchHistory
    });
    return;
  }

  clearStreamingState(params.setters);
  const sendError = formatSendError(error);
  params.setters.setLastSendError(sendError);
  params.setters.setStreamingSessionEvents([buildLocalAssistantEvent(sendError, 'message.assistant.error.local')]);
  params.setters.setActiveBackendRunId(null);
  params.activeRunRef.current = null;
  if (params.restoreDraftOnError) {
    params.setDraft((prev) => (prev.trim().length === 0 && params.sourceMessage ? params.sourceMessage : prev));
  }
}

async function executeStreamRun(params: ExecuteStreamRunParams): Promise<void> {
  const requestAbortController = new AbortController();
  const progress: StreamProgress = {
    streamText: '',
    hasAssistantSessionEvent: false,
    hasUserSessionEvent: false
  };

  activateRun(params, requestAbortController);
  applyRunStartState(params);
  params.setters.setStreamingAssistantTimestamp(new Date().toISOString());

  try {
    const handlers = buildExecuteHandlers(params, progress);
    const result = await params.openStream({
      signal: requestAbortController.signal,
      ...handlers
    });
    await finalizeExecuteSuccess(params, result, progress);
  } catch (error) {
    await handleExecuteError(params, requestAbortController, error);
  }
}

async function sendPendingMessage(params: {
  context: RunContext;
  item: PendingChatMessage;
  restoreDraftOnError?: boolean;
}) {
  const { context, item, restoreDraftOnError } = params;
  const { runIdRef, activeRunRef, setters } = context;

  setters.setLastSendError(null);
  runIdRef.current += 1;
  const requestedSkills = normalizeRequestedSkills(item.requestedSkills);

  await executeStreamRun({
    runId: runIdRef.current,
    runIdRef,
    activeRunRef,
    selectedSessionKeyRef: context.params.selectedSessionKeyRef,
    setSelectedSessionKey: context.params.setSelectedSessionKey,
    setDraft: context.params.setDraft,
    refetchSessions: context.params.refetchSessions,
    refetchHistory: context.params.refetchHistory,
    restoreDraftOnError,
    sourceSessionKey: item.sessionKey,
    sourceAgentId: item.agentId,
    sourceMessage: item.message,
    sourceStopSupported: item.stopSupported,
    sourceStopReason: item.stopReason,
    optimisticUserEvent: buildOptimisticUserEvent(context.params.nextOptimisticUserSeq, item.message),
    openStream: ({ signal, onReady, onDelta, onSessionEvent }) =>
      sendChatTurnStream(buildSendTurnPayload(item, requestedSkills), {
        signal,
        onReady,
        onDelta,
        onSessionEvent
      }),
    setters
  });
}

async function resumePendingRun(params: {
  context: RunContext;
  run: ChatRunView;
  isSending: boolean;
}) {
  const { context, run, isSending } = params;
  const runId = run.runId?.trim();
  const sessionKey = run.sessionKey?.trim();
  if (!runId || !sessionKey) {
    return;
  }

  const active = context.activeRunRef.current;
  if (active?.backendRunId === runId) {
    return;
  }
  if (isSending && active) {
    return;
  }

  context.setters.setLastSendError(null);
  context.runIdRef.current += 1;

  await executeStreamRun({
    runId: context.runIdRef.current,
    runIdRef: context.runIdRef,
    activeRunRef: context.activeRunRef,
    selectedSessionKeyRef: context.params.selectedSessionKeyRef,
    setSelectedSessionKey: context.params.setSelectedSessionKey,
    setDraft: context.params.setDraft,
    refetchSessions: context.params.refetchSessions,
    refetchHistory: context.params.refetchHistory,
    sourceSessionKey: sessionKey,
    sourceAgentId: run.agentId,
    sourceStopSupported: run.stopSupported,
    sourceStopReason: run.stopReason,
    optimisticUserEvent: null,
    openStream: ({ signal, onReady, onDelta, onSessionEvent }) =>
      streamChatRun({ runId }, { signal, onReady, onDelta, onSessionEvent }),
    setters: context.setters
  });
}

async function stopActiveRun(params: {
  activeRunRef: MutableRefObject<ActiveRunState | null>;
  setQueuedMessages: Dispatch<SetStateAction<PendingChatMessage[]>>;
  setCanStopCurrentRun: Dispatch<SetStateAction<boolean>>;
  options?: { clearQueue?: boolean };
}) {
  const activeRun = params.activeRunRef.current;
  if (!activeRun || !activeRun.backendStopSupported) {
    return;
  }

  if (params.options?.clearQueue ?? true) {
    params.setQueuedMessages([]);
  }

  params.setCanStopCurrentRun(false);
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
}

async function sendMessageByPolicy(params: {
  payload: SendMessageParams;
  isSending: boolean;
  queueIdRef: MutableRefObject<number>;
  activeRunRef: MutableRefObject<ActiveRunState | null>;
  setQueuedMessages: Dispatch<SetStateAction<PendingChatMessage[]>>;
  runSend: (item: PendingChatMessage, options?: { restoreDraftOnError?: boolean }) => Promise<void>;
  stopCurrentRun: (options?: { clearQueue?: boolean }) => Promise<void>;
  setLastSendError: Dispatch<SetStateAction<string | null>>;
}) {
  params.setLastSendError(null);
  params.queueIdRef.current += 1;
  const item = buildPendingChatMessage(params.queueIdRef.current, params.payload);

  if (params.isSending) {
    if (params.payload.interruptIfSending) {
      params.setQueuedMessages((prev) => [item, ...prev]);
      const activeRun = params.activeRunRef.current;
      if (activeRun?.backendStopSupported) {
        void params.stopCurrentRun({ clearQueue: false });
      }
      return;
    }
    params.setQueuedMessages((prev) => [...prev, item]);
    return;
  }

  await params.runSend(item, { restoreDraftOnError: params.payload.restoreDraftOnError });
}

function moveQueuedMessageToFront(id: number, prev: PendingChatMessage[]): PendingChatMessage[] {
  const index = prev.findIndex((item) => item.id === id);
  if (index <= 0) {
    return prev;
  }
  const next = [...prev];
  const [picked] = next.splice(index, 1);
  next.unshift(picked);
  return next;
}

export function useChatStreamController(params: UseChatStreamControllerParams) {
  const [optimisticUserEvent, setOptimisticUserEvent] = useState<SessionEventView | null>(null);
  const [streamingSessionEvents, setStreamingSessionEvents] = useState<SessionEventView[]>([]);
  const [streamingAssistantText, setStreamingAssistantText] = useState('');
  const [streamingAssistantTimestamp, setStreamingAssistantTimestamp] = useState<string | null>(null);
  const [activeBackendRunId, setActiveBackendRunId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isAwaitingAssistantOutput, setIsAwaitingAssistantOutput] = useState(false);
  const [queuedMessages, setQueuedMessages] = useState<PendingChatMessage[]>([]);
  const [canStopCurrentRun, setCanStopCurrentRun] = useState(false);
  const [stopDisabledReason, setStopDisabledReason] = useState<string | null>(null);
  const [lastSendError, setLastSendError] = useState<string | null>(null);

  const runIdRef = useRef(0);
  const queueIdRef = useRef(0);
  const activeRunRef = useRef<ActiveRunState | null>(null);

  const setters = useMemo<StreamSetters>(
    () => ({
      setOptimisticUserEvent,
      setStreamingSessionEvents,
      setStreamingAssistantText,
      setStreamingAssistantTimestamp,
      setActiveBackendRunId,
      setIsSending,
      setIsAwaitingAssistantOutput,
      setCanStopCurrentRun,
      setStopDisabledReason,
      setLastSendError
    }),
    []
  );

  const context = useMemo<RunContext>(
    () => ({
      params,
      runIdRef,
      activeRunRef,
      setters
    }),
    [params, setters]
  );

  const resetStreamState = useCallback(() => {
    runIdRef.current += 1;
    setQueuedMessages([]);
    activeRunRef.current?.requestAbortController.abort();
    activeRunRef.current = null;
    clearStreamingState(setters);
  }, [setters]);

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      activeRunRef.current?.requestAbortController.abort();
      activeRunRef.current = null;
    };
  }, []);

  const runSend = useCallback(
    async (item: PendingChatMessage, options?: { restoreDraftOnError?: boolean }) => {
      await sendPendingMessage({
        context,
        item,
        restoreDraftOnError: options?.restoreDraftOnError
      });
    },
    [context]
  );

  const resumeRun = useCallback(
    async (run: ChatRunView) => {
      await resumePendingRun({ context, run, isSending });
    },
    [context, isSending]
  );

  useEffect(() => {
    if (isSending || queuedMessages.length === 0) {
      return;
    }
    const [next, ...rest] = queuedMessages;
    setQueuedMessages(rest);
    void runSend(next, { restoreDraftOnError: true });
  }, [isSending, queuedMessages, runSend]);

  const stopCurrentRun = useCallback(
    async (options?: { clearQueue?: boolean }) => {
      await stopActiveRun({
        activeRunRef,
        setQueuedMessages,
        setCanStopCurrentRun,
        options,
      });
    },
    []
  );

  const sendMessage = useCallback(
    async (payload: SendMessageParams) => {
      await sendMessageByPolicy({
        payload,
        isSending,
        queueIdRef,
        activeRunRef,
        setQueuedMessages,
        runSend,
        stopCurrentRun,
        setLastSendError
      });
    },
    [isSending, runSend, stopCurrentRun]
  );

  const removeQueuedMessage = useCallback((id: number) => {
    setQueuedMessages((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const promoteQueuedMessage = useCallback((id: number) => {
    setQueuedMessages((prev) => moveQueuedMessageToFront(id, prev));
  }, []);

  const queuedMessagesView = useMemo<QueuedChatMessageView[]>(
    () => queuedMessages.map((item) => ({ id: item.id, message: item.message })),
    [queuedMessages]
  );

  return {
    optimisticUserEvent,
    streamingSessionEvents,
    streamingAssistantText,
    streamingAssistantTimestamp,
    isSending,
    isAwaitingAssistantOutput,
    queuedMessages: queuedMessagesView,
    queuedCount: queuedMessages.length,
    canStopCurrentRun,
    stopDisabledReason,
    lastSendError,
    activeBackendRunId,
    sendMessage,
    resumeRun,
    stopCurrentRun,
    removeQueuedMessage,
    promoteQueuedMessage,
    resetStreamState
  };
}
