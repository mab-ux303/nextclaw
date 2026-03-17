import type { ChatMessageRole } from '@/components/chat/view-models/chat-ui.types';
import { Bot, User, Wrench } from 'lucide-react';

export function ChatMessageAvatar({ role }: { role: ChatMessageRole }) {
  if (role === 'user') {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-sm">
        <User className="h-4 w-4" />
      </div>
    );
  }
  if (role === 'assistant') {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm">
        <Bot className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 shadow-sm">
      <Wrench className="h-4 w-4" />
    </div>
  );
}
