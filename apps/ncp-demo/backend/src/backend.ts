import {
  DefaultNcpAgentRuntime,
  DefaultNcpContextBuilder,
  DefaultNcpToolRegistry,
} from "@nextclaw/ncp-agent-runtime";
import {
  DefaultNcpAgentBackend,
} from "@nextclaw/ncp-toolkit";
import { resolve } from "node:path";
import { createClockTool } from "./tools/clock-tool.js";
import { createSleepTool } from "./tools/sleep-tool.js";
import { createLlmApi } from "./llm/create-llm-api.js";
import { FileAgentSessionStore } from "./stores/file-agent-session-store.js";

export function createDemoBackend(): { backend: DefaultNcpAgentBackend } {
  const llmApi = createLlmApi();
  const storeDir = resolveStoreDir(process.env.NCP_DEMO_STORE_DIR);
  return {
    backend: new DefaultNcpAgentBackend({
      endpointId: "ncp-demo-agent",
      sessionStore: new FileAgentSessionStore({ baseDir: storeDir }),
      createRuntime: ({ stateManager }) => {
        const toolRegistry = new DefaultNcpToolRegistry([
          createClockTool(),
          createSleepTool(),
        ]);
        return new DefaultNcpAgentRuntime({
          contextBuilder: new DefaultNcpContextBuilder(toolRegistry),
          llmApi,
          toolRegistry,
          stateManager,
        });
      },
    }),
  };
}

function resolveStoreDir(value: string | undefined): string {
  const normalized = value?.trim();
  if (normalized) {
    return resolve(normalized);
  }

  return resolve(process.cwd(), ".ncp-demo-store");
}
