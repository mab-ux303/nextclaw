import type {
  NcpAgentClientEndpoint,
  NcpEndpointEvent,
  NcpStreamRequestPayload,
} from "@nextclaw/ncp";

export const DEFAULT_BASE_PATH = "/ncp/agent";
export const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;

/** Filters which events belong to the current request (session/run/correlation). */
export type EventScope = {
  sessionId: string;
  correlationId?: string;
  runId?: string;
};

/**
 * Streams live session events for `/stream`.
 *
 * **Scenario**: User sends a message, agent streams SSE back. Network drops mid-stream.
 * User reconnects and requests `GET /stream?sessionId=xxx` to continue following
 * the current live response for that session.
 *
 * **Two paths**:
 * - **Session stream** (with streamProvider): Do not call agent again. Attach to the
 *   active session's live event stream.
 * - **Forward** (no streamProvider): Forward `message.stream-request` to the agent
 *   and let the upstream endpoint provide the live stream.
 *
 * **Implementation**: `stream` attaches by payload.sessionId and yields live events
 * for that active session.
 */
export type NcpHttpAgentStreamProvider = {
  stream(params: {
    payload: NcpStreamRequestPayload;
    signal: AbortSignal;
  }): AsyncIterable<NcpEndpointEvent>;
};

export type NcpHttpAgentServerOptions = {
  /** Client endpoint to forward requests to (in-process adapter or remote HTTP client). */
  agentClientEndpoint: NcpAgentClientEndpoint;
  basePath?: string;
  requestTimeoutMs?: number;
  /**
   * Optional. When set, `/stream` serves live session events from streamProvider instead of
   * forwarding to the agent.
   * When not set, forwards `message.stream-request` to the agent.
   */
  streamProvider?: NcpHttpAgentStreamProvider;
};

export type SseEventFrame = {
  event: "ncp-event" | "error";
  data: unknown;
};
