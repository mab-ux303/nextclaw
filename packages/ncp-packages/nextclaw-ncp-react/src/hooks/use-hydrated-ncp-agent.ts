import { useCallback, useEffect, useRef, useState } from "react";
import type { NcpAgentClientEndpoint, NcpMessage } from "@nextclaw/ncp";
import { useNcpAgentRuntime, useScopedAgentManager, type UseNcpAgentResult } from "./use-ncp-agent-runtime.js";

export type NcpConversationSeed = {
  messages: readonly NcpMessage[];
  status: "idle" | "running";
};

export type NcpConversationSeedLoader = (
  sessionId: string,
  signal: AbortSignal,
) => Promise<NcpConversationSeed>;

export type UseHydratedNcpAgentOptions = {
  sessionId: string;
  client: NcpAgentClientEndpoint;
  loadSeed: NcpConversationSeedLoader;
  autoResumeRunningSession?: boolean;
};

export type UseHydratedNcpAgentResult = UseNcpAgentResult & {
  isHydrating: boolean;
  hydrateError: Error | null;
  reloadSeed: () => Promise<void>;
};

type LoadState = {
  requestId: number;
  controller: AbortController | null;
};

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function useHydratedNcpAgent({
  sessionId,
  client,
  loadSeed,
  autoResumeRunningSession = true,
}: UseHydratedNcpAgentOptions): UseHydratedNcpAgentResult {
  const manager = useScopedAgentManager(sessionId);
  const runtime = useNcpAgentRuntime({ sessionId, client, manager });
  const [isHydrating, setIsHydrating] = useState(true);
  const [hydrateError, setHydrateError] = useState<Error | null>(null);
  const loadStateRef = useRef<LoadState>({ requestId: 0, controller: null });

  const reloadSeed = useCallback(async () => {
    loadStateRef.current.controller?.abort();

    const controller = new AbortController();
    const requestId = loadStateRef.current.requestId + 1;
    loadStateRef.current = {
      requestId,
      controller,
    };

    await client.stop();
    manager.reset();
    setHydrateError(null);
    setIsHydrating(true);

    try {
      const seed = await loadSeed(sessionId, controller.signal);
      if (controller.signal.aborted || loadStateRef.current.requestId !== requestId) {
        return;
      }

      manager.hydrate({
        sessionId,
        messages: seed.messages,
        activeRun:
          seed.status === "running"
            ? {
                runId: null,
                sessionId,
                abortDisabledReason: null,
              }
            : null,
      });
      setHydrateError(null);
      setIsHydrating(false);

      if (seed.status === "running" && autoResumeRunningSession) {
        void client.stream({ sessionId }).catch((error) => {
          if (loadStateRef.current.requestId !== requestId) {
            return;
          }
          setHydrateError(toError(error));
        });
      }
    } catch (error) {
      if (controller.signal.aborted || loadStateRef.current.requestId !== requestId) {
        return;
      }
      setHydrateError(toError(error));
      setIsHydrating(false);
    } finally {
      if (loadStateRef.current.controller === controller) {
        loadStateRef.current.controller = null;
      }
    }
  }, [autoResumeRunningSession, client, loadSeed, manager, sessionId]);

  useEffect(() => {
    void reloadSeed();

    return () => {
      loadStateRef.current.controller?.abort();
      loadStateRef.current.controller = null;
    };
  }, [reloadSeed]);

  return {
    ...runtime,
    isHydrating,
    hydrateError,
    reloadSeed,
  };
}
