import type { SessionManager, SessionMessage } from "@nextclaw/core";
import type { AgentSessionRecord, AgentSessionStore } from "@nextclaw/ncp-toolkit";
import type { NcpMessage, NcpMessagePart, NcpToolInvocationPart } from "@nextclaw/ncp";

type LegacyToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneMetadata(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? structuredClone(value) : undefined;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const deduped = new Set<string>();
  for (const item of value) {
    const normalized = normalizeString(item);
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return [...deduped];
}

function mergeSessionMetadata(
  currentMetadata: Record<string, unknown>,
  inputMetadata?: Record<string, unknown>,
): Record<string, unknown> {
  if (!inputMetadata) {
    return currentMetadata;
  }

  const nextMetadata = {
    ...currentMetadata,
    ...structuredClone(inputMetadata),
  };
  const model =
    normalizeString(inputMetadata.model) ??
    normalizeString(inputMetadata.preferred_model) ??
    normalizeString(inputMetadata.preferredModel);
  if (model) {
    nextMetadata.model = model;
    nextMetadata.preferred_model = model;
  }

  const thinking =
    normalizeString(inputMetadata.thinking) ??
    normalizeString(inputMetadata.preferred_thinking) ??
    normalizeString(inputMetadata.thinking_level) ??
    normalizeString(inputMetadata.thinkingLevel);
  if (thinking) {
    nextMetadata.thinking = thinking;
    nextMetadata.preferred_thinking = thinking;
  }

  const sessionType =
    normalizeString(inputMetadata.session_type) ?? normalizeString(inputMetadata.sessionType);
  if (sessionType) {
    nextMetadata.session_type = sessionType;
  }

  const label =
    normalizeString(inputMetadata.label) ?? normalizeString(inputMetadata.session_label);
  if (label) {
    nextMetadata.label = label;
  }

  const requestedSkills =
    readStringArray(inputMetadata.requested_skills) ??
    readStringArray(inputMetadata.requestedSkills);
  if (requestedSkills) {
    nextMetadata.requested_skills = requestedSkills;
  }

  return nextMetadata;
}

function extractMessageMetadata(messages: NcpMessage[]): Record<string, unknown> | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") {
      continue;
    }
    const metadata = cloneMetadata(message.metadata);
    if (metadata) {
      return metadata;
    }
  }
  return undefined;
}

function ensureIsoTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return fallback;
  }
  return new Date(timestamp).toISOString();
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function toTextPart(text: string): NcpMessagePart | null {
  return text.length > 0 ? { type: "text", text } : null;
}

function contentToParts(content: unknown): NcpMessagePart[] {
  if (typeof content === "string") {
    const textPart = toTextPart(content);
    return textPart ? [textPart] : [];
  }
  if (Array.isArray(content)) {
    return content.length > 0
      ? [
          {
            type: "extension",
            extensionType: "nextclaw.legacy.content-array",
            data: structuredClone(content)
          }
        ]
      : [];
  }
  if (content && typeof content === "object") {
    return [
      {
        type: "extension",
        extensionType: "nextclaw.legacy.content-object",
        data: structuredClone(content)
      }
    ];
  }
  return [];
}

function parseLegacyToolCalls(value: unknown): LegacyToolCall[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }
      const toolCall = entry as Record<string, unknown>;
      const id = normalizeString(toolCall.id);
      const rawFunction = toolCall.function;
      if (!id || !rawFunction || typeof rawFunction !== "object" || Array.isArray(rawFunction)) {
        return null;
      }
      const fn = rawFunction as Record<string, unknown>;
      const name = normalizeString(fn.name);
      const args = typeof fn.arguments === "string" ? fn.arguments : JSON.stringify(fn.arguments ?? {});
      if (!name) {
        return null;
      }
      return {
        id,
        type: "function" as const,
        function: {
          name,
          arguments: args
        }
      };
    })
    .filter((entry): entry is LegacyToolCall => entry !== null);
}

function createMessageId(sessionId: string, index: number, role: string, timestamp: string): string {
  const safeRole = role.trim().toLowerCase() || "message";
  return `${sessionId}:${safeRole}:${index}:${timestamp}`;
}

function buildAssistantMessage(params: {
  sessionId: string;
  index: number;
  message: SessionMessage;
}): NcpMessage {
  const timestamp = ensureIsoTimestamp(params.message.timestamp, new Date().toISOString());
  const toolCalls = parseLegacyToolCalls(params.message.tool_calls);
  const parts: NcpMessagePart[] = [...contentToParts(params.message.content)];

  const reasoning = normalizeString(params.message.reasoning_content);
  if (reasoning) {
    parts.push({
      type: "reasoning",
      text: reasoning
    });
  }

  for (const toolCall of toolCalls) {
    parts.push({
      type: "tool-invocation",
      toolCallId: toolCall.id,
      toolName: toolCall.function.name,
      state: "call",
      args: tryParseJson(toolCall.function.arguments)
    });
  }

  return {
    id: createMessageId(params.sessionId, params.index, "assistant", timestamp),
    sessionId: params.sessionId,
    role: "assistant",
    status: "final",
    timestamp,
    parts
  };
}

function buildGenericMessage(params: {
  sessionId: string;
  index: number;
  role: NcpMessage["role"];
  message: SessionMessage;
}): NcpMessage {
  const timestamp = ensureIsoTimestamp(params.message.timestamp, new Date().toISOString());
  return {
    id: createMessageId(params.sessionId, params.index, params.role, timestamp),
    sessionId: params.sessionId,
    role: params.role,
    status: "final",
    timestamp,
    parts: contentToParts(params.message.content)
  };
}

function attachToolResult(target: NcpMessage, toolCallId: string, result: unknown, toolName?: string): void {
  target.parts = target.parts.map((part) => {
    if (part.type !== "tool-invocation" || part.toolCallId !== toolCallId) {
      return part;
    }
    return {
      ...part,
      toolName: toolName ?? part.toolName,
      state: "result",
      result
    };
  });
}

function toNcpMessages(sessionId: string, messages: SessionMessage[]): NcpMessage[] {
  const ncpMessages: NcpMessage[] = [];
  const assistantIndexByToolCallId = new Map<string, number>();

  messages.forEach((message, index) => {
    const role = normalizeString(message.role)?.toLowerCase() ?? "assistant";
    if (role === "tool") {
      const toolCallId = normalizeString(message.tool_call_id);
      if (toolCallId) {
        const assistantIndex = assistantIndexByToolCallId.get(toolCallId);
        if (assistantIndex !== undefined) {
          attachToolResult(
            ncpMessages[assistantIndex] as NcpMessage,
            toolCallId,
            structuredClone(message.content),
            normalizeString(message.name) ?? undefined
          );
          return;
        }
      }
      ncpMessages.push(
        buildGenericMessage({
          sessionId,
          index,
          role: "tool",
          message
        })
      );
      return;
    }

    if (role === "assistant") {
      const assistant = buildAssistantMessage({ sessionId, index, message });
      const assistantPosition = ncpMessages.push(assistant) - 1;
      for (const part of assistant.parts) {
        if (part.type === "tool-invocation" && part.toolCallId) {
          assistantIndexByToolCallId.set(part.toolCallId, assistantPosition);
        }
      }
      return;
    }

    const normalizedRole = (role === "system" || role === "user" || role === "service" ? role : "user") as NcpMessage["role"];
    ncpMessages.push(
      buildGenericMessage({
        sessionId,
        index,
        role: normalizedRole,
        message
      })
    );
  });

  return ncpMessages;
}

function serializeToolArgs(args: unknown): string {
  if (typeof args === "string") {
    return args;
  }
  return JSON.stringify(args ?? {});
}

function serializeLegacyContent(parts: NcpMessagePart[]): unknown {
  const text = parts
    .filter((part): part is Extract<NcpMessagePart, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
  if (text.length > 0) {
    return text;
  }
  if (parts.length === 0) {
    return "";
  }
  return structuredClone(parts);
}

function toLegacyMessages(messages: NcpMessage[]): SessionMessage[] {
  const legacyMessages: SessionMessage[] = [];

  for (const message of messages) {
    const timestamp = ensureIsoTimestamp(message.timestamp, new Date().toISOString());

    if (message.role === "assistant") {
      const textContent = message.parts
        .filter((part): part is Extract<NcpMessagePart, { type: "text" }> => part.type === "text")
        .map((part) => part.text)
        .join("");
      const reasoningContent = message.parts
        .filter((part): part is Extract<NcpMessagePart, { type: "reasoning" }> => part.type === "reasoning")
        .map((part) => part.text)
        .join("");
      const toolInvocations = message.parts.filter(
        (part): part is NcpToolInvocationPart => part.type === "tool-invocation"
      );

      const assistantMessage: SessionMessage = {
        role: "assistant",
        content: textContent,
        timestamp,
        ncp_message_id: message.id
      };
      if (reasoningContent.length > 0) {
        assistantMessage.reasoning_content = reasoningContent;
      }
      if (toolInvocations.length > 0) {
        assistantMessage.tool_calls = toolInvocations.map((toolInvocation, index) => ({
          id: toolInvocation.toolCallId ?? `${message.id}:tool:${index}`,
          type: "function",
          function: {
            name: toolInvocation.toolName,
            arguments: serializeToolArgs(toolInvocation.args)
          }
        }));
      }
      legacyMessages.push(assistantMessage);

      for (const toolInvocation of toolInvocations) {
        if (toolInvocation.state !== "result") {
          continue;
        }
        legacyMessages.push({
          role: "tool",
          name: toolInvocation.toolName,
          tool_call_id: toolInvocation.toolCallId,
          content: typeof toolInvocation.result === "string"
            ? toolInvocation.result
            : JSON.stringify(toolInvocation.result ?? null),
          timestamp,
          ncp_message_id: message.id
        });
      }
      continue;
    }

    legacyMessages.push({
      role: message.role,
      content: serializeLegacyContent(message.parts),
      timestamp,
      ncp_message_id: message.id
    });
  }

  return legacyMessages;
}

function resolveLegacyEventType(message: SessionMessage): string {
  const role = normalizeString(message.role)?.toLowerCase() ?? "";
  if (role === "assistant" && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    return "assistant.tool_call";
  }
  if (role === "tool") {
    return "tool.result";
  }
  if (role === "assistant") {
    return "message.assistant";
  }
  if (role === "user") {
    return "message.user";
  }
  if (role === "system") {
    return "message.system";
  }
  return `message.${role || "other"}`;
}

export class NextclawAgentSessionStore implements AgentSessionStore {
  constructor(
    private readonly sessionManager: SessionManager,
    private readonly options: {
      writeMode?: "ncp-state" | "runtime-owned";
    } = {},
  ) {}

  async getSession(sessionId: string): Promise<AgentSessionRecord | null> {
    const session = this.sessionManager.getIfExists(sessionId);
    if (!session) {
      return null;
    }
    return {
      sessionId,
      messages: toNcpMessages(sessionId, session.messages),
      updatedAt: session.updatedAt.toISOString(),
      metadata: structuredClone(session.metadata),
    };
  }

  async listSessions(): Promise<AgentSessionRecord[]> {
    const records = this.sessionManager.listSessions();
    const sessions: AgentSessionRecord[] = [];
    for (const record of records) {
      const sessionId = normalizeString(record.key);
      if (!sessionId) {
        continue;
      }
      const session = this.sessionManager.getIfExists(sessionId);
      if (!session) {
        continue;
      }
      sessions.push({
        sessionId,
        messages: toNcpMessages(sessionId, session.messages),
        updatedAt: session.updatedAt.toISOString(),
        metadata: structuredClone(session.metadata),
      });
    }

    sessions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return sessions;
  }

  async saveSession(sessionRecord: AgentSessionRecord): Promise<void> {
    if (this.options.writeMode === "runtime-owned") {
      return;
    }
    const session =
      this.sessionManager.getIfExists(sessionRecord.sessionId) ?? this.sessionManager.getOrCreate(sessionRecord.sessionId);
    const legacyMessages = toLegacyMessages(sessionRecord.messages);
    const nextMetadata = mergeSessionMetadata(
      session.metadata,
      extractMessageMetadata(sessionRecord.messages),
    );
    session.metadata = mergeSessionMetadata(nextMetadata, cloneMetadata(sessionRecord.metadata));

    this.sessionManager.clear(session);
    for (const message of legacyMessages) {
      this.sessionManager.appendEvent(session, {
        type: resolveLegacyEventType(message),
        timestamp: ensureIsoTimestamp(message.timestamp, new Date().toISOString()),
        data: {
          message
        }
      });
    }

    if (legacyMessages.length === 0) {
      session.updatedAt = new Date(ensureIsoTimestamp(sessionRecord.updatedAt, new Date().toISOString()));
    }

    this.sessionManager.save(session);
  }

  async deleteSession(sessionId: string): Promise<AgentSessionRecord | null> {
    const existing = await this.getSession(sessionId);
    if (!existing) {
      return null;
    }
    this.sessionManager.delete(sessionId);
    return existing;
  }
}
