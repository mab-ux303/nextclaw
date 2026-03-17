import type { ChatInputBarProps } from '@/components/chat/view-models/chat-ui.types';
import { ChatInputBarTextarea } from '@/components/chat/ui/chat-input-bar/chat-input-bar-textarea';
import { ChatInputBarSelectedItems } from '@/components/chat/ui/chat-input-bar/chat-input-bar-selected-items';
import { ChatSlashMenu } from '@/components/chat/ui/chat-input-bar/chat-slash-menu';
import { ChatInputBarToolbar } from '@/components/chat/ui/chat-input-bar/chat-input-bar-toolbar';

function InputBarHint({ hint }: { hint: ChatInputBarProps['hint'] }) {
  if (!hint) {
    return null;
  }

  if (hint.loading) {
    return (
      <div className="px-4 pb-2">
        <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <span className="h-3 w-28 animate-pulse rounded bg-gray-200" />
          <span className="h-3 w-16 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  const toneClassName =
    hint.tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-gray-200 bg-gray-50 text-gray-700';

  return (
    <div className="px-4 pb-2">
      <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs ${toneClassName}`}>
        {hint.text ? <span>{hint.text}</span> : null}
        {hint.actionLabel && hint.onAction ? (
          <button
            type="button"
            onClick={hint.onAction}
            className="font-semibold underline-offset-2 hover:underline"
          >
            {hint.actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ChatInputBar(props: ChatInputBarProps) {
  return (
    <div className="border-t border-gray-200/80 bg-white p-4">
      <div className="mx-auto w-full max-w-[min(1120px,100%)]">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-card">
          <div className="relative">
            <ChatInputBarTextarea
              value={props.value}
              placeholder={props.placeholder}
              disabled={props.disabled}
              onValueChange={props.onValueChange}
              onKeyDown={props.onKeyDown}
            />
            <ChatSlashMenu {...props.slashMenu} />
          </div>

          <InputBarHint hint={props.hint} />
          <ChatInputBarSelectedItems items={props.selectedItems.items} onRemove={props.selectedItems.onRemove} />
          <ChatInputBarToolbar {...props.toolbar} />
        </div>
      </div>
    </div>
  );
}
