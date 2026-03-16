import { describe, expect, it } from "vitest";
import {
  type NcpAgentClientEndpoint,
  type NcpEndpointEvent,
  type NcpEndpointManifest,
  type NcpEndpointSubscriber,
  type NcpMessageAbortPayload,
  type NcpRequestEnvelope,
  type NcpStreamRequestPayload,
  NcpEventType,
} from "@nextclaw/ncp";
import { createNcpHttpAgentRouter } from "./index.js";

const now = "2026-03-12T00:00:00.000Z";

describe("createNcpHttpAgentRouter", () => {
  it("forwards /send request to endpoint and streams scoped events", async () => {
    const endpoint = new FakeAgentEndpoint();
    const app = createNcpHttpAgentRouter({ agentClientEndpoint: endpoint });

    endpoint.setEmitHandler((event) => {
      if (event.type !== NcpEventType.MessageRequest) {
        return;
      }
      const { sessionId, correlationId } = event.payload;
      endpoint.push({
        type: NcpEventType.MessageAccepted,
        payload: { messageId: "assistant-1", correlationId },
      });
      endpoint.push({
        type: NcpEventType.MessageTextDelta,
        payload: { sessionId: "other-session", messageId: "assistant-1", delta: "ignored" },
      });
      endpoint.push({
        type: NcpEventType.MessageCompleted,
        payload: {
          sessionId,
          correlationId,
          message: {
            id: "assistant-1",
            sessionId,
            role: "assistant",
            status: "final",
            parts: [{ type: "text", text: "ok" }],
            timestamp: now,
          },
        },
      });
    });

    const requestBody: NcpRequestEnvelope = {
      sessionId: "session-1",
      correlationId: "corr-1",
      message: {
        id: "user-1",
        sessionId: "session-1",
        role: "user",
        status: "final",
        parts: [{ type: "text", text: "ping" }],
        timestamp: now,
      },
    };

    const response = await app.request("http://localhost/ncp/agent/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const body = await response.text();
    expect(body).toContain('"type":"message.accepted"');
    expect(body).toContain('"type":"message.completed"');
    expect(body).not.toContain('"other-session"');

    expect(endpoint.emitted[0]?.type).toBe("message.request");
  });

  it("returns 400 when stream query is missing required fields", async () => {
    const endpoint = new FakeAgentEndpoint();
    const app = createNcpHttpAgentRouter({ agentClientEndpoint: endpoint });

    const response = await app.request("http://localhost/ncp/agent/stream", {
      method: "GET",
    });
    expect(response.status).toBe(400);
  });

  it("closes /stream immediately when no live session is available", async () => {
    const endpoint = new FakeAgentEndpoint();
    const app = createNcpHttpAgentRouter({ agentClientEndpoint: endpoint });

    const response = await app.request("http://localhost/ncp/agent/stream?sessionId=session-1", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(endpoint.emitted).toEqual([
      {
        type: NcpEventType.MessageStreamRequest,
        payload: { sessionId: "session-1" },
      },
    ]);
  });

  it("forwards /abort payload to endpoint", async () => {
    const endpoint = new FakeAgentEndpoint();
    const app = createNcpHttpAgentRouter({ agentClientEndpoint: endpoint });

    const response = await app.request("http://localhost/ncp/agent/abort", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "session-1" }),
    });

    expect(response.status).toBe(200);
    const abortEvent = endpoint.emitted.find((event) => event.type === NcpEventType.MessageAbort);
    expect(abortEvent).toEqual({
      type: NcpEventType.MessageAbort,
      payload: { sessionId: "session-1" },
    });
  });
});

class FakeAgentEndpoint implements NcpAgentClientEndpoint {
  readonly manifest: NcpEndpointManifest = {
    endpointKind: "agent",
    endpointId: "fake-agent",
    version: "0.1.0",
    supportsStreaming: true,
    supportsAbort: true,
    supportsProactiveMessages: false,
    supportsLiveSessionStream: true,
    supportedPartTypes: ["text"],
    expectedLatency: "seconds",
  };

  private readonly listeners = new Set<NcpEndpointSubscriber>();
  private emitHandler: ((event: NcpEndpointEvent) => void) | null = null;
  readonly emitted: NcpEndpointEvent[] = [];

  async start(): Promise<void> {}

  async stop(): Promise<void> {}

  async emit(event: NcpEndpointEvent): Promise<void> {
    this.emitted.push(event);
    if (this.emitHandler) {
      this.emitHandler(event);
    }
  }

  subscribe(listener: NcpEndpointSubscriber): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async send(envelope: NcpRequestEnvelope): Promise<void> {
    await this.emit({ type: NcpEventType.MessageRequest, payload: envelope });
  }

  async stream(payload: NcpStreamRequestPayload): Promise<void> {
    await this.emit({ type: NcpEventType.MessageStreamRequest, payload });
  }

  async abort(payload: NcpMessageAbortPayload): Promise<void> {
    await this.emit({ type: NcpEventType.MessageAbort, payload });
  }

  setEmitHandler(handler: (event: NcpEndpointEvent) => void): void {
    this.emitHandler = handler;
  }

  push(event: NcpEndpointEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
