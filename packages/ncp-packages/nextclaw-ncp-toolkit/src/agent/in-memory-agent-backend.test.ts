import { describe, expect, it } from "vitest";
import {
  type NcpAgentConversationStateManager,
  type NcpLLMApi,
  type NcpLLMApiInput,
  type NcpLLMApiOptions,
  type NcpRequestEnvelope,
  type OpenAIChatChunk,
  NcpEventType,
} from "@nextclaw/ncp";
import {
  DefaultNcpContextBuilder,
  DefaultNcpAgentRuntime,
  DefaultNcpToolRegistry,
  EchoNcpLLMApi,
} from "@nextclaw/ncp-agent-runtime";
import {
  DefaultNcpAgentBackend,
  InMemoryAgentSessionStore,
} from "./index.js";

const now = "2026-03-15T00:00:00.000Z";

const createEnvelope = (text: string): NcpRequestEnvelope => ({
  sessionId: "session-1",
  correlationId: "corr-1",
  message: {
    id: "user-1",
    sessionId: "session-1",
    role: "user",
    status: "final",
    parts: [{ type: "text", text }],
    timestamp: now,
  },
});

function createBackend(llmApi: NcpLLMApi) {
  return new DefaultNcpAgentBackend({
    sessionStore: new InMemoryAgentSessionStore(),
    createRuntime: ({ stateManager }: { stateManager: NcpAgentConversationStateManager }) => {
      const toolRegistry = new DefaultNcpToolRegistry();
      return new DefaultNcpAgentRuntime({
        contextBuilder: new DefaultNcpContextBuilder(toolRegistry),
        llmApi,
        toolRegistry,
        stateManager,
      });
    },
  });
}

describe("DefaultNcpAgentBackend with in-memory session store", () => {
  it("stores finalized assistant message and exposes session status", async () => {
    const backend = createBackend(new EchoNcpLLMApi());
    const events: string[] = [];
    backend.subscribe((event) => {
      events.push(event.type);
    });

    await backend.emit({
      type: NcpEventType.MessageRequest,
      payload: createEnvelope("hello"),
    });

    expect(events).toContain(NcpEventType.MessageSent);
    expect(events).toContain(NcpEventType.RunFinished);

    const sessions = await backend.listSessions();
    expect(sessions[0]).toMatchObject({
      sessionId: "session-1",
      messageCount: 2,
      status: "idle",
    });

    const messages = await backend.listSessionMessages("session-1");
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({
      role: "assistant",
      status: "final",
      parts: [{ type: "text", text: "hello" }],
    });
  });

  it("streams live session events for an active session", async () => {
    const backend = createBackend(new SlowEchoNcpLLMApi());
    const requestPromise = backend.emit({
      type: NcpEventType.MessageRequest,
      payload: createEnvelope("slow"),
    });

    await waitFor(async () => (await backend.getSession("session-1"))?.status === "running");

    const streamed: string[] = [];
    for await (const event of backend.stream({
      payload: { sessionId: "session-1" },
      signal: new AbortController().signal,
    })) {
      streamed.push(event.type);
    }

    await requestPromise;

    expect(streamed).toContain(NcpEventType.MessageTextDelta);
    expect(streamed.at(-1)).toBe(NcpEventType.RunFinished);
  });

  it("aborts a slow run by session id and clears session status", async () => {
    const backend = createBackend(new SlowEchoNcpLLMApi());
    const requestPromise = backend.emit({
      type: NcpEventType.MessageRequest,
      payload: createEnvelope("slow"),
    });

    await waitFor(async () => (await backend.getSession("session-1"))?.status === "running");
    await backend.abort({ sessionId: "session-1" });
    await requestPromise;

    const session = await backend.getSession("session-1");
    expect(session?.status).toBe("idle");
  });

  it("does not duplicate live events when attaching a session stream", async () => {
    const llmApi = new GatedEchoNcpLLMApi();
    const backend = createBackend(llmApi);
    const textDeltas: string[] = [];

    backend.subscribe((event) => {
      if (event.type === NcpEventType.MessageTextDelta) {
        textDeltas.push(event.payload.delta);
      }
    });

    const requestPromise = backend.emit({
      type: NcpEventType.MessageRequest,
      payload: createEnvelope("slow"),
    });

    await llmApi.started;
    const streamPromise = backend.emit({
      type: NcpEventType.MessageStreamRequest,
      payload: { sessionId: "session-1" },
    });

    llmApi.release();
    await Promise.all([requestPromise, streamPromise]);

    expect(textDeltas).toEqual(["s", "l", "o", "w"]);
  });
});

describe("DefaultNcpAgentBackend", () => {
  it("accepts an injected session store through the generic core", async () => {
    const sessionStore = new RecordingSessionStore();
    const backend = new DefaultNcpAgentBackend({
      createRuntime: ({ stateManager }: { stateManager: NcpAgentConversationStateManager }) => {
        const toolRegistry = new DefaultNcpToolRegistry();
        return new DefaultNcpAgentRuntime({
          contextBuilder: new DefaultNcpContextBuilder(toolRegistry),
          llmApi: new EchoNcpLLMApi(),
          toolRegistry,
          stateManager,
        });
      },
      sessionStore,
    });

    await backend.emit({
      type: NcpEventType.MessageRequest,
      payload: createEnvelope("generic"),
    });

    expect(sessionStore.saveCallCount).toBeGreaterThan(0);
    const messages = await backend.listSessionMessages("session-1");
    expect(messages.at(-1)).toMatchObject({
      role: "assistant",
      parts: [{ type: "text", text: "generic" }],
    });
  });
});

class SlowEchoNcpLLMApi implements NcpLLMApi {
  async *generate(
    input: NcpLLMApiInput,
    options?: NcpLLMApiOptions,
  ): AsyncGenerator<OpenAIChatChunk> {
    const text = getLastUserText(input);
    for (const char of text) {
      if (options?.signal?.aborted) {
        break;
      }
      await sleep(20);
      yield {
        choices: [{ index: 0, delta: { content: char } }],
      };
    }
    yield {
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    };
  }
}

class GatedEchoNcpLLMApi implements NcpLLMApi {
  private readonly startedDeferred = createDeferred<void>();
  private readonly releaseDeferred = createDeferred<void>();

  get started(): Promise<void> {
    return this.startedDeferred.promise;
  }

  release(): void {
    this.releaseDeferred.resolve();
  }

  async *generate(
    input: NcpLLMApiInput,
    options?: NcpLLMApiOptions,
  ): AsyncGenerator<OpenAIChatChunk> {
    const text = getLastUserText(input);
    this.startedDeferred.resolve();
    await this.releaseDeferred.promise;

    for (const char of text) {
      if (options?.signal?.aborted) {
        break;
      }
      yield {
        choices: [{ index: 0, delta: { content: char } }],
      };
    }

    yield {
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    };
  }
}

function getLastUserText(input: NcpLLMApiInput): string {
  for (let index = input.messages.length - 1; index >= 0; index -= 1) {
    const message = input.messages[index];
    if (message?.role === "user" && typeof message.content === "string") {
      return message.content;
    }
  }
  return "";
}

async function waitFor(assertion: () => boolean | Promise<boolean>): Promise<void> {
  for (let index = 0; index < 100; index += 1) {
    if (await assertion()) {
      return;
    }
    await sleep(10);
  }
  throw new Error("Condition not reached in time.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

class RecordingSessionStore extends InMemoryAgentSessionStore {
  saveCallCount = 0;

  override async saveSession(...args: Parameters<InMemoryAgentSessionStore["saveSession"]>) {
    this.saveCallCount += 1;
    await super.saveSession(...args);
  }
}
