import type { NcpErrorCode } from "./errors.js";

/**
 * An opaque session-level event passed through a stream.
 *
 * Used to carry runtime or session signals (e.g. session created, quota updated)
 * alongside content events without requiring a separate channel.
 * The shape is intentionally open — consumers should narrow on `type`.
 */
export type NcpSessionEvent = {
  type: string;
  data?: unknown;
};

// ---------------------------------------------------------------------------
// Stream event types
// ---------------------------------------------------------------------------

/**
 * An incremental text delta for streaming-capable endpoints.
 * Accumulate `delta` values in order to reconstruct the full response.
 */
export type NcpStreamDeltaEvent = {
  type: "delta";
  delta: string;
};

/**
 * A session-level event surfaced inline within a content stream.
 * Allows runtime signals to flow through the same async iterable as content.
 */
export type NcpStreamSessionEvent = {
  type: "session-event";
  event: NcpSessionEvent;
};

/**
 * Terminal success event — emitted once when the full response is available.
 * After this event no further events will be emitted on the stream.
 */
export type NcpStreamCompletedEvent = {
  type: "completed";
  /** The full response content, equivalent to concatenating all preceding deltas. */
  content: string;
  /** Optional metadata from the endpoint (e.g. token usage, model version). */
  metadata?: Record<string, unknown>;
};

/**
 * Terminal failure event — emitted when the stream ends with an error.
 * After this event no further events will be emitted on the stream.
 */
export type NcpStreamErrorEvent = {
  type: "error";
  /** Human-readable error description. */
  error: string;
  /** Machine-readable error category for programmatic handling. */
  code?: NcpErrorCode;
};

/**
 * Explicit cancellation marker — emitted when the request is aborted.
 * Distinct from `error` to allow consumers to handle cancellation separately
 * (e.g. suppress error UI, clean up optimistic state).
 */
export type NcpStreamAbortedEvent = {
  type: "aborted";
  reason?: string;
};

// ---------------------------------------------------------------------------
// Unified stream event union
// ---------------------------------------------------------------------------

/**
 * All possible events emitted by a streaming endpoint turn.
 *
 * A well-formed stream emits zero or more `delta` and `session-event` events,
 * followed by exactly one terminal event (`completed`, `error`, or `aborted`).
 */
export type NcpStreamEvent =
  | NcpStreamDeltaEvent
  | NcpStreamSessionEvent
  | NcpStreamCompletedEvent
  | NcpStreamErrorEvent
  | NcpStreamAbortedEvent;
