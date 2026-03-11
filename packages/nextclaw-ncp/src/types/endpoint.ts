import type { NcpEndpointEvent } from "./events.js";
import type { NcpEndpointManifest } from "./manifest.js";

export type { NcpEndpointEvent, NcpEndpointSubscriber } from "./events.js";

/**
 * Core interface every NCP endpoint adapter must implement.
 *
 * Single primitive: emit(event) to send, subscribe(listener) to receive.
 * Event types and payloads are defined in events.ts (aligned with agent-chat).
 */
export interface NcpEndpoint {
  readonly manifest: NcpEndpointManifest;

  start(): Promise<void>;
  stop(): Promise<void>;

  emit(event: NcpEndpointEvent): void | Promise<void>;

  subscribe(listener: (event: NcpEndpointEvent) => void): () => void;
}
