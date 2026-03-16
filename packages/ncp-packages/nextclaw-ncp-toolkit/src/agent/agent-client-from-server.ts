import {
  type NcpAgentClientEndpoint,
  type NcpAgentServerEndpoint,
  type NcpEndpointEvent,
  type NcpEndpointSubscriber,
  type NcpMessageAbortPayload,
  type NcpRequestEnvelope,
  type NcpStreamRequestPayload,
  NcpEventType,
} from "@nextclaw/ncp";

/**
 * Creates an NcpAgentClientEndpoint that forwards to an in-process NcpAgentServerEndpoint.
 * Use when the agent runs in-process and you need to pass a client endpoint to the HTTP server.
 */
export function createAgentClientFromServer(
  server: NcpAgentServerEndpoint,
): NcpAgentClientEndpoint {
  return {
    get manifest() {
      return server.manifest;
    },
    async start(): Promise<void> {
      await server.start();
    },
    async stop(): Promise<void> {
      await server.stop();
    },
    async emit(event: NcpEndpointEvent): Promise<void> {
      switch (event.type) {
        case NcpEventType.MessageRequest:
          await consume(server.send(event.payload));
          return;
        case NcpEventType.MessageStreamRequest:
          await consume(server.stream(event.payload));
          return;
        case NcpEventType.MessageAbort:
          await server.abort(event.payload);
          return;
        default:
          await server.emit(event);
      }
    },
    subscribe(listener: NcpEndpointSubscriber) {
      return server.subscribe(listener);
    },
    async send(envelope: NcpRequestEnvelope): Promise<void> {
      await consume(server.send(envelope));
    },
    async stream(payload: NcpStreamRequestPayload): Promise<void> {
      await consume(server.stream(payload));
    },
    async abort(payload: NcpMessageAbortPayload): Promise<void> {
      await server.abort(payload);
    },
  };
}

async function consume(events: AsyncIterable<unknown>): Promise<void> {
  for await (const event of events) {
    // Consume iterator to execute server-side async generator side effects.
    void event;
  }
}
