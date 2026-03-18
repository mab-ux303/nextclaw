import { createRequire } from "node:module";
import type { Codex as CodexClient, CodexOptions, Thread, ThreadOptions } from "@openai/codex-sdk";
import {
  type NcpAgentConversationStateManager,
  type NcpAgentRunInput,
  type NcpAgentRunOptions,
  type NcpAgentRuntime,
  type NcpEndpointEvent,
  NcpEventType,
} from "@nextclaw/ncp";
import {
  type ItemTextSnapshot,
  mapCodexItemEvent,
  type ToolSnapshot,
} from "./codex-sdk-ncp-event-mapper.js";

type CodexCtor = new (options: CodexOptions) => CodexClient;

type CodexLoader = {
  loadCodexConstructor: () => Promise<CodexCtor>;
};

const require = createRequire(import.meta.url);
const codexLoader = require("../codex-sdk-loader.cjs") as CodexLoader;

export type CodexSdkNcpAgentRuntimeConfig = {
  sessionId: string;
  apiKey: string;
  apiBase?: string;
  model?: string;
  threadId?: string | null;
  codexPathOverride?: string;
  env?: Record<string, string>;
  cliConfig?: CodexOptions["config"];
  threadOptions?: ThreadOptions;
  sessionMetadata?: Record<string, unknown>;
  setSessionMetadata?: (nextMetadata: Record<string, unknown>) => void;
  inputBuilder?: (input: NcpAgentRunInput) => Promise<string> | string;
  stateManager?: NcpAgentConversationStateManager;
};

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readUserText(input: NcpAgentRunInput): string {
  for (let index = input.messages.length - 1; index >= 0; index -= 1) {
    const message = input.messages[index];
    if (message?.role !== "user") {
      continue;
    }
    const text = message.parts
      .filter((part): part is Extract<typeof message.parts[number], { type: "text" }> => part.type === "text")
      .map((part) => part.text)
      .join("")
      .trim();
    if (text) {
      return text;
    }
  }
  return "";
}

function toAbortError(reason: unknown): Error {
  if (reason instanceof Error) {
    return reason;
  }
  const message = typeof reason === "string" && reason.trim() ? reason.trim() : "operation aborted";
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function buildCliEnv(config: CodexSdkNcpAgentRuntimeConfig): Record<string, string> | undefined {
  const env: Record<string, string> = {
    ...(config.env ?? {}),
  };

  if (config.apiKey.trim()) {
    env.OPENAI_API_KEY = config.apiKey;
  }
  if (config.apiBase?.trim()) {
    env.OPENAI_BASE_URL = config.apiBase.trim();
  }

  return Object.keys(env).length > 0 ? env : undefined;
}

export class CodexSdkNcpAgentRuntime implements NcpAgentRuntime {
  private codexPromise: Promise<CodexClient> | null = null;
  private thread: Thread | null = null;
  private threadId: string | null;
  private readonly sessionMetadata: Record<string, unknown>;

  constructor(private readonly config: CodexSdkNcpAgentRuntimeConfig) {
    this.threadId = config.threadId?.trim() || null;
    this.sessionMetadata = {
      ...(config.sessionMetadata ? structuredClone(config.sessionMetadata) : {}),
    };
  }

  async *run(
    input: NcpAgentRunInput,
    options?: NcpAgentRunOptions,
  ): AsyncGenerator<NcpEndpointEvent> {
    const messageId = createId("codex-message");
    const runId = createId("codex-run");
    const itemTextById = new Map<string, ItemTextSnapshot>();
    const toolStateById = new Map<string, ToolSnapshot>();
    let finished = false;

    yield* this.emitEvent({
      type: NcpEventType.RunStarted,
      payload: {
        sessionId: input.sessionId,
        messageId,
        runId,
      },
    });
    yield* this.emitEvent({
      type: NcpEventType.RunMetadata,
      payload: {
        sessionId: input.sessionId,
        messageId,
        runId,
        metadata: {
          kind: "ready",
          runId,
          sessionId: input.sessionId,
          supportsAbort: true,
        },
      },
    });

    const thread = await this.resolveThread();
    const turnInput = await this.buildTurnInput(input);
    const streamed = await thread.runStreamed(turnInput, {
      ...(options?.signal ? { signal: options.signal } : {}),
    });

    try {
      for await (const event of streamed.events) {
        if (options?.signal?.aborted) {
          throw toAbortError(options.signal.reason);
        }

        if (event.type === "thread.started") {
          this.updateThreadId(event.thread_id);
          continue;
        }

        if (event.type === "turn.failed") {
          yield* this.emitEvent({
            type: NcpEventType.RunError,
            payload: {
              sessionId: input.sessionId,
              messageId,
              runId,
              error: event.error.message,
            },
          });
          finished = true;
          return;
        }

        if (event.type === "error") {
          yield* this.emitEvent({
            type: NcpEventType.RunError,
            payload: {
              sessionId: input.sessionId,
              messageId,
              runId,
              error: event.message,
            },
          });
          finished = true;
          return;
        }

        if (event.type === "item.started" || event.type === "item.updated" || event.type === "item.completed") {
          for await (const mappedEvent of mapCodexItemEvent({
            sessionId: input.sessionId,
            messageId,
            event,
            itemTextById,
            toolStateById,
          })) {
            yield* this.emitEvent(mappedEvent);
          }
          continue;
        }

        if (event.type === "turn.completed") {
          yield* this.emitEvent({
            type: NcpEventType.RunMetadata,
            payload: {
              sessionId: input.sessionId,
              messageId,
              runId,
              metadata: {
                kind: "final",
                sessionId: input.sessionId,
              },
            },
          });
          yield* this.emitEvent({
            type: NcpEventType.RunFinished,
            payload: {
              sessionId: input.sessionId,
              messageId,
              runId,
            },
          });
          finished = true;
          return;
        }
      }

      if (!finished) {
        yield* this.emitEvent({
          type: NcpEventType.RunMetadata,
          payload: {
            sessionId: input.sessionId,
            messageId,
            runId,
            metadata: {
              kind: "final",
              sessionId: input.sessionId,
            },
          },
        });
        yield* this.emitEvent({
          type: NcpEventType.RunFinished,
          payload: {
            sessionId: input.sessionId,
            messageId,
            runId,
          },
        });
      }
    } catch (error) {
      if (options?.signal?.aborted) {
        throw toAbortError(options.signal.reason);
      }
      throw error;
    }
  }

  private async getCodex(): Promise<CodexClient> {
    if (!this.codexPromise) {
      const env = buildCliEnv(this.config);
      this.codexPromise = codexLoader.loadCodexConstructor().then((Ctor) =>
        new Ctor({
          apiKey: this.config.apiKey,
          baseUrl: this.config.apiBase,
          ...(this.config.codexPathOverride ? { codexPathOverride: this.config.codexPathOverride } : {}),
          ...(env ? { env } : {}),
          ...(this.config.cliConfig ? { config: this.config.cliConfig } : {}),
        }),
      );
    }
    return this.codexPromise;
  }

  private async resolveThread(): Promise<Thread> {
    if (this.thread) {
      return this.thread;
    }

    const codex = await this.getCodex();
    const threadOptions = {
      ...this.config.threadOptions,
      ...(this.config.model ? { model: this.config.model } : {}),
    };

    this.thread = this.threadId
      ? codex.resumeThread(this.threadId, threadOptions)
      : codex.startThread(threadOptions);
    return this.thread;
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

  private updateThreadId(nextThreadId: string): void {
    const normalizedThreadId = nextThreadId.trim();
    if (!normalizedThreadId || normalizedThreadId === this.threadId) {
      return;
    }
    this.threadId = normalizedThreadId;
    const nextMetadata = {
      ...this.sessionMetadata,
      session_type: "codex",
      codex_thread_id: normalizedThreadId,
    };
    this.sessionMetadata.codex_thread_id = normalizedThreadId;
    this.sessionMetadata.session_type = "codex";
    this.config.setSessionMetadata?.(nextMetadata);
  }
}
