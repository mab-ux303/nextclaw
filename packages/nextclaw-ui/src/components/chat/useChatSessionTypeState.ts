import { useEffect, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SessionEntryView } from '@/api/types';
import { t } from '@/lib/i18n';

export const DEFAULT_SESSION_TYPE = 'native';

export type ChatSessionTypeOption = {
  value: string;
  label: string;
};

type UseChatSessionTypeStateParams = {
  selectedSession: SessionEntryView | null;
  selectedSessionKey: string | null;
  pendingSessionType: string;
  setPendingSessionType: Dispatch<SetStateAction<string>>;
  sessionTypesData?: {
    defaultType?: string;
    options?: Array<{ value: string; label: string }>;
  } | null;
};

export function normalizeSessionType(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_SESSION_TYPE;
  }
  const normalized = value.trim().toLowerCase();
  return normalized || DEFAULT_SESSION_TYPE;
}

export function resolveSessionTypeLabel(sessionType: string, fallbackLabel?: string): string {
  if (sessionType === 'native') {
    return t('chatSessionTypeNative');
  }
  if (sessionType === 'codex') {
    return t('chatSessionTypeCodex');
  }
  if (sessionType === 'codex-sdk') {
    return t('chatSessionTypeCodex');
  }
  if (sessionType === 'claude-agent-sdk') {
    return t('chatSessionTypeClaude');
  }
  return fallbackLabel?.trim() || sessionType;
}

function buildSessionTypeOptions(
  options: Array<{ value: string; label: string }>
): ChatSessionTypeOption[] {
  const deduped = new Map<string, ChatSessionTypeOption>();
  for (const option of options) {
    const value = normalizeSessionType(option.value);
    deduped.set(value, {
      value,
      label: option.label?.trim() || resolveSessionTypeLabel(value)
    });
  }
  if (!deduped.has(DEFAULT_SESSION_TYPE)) {
    deduped.set(DEFAULT_SESSION_TYPE, {
      value: DEFAULT_SESSION_TYPE,
      label: resolveSessionTypeLabel(DEFAULT_SESSION_TYPE)
    });
  }
  return Array.from(deduped.values()).sort((left, right) => {
    if (left.value === DEFAULT_SESSION_TYPE) {
      return -1;
    }
    if (right.value === DEFAULT_SESSION_TYPE) {
      return 1;
    }
    return left.value.localeCompare(right.value);
  });
}

export function useChatSessionTypeState(params: UseChatSessionTypeStateParams): {
  sessionTypeOptions: ChatSessionTypeOption[];
  defaultSessionType: string;
  selectedSessionType: string;
  canEditSessionType: boolean;
  sessionTypeUnavailable: boolean;
  sessionTypeUnavailableMessage: string | null;
} {
  const {
    selectedSession,
    selectedSessionKey,
    pendingSessionType,
    setPendingSessionType,
    sessionTypesData
  } = params;

  const runtimeSessionTypeOptions = useMemo(
    () => buildSessionTypeOptions(sessionTypesData?.options ?? []),
    [sessionTypesData?.options]
  );
  const sessionTypeOptions = useMemo(() => {
    const options = [...runtimeSessionTypeOptions];
    const currentSessionType = normalizeSessionType(selectedSession?.sessionType);
    if (!options.some((option) => option.value === currentSessionType)) {
      options.push({
        value: currentSessionType,
        label: resolveSessionTypeLabel(currentSessionType)
      });
    }
    return options.sort((left, right) => {
      if (left.value === DEFAULT_SESSION_TYPE) {
        return -1;
      }
      if (right.value === DEFAULT_SESSION_TYPE) {
        return 1;
      }
      return left.value.localeCompare(right.value);
    });
  }, [runtimeSessionTypeOptions, selectedSession?.sessionType]);
  const defaultSessionType = useMemo(
    () => normalizeSessionType(sessionTypesData?.defaultType ?? DEFAULT_SESSION_TYPE),
    [sessionTypesData?.defaultType]
  );
  const selectedSessionType = useMemo(
    () => normalizeSessionType(selectedSession?.sessionType ?? pendingSessionType ?? defaultSessionType),
    [defaultSessionType, pendingSessionType, selectedSession?.sessionType]
  );

  useEffect(() => {
    if (selectedSessionKey) {
      return;
    }
    setPendingSessionType(defaultSessionType);
  }, [defaultSessionType, selectedSessionKey, setPendingSessionType]);

  const canEditSessionType = !selectedSessionKey || Boolean(selectedSession?.sessionTypeMutable);
  const availableSessionTypeSet = useMemo(
    () => new Set(runtimeSessionTypeOptions.map((option) => option.value)),
    [runtimeSessionTypeOptions]
  );
  const sessionTypeUnavailable = Boolean(
    selectedSession && !availableSessionTypeSet.has(normalizeSessionType(selectedSession.sessionType))
  );
  const sessionTypeUnavailableMessage = sessionTypeUnavailable
    ? `${resolveSessionTypeLabel(selectedSessionType)} ${t('chatSessionTypeUnavailableSuffix')}`
    : null;

  return {
    sessionTypeOptions,
    defaultSessionType,
    selectedSessionType,
    canEditSessionType,
    sessionTypeUnavailable,
    sessionTypeUnavailableMessage
  };
}
