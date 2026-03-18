import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  ConfigSchema,
  MessageBus,
  SessionManager,
  type LLMStreamEvent,
  type ProviderManager,
} from "@nextclaw/core";
import { NcpEventType, type NcpEndpointEvent, type NcpRequestEnvelope } from "@nextclaw/ncp";
import { loadPluginRegistry, toExtensionRegistry } from "../plugins.js";
import { createUiNcpAgent } from "./create-ui-ncp-agent.js";

const tempDirs: string[] = [];

function createTempWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ncp-native-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("createUiNcpAgent", () => {
  it("uses DefaultNcpAgentRuntime with nextclaw context, skills, tools, and session metadata", async () => {
    const workspace = createTempWorkspace();
    writeFileSync(join(workspace, "AGENTS.md"), "Always answer carefully.\n");
    mkdirSync(join(workspace, "skills", "demo-skill"), { recursive: true });
    writeFileSync(
      join(workspace, "skills", "demo-skill", "SKILL.md"),
      [
        "---",
        "name: demo-skill",
        "description: Demo skill",
        "---",
        "",
        "Use the demo skill instructions.",
      ].join("\n"),
    );

    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace,
          model: "default-model",
          contextTokens: 200000,
          maxToolIterations: 8,
        },
      },
    });
    const providerManager = new RecordingProviderManager();
    const sessionManager = new SessionManager(workspace);
    const ncpAgent = await createUiNcpAgent({
      bus: new MessageBus(),
      providerManager: providerManager as unknown as ProviderManager,
      sessionManager,
      getConfig: () => config,
    });

    const firstRunEvents = await sendAndCollectEvents(
      ncpAgent.agentClientEndpoint,
      createEnvelope({
        sessionId: "session-1",
        text: "please inspect the workspace",
        metadata: {
          requested_skills: ["demo-skill"],
          model: "override-model",
          thinking: "high",
        },
      }),
    );

    expect(firstRunEvents.map((event) => event.type)).toContain(NcpEventType.MessageToolCallStart);
    expect(firstRunEvents.map((event) => event.type)).toContain(NcpEventType.MessageToolCallResult);
    expect(firstRunEvents.at(-1)?.type).toBe(NcpEventType.RunFinished);

    expect(providerManager.calls).toHaveLength(2);
    const firstModelInput = providerManager.calls[0];
    expect(firstModelInput.model).toBe("override-model");
    expect(firstModelInput.thinkingLevel).toBe("high");
    expect(
      firstModelInput.tools?.some((tool) => {
        const fn = tool.function as { name?: string } | undefined;
        return fn?.name === "list_dir";
      }),
    ).toBe(true);
    const combinedPrompt = firstModelInput.messages.map((message) => String(message.content ?? "")).join("\n\n");
    expect(combinedPrompt).toContain("Selected skill names: demo-skill");
    expect(combinedPrompt).toContain("Use the demo skill instructions.");

    const persistedSession = sessionManager.getIfExists("session-1");
    expect(persistedSession?.messages.some((message) => message.role === "tool")).toBe(true);
    expect(
      persistedSession?.messages.some(
        (message) => message.role === "assistant" && String(message.content ?? "").includes("final answer"),
      ),
    ).toBe(true);
    expect(persistedSession?.metadata.preferred_model).toBe("override-model");
    expect(persistedSession?.metadata.preferred_thinking).toBe("high");

    providerManager.calls.length = 0;
    const secondRunEvents = await sendAndCollectEvents(
      ncpAgent.agentClientEndpoint,
      createEnvelope({
        sessionId: "session-1",
        text: "run again with saved settings",
      }),
    );
    expect(secondRunEvents.at(-1)?.type).toBe(NcpEventType.RunFinished);
    expect(providerManager.calls[0]?.model).toBe("override-model");
    expect(providerManager.calls[0]?.thinkingLevel).toBe("high");
    expect(providerManager.calls).toHaveLength(2);
    expect(
      providerManager.calls[1]?.messages.some((message) => (
        message.role === "assistant" &&
        Array.isArray(message.tool_calls) &&
        message.reasoning_content === "need a tool first"
      )),
    ).toBe(true);
  });

  it("lists codex as an available session type when the runtime is enabled", async () => {
    const workspace = createTempWorkspace();
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace,
          model: "openai/gpt-5.3-codex",
          contextTokens: 200000,
          maxToolIterations: 8,
        },
      },
      plugins: {
        load: {
          paths: ["../extensions/nextclaw-ncp-runtime-plugin-codex-sdk"],
        },
        entries: {
          "nextclaw-ncp-runtime-plugin-codex-sdk": {
            enabled: true,
            config: {
              apiKey: "test-codex-api-key",
            },
          },
        },
      },
    });
    const extensionRegistry = toExtensionRegistry(loadPluginRegistry(config, workspace));

    const ncpAgent = await createUiNcpAgent({
      bus: new MessageBus(),
      providerManager: new RecordingProviderManager() as unknown as ProviderManager,
      sessionManager: new SessionManager(workspace),
      getConfig: () => config,
      getExtensionRegistry: () => extensionRegistry,
    });

    const sessionTypes = await ncpAgent.listSessionTypes?.();
    expect(sessionTypes).toEqual({
      defaultType: "native",
      options: [
        { value: "native", label: "Native" },
        { value: "codex", label: "Codex" },
      ],
    });
  });

  it("refreshes available session types when the extension registry changes after startup", async () => {
    const workspace = createTempWorkspace();
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace,
          model: "openai/gpt-5.3-codex",
          contextTokens: 200000,
          maxToolIterations: 8,
        },
      },
      plugins: {
        entries: {},
      },
    });
    let extensionRegistry = toExtensionRegistry(loadPluginRegistry(config, workspace));

    const ncpAgent = await createUiNcpAgent({
      bus: new MessageBus(),
      providerManager: new RecordingProviderManager() as unknown as ProviderManager,
      sessionManager: new SessionManager(workspace),
      getConfig: () => config,
      getExtensionRegistry: () => extensionRegistry,
    });

    expect(await ncpAgent.listSessionTypes?.()).toEqual({
      defaultType: "native",
      options: [{ value: "native", label: "Native" }],
    });

    const enabledConfig = ConfigSchema.parse({
      ...config,
      plugins: {
        load: {
          paths: ["../extensions/nextclaw-ncp-runtime-plugin-codex-sdk"],
        },
        entries: {
          "nextclaw-ncp-runtime-plugin-codex-sdk": {
            enabled: true,
            config: {
              apiKey: "test-codex-api-key",
            },
          },
        },
      },
    });
    extensionRegistry = toExtensionRegistry(loadPluginRegistry(enabledConfig, workspace));

    expect(await ncpAgent.listSessionTypes?.()).toEqual({
      defaultType: "native",
      options: [
        { value: "native", label: "Native" },
        { value: "codex", label: "Codex" },
      ],
    });
  });
});

type RecordedCall = {
  messages: Array<Record<string, unknown>>;
  tools?: Array<Record<string, unknown>>;
  model?: string;
  thinkingLevel?: string | null;
};

class RecordingProviderManager {
  readonly calls: RecordedCall[] = [];

  get() {
    return {
      getDefaultModel: () => "default-model",
    };
  }

  async *chatStream(params: RecordedCall): AsyncGenerator<LLMStreamEvent> {
    this.calls.push({
      messages: structuredClone(params.messages),
      tools: structuredClone(params.tools),
      model: params.model,
      thinkingLevel: params.thinkingLevel ?? null,
    });

    const hasToolResult = params.messages.some((message) => message.role === "tool");
    if (!hasToolResult) {
      yield {
        type: "done",
        response: {
          content: "",
          reasoningContent: "need a tool first",
          toolCalls: [
            {
              id: "call-1",
              name: "list_dir",
              arguments: { path: "." },
            },
          ],
          finishReason: "tool_calls",
          usage: {},
        },
      };
      return;
    }

    yield {
      type: "done",
      response: {
        content: "final answer",
        toolCalls: [],
        finishReason: "stop",
        usage: {},
      },
    };
  }
}

function createEnvelope(params: {
  sessionId: string;
  text: string;
  metadata?: Record<string, unknown>;
}): NcpRequestEnvelope {
  return {
    sessionId: params.sessionId,
    message: {
      id: `${params.sessionId}:user:${Date.now()}`,
      sessionId: params.sessionId,
      role: "user",
      status: "final",
      timestamp: new Date().toISOString(),
      parts: [{ type: "text", text: params.text }],
      ...(params.metadata ? { metadata: params.metadata } : {}),
    },
    ...(params.metadata ? { metadata: params.metadata } : {}),
  };
}

async function sendAndCollectEvents(
  endpoint: {
    send(envelope: NcpRequestEnvelope): Promise<void>;
    subscribe(listener: (event: NcpEndpointEvent) => void): () => void;
  },
  envelope: NcpRequestEnvelope,
): Promise<NcpEndpointEvent[]> {
  const events: NcpEndpointEvent[] = [];
  const unsubscribe = endpoint.subscribe((event) => {
    if (!("payload" in event)) {
      return;
    }
    const payload = event.payload;
    if (payload && "sessionId" in payload && payload.sessionId !== envelope.sessionId) {
      return;
    }
    events.push(event);
  });
  try {
    await endpoint.send(envelope);
    return events;
  } finally {
    unsubscribe();
  }
}
