export { ChatInputBarContainer } from '@/components/chat/containers/chat-input-bar.container';
export { ChatMessageListContainer } from '@/components/chat/containers/chat-message-list.container';

export { ChatInputBar } from '@/components/chat/ui/chat-input-bar/chat-input-bar';
export { ChatMessageList } from '@/components/chat/ui/chat-message-list/chat-message-list';

export { useActiveItemScroll } from '@/components/chat/hooks/use-active-item-scroll';
export { useCopyFeedback } from '@/components/chat/hooks/use-copy-feedback';
export { useElementWidth } from '@/components/chat/hooks/use-element-width';
export { useStickyBottomScroll } from '@/components/chat/hooks/use-sticky-bottom-scroll';
export { copyText } from '@/components/chat/utils/copy-text';

export {
  adaptChatMessages,
  type ChatMessageAdapterTexts,
  type ChatMessageSource,
  type ChatMessagePartSource
} from '@/components/chat/adapters/chat-message.adapter';

export {
  buildChatSlashItems,
  buildSelectedSkillItems,
  buildSkillPickerModel,
  buildModelStateHint,
  buildModelToolbarSelect,
  buildSessionTypeToolbarSelect,
  buildThinkingToolbarSelect,
  resolveSlashQuery,
  type ChatSkillRecord,
  type ChatModelRecord,
  type ChatThinkingLevel
} from '@/components/chat/adapters/chat-input-bar.adapter';

export type {
  ChatTexts,
  ChatSlashItem,
  ChatSelectedItem,
  ChatToolbarIcon,
  ChatToolbarAccessoryIcon,
  ChatToolbarSelectOption,
  ChatToolbarSelect,
  ChatToolbarAccessory,
  ChatSkillPickerOption,
  ChatSkillPickerProps,
  ChatInputBarActionsProps,
  ChatInputBarToolbarProps,
  ChatInlineHint,
  ChatSlashMenuProps,
  ChatInputBarProps,
  ChatMessageRole,
  ChatToolPartViewModel,
  ChatMessagePartViewModel,
  ChatMessageViewModel,
  ChatMessageTexts,
  ChatMessageListProps
} from '@/components/chat/view-models/chat-ui.types';
