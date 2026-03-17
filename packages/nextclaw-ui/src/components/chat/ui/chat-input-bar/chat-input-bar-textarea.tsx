import type { KeyboardEventHandler } from 'react';

type ChatInputBarTextareaProps = {
  value: string;
  placeholder: string;
  disabled: boolean;
  onValueChange: (value: string) => void;
  onKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
};

export function ChatInputBarTextarea(props: ChatInputBarTextareaProps) {
  return (
    <textarea
      value={props.value}
      onChange={(event) => props.onValueChange(event.target.value)}
      disabled={props.disabled}
      onKeyDown={props.onKeyDown}
      placeholder={props.placeholder}
      className="w-full min-h-[68px] max-h-[220px] resize-y bg-transparent px-4 py-3 text-sm text-gray-800 outline-none placeholder:text-gray-400"
    />
  );
}
