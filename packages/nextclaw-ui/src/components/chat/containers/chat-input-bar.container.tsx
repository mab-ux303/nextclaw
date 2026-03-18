import { useMemo } from 'react';
import { ChatInputBar } from '@nextclaw/agent-chat-ui';
import {
  buildChatSlashItems,
  buildModelStateHint,
  buildModelToolbarSelect,
  buildSelectedSkillItems,
  buildSkillPickerModel,
  buildThinkingToolbarSelect,
  resolveSlashQuery,
  type ChatModelRecord,
  type ChatSkillRecord,
  type ChatThinkingLevel
} from '@/components/chat/adapters/chat-input-bar.adapter';
import { useChatInputBarController } from '@/components/chat/chat-input/chat-input-bar.controller';
import { usePresenter } from '@/components/chat/presenter/chat-presenter-context';
import { useI18n } from '@/components/providers/I18nProvider';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';
import { t } from '@/lib/i18n';

function buildThinkingLabels(): Record<ChatThinkingLevel, string> {
  return {
    off: t('chatThinkingLevelOff'),
    minimal: t('chatThinkingLevelMinimal'),
    low: t('chatThinkingLevelLow'),
    medium: t('chatThinkingLevelMedium'),
    high: t('chatThinkingLevelHigh'),
    adaptive: t('chatThinkingLevelAdaptive'),
    xhigh: t('chatThinkingLevelXhigh')
  };
}

function toSkillRecords(snapshotRecords: Array<{
  spec: string;
  label?: string;
  description?: string;
  descriptionZh?: string;
  origin?: string;
}>, officialBadgeLabel: string): ChatSkillRecord[] {
  return snapshotRecords.map((record) => ({
    key: record.spec,
    label: record.label || record.spec,
    description: record.description,
    descriptionZh: record.descriptionZh,
    badgeLabel: record.origin === 'builtin' ? officialBadgeLabel : undefined
  }));
}

function toModelRecords(snapshotModels: Array<{
  value: string;
  modelLabel: string;
  providerLabel: string;
  thinkingCapability?: {
    supported: string[];
    default?: string | null;
  } | null;
}>): ChatModelRecord[] {
  return snapshotModels.map((model) => ({
    value: model.value,
    modelLabel: model.modelLabel,
    providerLabel: model.providerLabel,
    thinkingCapability: model.thinkingCapability
      ? {
          supported: model.thinkingCapability.supported as ChatThinkingLevel[],
          default: (model.thinkingCapability.default as ChatThinkingLevel | null | undefined) ?? null
        }
      : null
  }));
}

export function ChatInputBarContainer() {
  const presenter = usePresenter();
  const { language } = useI18n();
  const snapshot = useChatInputStore((state) => state.snapshot);

  const officialSkillBadgeLabel = useMemo(() => {
    // Keep memo reactive to locale switches even though `t` is imported as a stable function.
    const locale = language;
    void locale;
    return t('chatSkillsPickerOfficial');
  }, [language]);
  const slashTexts = useMemo(
    () => {
      // Keep memo reactive to locale switches even though `t` is imported as a stable function.
      const locale = language;
      void locale;
      return {
        slashSkillSubtitle: t('chatSlashTypeSkill'),
        slashSkillSpecLabel: t('chatSlashSkillSpec'),
        noSkillDescription: t('chatSkillsPickerNoDescription')
      };
    },
    [language]
  );

  const skillRecords = useMemo(
    () => toSkillRecords(snapshot.skillRecords, officialSkillBadgeLabel),
    [snapshot.skillRecords, officialSkillBadgeLabel]
  );
  const modelRecords = useMemo(() => toModelRecords(snapshot.modelOptions), [snapshot.modelOptions]);

  const hasModelOptions = modelRecords.length > 0;
  const isModelOptionsLoading = !snapshot.isProviderStateResolved && !hasModelOptions;
  const isModelOptionsEmpty = snapshot.isProviderStateResolved && !hasModelOptions;
  const inputDisabled =
    ((isModelOptionsLoading || isModelOptionsEmpty) && !snapshot.isSending) || snapshot.sessionTypeUnavailable;
  const textareaPlaceholder = isModelOptionsLoading
    ? ''
    : hasModelOptions
      ? t('chatInputPlaceholder')
      : t('chatModelNoOptions');

  const slashQuery = resolveSlashQuery(snapshot.draft);
  const slashItems = useMemo(
    () => buildChatSlashItems(skillRecords, slashQuery ?? '', slashTexts),
    [slashQuery, skillRecords, slashTexts]
  );

  const controller = useChatInputBarController({
    isSlashMode: slashQuery !== null,
    slashItems,
    isSlashLoading: snapshot.isSkillsLoading,
    onSelectSlashItem: (item) => {
      if (!item.value) {
        return;
      }
      if (!snapshot.selectedSkills.includes(item.value)) {
        presenter.chatInputManager.selectSkills([...snapshot.selectedSkills, item.value]);
      }
      presenter.chatInputManager.setDraft('');
    },
    onSend: presenter.chatInputManager.send,
    onStop: presenter.chatInputManager.stop,
    isSending: snapshot.isSending,
    canStopGeneration: snapshot.canStopGeneration
  });

  const selectedModelOption = modelRecords.find((option) => option.value === snapshot.selectedModel);
  const selectedModelThinkingCapability = selectedModelOption?.thinkingCapability;
  const thinkingSupportedLevels = selectedModelThinkingCapability?.supported ?? [];

  const resolvedStopHint =
    snapshot.stopDisabledReason === '__preparing__'
      ? t('chatStopPreparing')
      : snapshot.stopDisabledReason?.trim() || t('chatStopUnavailable');

  const toolbarSelects = [
    buildModelToolbarSelect({
      modelOptions: modelRecords,
      selectedModel: snapshot.selectedModel,
      isModelOptionsLoading,
      hasModelOptions,
      onValueChange: presenter.chatInputManager.selectModel,
      texts: {
        modelSelectPlaceholder: t('chatSelectModel'),
        modelNoOptionsLabel: t('chatModelNoOptions')
      }
    }),
    buildThinkingToolbarSelect({
      supportedLevels: thinkingSupportedLevels,
      selectedThinkingLevel: snapshot.selectedThinkingLevel as ChatThinkingLevel | null,
      defaultThinkingLevel: selectedModelThinkingCapability?.default ?? null,
      onValueChange: (value) => presenter.chatInputManager.selectThinkingLevel(value),
      texts: {
        thinkingLabels: buildThinkingLabels()
      }
    })
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  const skillPicker = buildSkillPickerModel({
    skillRecords,
    selectedSkills: snapshot.selectedSkills,
    isLoading: snapshot.isSkillsLoading,
    onSelectedKeysChange: presenter.chatInputManager.selectSkills,
    texts: {
      title: t('chatSkillsPickerTitle'),
      searchPlaceholder: t('chatSkillsPickerSearchPlaceholder'),
      emptyLabel: t('chatSkillsPickerEmpty'),
      loadingLabel: t('sessionsLoading'),
      manageLabel: t('chatSkillsPickerManage')
    }
  });

  return (
    <ChatInputBar
      value={snapshot.draft}
      placeholder={textareaPlaceholder}
      disabled={inputDisabled}
      onValueChange={presenter.chatInputManager.setDraft}
      onKeyDown={controller.onTextareaKeyDown}
      slashMenu={{
        isOpen: controller.isSlashPanelOpen,
        isLoading: snapshot.isSkillsLoading,
        items: slashItems,
        activeIndex: controller.activeSlashIndex,
        activeItem: controller.activeSlashItem,
        texts: {
          slashLoadingLabel: t('chatSlashLoading'),
          slashSectionLabel: t('chatSlashSectionSkills'),
          slashEmptyLabel: t('chatSlashNoResult'),
          slashHintLabel: t('chatSlashHint'),
          slashSkillHintLabel: t('chatSlashSkillHint')
        },
        onSelectItem: controller.onSelectSlashItem,
        onOpenChange: controller.onSlashPanelOpenChange,
        onSetActiveIndex: controller.onSetActiveSlashIndex
      }}
      hint={buildModelStateHint({
        isModelOptionsLoading,
        isModelOptionsEmpty,
        onGoToProviders: presenter.chatInputManager.goToProviders,
        texts: {
          noModelOptionsLabel: t('chatModelNoOptions'),
          configureProviderLabel: t('chatGoConfigureProvider')
        }
      })}
      selectedItems={{
        items: buildSelectedSkillItems(snapshot.selectedSkills, skillRecords),
        onRemove: (key) => presenter.chatInputManager.selectSkills(snapshot.selectedSkills.filter((skill) => skill !== key))
      }}
      toolbar={{
        selects: toolbarSelects,
        accessories: [
          {
            key: 'attach',
            label: t('chatInputAttachComingSoon'),
            icon: 'paperclip',
            disabled: true,
            tooltip: t('chatInputAttachComingSoon')
          }
        ],
        skillPicker,
        actions: {
          sendError: snapshot.sendError,
          isSending: snapshot.isSending,
          canStopGeneration: snapshot.canStopGeneration,
          sendDisabled: snapshot.draft.trim().length === 0 || !hasModelOptions || snapshot.sessionTypeUnavailable,
          stopDisabled: !snapshot.canStopGeneration,
          stopHint: resolvedStopHint,
          sendButtonLabel: t('chatSend'),
          stopButtonLabel: t('chatStop'),
          onSend: presenter.chatInputManager.send,
          onStop: presenter.chatInputManager.stop
        }
      }}
    />
  );
}
