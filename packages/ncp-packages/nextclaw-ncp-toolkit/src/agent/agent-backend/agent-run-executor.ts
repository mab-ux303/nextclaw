import type { NcpEndpointEvent, NcpRequestEnvelope } from "@nextclaw/ncp";
import { NcpEventType } from "@nextclaw/ncp";
import type { LiveSessionState } from "./agent-backend-types.js";

export class AgentRunExecutor {
  constructor(
    private readonly persistSession: (sessionId: string) => Promise<void>,
  ) {}

  async *executeRun(
    session: LiveSessionState,
    envelope: NcpRequestEnvelope,
    controller: AbortController,
  ): AsyncGenerator<NcpEndpointEvent> {
    const messageSent: NcpEndpointEvent = {
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: envelope.sessionId,
        message: structuredClone(envelope.message),
        metadata: envelope.metadata,
      },
    };
    let messageSentPublished = false;

    try {
      for await (const event of session.runtime.run(
        {
          sessionId: envelope.sessionId,
          messages: [envelope.message],
          correlationId: envelope.correlationId,
        },
        { signal: controller.signal },
      )) {
        if (!messageSentPublished) {
          messageSentPublished = true;
          await this.persistSession(envelope.sessionId);
          yield structuredClone(messageSent);
        }

        await this.persistSession(envelope.sessionId);
        yield structuredClone(event);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const runErrorEvent = await this.publishFailure(error, envelope, session);
        yield structuredClone(runErrorEvent);
      }
    } finally {
      await this.persistSession(envelope.sessionId);
    }
  }

  private async publishFailure(
    error: unknown,
    envelope: NcpRequestEnvelope,
    session: LiveSessionState,
  ): Promise<NcpEndpointEvent> {
    const message = error instanceof Error ? error.message : String(error);
    const runErrorEvent: NcpEndpointEvent = {
      type: NcpEventType.RunError,
      payload: {
        sessionId: envelope.sessionId,
        error: message,
      },
    };

    await session.stateManager.dispatch(runErrorEvent);
    await this.persistSession(envelope.sessionId);
    return runErrorEvent;
  }
}
