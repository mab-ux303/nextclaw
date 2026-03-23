import { touchRemoteInstance } from "./repositories/remote-repository";
import { decodeRelayMessageData } from "./remote-relay-message.utils";
import {
  failPendingRelayResponse,
  finishBufferedRelayResponse,
  finishStreamingRelayResponse,
  startStreamingRelayResponse,
  writeStreamingRelayChunk
} from "./remote-relay-response.utils";
import type {
  BrowserCommandFrame,
  ClientAttachment,
  ConnectorAttachment,
  ConnectorClientFrame,
  HeaderEntry,
  PendingRelay,
  RelayRequestFrame,
  RelayResponseFrame,
  WebSocketMessageData
} from "./remote-relay.types";
import type { Env } from "./types/platform";

const CONNECTOR_TAG = "connector"; const CLIENT_TAG = "client";

export class NextclawRemoteRelayDurableObject {
  private readonly pending = new Map<string, PendingRelay>();

  constructor(private readonly state: DurableObjectState, private readonly env: Env) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const role = request.headers.get("x-nextclaw-remote-role")?.trim();
      if (role === "browser") {
        return this.handleBrowserUpgrade(request);
      }
      return this.handleConnectorUpgrade(request);
    }
    if (url.pathname === "/proxy" && request.method === "POST") {
      return this.handleProxyRequest(request);
    }
    return new Response("not_found", { status: 404 });
  }

  private async handleConnectorUpgrade(request: Request): Promise<Response> {
    const deviceId = request.headers.get("x-nextclaw-remote-device-id")?.trim();
    if (!deviceId) {
      return new Response("Remote device id missing.", { status: 400 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const connectedAt = new Date().toISOString();
    server.serializeAttachment({
      type: "connector",
      deviceId,
      connectedAt
    } satisfies ConnectorAttachment);
    this.state.acceptWebSocket(server, [CONNECTOR_TAG]);
    for (const existingConnector of this.getConnectorSockets()) {
      if (existingConnector === server) {
        continue;
      }
      existingConnector.close(1012, "Replaced by a newer connector session.");
    }
    await this.setDeviceStatus(deviceId, "online", connectedAt);
    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleBrowserUpgrade(request: Request): Promise<Response> {
    if (!this.getActiveConnector()) {
      return new Response("Remote device connector is offline.", { status: 503 });
    }
    const clientId = request.headers.get("x-nextclaw-remote-client-id")?.trim() || crypto.randomUUID();
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.serializeAttachment({
      type: "client",
      clientId,
      connectedAt: new Date().toISOString()
    } satisfies ClientAttachment);
    this.state.acceptWebSocket(server, [CLIENT_TAG]);
    server.send(JSON.stringify({
      type: "connection.ready",
      connectionId: clientId,
      protocolVersion: 1
    }));
    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleProxyRequest(request: Request): Promise<Response> {
    const connector = this.getActiveConnector();
    if (!connector) {
      return new Response("Remote device connector is offline.", { status: 503 });
    }
    const payload = await request.json<{
      method: string;
      path: string;
      headers: HeaderEntry[];
      bodyBase64?: string;
    }>();
    const requestId = crypto.randomUUID();
    const pending = this.createPendingRelay(requestId);
    this.pending.set(requestId, pending);
    const frame: RelayRequestFrame = {
      type: "request",
      requestId,
      method: payload.method,
      path: payload.path,
      headers: Array.isArray(payload.headers) ? payload.headers : [],
      bodyBase64: payload.bodyBase64
    };
    try {
      connector.send(JSON.stringify(frame));
    } catch (error) {
      clearTimeout(pending.timeoutId);
      this.pending.delete(requestId);
      return new Response(
        error instanceof Error ? error.message : "Failed to forward remote request.",
        { status: 503 }
      );
    }
    return await pending.responsePromise;
  }

  private createPendingRelay(requestId: string): PendingRelay {
    let resolveResponse!: (response: Response) => void;
    let rejectResponse!: (error: Error) => void;
    const responsePromise = new Promise<Response>((resolve, reject) => {
      resolveResponse = resolve;
      rejectResponse = reject;
    });
    const timeoutId = setTimeout(() => {
      const entry = this.pending.get(requestId);
      if (!entry) {
        return;
      }
      entry.rejectResponse(new Error("Remote relay timed out."));
      this.pending.delete(requestId);
    }, 30_000);
    return {
      responsePromise,
      resolveResponse,
      rejectResponse,
      writer: null,
      timeoutId
    };
  }

  webSocketMessage(webSocket: WebSocket, message: WebSocketMessageData): void {
    const attachment = webSocket.deserializeAttachment() as ConnectorAttachment | ClientAttachment | null;
    const raw = decodeRelayMessageData(message);
    if (attachment?.type === "client") {
      this.state.waitUntil(this.handleBrowserMessage(attachment.clientId, raw));
      return;
    }
    this.state.waitUntil(this.handleConnectorMessage(raw));
  }

  webSocketClose(webSocket: WebSocket): void {
    this.state.waitUntil(this.handleConnectorClosed(webSocket));
  }

  webSocketError(webSocket: WebSocket): void {
    this.state.waitUntil(this.handleConnectorClosed(webSocket));
  }

  private async handleConnectorMessage(raw: string): Promise<void> {
    let frame: RelayResponseFrame | ConnectorClientFrame | null = null;
    try {
      frame = JSON.parse(raw) as RelayResponseFrame | ConnectorClientFrame;
    } catch {
      return;
    }
    if (!frame) {
      return;
    }

    if ("clientId" in frame || frame.type === "client.event") {
      this.handleConnectorClientFrame(frame as ConnectorClientFrame);
      return;
    }

    const pending = this.pending.get(frame.requestId);
    if (!pending) {
      return;
    }
    switch (frame.type) {
      case "response":
        finishBufferedRelayResponse(this.pending, frame, pending);
        return;
      case "response.start":
        startStreamingRelayResponse(frame, pending);
        return;
      case "response.chunk":
        await writeStreamingRelayChunk(frame, pending);
        return;
      case "response.end":
        await finishStreamingRelayResponse(this.pending, frame.requestId, pending);
        return;
      case "response.error":
        await failPendingRelayResponse(this.pending, frame.requestId, pending, frame.message);
        return;
      default:
        return;
    }
  }

  private async handleBrowserMessage(clientId: string, raw: string): Promise<void> {
    let frame: BrowserCommandFrame | null = null;
    try {
      frame = JSON.parse(raw) as BrowserCommandFrame;
    } catch {
      return;
    }
    if (!frame) {
      return;
    }

    const connector = this.getActiveConnector();
    if (!connector) {
      if (frame.type === "request") {
        this.sendToClient(clientId, {
          type: "request.error",
          id: frame.id,
          message: "Remote device connector is offline."
        });
        return;
      }
      this.sendToClient(clientId, {
        type: "stream.error",
        streamId: frame.streamId,
        message: "Remote device connector is offline."
      });
      return;
    }

    if (frame.type === "request") {
      connector.send(JSON.stringify({
        type: "client.request",
        clientId,
        id: frame.id,
        target: frame.target
      }));
      return;
    }

    if (frame.type === "stream.open") {
      connector.send(JSON.stringify({
        type: "client.stream.open",
        clientId,
        streamId: frame.streamId,
        target: frame.target
      }));
      return;
    }

    connector.send(JSON.stringify({
      type: "client.stream.cancel",
      clientId,
      streamId: frame.streamId
    }));
  }

  private getConnectorSockets(): WebSocket[] {
    return this.state.getWebSockets(CONNECTOR_TAG).filter((socket) => {
      const attachment = socket.deserializeAttachment() as ConnectorAttachment | null;
      return attachment?.type === "connector";
    });
  }

  private getClientSockets(): WebSocket[] {
    return this.state.getWebSockets(CLIENT_TAG).filter((socket) => {
      const attachment = socket.deserializeAttachment() as ClientAttachment | null;
      return attachment?.type === "client";
    });
  }

  private getActiveConnector(): WebSocket | null {
    for (const socket of this.getConnectorSockets()) {
      if (socket.readyState === WebSocket.OPEN) {
        return socket;
      }
    }
    return null;
  }

  private async handleConnectorClosed(closedSocket: WebSocket): Promise<void> {
    const attachment = closedSocket.deserializeAttachment() as ConnectorAttachment | null;
    if (attachment?.type !== "connector") {
      return;
    }
    const hasOtherOpenConnector = this.getConnectorSockets().some((socket) => {
      return socket !== closedSocket && socket.readyState === WebSocket.OPEN;
    });
    if (hasOtherOpenConnector) {
      return;
    }
    for (const socket of this.getClientSockets()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "connection.error",
          message: "Remote device connector disconnected."
        }));
        socket.close(1012, "Remote device connector disconnected.");
      }
    }
    await this.setDeviceStatus(attachment.deviceId, "offline", new Date().toISOString());
  }

  private handleConnectorClientFrame(frame: ConnectorClientFrame): void {
    if (frame.type === "client.event") {
      this.broadcastToClients({
        type: "event",
        event: frame.event
      });
      return;
    }

    if (frame.type === "client.response") {
      this.sendToClient(frame.clientId, {
        type: "response",
        id: frame.id,
        status: frame.status,
        body: frame.body
      });
      return;
    }

    if (frame.type === "client.request.error") {
      this.sendToClient(frame.clientId, {
        type: "request.error",
        id: frame.id,
        message: frame.message,
        code: frame.code
      });
      return;
    }

    if (frame.type === "client.stream.event") {
      this.sendToClient(frame.clientId, {
        type: "stream.event",
        streamId: frame.streamId,
        event: frame.event,
        payload: frame.payload
      });
      return;
    }

    if (frame.type === "client.stream.end") {
      this.sendToClient(frame.clientId, {
        type: "stream.end",
        streamId: frame.streamId,
        result: frame.result
      });
      return;
    }

    if (frame.type === "client.stream.error") {
      this.sendToClient(frame.clientId, {
        type: "stream.error",
        streamId: frame.streamId,
        message: frame.message,
        code: frame.code
      });
    }
  }

  private sendToClient(clientId: string, frame: Record<string, unknown>): void {
    for (const socket of this.getClientSockets()) {
      const attachment = socket.deserializeAttachment() as ClientAttachment | null;
      if (attachment?.type !== "client" || attachment.clientId !== clientId || socket.readyState !== WebSocket.OPEN) {
        continue;
      }
      socket.send(JSON.stringify(frame));
      return;
    }
  }

  private broadcastToClients(frame: Record<string, unknown>): void {
    for (const socket of this.getClientSockets()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(frame));
      }
    }
  }
  private async setDeviceStatus(
    deviceId: string,
    status: "online" | "offline",
    at: string
  ): Promise<void> {
    await touchRemoteInstance(this.env.NEXTCLAW_PLATFORM_DB, deviceId, {
      status,
      lastSeenAt: at
    });
  }
}
