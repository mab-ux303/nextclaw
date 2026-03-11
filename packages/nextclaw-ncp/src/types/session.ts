import type { NcpMessage } from "./message.js";

/**
 * Stable mapping between an NCP-internal session key and the endpoint's
 * native session identifier.
 *
 * A single NCP session may span multiple endpoint sessions over time
 * (e.g. after reconnects). This binding is the source of truth for that mapping.
 */
export type NcpSessionBinding = {
  /** The endpoint that owns this session. */
  endpointId: string;
  /** NCP-internal session identifier — stable across reconnects. */
  sessionKey: string;
  /**
   * The session identifier used by the endpoint itself (e.g. an OpenAI thread id,
   * a Slack channel + thread_ts pair, or a vendor-specific conversation id).
   */
  endpointSessionId: string;
  /** Arbitrary metadata for adapter-specific session context. */
  metadata?: Record<string, unknown>;
};

/**
 * Lightweight snapshot of session state for orchestration and observability.
 *
 * Not a full history — use `NcpSessionContract.appendMessage` for the message log.
 */
export type NcpSessionState = {
  sessionKey: string;
  endpointId: string;
  /** Present once a binding has been established. */
  endpointSessionId?: string;
  /** Total number of messages appended to this session. */
  messageCount: number;
  /** ISO 8601 timestamp of the last state mutation. */
  updatedAt: string;
};

/**
 * Minimal storage contract for NCP session management.
 *
 * Intentionally small for early protocol iterations — implementations can
 * extend it with querying, TTL, or event hooks as requirements grow.
 */
export interface NcpSessionContract {
  /**
   * Looks up the binding for a given session key.
   * Returns `null` if no binding exists yet.
   */
  resolveBinding(sessionKey: string): Promise<NcpSessionBinding | null>;

  /**
   * Creates or updates the binding for a session key.
   * Implementations should treat this as an upsert (idempotent on `sessionKey`).
   */
  upsertBinding(binding: NcpSessionBinding): Promise<void>;

  /**
   * Appends a message to the session's immutable message log.
   *
   * Implementations MUST treat this as append-only — existing messages
   * should never be mutated or deleted through this method.
   */
  appendMessage(message: NcpMessage): Promise<void>;
}
