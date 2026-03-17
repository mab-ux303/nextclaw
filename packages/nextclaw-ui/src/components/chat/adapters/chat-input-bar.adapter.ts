import type { MarketplaceInstalledRecord, ThinkingLevel } from '@/api/types';
import type { ChatModelOption } from '@/components/chat/chat-input.types';
import type {
  ChatInlineHint,
  ChatSelectedItem,
  ChatSlashItem,
  ChatToolbarSelect
} from '@/components/chat/view-models/chat-ui.types';

const SLASH_ITEM_MATCH_SCORE = {
  exactSpec: 1200,
  exactLabel: 1150,
  prefixSpec: 1000,
  prefixLabel: 950,
  prefixToken: 900,
  containsSpec: 800,
  containsLabel: 760,
  containsDescription: 500,
  subsequence: 300,
  fallback: 1
} as const;

export type ChatInputBarAdapterTexts = {
  slashSkillSubtitle: string;
  slashSkillSpecLabel: string;
  noSkillDescription: string;
  modelSelectPlaceholder: string;
  modelNoOptionsLabel: string;
  sessionTypePlaceholder: string;
  thinkingLabels: Record<ThinkingLevel, string>;
  noModelOptionsLabel: string;
  configureProviderLabel: string;
};

export function resolveSlashQuery(draft: string): string | null {
  const match = /^\/([^\s]*)$/.exec(draft);
  if (!match) {
    return null;
  }
  return (match[1] ?? '').trim().toLowerCase();
}

function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function isSubsequenceMatch(query: string, target: string): boolean {
  if (!query || !target) {
    return false;
  }
  let pointer = 0;
  for (const char of target) {
    if (char === query[pointer]) {
      pointer += 1;
      if (pointer >= query.length) {
        return true;
      }
    }
  }
  return false;
}

function scoreSkillRecord(record: MarketplaceInstalledRecord, query: string): number {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return SLASH_ITEM_MATCH_SCORE.fallback;
  }

  const spec = normalizeSearchText(record.spec);
  const label = normalizeSearchText(record.label || record.spec);
  const description = normalizeSearchText(`${record.descriptionZh ?? ''} ${record.description ?? ''}`);
  const labelTokens = label.split(/[\s/_-]+/).filter(Boolean);

  if (spec === normalizedQuery) {
    return SLASH_ITEM_MATCH_SCORE.exactSpec;
  }
  if (label === normalizedQuery) {
    return SLASH_ITEM_MATCH_SCORE.exactLabel;
  }
  if (spec.startsWith(normalizedQuery)) {
    return SLASH_ITEM_MATCH_SCORE.prefixSpec;
  }
  if (label.startsWith(normalizedQuery)) {
    return SLASH_ITEM_MATCH_SCORE.prefixLabel;
  }
  if (labelTokens.some((token) => token.startsWith(normalizedQuery))) {
    return SLASH_ITEM_MATCH_SCORE.prefixToken;
  }
  if (spec.includes(normalizedQuery)) {
    return SLASH_ITEM_MATCH_SCORE.containsSpec;
  }
  if (label.includes(normalizedQuery)) {
    return SLASH_ITEM_MATCH_SCORE.containsLabel;
  }
  if (description.includes(normalizedQuery)) {
    return SLASH_ITEM_MATCH_SCORE.containsDescription;
  }
  if (isSubsequenceMatch(normalizedQuery, label) || isSubsequenceMatch(normalizedQuery, spec)) {
    return SLASH_ITEM_MATCH_SCORE.subsequence;
  }
  return 0;
}

export function buildChatSlashItems(
  skillRecords: MarketplaceInstalledRecord[],
  normalizedSlashQuery: string,
  texts: Pick<ChatInputBarAdapterTexts, 'slashSkillSubtitle' | 'slashSkillSpecLabel' | 'noSkillDescription'>
): ChatSlashItem[] {
  const skillSortCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

  return skillRecords
    .map((record, order) => ({
      record,
      order,
      score: scoreSkillRecord(record, normalizedSlashQuery)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      const leftLabel = (left.record.label || left.record.spec).trim();
      const rightLabel = (right.record.label || right.record.spec).trim();
      const labelCompare = skillSortCollator.compare(leftLabel, rightLabel);
      if (labelCompare !== 0) {
        return labelCompare;
      }
      return left.order - right.order;
    })
    .map(({ record }) => ({
      key: `skill:${record.spec}`,
      title: record.label || record.spec,
      subtitle: texts.slashSkillSubtitle,
      description: (record.descriptionZh ?? record.description ?? '').trim() || texts.noSkillDescription,
      detailLines: [`${texts.slashSkillSpecLabel}: ${record.spec}`],
      value: record.spec
    }));
}

export function buildSelectedSkillItems(
  selectedSkills: string[],
  skillRecords: MarketplaceInstalledRecord[]
): ChatSelectedItem[] {
  return selectedSkills.map((spec) => {
    const matched = skillRecords.find((record) => record.spec === spec);
    return {
      key: spec,
      label: matched?.label || spec
    };
  });
}

export function buildModelStateHint(params: {
  isModelOptionsLoading: boolean;
  isModelOptionsEmpty: boolean;
  onGoToProviders: () => void;
  texts: Pick<ChatInputBarAdapterTexts, 'noModelOptionsLabel' | 'configureProviderLabel'>;
}): ChatInlineHint | null {
  if (!params.isModelOptionsLoading && !params.isModelOptionsEmpty) {
    return null;
  }
  if (params.isModelOptionsLoading) {
    return {
      tone: 'neutral',
      loading: true
    };
  }
  return {
    tone: 'warning',
    text: params.texts.noModelOptionsLabel,
    actionLabel: params.texts.configureProviderLabel,
    onAction: params.onGoToProviders
  };
}

export function buildModelToolbarSelect(params: {
  modelOptions: ChatModelOption[];
  selectedModel: string;
  isModelOptionsLoading: boolean;
  hasModelOptions: boolean;
  onValueChange: (value: string) => void;
  texts: Pick<ChatInputBarAdapterTexts, 'modelSelectPlaceholder' | 'modelNoOptionsLabel'>;
}): ChatToolbarSelect {
  const selectedModelOption = params.modelOptions.find((option) => option.value === params.selectedModel);

  return {
    key: 'model',
    value: params.hasModelOptions ? params.selectedModel : undefined,
    placeholder: params.texts.modelSelectPlaceholder,
    selectedLabel: selectedModelOption
      ? `${selectedModelOption.providerLabel}/${selectedModelOption.modelLabel}`
      : undefined,
    icon: 'sparkles',
    options: params.modelOptions.map((option) => ({
      value: option.value,
      label: option.modelLabel,
      description: option.providerLabel
    })),
    disabled: !params.hasModelOptions,
    loading: params.isModelOptionsLoading,
    emptyLabel: params.texts.modelNoOptionsLabel,
    minWidthClassName: 'min-w-[220px]',
    contentWidthClassName: 'w-[320px]',
    onValueChange: params.onValueChange
  };
}

export function buildSessionTypeToolbarSelect(params: {
  selectedSessionType?: string;
  selectedSessionTypeOption: { value: string; label: string } | null;
  sessionTypeOptions: Array<{ value: string; label: string }>;
  onValueChange: (value: string) => void;
  canEditSessionType: boolean;
  shouldShow: boolean;
  texts: Pick<ChatInputBarAdapterTexts, 'sessionTypePlaceholder'>;
}): ChatToolbarSelect | null {
  if (!params.shouldShow) {
    return null;
  }

  return {
    key: 'session-type',
    value: params.selectedSessionType,
    placeholder: params.texts.sessionTypePlaceholder,
    selectedLabel: params.selectedSessionTypeOption?.label,
    options: params.sessionTypeOptions.map((option) => ({
      value: option.value,
      label: option.label
    })),
    disabled: !params.canEditSessionType,
    minWidthClassName: 'min-w-[140px]',
    contentWidthClassName: 'w-[220px]',
    onValueChange: params.onValueChange
  };
}

function normalizeThinkingLevels(levels: ThinkingLevel[]): ThinkingLevel[] {
  const deduped: ThinkingLevel[] = [];
  for (const level of ['off', ...levels] as ThinkingLevel[]) {
    if (!deduped.includes(level)) {
      deduped.push(level);
    }
  }
  return deduped;
}

export function buildThinkingToolbarSelect(params: {
  supportedLevels: ThinkingLevel[];
  selectedThinkingLevel: ThinkingLevel | null;
  defaultThinkingLevel?: ThinkingLevel | null;
  onValueChange: (value: ThinkingLevel) => void;
  texts: Pick<ChatInputBarAdapterTexts, 'thinkingLabels'>;
}): ChatToolbarSelect | null {
  if (params.supportedLevels.length === 0) {
    return null;
  }

  const options = normalizeThinkingLevels(params.supportedLevels);
  const fallback = options.includes('off') ? 'off' : options[0];
  const resolvedValue =
    (params.selectedThinkingLevel && options.includes(params.selectedThinkingLevel) && params.selectedThinkingLevel) ||
    (params.defaultThinkingLevel && options.includes(params.defaultThinkingLevel) && params.defaultThinkingLevel) ||
    fallback;

  return {
    key: 'thinking',
    value: resolvedValue,
    placeholder: params.texts.thinkingLabels[resolvedValue],
    selectedLabel: params.texts.thinkingLabels[resolvedValue],
    icon: 'brain',
    options: options.map((level) => ({
      value: level,
      label: params.texts.thinkingLabels[level]
    })),
    minWidthClassName: 'min-w-[150px]',
    contentWidthClassName: 'w-[180px]',
    onValueChange: (value) => params.onValueChange(value as ThinkingLevel)
  };
}
