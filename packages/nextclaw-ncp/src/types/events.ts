import type { NcpError } from "./errors.js";
import type { NcpMessage } from "./message.js";

/**
 * NCP event and payload definitions.
 *
 * Streaming content (text, reasoning, tool args) uses start → delta sequence → end.
 * The same content can be sent as a single full event (e.g. message.received or message.completed)
 * instead; endpoints or upper layers choose as needed.
 */

// ---------------------------------------------------------------------------
// Message envelopes (used by request/response/completed/failed/received)
// ---------------------------------------------------------------------------

export type NcpRequestEnvelope = {
  sessionKey: string;
  message: NcpMessage;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

export type NcpResponseEnvelope = {
  sessionKey: string;
  message: NcpMessage;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

export type NcpCompletedEnvelope = {
  sessionKey: string;
  message: NcpMessage;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

export type NcpFailedEnvelope = {
  sessionKey: string;
  messageId?: string;
  error: NcpError;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

export type NcpMessageAcceptedPayload = {
  messageId: string;
  correlationId?: string;
  transportId?: string;
};

export type NcpMessageAbortPayload = {
  messageId?: string;
  correlationId?: string;
};

// ---------------------------------------------------------------------------
// Run lifecycle (aligned with agent-chat RUN_*)
// ---------------------------------------------------------------------------

export type NcpRunStartedPayload = {
  sessionKey?: string;
  messageId?: string;
  threadId?: string;
  runId?: string;
};

export type NcpRunFinishedPayload = {
  sessionKey?: string;
  messageId?: string;
  threadId?: string;
  runId?: string;
};

export type NcpRunErrorPayload = {
  sessionKey?: string;
  messageId?: string;
  error?: string;
  threadId?: string;
  runId?: string;
};

export type NcpRunMetadataPayload = {
  sessionKey?: string;
  messageId?: string;
  runId?: string;
  metadata: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Text stream (aligned with agent-chat TEXT_*)
// Streaming: text-start → text-delta sequence → text-end. Alternative: message.received / message.completed with full NcpMessage.
// ---------------------------------------------------------------------------

export type NcpTextStartPayload = {
  sessionKey: string;
  messageId: string;
};

export type NcpTextDeltaPayload = {
  sessionKey: string;
  messageId: string;
  delta: string;
};

export type NcpTextEndPayload = {
  sessionKey: string;
  messageId: string;
};

// ---------------------------------------------------------------------------
// Reasoning stream (aligned with agent-chat REASONING_*)
// Streaming: reasoning-start → reasoning-delta sequence → reasoning-end. Alternative: message.received / message.completed with full NcpMessage.
// ---------------------------------------------------------------------------

export type NcpReasoningStartPayload = {
  sessionKey: string;
  messageId: string;
};

export type NcpReasoningDeltaPayload = {
  sessionKey: string;
  messageId: string;
  delta: string;
};

export type NcpReasoningEndPayload = {
  sessionKey: string;
  messageId: string;
};

// ---------------------------------------------------------------------------
// Tool call stream (aligned with agent-chat TOOL_CALL_*)
// Streaming: tool-call-start → tool-call-args or tool-call-args-delta sequence → tool-call-end; then tool-call-result. Alternative: message.received / message.completed with full NcpMessage.
// ---------------------------------------------------------------------------

export type NcpToolCallStartPayload = {
  sessionKey: string;
  messageId?: string;
  toolCallId: string;
  toolName: string;
};

export type NcpToolCallArgsPayload = {
  sessionKey: string;
  toolCallId: string;
  args: string;
};

export type NcpToolCallArgsDeltaPayload = {
  sessionKey: string;
  messageId?: string;
  toolCallId: string;
  delta: string;
};

export type NcpToolCallEndPayload = {
  sessionKey: string;
  toolCallId: string;
};

export type NcpToolCallResultPayload = {
  sessionKey: string;
  toolCallId: string;
  content: unknown;
};

// ---------------------------------------------------------------------------
// Event union (aligned with agent-chat EventType + endpoint lifecycle)
// ---------------------------------------------------------------------------

export type NcpEndpointEvent =
  | { type: "endpoint.ready" }
  | { type: "message.request"; payload: NcpRequestEnvelope }
  | { type: "message.accepted"; payload: NcpMessageAcceptedPayload }
  | { type: "message.received"; payload: NcpResponseEnvelope }
  | { type: "message.completed"; payload: NcpCompletedEnvelope }
  | { type: "message.failed"; payload: NcpFailedEnvelope }
  | { type: "message.abort"; payload: NcpMessageAbortPayload }
  | { type: "endpoint.error"; payload: NcpError }
  | { type: "run.started"; payload: NcpRunStartedPayload }
  | { type: "run.finished"; payload: NcpRunFinishedPayload }
  | { type: "run.error"; payload: NcpRunErrorPayload }
  | { type: "run.metadata"; payload: NcpRunMetadataPayload }
  | { type: "message.text-start"; payload: NcpTextStartPayload }
  | { type: "message.text-delta"; payload: NcpTextDeltaPayload }
  | { type: "message.text-end"; payload: NcpTextEndPayload }
  | { type: "message.reasoning-start"; payload: NcpReasoningStartPayload }
  | { type: "message.reasoning-delta"; payload: NcpReasoningDeltaPayload }
  | { type: "message.reasoning-end"; payload: NcpReasoningEndPayload }
  | { type: "message.tool-call-start"; payload: NcpToolCallStartPayload }
  | { type: "message.tool-call-args"; payload: NcpToolCallArgsPayload }
  | { type: "message.tool-call-args-delta"; payload: NcpToolCallArgsDeltaPayload }
  | { type: "message.tool-call-end"; payload: NcpToolCallEndPayload }
  | { type: "message.tool-call-result"; payload: NcpToolCallResultPayload };

export type NcpEndpointSubscriber = (event: NcpEndpointEvent) => void;
