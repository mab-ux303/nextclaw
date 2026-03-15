import type { NcpAgentClientEndpoint } from "@nextclaw/ncp";
import { useNcpAgentRuntime, useScopedAgentManager } from "./use-ncp-agent-runtime.js";

export function useNcpAgent(sessionId: string, client: NcpAgentClientEndpoint) {
  const manager = useScopedAgentManager(sessionId);
  return useNcpAgentRuntime({ sessionId, client, manager });
}
