import type { SessionEvent, SessionMessage } from "@nextclaw/core";
import {
  NcpEventType,
  type NcpAgentRunInput,
  type NcpAgentRunOptions,
  type NcpAgentRuntime,
  type NcpEndpointEvent,
} from "@nextclaw/ncp";

type NextclawDirectRuntime = {
  processDirect(params: {
    content: string;
    sessionKey?: string;
    channel?: string;
    chatId?: string;
    metadata?: Record<string, unknown>;
    abortSignal?: AbortSignal;
    onAssistantDelta?: (delta: string) => void;
    onSessionEvent?: (event: SessionEvent) => void;
  }): Promise<string>;
};

type RuntimeQueueItem =
  | { kind: "event"; event: NcpEndpointEvent }
  | { kind: "close" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mergeInputMetadata(input: NcpAgentRunInput): Record<string, unknown> {
  const messageMetadata = input.messages
    .slice()
    .reverse()
    .find((message) => isRecord(message.metadata))?.metadata;
  return {
    ...(isRecord(messageMetadata) ? structuredClone(messageMetadata) : {}),
    ...(isRecord(input.metadata) ? structuredClone(input.metadata) : {}),
  };
}

function extractUserMessageText(input: NcpAgentRunInput): string {
  const lastMessage = input.messages[input.messages.length - 1];
  if (!lastMessage) {
    return "";
  }
  return lastMessage.parts
    .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function createRunId(sessionId: string): string {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${sessionId}:run:${now}:${rand}`;
}

function createAssistantMessageId(sessionId: string, runId: string): string {
  return `${sessionId}:assistant:${runId}`;
}

function extractSessionMessage(event: SessionEvent): SessionMessage | null {
  const source = isRecord(event.data.message)
    ? event.data.message
    : isRecord(event.data)
      ? event.data
      : null;
  if (!source) {
    return null;
  }
  const role = readOptionalString(source.role);
  if (!role) {
    return null;
  }
  const timestamp = readOptionalString(source.timestamp) ?? event.timestamp;
  return {
    ...source,
    role,
    timestamp,
    content: Object.prototype.hasOwnProperty.call(source, "content") ? source.content : "",
  };
}

function normalizeToolCalls(value: unknown): Array<{
  id: string;
  name: string;
  args: string;
}> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }
      const id = readOptionalString(entry.id);
      const rawFunction = entry.function;
      if (!id || !isRecord(rawFunction)) {
        return null;
      }
      const name = readOptionalString(rawFunction.name);
      if (!name) {
        return null;
      }
      return {
        id,
        name,
        args:
          typeof rawFunction.arguments === "string"
            ? rawFunction.arguments
            : JSON.stringify(rawFunction.arguments ?? {}),
      };
    })
    .filter((entry): entry is { id: string; name: string; args: string } => entry !== null);
}

function contentToText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  return "";
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return true;
    }
    const normalized = error.message.trim().toLowerCase();
    return normalized.includes("abort");
  }
  return false;
}

class AsyncRuntimeEventQueue {
  private readonly items: RuntimeQueueItem[] = [];
  private readonly waiters: Array<(value: RuntimeQueueItem) => void> = [];
  private closed = false;

  push(event: NcpEndpointEvent): void {
    if (this.closed) {
      return;
    }
    const item: RuntimeQueueItem = { kind: "event", event };
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(item);
      return;
    }
    this.items.push(item);
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    const item: RuntimeQueueItem = { kind: "close" };
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter?.(item);
    }
  }

  async next(): Promise<RuntimeQueueItem> {
    if (this.items.length > 0) {
      return this.items.shift() as RuntimeQueueItem;
    }
    if (this.closed) {
      return { kind: "close" };
    }
    return new Promise<RuntimeQueueItem>((resolve) => {
      this.waiters.push(resolve);
    });
  }
}

class NextclawSessionEventNcpAdapter {
  private readonly emittedToolResults = new Set<string>();
  private streamedSinceLastAssistantEvent = false;
  private emittedAssistantText = false;
  private textStarted = false;
  private textEnded = false;

  constructor(
    private readonly context: {
      sessionId: string;
      messageId: string;
    },
    private readonly publish: (event: NcpEndpointEvent) => void,
  ) {}

  onAssistantDelta(delta: string): void {
    if (!delta) {
      return;
    }
    this.ensureTextStarted();
    this.publish({
      type: NcpEventType.MessageTextDelta,
      payload: {
        sessionId: this.context.sessionId,
        messageId: this.context.messageId,
        delta,
      },
    });
    this.streamedSinceLastAssistantEvent = true;
    this.emittedAssistantText = true;
  }

  onSessionEvent(event: SessionEvent): void {
    const message = extractSessionMessage(event);
    if (!message) {
      return;
    }
    const role = message.role.trim().toLowerCase();
    if (role === "assistant") {
      this.handleAssistantMessage(message);
      this.streamedSinceLastAssistantEvent = false;
      return;
    }
    if (role === "tool") {
      this.handleToolMessage(message);
    }
  }

  finish(finalReply: string): void {
    const normalizedReply = finalReply.trim();
    if (normalizedReply && !this.emittedAssistantText) {
      this.emitFullText(normalizedReply);
    }
    this.finishTextStream();
  }

  private handleAssistantMessage(message: SessionMessage): void {
    const reasoning = readOptionalString(message.reasoning_content);
    if (reasoning) {
      this.publish({
        type: NcpEventType.MessageReasoningStart,
        payload: {
          sessionId: this.context.sessionId,
          messageId: this.context.messageId,
        },
      });
      this.publish({
        type: NcpEventType.MessageReasoningDelta,
        payload: {
          sessionId: this.context.sessionId,
          messageId: this.context.messageId,
          delta: reasoning,
        },
      });
      this.publish({
        type: NcpEventType.MessageReasoningEnd,
        payload: {
          sessionId: this.context.sessionId,
          messageId: this.context.messageId,
        },
      });
    }

    const text = contentToText(message.content).trim();
    if (text && !this.streamedSinceLastAssistantEvent) {
      this.emitFullText(text);
    }

    for (const toolCall of normalizeToolCalls(message.tool_calls)) {
      this.publish({
        type: NcpEventType.MessageToolCallStart,
        payload: {
          sessionId: this.context.sessionId,
          messageId: this.context.messageId,
          toolCallId: toolCall.id,
          toolName: toolCall.name,
        },
      });
      this.publish({
        type: NcpEventType.MessageToolCallArgs,
        payload: {
          sessionId: this.context.sessionId,
          toolCallId: toolCall.id,
          args: toolCall.args,
        },
      });
      this.publish({
        type: NcpEventType.MessageToolCallEnd,
        payload: {
          sessionId: this.context.sessionId,
          toolCallId: toolCall.id,
        },
      });
    }
  }

  private handleToolMessage(message: SessionMessage): void {
    const toolCallId = readOptionalString(message.tool_call_id);
    if (!toolCallId || this.emittedToolResults.has(toolCallId)) {
      return;
    }
    this.emittedToolResults.add(toolCallId);
    this.publish({
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId: this.context.sessionId,
        toolCallId,
        content: message.content,
      },
    });
  }

  private emitFullText(text: string): void {
    if (!text) {
      return;
    }
    this.ensureTextStarted();
    this.publish({
      type: NcpEventType.MessageTextDelta,
      payload: {
        sessionId: this.context.sessionId,
        messageId: this.context.messageId,
        delta: text,
      },
    });
    this.emittedAssistantText = true;
  }

  private ensureTextStarted(): void {
    if (this.textStarted) {
      return;
    }
    this.publish({
      type: NcpEventType.MessageTextStart,
      payload: {
        sessionId: this.context.sessionId,
        messageId: this.context.messageId,
      },
    });
    this.textStarted = true;
    this.textEnded = false;
  }

  private finishTextStream(): void {
    if (!this.textStarted || this.textEnded) {
      return;
    }
    this.publish({
      type: NcpEventType.MessageTextEnd,
      payload: {
        sessionId: this.context.sessionId,
        messageId: this.context.messageId,
      },
    });
    this.textEnded = true;
  }
}

export class NextclawUiNcpRuntime implements NcpAgentRuntime {
  constructor(private readonly runtime: NextclawDirectRuntime) {}

  async *run(
    input: NcpAgentRunInput,
    options?: NcpAgentRunOptions,
  ): AsyncGenerator<NcpEndpointEvent> {
    const runId = createRunId(input.sessionId);
    const messageId = createAssistantMessageId(input.sessionId, runId);
    const metadata = mergeInputMetadata(input);
    const queue = new AsyncRuntimeEventQueue();
    const adapter = new NextclawSessionEventNcpAdapter(
      {
        sessionId: input.sessionId,
        messageId,
      },
      (event) => queue.push(event),
    );
    let processError: unknown = null;

    void this.runtime
      .processDirect({
        content: extractUserMessageText(input),
        sessionKey: input.sessionId,
        channel: "ui",
        chatId: "web-ui",
        metadata,
        abortSignal: options?.signal,
        onAssistantDelta: (delta) => adapter.onAssistantDelta(delta),
        onSessionEvent: (event) => adapter.onSessionEvent(event),
      })
      .then((reply) => {
        adapter.finish(reply);
      })
      .catch((error) => {
        if (!options?.signal?.aborted && !isAbortError(error)) {
          processError = error;
        }
      })
      .finally(() => {
        queue.close();
      });

    yield {
      type: NcpEventType.RunStarted,
      payload: {
        sessionId: input.sessionId,
        messageId,
        runId,
      },
    };

    while (true) {
      const item = await queue.next();
      if (item.kind === "close") {
        break;
      }
      yield item.event;
    }

    if (options?.signal?.aborted) {
      return;
    }
    if (processError) {
      throw processError;
    }

    yield {
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: input.sessionId,
        messageId,
        runId,
      },
    };
  }
}
