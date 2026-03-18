import * as NextclawCore from "@nextclaw/core";
import { DEFAULT_SESSION_TYPE } from "../config.js";
import type {
  ChatRunState,
  ChatRunView,
  ChatSessionTypesView,
  ChatTurnView,
  UiChatRuntime
} from "../types.js";
import { readNonEmptyString } from "./response.js";

function normalizeSessionType(value: unknown): string | undefined {
  return readNonEmptyString(value)?.toLowerCase();
}

function resolveSessionTypeLabel(sessionType: string): string {
  if (sessionType === "native") {
    return "Native";
  }
  if (sessionType === "codex") {
    return "Codex";
  }
  if (sessionType === "codex-sdk") {
    return "Codex";
  }
  if (sessionType === "claude-agent-sdk") {
    return "Claude Code";
  }
  return sessionType;
}

export async function buildChatSessionTypesView(chatRuntime?: UiChatRuntime): Promise<ChatSessionTypesView> {
  if (!chatRuntime?.listSessionTypes) {
    return {
      defaultType: DEFAULT_SESSION_TYPE,
      options: [{ value: DEFAULT_SESSION_TYPE, label: resolveSessionTypeLabel(DEFAULT_SESSION_TYPE) }]
    };
  }

  const payload = await chatRuntime.listSessionTypes();
  const deduped = new Map<string, { value: string; label: string }>();
  for (const rawOption of payload.options ?? []) {
    const normalized = normalizeSessionType(rawOption.value);
    if (!normalized) {
      continue;
    }
    deduped.set(normalized, {
      value: normalized,
      label: readNonEmptyString(rawOption.label) ?? resolveSessionTypeLabel(normalized)
    });
  }
  if (!deduped.has(DEFAULT_SESSION_TYPE)) {
    deduped.set(DEFAULT_SESSION_TYPE, {
      value: DEFAULT_SESSION_TYPE,
      label: resolveSessionTypeLabel(DEFAULT_SESSION_TYPE)
    });
  }

  const defaultType = normalizeSessionType(payload.defaultType) ?? DEFAULT_SESSION_TYPE;
  if (!deduped.has(defaultType)) {
    deduped.set(defaultType, {
      value: defaultType,
      label: resolveSessionTypeLabel(defaultType)
    });
  }
  const options = Array.from(deduped.values()).sort((left, right) => {
    if (left.value === DEFAULT_SESSION_TYPE) {
      return -1;
    }
    if (right.value === DEFAULT_SESSION_TYPE) {
      return 1;
    }
    return left.value.localeCompare(right.value);
  });

  return {
    defaultType,
    options
  };
}

export function resolveAgentIdFromSessionKey(sessionKey?: string): string | undefined {
  const parsed = NextclawCore.parseAgentScopedSessionKey(sessionKey);
  const agentId = readNonEmptyString(parsed?.agentId);
  return agentId;
}

export function createChatRunId(): string {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `run-${now}-${rand}`;
}

function isChatRunState(value: string): value is ChatRunState {
  return value === "queued" || value === "running" || value === "completed" || value === "failed" || value === "aborted";
}

export function readChatRunStates(value: unknown): ChatRunState[] | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const values = value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is ChatRunState => Boolean(item) && isChatRunState(item));
  if (values.length === 0) {
    return undefined;
  }
  return Array.from(new Set(values));
}

export function buildChatTurnView(params: {
  result: {
    reply: string;
    sessionKey: string;
    agentId?: string;
    model?: string;
  };
  fallbackSessionKey: string;
  requestedAgentId?: string;
  requestedModel?: string;
  requestedAt: Date;
  startedAtMs: number;
}): ChatTurnView {
  const completedAt = new Date();
  return {
    reply: String(params.result.reply ?? ""),
    sessionKey: readNonEmptyString(params.result.sessionKey) ?? params.fallbackSessionKey,
    ...(readNonEmptyString(params.result.agentId) || params.requestedAgentId
      ? { agentId: readNonEmptyString(params.result.agentId) ?? params.requestedAgentId }
      : {}),
    ...(readNonEmptyString(params.result.model) || params.requestedModel
      ? { model: readNonEmptyString(params.result.model) ?? params.requestedModel }
      : {}),
    requestedAt: params.requestedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: Math.max(0, completedAt.getTime() - params.startedAtMs)
  };
}

export function buildChatTurnViewFromRun(params: {
  run: ChatRunView;
  fallbackSessionKey: string;
  fallbackAgentId?: string;
  fallbackModel?: string;
  fallbackReply?: string;
}): ChatTurnView {
  const requestedAt = readNonEmptyString(params.run.requestedAt) ?? new Date().toISOString();
  const completedAt = readNonEmptyString(params.run.completedAt) ?? new Date().toISOString();
  const requestedAtMs = Date.parse(requestedAt);
  const completedAtMs = Date.parse(completedAt);
  return {
    reply: readNonEmptyString(params.run.reply) ?? params.fallbackReply ?? "",
    sessionKey: readNonEmptyString(params.run.sessionKey) ?? params.fallbackSessionKey,
    ...(readNonEmptyString(params.run.agentId) || params.fallbackAgentId
      ? { agentId: readNonEmptyString(params.run.agentId) ?? params.fallbackAgentId }
      : {}),
    ...(readNonEmptyString(params.run.model) || params.fallbackModel
      ? { model: readNonEmptyString(params.run.model) ?? params.fallbackModel }
      : {}),
    requestedAt,
    completedAt,
    durationMs:
      Number.isFinite(requestedAtMs) && Number.isFinite(completedAtMs)
        ? Math.max(0, completedAtMs - requestedAtMs)
        : 0
  };
}

export function toSseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
