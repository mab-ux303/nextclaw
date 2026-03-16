import {
  type NcpAgentServerEndpoint,
  type NcpAgentRunApi,
  type NcpAgentRunSendOptions,
  type NcpAgentRunStreamOptions,
  type NcpAgentStreamProvider,
  type NcpEndpointEvent,
  type NcpEndpointManifest,
  type NcpMessage,
  type NcpMessageAbortPayload,
  type NcpRequestEnvelope,
  type NcpSessionApi,
  type NcpSessionSummary,
  type NcpStreamRequestPayload,
  NcpEventType,
} from "@nextclaw/ncp";
import { NcpErrorException } from "../../errors/ncp-error-exception.js";
import { AgentLiveSessionRegistry } from "./agent-live-session-registry.js";
import { AgentRunExecutor } from "./agent-run-executor.js";
import { createAsyncQueue } from "./async-queue.js";
import type {
  AgentSessionRecord,
  AgentSessionStore,
  CreateRuntimeFn,
  LiveSessionExecution,
  LiveSessionState,
} from "./agent-backend-types.js";
import { EventPublisher } from "./event-publisher.js";

const DEFAULT_SUPPORTED_PART_TYPES: NcpEndpointManifest["supportedPartTypes"] = [
  "text",
  "file",
  "source",
  "step-start",
  "reasoning",
  "tool-invocation",
  "card",
  "rich-text",
  "action",
  "extension",
];

export type DefaultNcpAgentBackendConfig = {
  createRuntime: CreateRuntimeFn;
  sessionStore: AgentSessionStore;
  endpointId?: string;
  version?: string;
  metadata?: Record<string, unknown>;
  supportedPartTypes?: NcpEndpointManifest["supportedPartTypes"];
  expectedLatency?: NcpEndpointManifest["expectedLatency"];
};

export class DefaultNcpAgentBackend
  implements
    NcpAgentServerEndpoint,
    NcpSessionApi,
    NcpAgentStreamProvider,
    NcpAgentRunApi
{
  readonly manifest: NcpEndpointManifest & { endpointKind: "agent" };

  private readonly sessionStore: AgentSessionStore;
  private readonly sessionRegistry: AgentLiveSessionRegistry;
  private readonly executor: AgentRunExecutor;
  private readonly publisher: EventPublisher;
  private started = false;

  constructor(config: DefaultNcpAgentBackendConfig) {
    this.sessionStore = config.sessionStore;
    this.sessionRegistry = new AgentLiveSessionRegistry(
      this.sessionStore,
      config.createRuntime,
    );
    this.executor = new AgentRunExecutor(async (sessionId) => this.persistSession(sessionId));
    this.publisher = new EventPublisher();
    this.manifest = {
      endpointKind: "agent",
      endpointId: config.endpointId?.trim() || "ncp-agent-backend",
      version: config.version?.trim() || "0.1.0",
      supportsStreaming: true,
      supportsAbort: true,
      supportsProactiveMessages: false,
      supportsLiveSessionStream: true,
      supportedPartTypes:
        config.supportedPartTypes ?? DEFAULT_SUPPORTED_PART_TYPES,
      expectedLatency: config.expectedLatency ?? "seconds",
      metadata: config.metadata,
    };
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.started = true;
    this.publisher.publish({ type: NcpEventType.EndpointReady });
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    this.started = false;
    for (const session of this.sessionRegistry.listSessions()) {
      const execution = session.activeExecution;
      if (!execution) {
        continue;
      }
      execution.abortHandled = true;
      execution.controller.abort();
      this.finishSessionExecution(session, execution);
    }
    this.sessionRegistry.clear();
  }

  async emit(event: NcpEndpointEvent): Promise<void> {
    await this.ensureStarted();

    switch (event.type) {
      case NcpEventType.MessageRequest:
        await this.handleRequest(event.payload);
        return;
      case NcpEventType.MessageStreamRequest:
        await this.streamToSubscribers(event.payload);
        return;
      case NcpEventType.MessageAbort:
        await this.handleAbort(event.payload);
        return;
      default:
        this.publisher.publish(event);
    }
  }

  subscribe(listener: (event: NcpEndpointEvent) => void): () => void {
    return this.publisher.subscribe(listener);
  }

  async *send(
    envelope: NcpRequestEnvelope,
    options?: NcpAgentRunSendOptions,
  ): AsyncIterable<NcpEndpointEvent> {
    await this.ensureStarted();
    const session = await this.sessionRegistry.ensureSession(envelope.sessionId);
    const execution = this.startSessionExecution(session, envelope, options?.signal);

    try {
      for await (const event of this.executor.executeRun(session, envelope, execution.controller)) {
        this.publishLiveEvent(execution, event);
        yield event;
      }

      if (execution.controller.signal.aborted && !execution.abortHandled) {
        const abortEvent = await this.createAbortEvent(session.sessionId);
        execution.abortHandled = true;
        this.publishLiveEvent(execution, abortEvent);
        yield abortEvent;
      }
    } finally {
      this.finishSessionExecution(session, execution);
    }
  }

  async abort(payload: NcpMessageAbortPayload): Promise<void> {
    await this.handleAbort(payload);
  }

  async *stream(
    payloadOrParams:
      | NcpStreamRequestPayload
      | { payload: NcpStreamRequestPayload; signal: AbortSignal },
    opts?: NcpAgentRunStreamOptions,
  ): AsyncIterable<NcpEndpointEvent> {
    const payload =
      "payload" in payloadOrParams && "signal" in payloadOrParams
        ? payloadOrParams.payload
        : payloadOrParams;
    const signal =
      "payload" in payloadOrParams && "signal" in payloadOrParams
        ? payloadOrParams.signal
        : opts?.signal ?? new AbortController().signal;

    const session = this.sessionRegistry.getSession(payload.sessionId);
    const execution = session?.activeExecution;
    if (!session || !execution || execution.closed) {
      return;
    }

    const queue = createAsyncQueue<NcpEndpointEvent>();
    const unsubscribe = execution.publisher.subscribe((event) => {
      queue.push(event);
    });
    const unsubscribeClose = execution.publisher.onClose(() => {
      queue.close();
    });
    const stop = () => {
      unsubscribe();
      unsubscribeClose();
      queue.close();
      signal.removeEventListener("abort", stop);
    };

    signal.addEventListener("abort", stop, { once: true });

    try {
      for await (const event of queue.iterable) {
        if (signal.aborted) {
          break;
        }
        yield event;
        if (isTerminalEvent(event)) {
          break;
        }
      }
    } finally {
      stop();
    }
  }

  async listSessions(): Promise<NcpSessionSummary[]> {
    const storedSessions = await this.sessionStore.listSessions();
    const summaries = storedSessions.map((session) =>
      toSessionSummary(session, this.sessionRegistry.getSession(session.sessionId)),
    );

    for (const liveSession of this.sessionRegistry.listSessions()) {
      if (summaries.some((session) => session.sessionId === liveSession.sessionId)) {
        continue;
      }
      summaries.push(toLiveSessionSummary(liveSession));
    }

    return summaries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async listSessionMessages(sessionId: string): Promise<NcpMessage[]> {
    const liveSession = this.sessionRegistry.getSession(sessionId);
    if (liveSession) {
      return readMessages(liveSession.stateManager.getSnapshot());
    }

    const session = await this.sessionStore.getSession(sessionId);
    return session ? session.messages.map((message) => structuredClone(message)) : [];
  }

  async getSession(sessionId: string): Promise<NcpSessionSummary | null> {
    const liveSession = this.sessionRegistry.getSession(sessionId);
    const storedSession = await this.sessionStore.getSession(sessionId);

    if (storedSession) {
      return toSessionSummary(storedSession, liveSession);
    }

    if (liveSession) {
      return toLiveSessionSummary(liveSession);
    }

    return null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const liveSession = this.sessionRegistry.deleteSession(sessionId);
    const execution = liveSession?.activeExecution;
    if (execution) {
      execution.abortHandled = true;
      execution.controller.abort();
      this.closeExecution(execution);
    }

    await this.sessionStore.deleteSession(sessionId);
  }

  private async ensureStarted(): Promise<void> {
    if (!this.started) {
      await this.start();
    }
  }

  private startSessionExecution(
    session: LiveSessionState,
    envelope: NcpRequestEnvelope,
    signal?: AbortSignal,
  ): LiveSessionExecution {
    if (session.activeExecution && !session.activeExecution.closed) {
      throw new NcpErrorException(
        "runtime-error",
        `Session ${session.sessionId} already has an active execution.`,
        { sessionId: session.sessionId },
      );
    }

    const controller = new AbortController();
    if (signal) {
      signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }

    const execution: LiveSessionExecution = {
      controller,
      publisher: new EventPublisher(),
      requestEnvelope: structuredClone(envelope),
      abortHandled: false,
      closed: false,
    };
    session.activeExecution = execution;
    return execution;
  }

  private finishSessionExecution(
    session: LiveSessionState,
    execution: LiveSessionExecution,
  ): void {
    if (session.activeExecution === execution) {
      session.activeExecution = null;
    }
    this.closeExecution(execution);
  }

  private closeExecution(execution: LiveSessionExecution): void {
    if (execution.closed) {
      return;
    }
    execution.closed = true;
    execution.publisher.close();
  }

  private publishLiveEvent(
    execution: LiveSessionExecution,
    event: NcpEndpointEvent,
  ): void {
    this.publisher.publish(event);
    if (!execution.closed) {
      execution.publisher.publish(event);
    }
  }

  private async handleRequest(envelope: NcpRequestEnvelope): Promise<void> {
    for await (const event of this.send(envelope)) {
      void event;
    }
  }

  private async streamToSubscribers(
    payload: NcpStreamRequestPayload,
  ): Promise<void> {
    const signal = new AbortController().signal;
    for await (const event of this.stream({ payload, signal })) {
      void event;
    }
  }

  private async handleAbort(payload: NcpMessageAbortPayload): Promise<void> {
    const session = this.sessionRegistry.getSession(payload.sessionId);
    const execution = session?.activeExecution;
    if (!session || !execution || execution.closed) {
      return;
    }

    execution.abortHandled = true;
    execution.controller.abort();

    const abortEvent = await this.createAbortEvent(payload.sessionId, payload.messageId);
    this.publishLiveEvent(execution, abortEvent);
    this.finishSessionExecution(session, execution);
  }

  private async createAbortEvent(
    sessionId: string,
    messageId?: string,
  ): Promise<NcpEndpointEvent> {
    const abortEvent: NcpEndpointEvent = {
      type: NcpEventType.MessageAbort,
      payload: {
        sessionId,
        ...(messageId ? { messageId } : {}),
      },
    };
    const liveSession = this.sessionRegistry.getSession(sessionId);
    if (liveSession) {
      await liveSession.stateManager.dispatch(abortEvent);
    }
    await this.persistSession(sessionId);
    return abortEvent;
  }

  private async persistSession(sessionId: string): Promise<void> {
    const session = this.sessionRegistry.getSession(sessionId);
    if (!session) {
      return;
    }

    const snapshot = session.stateManager.getSnapshot();
    await this.sessionStore.saveSession({
      sessionId,
      messages: readMessages(snapshot),
      updatedAt: now(),
    });
  }
}

function readMessages(
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

function toSessionSummary(
  session: AgentSessionRecord,
  liveSession: LiveSessionState | null,
): NcpSessionSummary {
  return {
    sessionId: session.sessionId,
    messageCount: session.messages.length,
    updatedAt: session.updatedAt,
    status: liveSession?.activeExecution ? "running" : "idle",
  };
}

function toLiveSessionSummary(session: LiveSessionState): NcpSessionSummary {
  const snapshot = session.stateManager.getSnapshot();
  return {
    sessionId: session.sessionId,
    messageCount: readMessages(snapshot).length,
    updatedAt: now(),
    status: session.activeExecution ? "running" : "idle",
  };
}

function now(): string {
  return new Date().toISOString();
}

function isTerminalEvent(event: NcpEndpointEvent): boolean {
  switch (event.type) {
    case NcpEventType.MessageAbort:
    case NcpEventType.RunFinished:
    case NcpEventType.RunError:
      return true;
    default:
      return false;
  }
}
