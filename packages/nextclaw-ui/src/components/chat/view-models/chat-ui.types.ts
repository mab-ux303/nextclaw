import type { KeyboardEventHandler, MutableRefObject, ReactNode } from 'react';

export type ChatTexts = {
  slashLoadingLabel: string;
  slashSectionLabel: string;
  slashEmptyLabel: string;
  slashHintLabel: string;
  slashSkillHintLabel: string;
  sendButtonLabel: string;
  stopButtonLabel: string;
};

export type ChatSlashItem = {
  key: string;
  title: string;
  subtitle: string;
  description: string;
  detailLines: string[];
  value?: string;
};

export type ChatSelectedItem = {
  key: string;
  label: string;
};

export type ChatToolbarIcon = 'sparkles' | 'brain';

export type ChatToolbarSelectOption = {
  value: string;
  label: string;
  description?: string;
};

export type ChatToolbarSelect = {
  key: string;
  value?: string;
  placeholder: string;
  selectedLabel?: string;
  icon?: ChatToolbarIcon;
  options: ChatToolbarSelectOption[];
  disabled?: boolean;
  loading?: boolean;
  emptyLabel?: string;
  minWidthClassName?: string;
  contentWidthClassName?: string;
  onValueChange: (value: string) => void;
};

export type ChatInputBarActionsProps = {
  sendError?: string | null;
  isSending: boolean;
  canStopGeneration: boolean;
  sendDisabled: boolean;
  stopDisabled: boolean;
  stopHint: string;
  sendButtonLabel: string;
  stopButtonLabel: string;
  onSend: () => Promise<void> | void;
  onStop: () => Promise<void> | void;
};

export type ChatInputBarToolbarProps = {
  startContent?: ReactNode[];
  selects: ChatToolbarSelect[];
  endContent?: ReactNode[];
  actions: ChatInputBarActionsProps;
};

export type ChatInlineHint = {
  tone: 'neutral' | 'warning';
  loading?: boolean;
  text?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export type ChatSlashMenuProps = {
  anchorRef: MutableRefObject<HTMLDivElement | null>;
  listRef: MutableRefObject<HTMLDivElement | null>;
  isOpen: boolean;
  isLoading: boolean;
  width?: number;
  items: ChatSlashItem[];
  activeIndex: number;
  activeItem: ChatSlashItem | null;
  texts: Pick<
    ChatTexts,
    'slashLoadingLabel' | 'slashSectionLabel' | 'slashEmptyLabel' | 'slashHintLabel' | 'slashSkillHintLabel'
  >;
  onSelectItem: (item: ChatSlashItem) => void;
  onOpenChange: (open: boolean) => void;
  onSetActiveIndex: (index: number) => void;
};

export type ChatInputBarProps = {
  value: string;
  placeholder: string;
  disabled: boolean;
  onValueChange: (value: string) => void;
  onKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
  slashMenu: ChatSlashMenuProps;
  hint?: ChatInlineHint | null;
  selectedItems: {
    items: ChatSelectedItem[];
    onRemove: (key: string) => void;
  };
  toolbar: ChatInputBarToolbarProps;
};

export type ChatMessageRole = 'user' | 'assistant' | 'tool' | 'system' | 'message';

export type ChatToolPartViewModel = {
  kind: 'call' | 'result';
  toolName: string;
  summary?: string;
  output?: string;
  hasResult: boolean;
  titleLabel: string;
  outputLabel: string;
  emptyLabel: string;
};

export type ChatMessagePartViewModel =
  | {
      type: 'markdown';
      text: string;
    }
  | {
      type: 'reasoning';
      text: string;
      label: string;
    }
  | {
      type: 'tool-card';
      card: ChatToolPartViewModel;
    };

export type ChatMessageViewModel = {
  id: string;
  role: ChatMessageRole;
  roleLabel: string;
  timestampLabel: string;
  parts: ChatMessagePartViewModel[];
  status?: string;
};

export type ChatMessageTexts = {
  copyCodeLabel: string;
  copiedCodeLabel: string;
  typingLabel: string;
};

export type ChatMessageListProps = {
  messages: ChatMessageViewModel[];
  isSending: boolean;
  hasStreamingDraft: boolean;
  texts: ChatMessageTexts;
  className?: string;
};
