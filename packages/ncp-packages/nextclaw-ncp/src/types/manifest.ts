import type { NcpMessagePart } from "./message.js";

/**
 * High-level category of an endpoint.
 *
 * Used for routing decisions, capability interpretation, and UI labeling.
 * - `agent`    — An AI agent that processes and responds to messages.
 * - `platform` — A collaboration platform (e.g. Slack, Teams, Discord).
 * - `email`    — An email transport.
 * - `human`    — A human operator or approval gate.
 * - `custom`   — Any endpoint type not covered by the above.
 */
export type NcpEndpointKind = "agent" | "platform" | "email" | "human" | "custom";

/**
 * Expected response latency profile of an endpoint.
 *
 * Used by the runtime and product layer to set user expectations,
 * configure timeouts, and choose appropriate UX patterns.
 */
export type NcpEndpointLatency = "realtime" | "seconds" | "minutes" | "hours" | "days";

/**
 * Capability manifest every endpoint adapter must expose.
 *
 * Consumers use the manifest for runtime capability discovery —
 * e.g. whether to show a typing indicator, whether to offer file uploads,
 * or whether an existing run can be streamed again.
 */
export type NcpEndpointManifest = {
  /** Category of this endpoint. */
  endpointKind: NcpEndpointKind;
  /** Stable unique identifier for this endpoint instance. */
  endpointId: string;
  /** SemVer string for the adapter implementation. */
  version: string;
  /** Whether this endpoint supports incremental streaming of message content. */
  supportsStreaming: boolean;
  /** Whether in-flight requests can be cancelled via `AbortSignal`. */
  supportsAbort: boolean;
  /** Whether this endpoint can push messages without a prior user request. */
  supportsProactiveMessages: boolean;
  /** Whether this endpoint can stream the live events of an active session by `sessionId`. */
  supportsLiveSessionStream: boolean;
  /**
   * The subset of `NcpMessagePart` types this endpoint can send or receive.
   * Using the literal union from `NcpMessagePart["type"]` prevents typos
   * and keeps the manifest in sync with the protocol definition.
   */
  supportedPartTypes: ReadonlyArray<NcpMessagePart["type"]>;
  /** Expected response latency — informs timeouts and UX treatment. */
  expectedLatency: NcpEndpointLatency;
  /** Arbitrary adapter- or deployment-specific metadata. */
  metadata?: Record<string, unknown>;
};
