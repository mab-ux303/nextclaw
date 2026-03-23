declare module "ws" {
  export type RawData = string | ArrayBuffer | Buffer | Buffer[];

  type EventMap = {
    open: () => void;
    message: (data: RawData) => void;
    close: () => void;
    error: (error: Error) => void;
  };

  export class WebSocket {
    static readonly OPEN: number;
    readonly readyState: number;

    constructor(url: string, options?: { headers?: Record<string, string> });

    send(data: string): void;
    close(code?: number, reason?: string): void;

    on<TEvent extends keyof EventMap>(event: TEvent, listener: EventMap[TEvent]): this;
  }

  export class WebSocketServer {
    constructor(options?: { noServer?: boolean });

    handleUpgrade(
      request: unknown,
      socket: unknown,
      head: unknown,
      callback: (socket: WebSocket) => void
    ): void;

    emit(event: "connection", socket: WebSocket, request: unknown): void;
    on(event: "connection", listener: (socket: WebSocket, request: unknown) => void): this;
    close(callback?: () => void): void;
  }

  export default WebSocket;
}
