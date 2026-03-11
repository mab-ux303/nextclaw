import type { NcpError } from "./errors.js";
import type { NcpEndpointManifest } from "./manifest.js";
import type { NcpMessage } from "./message.js";

// ---------------------------------------------------------------------------
// Message envelopes
// ---------------------------------------------------------------------------

/**
 * Envelope wrapping a message sent *to* an endpoint (caller → endpoint).
 *
 * When `correlationId` is set, the endpoint should echo it back on the
 * corresponding `NcpCompletedEnvelope` or `NcpFailedEnvelope` so the caller
 * can pair responses with requests without relying on message ordering.
 */
export type NcpRequestEnvelope = {
  sessionKey: string;
  message: NcpMessage;
  /** Optional caller-assigned id for correlating this request with its response. */
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Envelope wrapping a message received *from* an endpoint (endpoint → caller).
 * Mirrors `NcpRequestEnvelope` for symmetric bridging in bidirectional setups.
 */
export type NcpResponseEnvelope = {
  sessionKey: string;
  message: NcpMessage;
  /** Echoed from the originating `NcpRequestEnvelope.correlationId`, if present. */
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Fine-grained streaming delta for use in UIs and streaming transports.
 * Emitted repeatedly between `message.received` and `message.completed`.
 */
export type NcpDeltaEnvelope = {
  sessionKey: string;
  messageId: string;
  /** Incremental text fragment — accumulate in order to reconstruct the full content. */
  delta: string;
  metadata?: Record<string, unknown>;
};

/** Final message payload delivered on successful completion of a turn. */
export type NcpCompletedEnvelope = {
  sessionKey: string;
  message: NcpMessage;
  /** Echoed from the originating `NcpRequestEnvelope.correlationId`, if present. */
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

/** Error payload delivered when a turn fails before or after streaming begins. */
export type NcpFailedEnvelope = {
  sessionKey: string;
  /** Present when the failure is associated with a specific in-progress message. */
  messageId?: string;
  error: NcpError;
  /** Echoed from the originating `NcpRequestEnvelope.correlationId`, if present. */
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Transport acknowledgment
// ---------------------------------------------------------------------------

/**
 * Minimal acknowledgment returned by `NcpEndpoint.send`.
 *
 * A returned receipt confirms the endpoint accepted the request.
 * Failures are signalled by throwing `NcpErrorException` — the receipt
 * always represents a successful handoff.
 */
export type NcpSendReceipt = {
  /** Identifier assigned to the outbound message. */
  messageId: string;
  /** Opaque identifier from the underlying transport layer, if available. */
  transportId?: string;
};

// ---------------------------------------------------------------------------
// Endpoint event bus
// ---------------------------------------------------------------------------

/**
 * All events emitted on the endpoint's pub/sub surface.
 *
 * Subscribers receive these events via `NcpEndpoint.subscribe`.
 * Events are ordered within a session but not guaranteed to be ordered
 * across sessions on the same endpoint.
 */
export type NcpEndpointEvent =
  | { type: "endpoint.ready" }
  | { type: "message.received"; payload: NcpResponseEnvelope }
  | { type: "message.delta"; payload: NcpDeltaEnvelope }
  | { type: "message.completed"; payload: NcpCompletedEnvelope }
  | { type: "message.failed"; payload: NcpFailedEnvelope }
  | { type: "endpoint.error"; payload: NcpError };

/** Callback signature for `NcpEndpoint.subscribe`. */
export type NcpEndpointSubscriber = (event: NcpEndpointEvent) => void;

// ---------------------------------------------------------------------------
// Endpoint contract
// ---------------------------------------------------------------------------

/**
 * Core interface every NCP endpoint adapter must implement.
 *
 * An endpoint is a named, lifecycle-managed communication channel.
 * It can send messages to a remote participant and emit events back to
 * the local runtime via a pub/sub subscription model.
 *
 * @example
 * const endpoint: NcpEndpoint = new MyAgentEndpoint(options);
 * await endpoint.start();
 * endpoint.subscribe((event) => { ... });
 * const receipt = await endpoint.send(envelope);
 */
export interface NcpEndpoint {
  /** Static capability declaration — available before `start()` is called. */
  readonly manifest: NcpEndpointManifest;

  /**
   * Initializes the endpoint (opens connections, authenticates, etc.).
   * Must be called before `send`. Idempotent — safe to call more than once.
   */
  start(): Promise<void>;

  /**
   * Gracefully shuts down the endpoint and releases resources.
   * Idempotent — safe to call more than once.
   */
  stop(): Promise<void>;

  /**
   * Sends a message to the remote participant.
   *
   * Throws `NcpErrorException` if the endpoint is not started or if the
   * message is rejected by the transport. Never returns a "not accepted" receipt —
   * a returned receipt always means the message was accepted.
   */
  send(envelope: NcpRequestEnvelope): Promise<NcpSendReceipt>;

  /**
   * Subscribes to endpoint events.
   *
   * @param listener - Called for every event emitted by this endpoint.
   * @returns An unsubscribe function. Call it to stop receiving events.
   *
   * @example
   * const unsubscribe = endpoint.subscribe((event) => {
   *   if (event.type === "message.completed") handleReply(event.payload);
   * });
   * unsubscribe();
   */
  subscribe(listener: NcpEndpointSubscriber): () => void;
}
