import { useMemo } from 'react';
import { Paperclip } from 'lucide-react';
import type { ThinkingLevel } from '@/api/types';
import {
  buildChatSlashItems,
  buildModelStateHint,
  buildModelToolbarSelect,
  buildSelectedSkillItems,
  buildSessionTypeToolbarSelect,
  buildThinkingToolbarSelect,
  resolveSlashQuery
} from '@/components/chat/adapters/chat-input-bar.adapter';
import { useChatInputBarController } from '@/components/chat/chat-input/chat-input-bar.controller';
import { SkillsPicker } from '@/components/chat/SkillsPicker';
import { usePresenter } from '@/components/chat/presenter/chat-presenter-context';
import type { ChatInputSnapshot } from '@/components/chat/stores/chat-input.store';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';
import { ChatInputBar } from '@/components/chat/ui/chat-input-bar/chat-input-bar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { t } from '@/lib/i18n';

function buildThinkingLabels(): Record<ThinkingLevel, string> {
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

function ChatAttachButtonSlot() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400"
          >
            <Paperclip className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{t('chatInputAttachComingSoon')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ChatSkillsPickerSlot(props: {
  records: ChatInputSnapshot['skillRecords'];
  isLoading: boolean;
  selectedSkills: string[];
  onSelectedSkillsChange: (next: string[]) => void;
}) {
  return (
    <SkillsPicker
      records={props.records}
      isLoading={props.isLoading}
      selectedSkills={props.selectedSkills}
      onSelectedSkillsChange={props.onSelectedSkillsChange}
    />
  );
}

export function ChatInputBarContainer() {
  const presenter = usePresenter();
  const snapshot = useChatInputStore((state) => state.snapshot);

  const hasModelOptions = snapshot.modelOptions.length > 0;
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
    () =>
      buildChatSlashItems(snapshot.skillRecords, slashQuery ?? '', {
        slashSkillSubtitle: t('chatSlashTypeSkill'),
        slashSkillSpecLabel: t('chatSlashSkillSpec'),
        noSkillDescription: t('chatSkillsPickerNoDescription')
      }),
    [slashQuery, snapshot.skillRecords]
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

  const selectedSessionTypeOption =
    snapshot.sessionTypeOptions.find((option) => option.value === snapshot.selectedSessionType) ??
    (snapshot.selectedSessionType
      ? { value: snapshot.selectedSessionType, label: snapshot.selectedSessionType }
      : null);
  const shouldShowSessionTypeSelector =
    snapshot.canEditSessionType &&
    (snapshot.sessionTypeOptions.length > 1 ||
      Boolean(snapshot.selectedSessionType && snapshot.selectedSessionType !== 'native'));

  const selectedModelOption = snapshot.modelOptions.find((option) => option.value === snapshot.selectedModel);
  const selectedModelThinkingCapability = selectedModelOption?.thinkingCapability;
  const thinkingSupportedLevels = selectedModelThinkingCapability?.supported ?? [];

  const resolvedStopHint =
    snapshot.stopDisabledReason === '__preparing__'
      ? t('chatStopPreparing')
      : snapshot.stopDisabledReason?.trim() || t('chatStopUnavailable');

  const toolbarSelects = [
    buildSessionTypeToolbarSelect({
      selectedSessionType: snapshot.selectedSessionType,
      selectedSessionTypeOption,
      sessionTypeOptions: snapshot.sessionTypeOptions,
      onValueChange: presenter.chatInputManager.selectSessionType,
      canEditSessionType: snapshot.canEditSessionType,
      shouldShow: shouldShowSessionTypeSelector,
      texts: {
        sessionTypePlaceholder: t('chatSessionTypeLabel')
      }
    }),
    buildModelToolbarSelect({
      modelOptions: snapshot.modelOptions,
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
      selectedThinkingLevel: snapshot.selectedThinkingLevel,
      defaultThinkingLevel: selectedModelThinkingCapability?.default ?? null,
      onValueChange: presenter.chatInputManager.selectThinkingLevel,
      texts: {
        thinkingLabels: buildThinkingLabels()
      }
    })
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <ChatInputBar
      value={snapshot.draft}
      placeholder={textareaPlaceholder}
      disabled={inputDisabled}
      onValueChange={presenter.chatInputManager.setDraft}
      onKeyDown={controller.onTextareaKeyDown}
      slashMenu={{
        anchorRef: controller.slashAnchorRef,
        listRef: controller.slashListRef,
        isOpen: controller.isSlashPanelOpen,
        isLoading: snapshot.isSkillsLoading,
        width: controller.resolvedSlashPanelWidth,
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
        items: buildSelectedSkillItems(snapshot.selectedSkills, snapshot.skillRecords),
        onRemove: (key) => presenter.chatInputManager.selectSkills(snapshot.selectedSkills.filter((skill) => skill !== key))
      }}
      toolbar={{
        startContent: [
          <ChatSkillsPickerSlot
            key="skills-picker"
            records={snapshot.skillRecords}
            isLoading={snapshot.isSkillsLoading}
            selectedSkills={snapshot.selectedSkills}
            onSelectedSkillsChange={presenter.chatInputManager.selectSkills}
          />
        ],
        selects: toolbarSelects,
        endContent: [<ChatAttachButtonSlot key="attach-button" />],
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
