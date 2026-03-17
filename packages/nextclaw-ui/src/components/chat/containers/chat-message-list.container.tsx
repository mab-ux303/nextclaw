import { useMemo } from 'react';
import { type UiMessage } from '@nextclaw/agent-chat';
import { adaptChatMessages } from '@/components/chat/adapters/chat-message.adapter';
import { ChatMessageList } from '@/components/chat/ui/chat-message-list/chat-message-list';
import { formatDateTime, t } from '@/lib/i18n';

type ChatMessageListContainerProps = {
  uiMessages: UiMessage[];
  isSending: boolean;
  className?: string;
};

export function ChatMessageListContainer(props: ChatMessageListContainerProps) {
  const messages = useMemo(
    () =>
      adaptChatMessages({
        uiMessages: props.uiMessages,
        formatTimestamp: formatDateTime,
        texts: {
          roleLabels: {
            user: t('chatRoleUser'),
            assistant: t('chatRoleAssistant'),
            tool: t('chatRoleTool'),
            system: t('chatRoleSystem'),
            fallback: t('chatRoleMessage')
          },
          reasoningLabel: t('chatReasoning'),
          toolCallLabel: t('chatToolCall'),
          toolResultLabel: t('chatToolResult'),
          toolNoOutputLabel: t('chatToolNoOutput'),
          toolOutputLabel: t('chatToolOutput')
        }
      }),
    [props.uiMessages]
  );

  return (
    <ChatMessageList
      messages={messages}
      isSending={props.isSending}
      hasStreamingDraft={props.uiMessages.some((message) => message.meta?.status === 'streaming')}
      className={props.className}
      texts={{
        copyCodeLabel: t('chatCodeCopy'),
        copiedCodeLabel: t('chatCodeCopied'),
        typingLabel: t('chatTyping')
      }}
    />
  );
}
