import type { ChatMessageTexts, ChatMessageViewModel } from '@/components/chat/view-models/chat-ui.types';
import { ChatMessageMarkdown } from '@/components/chat/ui/chat-message-list/chat-message-markdown';
import { ChatReasoningBlock } from '@/components/chat/ui/chat-message-list/chat-reasoning-block';
import { ChatToolCard } from '@/components/chat/ui/chat-message-list/chat-tool-card';
import { cn } from '@/lib/utils';

type ChatMessageProps = {
  message: ChatMessageViewModel;
  texts: Pick<ChatMessageTexts, 'copyCodeLabel' | 'copiedCodeLabel'>;
};

export function ChatMessage(props: ChatMessageProps) {
  const { message, texts } = props;
  const { role } = message;
  const isUser = role === 'user';

  return (
    <div
      className={cn(
        'inline-block w-fit max-w-full rounded-2xl border px-4 py-3 shadow-sm',
        isUser
          ? 'border-primary bg-primary text-white'
          : role === 'assistant'
            ? 'border-gray-200 bg-white text-gray-900'
            : 'border-orange-200/80 bg-orange-50/70 text-gray-900'
      )}
    >
      <div className="space-y-2">
        {message.parts.map((part, index) => {
          if (part.type === 'markdown') {
            return <ChatMessageMarkdown key={`markdown-${index}`} text={part.text} role={role} texts={texts} />;
          }
          if (part.type === 'reasoning') {
            return <ChatReasoningBlock key={`reasoning-${index}`} label={part.label} text={part.text} isUser={isUser} />;
          }
          if (part.type === 'tool-card') {
            return (
              <div key={`tool-${index}`} className="mt-0.5">
                <ChatToolCard card={part.card} />
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
