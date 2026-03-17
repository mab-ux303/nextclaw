import type { ChatToolPartViewModel } from '@/components/chat/view-models/chat-ui.types';
import { Clock3, FileSearch, Globe, Search, SendHorizontal, Terminal, Wrench } from 'lucide-react';

const TOOL_OUTPUT_PREVIEW_MAX = 220;

function renderToolIcon(toolName: string) {
  const lowered = toolName.toLowerCase();
  if (lowered.includes('exec') || lowered.includes('shell') || lowered.includes('command')) {
    return <Terminal className="h-3.5 w-3.5" />;
  }
  if (lowered.includes('search')) {
    return <Search className="h-3.5 w-3.5" />;
  }
  if (lowered.includes('fetch') || lowered.includes('http') || lowered.includes('web')) {
    return <Globe className="h-3.5 w-3.5" />;
  }
  if (lowered.includes('read') || lowered.includes('file')) {
    return <FileSearch className="h-3.5 w-3.5" />;
  }
  if (lowered.includes('message') || lowered.includes('send')) {
    return <SendHorizontal className="h-3.5 w-3.5" />;
  }
  if (lowered.includes('cron') || lowered.includes('schedule')) {
    return <Clock3 className="h-3.5 w-3.5" />;
  }
  return <Wrench className="h-3.5 w-3.5" />;
}

export function ChatToolCard({ card }: { card: ChatToolPartViewModel }) {
  const output = card.output?.trim() ?? '';
  const showDetails = output.length > TOOL_OUTPUT_PREVIEW_MAX || output.includes('\n');
  const preview = showDetails ? `${output.slice(0, TOOL_OUTPUT_PREVIEW_MAX)}...` : output;
  const showOutputSection = card.kind === 'result' || card.hasResult;

  return (
    <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-amber-800">
        {renderToolIcon(card.toolName)}
        <span>{card.titleLabel}</span>
        <span className="font-mono text-[11px] text-amber-900/80">{card.toolName}</span>
      </div>
      {card.summary ? (
        <div className="mt-1 break-words font-mono text-[11px] text-amber-800/90">{card.summary}</div>
      ) : null}
      {showOutputSection ? (
        <div className="mt-2">
          {!output ? (
            <div className="text-[11px] text-amber-700/80">{card.emptyLabel}</div>
          ) : showDetails ? (
            <details className="group">
              <summary className="cursor-pointer text-[11px] text-amber-700">{card.outputLabel}</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-amber-200 bg-amber-100/40 p-2 text-[11px] text-amber-900">
                {output}
              </pre>
            </details>
          ) : (
            <pre className="rounded-lg border border-amber-200 bg-amber-100/40 p-2 text-[11px] whitespace-pre-wrap break-words text-amber-900">
              {preview}
            </pre>
          )}
        </div>
      ) : null}
    </div>
  );
}
