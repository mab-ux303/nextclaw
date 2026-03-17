import { cn } from '@/lib/utils';

type ChatMessageMetaProps = {
  roleLabel: string;
  timestampLabel: string;
  isUser: boolean;
};

export function ChatMessageMeta(props: ChatMessageMetaProps) {
  return (
    <div className={cn('px-1 text-[11px]', props.isUser ? 'text-primary-300' : 'text-gray-400')}>
      {props.roleLabel} · {props.timestampLabel}
    </div>
  );
}
