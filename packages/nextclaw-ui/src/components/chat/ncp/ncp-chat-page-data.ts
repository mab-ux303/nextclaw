import { useEffect, useMemo, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SessionEntryView } from '@/api/types';
import type { ChatModelOption } from '@/components/chat/chat-input.types';
import {
  adaptNcpSessionSummaries,
  readNcpSessionPreferredThinking
} from '@/components/chat/ncp/ncp-session-adapter';
import { useChatSessionTypeState } from '@/components/chat/useChatSessionTypeState';
import { useSyncSelectedModel } from '@/components/chat/chat-page-runtime';
import {
  useConfig,
  useConfigMeta,
  useNcpSessions
} from '@/hooks/useConfig';
import { useNcpChatSessionTypes } from '@/hooks/use-ncp-chat-session-types';
import { useMarketplaceInstalled } from '@/hooks/useMarketplace';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';
import { buildProviderModelCatalog, composeProviderModel, resolveModelThinkingCapability } from '@/lib/provider-models';

type UseNcpChatPageDataParams = {
  query: string;
  selectedSessionKey: string | null;
  pendingSessionType: string;
  setPendingSessionType: Dispatch<SetStateAction<string>>;
  setSelectedModel: Dispatch<SetStateAction<string>>;
};

function filterSessionsByQuery(sessions: SessionEntryView[], query: string): SessionEntryView[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return sessions;
  }
  return sessions.filter((session) => session.key.toLowerCase().includes(normalizedQuery));
}

export function useNcpChatPageData(params: UseNcpChatPageDataParams) {
  const configQuery = useConfig();
  const configMetaQuery = useConfigMeta();
  const sessionsQuery = useNcpSessions({ limit: 200 });
  const sessionTypesQuery = useNcpChatSessionTypes();
  const installedSkillsQuery = useMarketplaceInstalled('skill');
  const isProviderStateResolved =
    (configQuery.isFetched || configQuery.isSuccess) &&
    (configMetaQuery.isFetched || configMetaQuery.isSuccess);

  const modelOptions = useMemo<ChatModelOption[]>(() => {
    const providers = buildProviderModelCatalog({
      meta: configMetaQuery.data,
      config: configQuery.data,
      onlyConfigured: true
    });
    const seen = new Set<string>();
    const options: ChatModelOption[] = [];
    for (const provider of providers) {
      for (const localModel of provider.models) {
        const value = composeProviderModel(provider.prefix, localModel);
        if (!value || seen.has(value)) {
          continue;
        }
        seen.add(value);
        options.push({
          value,
          modelLabel: localModel,
          providerLabel: provider.displayName,
          thinkingCapability: resolveModelThinkingCapability(provider.modelThinking, localModel, provider.aliases)
        });
      }
    }
    return options.sort((left, right) => {
      const providerCompare = left.providerLabel.localeCompare(right.providerLabel);
      if (providerCompare !== 0) {
        return providerCompare;
      }
      return left.modelLabel.localeCompare(right.modelLabel);
    });
  }, [configMetaQuery.data, configQuery.data]);
  const selectedModel = useChatInputStore((state) => state.snapshot.selectedModel);
  const lastAutoSelectedSessionTypeRef = useRef<string | null>(null);

  const sessionSummaries = useMemo(
    () => sessionsQuery.data?.sessions ?? [],
    [sessionsQuery.data?.sessions]
  );
  const allSessions = useMemo(
    () => adaptNcpSessionSummaries(sessionSummaries),
    [sessionSummaries]
  );
  const sessions = useMemo(
    () => filterSessionsByQuery(allSessions, params.query),
    [allSessions, params.query]
  );
  const selectedSession = useMemo(
    () => allSessions.find((session) => session.key === params.selectedSessionKey) ?? null,
    [allSessions, params.selectedSessionKey]
  );
  const selectedSessionSummary = useMemo(
    () => sessionSummaries.find((session) => session.sessionId === params.selectedSessionKey) ?? null,
    [params.selectedSessionKey, sessionSummaries]
  );
  const skillRecords = useMemo(
    () => installedSkillsQuery.data?.records ?? [],
    [installedSkillsQuery.data?.records]
  );
  const selectedSessionThinkingLevel = useMemo(
    () => (selectedSessionSummary ? readNcpSessionPreferredThinking(selectedSessionSummary) : null),
    [selectedSessionSummary]
  );

  const sessionTypeState = useChatSessionTypeState({
    selectedSession,
    selectedSessionKey: params.selectedSessionKey,
    pendingSessionType: params.pendingSessionType,
    setPendingSessionType: params.setPendingSessionType,
    sessionTypesData: sessionTypesQuery.data
  });

  useSyncSelectedModel({
    modelOptions,
    selectedSessionPreferredModel: selectedSession?.preferredModel,
    defaultModel: configQuery.data?.agents.defaults.model,
    setSelectedModel: params.setSelectedModel
  });

  const codexDefaultModel = useMemo(
    () => modelOptions.find((option) => option.value.startsWith('openai/'))?.value ?? modelOptions[0]?.value ?? '',
    [modelOptions]
  );

  useEffect(() => {
    const currentSessionType = sessionTypeState.selectedSessionType;
    const previousSessionType = lastAutoSelectedSessionTypeRef.current;
    lastAutoSelectedSessionTypeRef.current = currentSessionType;

    if (currentSessionType !== 'codex') {
      return;
    }
    if (previousSessionType === 'codex') {
      return;
    }
    if (selectedSession?.preferredModel?.trim()) {
      return;
    }
    if (!codexDefaultModel || codexDefaultModel === selectedModel) {
      return;
    }
    params.setSelectedModel(codexDefaultModel);
  }, [
    codexDefaultModel,
    params.setSelectedModel,
    selectedModel,
    selectedSession?.preferredModel,
    sessionTypeState.selectedSessionType
  ]);

  return {
    configQuery,
    configMetaQuery,
    sessionsQuery,
    sessionTypesQuery,
    installedSkillsQuery,
    isProviderStateResolved,
    modelOptions,
    sessionSummaries,
    sessions,
    skillRecords,
    selectedSession,
    selectedSessionThinkingLevel,
    ...sessionTypeState
  };
}
