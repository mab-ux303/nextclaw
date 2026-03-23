import { useEffect } from 'react';
import { appClient } from '@/transport';
import { useUiStore } from '@/stores/ui.store';
import type { QueryClient } from '@tanstack/react-query';

type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';
type SetConnectionStatus = (status: ConnectionStatus) => void;

function shouldInvalidateConfigQuery(configPath: string) {
  const normalized = configPath.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  if (normalized.startsWith('plugins') || normalized.startsWith('skills')) {
    return false;
  }
  return true;
}

function invalidateMarketplaceQueries(queryClient: QueryClient | undefined, configPath: string): void {
  if (configPath.startsWith('plugins')) {
    queryClient?.invalidateQueries({ queryKey: ['ncp-session-types'] });
    queryClient?.invalidateQueries({ queryKey: ['marketplace-installed', 'plugin'] });
    queryClient?.invalidateQueries({ queryKey: ['marketplace-items'] });
  }
  if (configPath.startsWith('mcp')) {
    queryClient?.invalidateQueries({ queryKey: ['marketplace-mcp-installed'] });
    queryClient?.invalidateQueries({ queryKey: ['marketplace-mcp-items'] });
    queryClient?.invalidateQueries({ queryKey: ['marketplace-mcp-doctor'] });
  }
}

function invalidateSessionQueries(queryClient: QueryClient | undefined, sessionKey?: string): void {
  if (!queryClient) {
    return;
  }
  queryClient.invalidateQueries({ queryKey: ['sessions'] });
  queryClient.invalidateQueries({ queryKey: ['ncp-sessions'] });
  if (sessionKey && sessionKey.trim().length > 0) {
    queryClient.invalidateQueries({ queryKey: ['session-history', sessionKey.trim()] });
    queryClient.invalidateQueries({ queryKey: ['ncp-session-messages', sessionKey.trim()] });
    return;
  }
  queryClient.invalidateQueries({ queryKey: ['session-history'] });
  queryClient.invalidateQueries({ queryKey: ['ncp-session-messages'] });
}

function handleConfigUpdatedEvent(queryClient: QueryClient | undefined, path: string): void {
  if (queryClient && shouldInvalidateConfigQuery(path)) {
    queryClient.invalidateQueries({ queryKey: ['config'] });
  }
  if (path.startsWith('session')) {
    invalidateSessionQueries(queryClient);
  }
  invalidateMarketplaceQueries(queryClient, path);
}

function handleRunUpdatedEvent(queryClient: QueryClient | undefined, payload: { run: { sessionKey?: string; runId?: string } }): void {
  if (!queryClient) {
    return;
  }
  const { sessionKey, runId } = payload.run;
  queryClient.invalidateQueries({ queryKey: ['chat-runs'] });
  if (sessionKey) {
    queryClient.invalidateQueries({ queryKey: ['sessions'] });
    queryClient.invalidateQueries({ queryKey: ['session-history', sessionKey] });
  } else {
    queryClient.invalidateQueries({ queryKey: ['session-history'] });
  }
  if (runId) {
    queryClient.invalidateQueries({ queryKey: ['chat-run', runId] });
  }
}

function handleRealtimeEvent(
  queryClient: QueryClient | undefined,
  setConnectionStatus: SetConnectionStatus,
  event: Parameters<Parameters<typeof appClient.subscribe>[0]>[0]
): void {
  if (event.type === 'connection.open') {
    setConnectionStatus('connected');
    return;
  }
  if (event.type === 'connection.close' || event.type === 'connection.error') {
    setConnectionStatus('disconnected');
    return;
  }
  if (event.type === 'config.updated') {
    const configPath = typeof event.payload?.path === 'string' ? event.payload.path : '';
    handleConfigUpdatedEvent(queryClient, configPath);
    return;
  }
  if (event.type === 'run.updated') {
    handleRunUpdatedEvent(queryClient, event.payload);
    return;
  }
  if (event.type === 'session.updated') {
    invalidateSessionQueries(queryClient, event.payload.sessionKey);
    return;
  }
  if (event.type === 'error') {
    console.error('Realtime transport error:', event.payload.message);
  }
}

export function useRealtimeQueryBridge(queryClient?: QueryClient) {
  const { setConnectionStatus } = useUiStore();

  useEffect(() => {
    setConnectionStatus('connecting');

    return appClient.subscribe((event) => handleRealtimeEvent(queryClient, setConnectionStatus, event));
  }, [queryClient, setConnectionStatus]);
}
