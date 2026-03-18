import type { SessionManager } from "@nextclaw/core";
import { createAgentClientFromServer, DefaultNcpAgentBackend } from "@nextclaw/ncp-toolkit";
import type { UiNcpAgent } from "@nextclaw/server";
import type { GatewayAgentRuntimePool } from "../agent-runtime-pool.js";
import { NextclawAgentSessionStore } from "./nextclaw-agent-session-store.js";
import { NextclawUiNcpRuntime } from "./nextclaw-ui-ncp-runtime.js";

export async function createUiNcpAgent(params: {
  sessionManager: SessionManager;
  runtimePool: GatewayAgentRuntimePool;
}): Promise<UiNcpAgent> {
  const sessionStore = new NextclawAgentSessionStore(params.sessionManager, {
    writeMode: "runtime-owned",
  });
  const backend = new DefaultNcpAgentBackend({
    endpointId: "nextclaw-ui-agent",
    sessionStore,
    createRuntime: () => new NextclawUiNcpRuntime(params.runtimePool),
  });

  await backend.start();

  return {
    basePath: "/api/ncp/agent",
    agentClientEndpoint: createAgentClientFromServer(backend),
    streamProvider: backend,
    sessionApi: backend
  };
}
