import type { NcpEndpointEvent, NcpEndpointSubscriber } from "@nextclaw/ncp";

export class EventPublisher {
  private readonly listeners = new Set<NcpEndpointSubscriber>();
  private readonly closeListeners = new Set<() => void>();
  private closed = false;

  subscribe(listener: NcpEndpointSubscriber): () => void {
    if (this.closed) {
      return () => undefined;
    }
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  onClose(listener: () => void): () => void {
    if (this.closed) {
      listener();
      return () => undefined;
    }
    this.closeListeners.add(listener);
    return () => {
      this.closeListeners.delete(listener);
    };
  }

  publish(event: NcpEndpointEvent): void {
    if (this.closed) {
      return;
    }
    for (const listener of this.listeners) {
      listener(structuredClone(event));
    }
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.listeners.clear();
    for (const listener of this.closeListeners) {
      listener();
    }
    this.closeListeners.clear();
  }
}
