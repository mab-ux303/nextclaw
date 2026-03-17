import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ChatMessageTexts } from '@/components/chat/view-models/chat-ui.types';
import { Check, Copy } from 'lucide-react';

const CODE_LANGUAGE_REGEX = /language-([a-z0-9-]+)/i;

function flattenNodeText(value: ReactNode): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(flattenNodeText).join('');
  }
  return '';
}

function normalizeCodeText(value: ReactNode): string {
  const content = flattenNodeText(value);
  return content.endsWith('\n') ? content.slice(0, -1) : content;
}

function resolveCodeLanguage(className?: string): string {
  const match = className ? CODE_LANGUAGE_REGEX.exec(className) : null;
  return match?.[1]?.toLowerCase() || 'text';
}

type ChatCodeBlockProps = {
  className?: string;
  children: ReactNode;
  texts: Pick<ChatMessageTexts, 'copyCodeLabel' | 'copiedCodeLabel'>;
};

export function ChatCodeBlock(props: ChatCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const language = useMemo(() => resolveCodeLanguage(props.className), [props.className]);
  const codeText = useMemo(() => normalizeCodeText(props.children), [props.children]);

  const handleCopy = useCallback(async () => {
    if (!codeText || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [codeText]);

  useEffect(() => {
    if (!copied || typeof window === 'undefined') {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 1300);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <div className="chat-codeblock">
      <div className="chat-codeblock-toolbar">
        <span className="chat-codeblock-language">{language}</span>
        <button
          type="button"
          className="chat-codeblock-copy"
          onClick={handleCopy}
          aria-label={copied ? props.texts.copiedCodeLabel : props.texts.copyCodeLabel}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? props.texts.copiedCodeLabel : props.texts.copyCodeLabel}</span>
        </button>
      </div>
      <pre>
        <code className={props.className}>{codeText}</code>
      </pre>
    </div>
  );
}
