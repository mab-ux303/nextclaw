import { decodeRelayBase64 } from "./remote-relay-message.utils";
import type { PendingRelay, RelayResponseFrame } from "./remote-relay.types";

export function finishBufferedRelayResponse(
  pendingMap: Map<string, PendingRelay>,
  frame: Extract<RelayResponseFrame, { type: "response" }>,
  pending: PendingRelay
): void {
  clearTimeout(pending.timeoutId);
  pendingMap.delete(frame.requestId);
  pending.resolveResponse(new Response(decodeRelayBase64(frame.bodyBase64), {
    status: frame.status,
    headers: new Headers(frame.headers)
  }));
}

export function startStreamingRelayResponse(
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

export async function writeStreamingRelayChunk(
  frame: Extract<RelayResponseFrame, { type: "response.chunk" }>,
  pending: PendingRelay
): Promise<void> {
  if (pending.writer) {
    await pending.writer.write(decodeRelayBase64(frame.bodyBase64));
  }
}

export async function finishStreamingRelayResponse(
  pendingMap: Map<string, PendingRelay>,
  requestId: string,
  pending: PendingRelay
): Promise<void> {
  clearTimeout(pending.timeoutId);
  pendingMap.delete(requestId);
  if (pending.writer) {
    await pending.writer.close();
  }
}

export async function failPendingRelayResponse(
  pendingMap: Map<string, PendingRelay>,
  requestId: string,
  pending: PendingRelay,
  message: string
): Promise<void> {
  clearTimeout(pending.timeoutId);
  pendingMap.delete(requestId);
  if (pending.writer) {
    await pending.writer.abort(new Error(message));
    return;
  }
  pending.rejectResponse(new Error(message));
}
