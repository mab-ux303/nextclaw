import { touchRemoteDevice } from "./repositories/remote-repository";
import type { Env } from "./types/platform";

type HeaderEntry = [string, string];

type RelayRequestFrame = {
  type: "request";
  requestId: string;
  method: string;
  path: string;
  headers: HeaderEntry[];
  bodyBase64?: string;
};

type RelayResponseFrame =
  | {
    type: "response";
    requestId: string;
    status: number;
    headers: HeaderEntry[];
    bodyBase64?: string;
  }
  | {
    type: "response.start";
    requestId: string;
    status: number;
    headers: HeaderEntry[];
  }
  | {
    type: "response.chunk";
    requestId: string;
    bodyBase64: string;
  }
  | {
    type: "response.end";
    requestId: string;
  }
  | {
    type: "response.error";
    requestId: string;
    message: string;
  }
  | {
    type: "ping";
    at: string;
  };

type PendingRelay = {
  responsePromise: Promise<Response>;
  resolveResponse: (response: Response) => void;
  rejectResponse: (error: Error) => void;
  writer: WritableStreamDefaultWriter<Uint8Array> | null;
  timeoutId: ReturnType<typeof setTimeout>;
};

function decodeBase64(base64: string | undefined): Uint8Array {
  if (!base64) {
    return new Uint8Array();
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export class NextclawRemoteRelayDurableObject {
  private connector: WebSocket | null = null;
  private deviceId: string | null = null;
  private readonly pending = new Map<string, PendingRelay>();

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
      return this.handleConnectorUpgrade(request);
    }
    if (url.pathname === "/proxy" && request.method === "POST") {
      return this.handleProxyRequest(request);
    }
    return new Response("not_found", { status: 404 });
  }

  private async handleConnectorUpgrade(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    this.deviceId = request.headers.get("x-nextclaw-remote-device-id")?.trim() ?? this.deviceId;
    this.connector?.close(1012, "Replaced by a newer connector session.");
    this.connector = server;
    server.addEventListener("message", (event) => {
      void this.handleConnectorMessage(String(event.data ?? ""));
    });
    server.addEventListener("close", () => {
      void this.markOffline();
      this.connector = null;
    });
    server.addEventListener("error", () => {
      void this.markOffline();
      this.connector = null;
    });
    await this.markOnline();
    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleProxyRequest(request: Request): Promise<Response> {
    if (!this.connector || this.connector.readyState !== WebSocket.OPEN) {
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
    this.connector.send(JSON.stringify(frame));
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

  private async handleConnectorMessage(raw: string): Promise<void> {
    let frame: RelayResponseFrame | null = null;
    try {
      frame = JSON.parse(raw) as RelayResponseFrame;
    } catch {
      return;
    }
    if (!frame) {
      return;
    }
    if (frame.type === "ping") {
      await this.markOnline(frame.at);
      return;
    }

    const pending = this.pending.get(frame.requestId);
    if (!pending) {
      return;
    }
    switch (frame.type) {
      case "response":
        this.finishBufferedResponse(frame, pending);
        return;
      case "response.start":
        this.startStreamingResponse(frame, pending);
        return;
      case "response.chunk":
        await this.writeStreamingChunk(frame, pending);
        return;
      case "response.end":
        await this.finishStreamingResponse(frame.requestId, pending);
        return;
      case "response.error":
        await this.failPendingResponse(frame.requestId, pending, frame.message);
        return;
      default:
        return;
    }
  }

  private finishBufferedResponse(
    frame: Extract<RelayResponseFrame, { type: "response" }>,
    pending: PendingRelay
  ): void {
    clearTimeout(pending.timeoutId);
    this.pending.delete(frame.requestId);
    pending.resolveResponse(new Response(decodeBase64(frame.bodyBase64), {
      status: frame.status,
      headers: new Headers(frame.headers)
    }));
  }

  private startStreamingResponse(
    frame: Extract<RelayResponseFrame, { type: "response.start" }>,
    pending: PendingRelay
  ): void {
    clearTimeout(pending.timeoutId);
    const stream = new TransformStream<Uint8Array, Uint8Array>();
    pending.writer = stream.writable.getWriter();
    pending.resolveResponse(new Response(stream.readable, {
      status: frame.status,
      headers: new Headers(frame.headers)
    }));
  }

  private async writeStreamingChunk(
    frame: Extract<RelayResponseFrame, { type: "response.chunk" }>,
    pending: PendingRelay
  ): Promise<void> {
    if (pending.writer) {
      await pending.writer.write(decodeBase64(frame.bodyBase64));
    }
  }

  private async finishStreamingResponse(requestId: string, pending: PendingRelay): Promise<void> {
    clearTimeout(pending.timeoutId);
    this.pending.delete(requestId);
    if (pending.writer) {
      await pending.writer.close();
    }
  }

  private async failPendingResponse(requestId: string, pending: PendingRelay, message: string): Promise<void> {
    clearTimeout(pending.timeoutId);
    this.pending.delete(requestId);
    if (pending.writer) {
      await pending.writer.abort(new Error(message));
      return;
    }
    pending.rejectResponse(new Error(message));
  }

  private async markOnline(at?: string): Promise<void> {
    if (!this.deviceId) {
      return;
    }
    const nowIso = at && at.trim().length > 0 ? at : new Date().toISOString();
    await touchRemoteDevice(this.env.NEXTCLAW_PLATFORM_DB, this.deviceId, {
      status: "online",
      lastSeenAt: nowIso
    });
  }

  private async markOffline(): Promise<void> {
    if (!this.deviceId) {
      return;
    }
    await touchRemoteDevice(this.env.NEXTCLAW_PLATFORM_DB, this.deviceId, {
      status: "offline",
      lastSeenAt: new Date().toISOString()
    });
  }
}
