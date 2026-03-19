import { createRequire } from "node:module";
import {
  type NcpAgentRunInput,
  type NcpAgentRunOptions,
  type NcpAgentRuntime,
  type NcpEndpointEvent,
  NcpEventType,
} from "@nextclaw/ncp";
import {
  type ClaudeCodeLoader,
  type ClaudeCodeMessage,
  type ClaudeCodeQueryOptions,
  type ClaudeCodeSdkModule,
  type ClaudeCodeSdkNcpAgentRuntimeConfig,
  type TextStreamState,
} from "./claude-code-sdk-types.js";
import {
  buildQueryEnv,
  createId,
  extractAssistantDelta,
  extractAssistantSnapshot,
  extractFailureMessage,
  readUserText,
  toAbortError,
} from "./claude-code-runtime-utils.js";

const require = createRequire(import.meta.url);
const claudeCodeLoader = require("../claude-code-loader.cjs") as ClaudeCodeLoader;

export type { ClaudeCodeSdkNcpAgentRuntimeConfig } from "./claude-code-sdk-types.js";

export class ClaudeCodeSdkNcpAgentRuntime implements NcpAgentRuntime {
  private sdkModulePromise: Promise<ClaudeCodeSdkModule> | null = null;
  private sessionRuntimeId: string | null;
  private readonly sessionMetadata: Record<string, unknown>;

  constructor(private readonly config: ClaudeCodeSdkNcpAgentRuntimeConfig) {
    this.sessionRuntimeId = config.sessionRuntimeId?.trim() || null;
    this.sessionMetadata = {
      ...(config.sessionMetadata ? structuredClone(config.sessionMetadata) : {}),
    };
  }

  async *run(
    input: NcpAgentRunInput,
    options?: NcpAgentRunOptions,
  ): AsyncGenerator<NcpEndpointEvent> {
    const messageId = createId("claude-message");
    const runId = createId("claude-run");
    const textState: TextStreamState = {
      emittedText: "",
      textStarted: false,
    };
    let finished = false;

    yield* this.emitReadyEvents(input.sessionId, messageId, runId);

    const sdk = await this.getSdkModule();
    const abortBridge = this.createAbortBridge(options);
    const { abortController } = abortBridge;

    const query = sdk.query({
      prompt: await this.buildTurnInput(input),
      options: this.buildQueryOptions(abortController),
    });
    const timeout = this.createRequestTimeout(abortController);

    try {
      for await (const message of query) {
        if (abortController.signal.aborted) {
          throw toAbortError(abortController.signal.reason);
        }
        const shouldStop = yield* this.processMessage({
          sessionId: input.sessionId,
          messageId,
          runId,
          message,
          textState,
        });
        if (shouldStop) {
          finished = true;
          return;
        }
      }

      yield* this.emitTextEnd(input.sessionId, messageId, textState);
      yield* this.emitFinalEvents(input.sessionId, messageId, runId);
      finished = true;
    } catch (error) {
      if (abortController.signal.aborted) {
        throw toAbortError(abortController.signal.reason);
      }
      throw error;
    } finally {
      abortBridge.dispose();
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      query.close?.();

      if (!finished) {
        yield* this.emitTextEnd(input.sessionId, messageId, textState);
      }
    }
  }

  private async getSdkModule(): Promise<ClaudeCodeSdkModule> {
    if (!this.sdkModulePromise) {
      this.sdkModulePromise = claudeCodeLoader.loadClaudeCodeSdkModule();
    }
    return this.sdkModulePromise;
  }

  private buildQueryOptions(abortController: AbortController): ClaudeCodeQueryOptions {
    return {
      ...(this.config.baseQueryOptions ?? {}),
      abortController,
      cwd: this.config.workingDirectory,
      model: this.config.model,
      env: buildQueryEnv(this.config),
      ...(this.sessionRuntimeId ? { resume: this.sessionRuntimeId } : {}),
    };
  }

  private createRequestTimeout(abortController: AbortController): ReturnType<typeof setTimeout> | null {
    const timeoutMs = Math.max(0, Math.trunc(this.config.requestTimeoutMs ?? 30000));
    if (timeoutMs <= 0) {
      return null;
    }

    const timeout = setTimeout(() => {
      abortController.abort("claude request timed out");
    }, timeoutMs);
    timeout.unref?.();
    return timeout;
  }

  private createAbortBridge(options?: NcpAgentRunOptions): {
    abortController: AbortController;
    dispose: () => void;
  } {
    const abortController = new AbortController();
    const onExternalAbort = () => {
      if (!abortController.signal.aborted) {
        abortController.abort(options?.signal?.reason);
      }
    };

    if (options?.signal?.aborted) {
      onExternalAbort();
    } else {
      options?.signal?.addEventListener("abort", onExternalAbort, { once: true });
    }

    return {
      abortController,
      dispose: () => {
        options?.signal?.removeEventListener("abort", onExternalAbort);
      },
    };
  }

  private async buildTurnInput(input: NcpAgentRunInput): Promise<string> {
    if (this.config.inputBuilder) {
      return await this.config.inputBuilder(input);
    }
    return readUserText(input);
  }

  private async *emitEvent(event: NcpEndpointEvent): AsyncGenerator<NcpEndpointEvent> {
    await this.config.stateManager?.dispatch(event);
    yield event;
  }

  private async *processMessage(params: {
    sessionId: string;
    messageId: string;
    runId: string;
    message: ClaudeCodeMessage;
    textState: TextStreamState;
  }): AsyncGenerator<NcpEndpointEvent, boolean> {
    const { sessionId, messageId, runId, message, textState } = params;

    if (typeof message.session_id === "string" && message.session_id.trim()) {
      this.updateSessionRuntimeId(message.session_id);
    }

    const failure = extractFailureMessage(message);
    if (failure) {
      yield* this.emitRunError(sessionId, messageId, runId, failure);
      return true;
    }

    const delta = extractAssistantDelta(message);
    if (delta) {
      yield* this.emitTextDelta(sessionId, messageId, textState, delta);
    }

    const snapshot = extractAssistantSnapshot(message);
    if (snapshot.length > textState.emittedText.length) {
      const nextDelta = snapshot.slice(textState.emittedText.length);
      yield* this.emitTextDelta(sessionId, messageId, textState, nextDelta);
      textState.emittedText = snapshot;
    }

    return false;
  }

  private async *emitReadyEvents(
    sessionId: string,
    messageId: string,
    runId: string,
  ): AsyncGenerator<NcpEndpointEvent> {
    yield* this.emitEvent({
      type: NcpEventType.RunStarted,
      payload: {
        sessionId,
        messageId,
        runId,
      },
    });
    yield* this.emitEvent({
      type: NcpEventType.RunMetadata,
      payload: {
        sessionId,
        messageId,
        runId,
        metadata: {
          kind: "ready",
          runId,
          sessionId,
          supportsAbort: true,
        },
      },
    });
  }

  private async *emitRunError(
    sessionId: string,
    messageId: string,
    runId: string,
    error: string,
  ): AsyncGenerator<NcpEndpointEvent> {
    yield* this.emitEvent({
      type: NcpEventType.RunError,
      payload: {
        sessionId,
        messageId,
        runId,
        error,
      },
    });
  }

  private async *emitTextDelta(
    sessionId: string,
    messageId: string,
    state: TextStreamState,
    delta: string,
  ): AsyncGenerator<NcpEndpointEvent> {
    if (!delta) {
      return;
    }

    if (!state.textStarted) {
      yield* this.emitEvent({
        type: NcpEventType.MessageTextStart,
        payload: {
          sessionId,
          messageId,
        },
      });
      state.textStarted = true;
    }

    state.emittedText += delta;
    yield* this.emitEvent({
      type: NcpEventType.MessageTextDelta,
      payload: {
        sessionId,
        messageId,
        delta,
      },
    });
  }

  private async *emitTextEnd(
    sessionId: string,
    messageId: string,
    state: TextStreamState,
  ): AsyncGenerator<NcpEndpointEvent> {
    if (!state.textStarted) {
      return;
    }

    yield* this.emitEvent({
      type: NcpEventType.MessageTextEnd,
      payload: {
        sessionId,
        messageId,
      },
    });
    state.textStarted = false;
  }

  private async *emitFinalEvents(
    sessionId: string,
    messageId: string,
    runId: string,
  ): AsyncGenerator<NcpEndpointEvent> {
    yield* this.emitEvent({
      type: NcpEventType.RunMetadata,
      payload: {
        sessionId,
        messageId,
        runId,
        metadata: {
          kind: "final",
          sessionId,
        },
      },
    });
    yield* this.emitEvent({
      type: NcpEventType.RunFinished,
      payload: {
        sessionId,
        messageId,
        runId,
      },
    });
  }

  private updateSessionRuntimeId(nextSessionId: string): void {
    const normalizedSessionId = nextSessionId.trim();
    if (!normalizedSessionId || normalizedSessionId === this.sessionRuntimeId) {
      return;
    }

    this.sessionRuntimeId = normalizedSessionId;
    const nextMetadata = {
      ...this.sessionMetadata,
      session_type: "claude",
      claude_session_id: normalizedSessionId,
    };
    this.sessionMetadata.session_type = "claude";
    this.sessionMetadata.claude_session_id = normalizedSessionId;
    this.config.setSessionMetadata?.(nextMetadata);
  }
}
