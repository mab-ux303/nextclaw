import { cn } from '@/lib/utils';

type ChatReasoningBlockProps = {
  label: string;
  text: string;
  isUser: boolean;
};

export function ChatReasoningBlock(props: ChatReasoningBlockProps) {
  return (
    <details className="mt-3">
      <summary className={cn('cursor-pointer text-xs', props.isUser ? 'text-primary-100' : 'text-gray-500')}>
        {props.label}
      </summary>
      <pre
        className={cn(
          'mt-2 whitespace-pre-wrap break-words rounded-lg p-2 text-[11px]',
          props.isUser ? 'bg-primary-700/60' : 'bg-gray-100'
        )}
      >
        {props.text}
      </pre>
    </details>
  );
}
