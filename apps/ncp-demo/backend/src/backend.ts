import {
  DefaultNcpAgentRuntime,
  DefaultNcpContextBuilder,
  DefaultNcpToolRegistry,
} from "@nextclaw/ncp-agent-runtime";
import { DefaultNcpInMemoryAgentBackend } from "@nextclaw/ncp-toolkit";
import { createClockTool } from "./tools/clock-tool.js";
import { createLlmApi, type DemoLlmMode } from "./llm/create-llm-api.js";

export type { DemoLlmMode } from "./llm/create-llm-api.js";

export function createDemoBackend(): { backend: DefaultNcpInMemoryAgentBackend; llmMode: DemoLlmMode } {
  const llm = createLlmApi();
  return {
    backend: new DefaultNcpInMemoryAgentBackend({
      endpointId: "ncp-demo-agent",
      createRuntime: ({ stateManager }) => {
        const toolRegistry = new DefaultNcpToolRegistry([createClockTool()]);
        return new DefaultNcpAgentRuntime({
          contextBuilder: new DefaultNcpContextBuilder(toolRegistry),
          llmApi: llm.api,
          toolRegistry,
          stateManager,
        });
      },
    }),
    llmMode: llm.mode,
  };
}
