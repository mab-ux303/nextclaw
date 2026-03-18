import type { ChatMessageListProps } from '../../view-models/chat-ui.types';
import { cn } from '../../internal/cn';
import { ChatMessageAvatar } from './chat-message-avatar';
import { ChatMessage } from './chat-message';
import { ChatMessageMeta } from './chat-message-meta';

const INVISIBLE_ONLY_TEXT_PATTERN = /\u200B|\u200C|\u200D|\u2060|\uFEFF/g;

function hasRenderableText(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return trimmed.replace(INVISIBLE_ONLY_TEXT_PATTERN, '').trim().length > 0;
}

function hasRenderableMessageContent(message: ChatMessageListProps['messages'][number]): boolean {
  return message.parts.some((part) => {
    if (part.type === 'markdown' || part.type === 'reasoning') {
      return hasRenderableText(part.text);
    }
    return true;
  });
}

export function ChatMessageList(props: ChatMessageListProps) {
  const visibleMessages = props.messages.filter(hasRenderableMessageContent);
  const hasRenderableAssistantDraft = visibleMessages.some(
    (message) =>
      message.role === 'assistant' &&
      (message.status === 'streaming' || message.status === 'pending')
  );

  return (
    <div className={cn('space-y-5', props.className)}>
      {visibleMessages.map((message) => {
        const isUser = message.role === 'user';
        return (
          <div key={message.id} className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
            {!isUser ? <ChatMessageAvatar role={message.role} /> : null}
            <div className={cn('w-fit max-w-[92%] space-y-2', isUser && 'flex flex-col items-end')}>
              <ChatMessage message={message} texts={props.texts} />
              <ChatMessageMeta roleLabel={message.roleLabel} timestampLabel={message.timestampLabel} isUser={isUser} />
            </div>
            {isUser ? <ChatMessageAvatar role={message.role} /> : null}
          </div>
        );
      })}

      {props.isSending && !hasRenderableAssistantDraft ? (
        <div className="flex justify-start gap-3">
          <ChatMessageAvatar role="assistant" />
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-sm">
            {props.texts.typingLabel}
          </div>
        </div>
      ) : null}
    </div>
  );
}
