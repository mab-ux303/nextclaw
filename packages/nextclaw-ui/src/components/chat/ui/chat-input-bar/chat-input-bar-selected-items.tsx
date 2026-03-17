import type { ChatSelectedItem } from '@/components/chat/view-models/chat-ui.types';
import { X } from 'lucide-react';

type ChatInputBarSelectedItemsProps = {
  items: ChatSelectedItem[];
  onRemove: (key: string) => void;
};

export function ChatInputBarSelectedItems(props: ChatInputBarSelectedItemsProps) {
  if (props.items.length === 0) {
    return null;
  }

  return (
    <div className="px-4 pb-2">
      <div className="flex flex-wrap items-center gap-2">
        {props.items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => props.onRemove(item.key)}
            className="inline-flex max-w-[200px] items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
          >
            <span className="truncate">{item.label}</span>
            <X className="h-3 w-3 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
