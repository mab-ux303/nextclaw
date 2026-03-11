import type {
  NcpEndpoint,
  NcpEndpointEvent,
  NcpEndpointSubscriber,
  NcpRequestEnvelope,
  NcpSendReceipt,
} from "../types/endpoint.js";
import type { NcpEndpointManifest } from "../types/manifest.js";

/**
 * Base class for NCP endpoint adapters.
 *
 * Provides the shared lifecycle (start/stop idempotency) and pub/sub
 * subscription layer so concrete adapters only need to implement
 * the three transport hooks: `onStart`, `onStop`, and `onSend`.
 *
 * @example
 * class MyAgentEndpoint extends AbstractEndpoint {
 *   readonly manifest = { ... };
 *   protected async onStart() { ... }
 *   protected async onStop() { ... }
 *   protected async onSend(envelope) { ... }
 * }
 */
export abstract class AbstractEndpoint implements NcpEndpoint {
  abstract readonly manifest: NcpEndpointManifest;

  private started = false;
  private readonly listeners = new Set<NcpEndpointSubscriber>();

  /** @inheritdoc */
  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    await this.onStart();
    this.started = true;
    this.emit({ type: "endpoint.ready" });
  }

  /** @inheritdoc */
  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }
    await this.onStop();
    this.started = false;
  }

  /** @inheritdoc */
  async send(envelope: NcpRequestEnvelope): Promise<NcpSendReceipt> {
    this.assertStarted();
    return this.onSend(envelope);
  }

  /** @inheritdoc */
  subscribe(listener: NcpEndpointSubscriber): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Broadcasts an event to all current subscribers.
   * Call this from `onSend` or async callbacks to surface inbound events.
   */
  protected emit(event: NcpEndpointEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /**
   * Throws if the endpoint has not been started.
   * Call at the top of any method that requires an active connection.
   */
  protected assertStarted(): void {
    if (!this.started) {
      throw new Error(`NcpEndpoint "${this.manifest.endpointId}" is not started`);
    }
  }

  // ---------------------------------------------------------------------------
  // Abstract hooks — implement in concrete adapters
  // ---------------------------------------------------------------------------

  /** Called once on the first `start()` invocation. Open connections here. */
  protected abstract onStart(): Promise<void>;

  /** Called once on the first `stop()` invocation. Release resources here. */
  protected abstract onStop(): Promise<void>;

  /** Deliver the envelope to the remote participant via the adapter's transport. */
  protected abstract onSend(envelope: NcpRequestEnvelope): Promise<NcpSendReceipt>;
}
