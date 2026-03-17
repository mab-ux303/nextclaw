import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ChatInputBarToolbarProps, ChatToolbarIcon, ChatToolbarSelect } from '@/components/chat/view-models/chat-ui.types';
import { cn } from '@/lib/utils';
import { Brain, Sparkles } from 'lucide-react';
import { ChatInputBarActions } from '@/components/chat/ui/chat-input-bar/chat-input-bar-actions';

function ToolbarIcon({ icon }: { icon?: ChatToolbarIcon }) {
  if (icon === 'sparkles') {
    return <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />;
  }
  if (icon === 'brain') {
    return <Brain className="h-3.5 w-3.5 shrink-0 text-gray-500" />;
  }
  return null;
}

function ToolbarSelect({ item }: { item: ChatToolbarSelect }) {
  return (
    <Select value={item.value} onValueChange={item.onValueChange} disabled={item.disabled}>
      <SelectTrigger
        className={cn(
          'h-8 w-auto rounded-lg border-0 bg-transparent px-3 text-xs font-medium text-gray-600 shadow-none hover:bg-gray-100 focus:ring-0',
          item.minWidthClassName
        )}
      >
        {item.selectedLabel ? (
          <div className="flex min-w-0 items-center gap-2 text-left">
            <ToolbarIcon icon={item.icon} />
            <span className="truncate text-xs font-semibold text-gray-700">{item.selectedLabel}</span>
          </div>
        ) : item.loading ? (
          <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
        ) : (
          <SelectValue placeholder={item.placeholder} />
        )}
      </SelectTrigger>
      <SelectContent className={item.contentWidthClassName}>
        {item.options.length === 0 ? (
          item.loading ? (
            <div className="space-y-2 px-3 py-2">
              <div className="h-3 w-36 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-28 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
            </div>
          ) : item.emptyLabel ? (
            <div className="px-3 py-2 text-xs text-gray-500">{item.emptyLabel}</div>
          ) : null
        ) : null}
        {item.options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="py-2">
            {option.description ? (
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-xs font-semibold text-gray-800">{option.label}</span>
                <span className="truncate text-[11px] text-gray-500">{option.description}</span>
              </div>
            ) : (
              <span className="truncate text-xs font-semibold text-gray-800">{option.label}</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ChatInputBarToolbar(props: ChatInputBarToolbarProps) {
  return (
    <div className="flex items-center justify-between px-3 pb-3">
      <div className="flex items-center gap-1">
        {props.startContent?.map((slot, index) => (
          <div key={`leading-${index}`}>{slot}</div>
        ))}
        {props.selects.map((item) => (
          <ToolbarSelect key={item.key} item={item} />
        ))}
        {props.endContent?.map((slot, index) => (
          <div key={`trailing-${index}`}>{slot}</div>
        ))}
      </div>
      <ChatInputBarActions {...props.actions} />
    </div>
  );
}
