import type { ThinkingLevel } from '@/api/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { t } from '@/lib/i18n';
import { Brain } from 'lucide-react';

type ChatInputThinkingSelectorProps = {
  supportedLevels: ThinkingLevel[];
  selectedThinkingLevel: ThinkingLevel | null;
  defaultThinkingLevel?: ThinkingLevel | null;
  onSelectedThinkingLevelChange: (value: ThinkingLevel) => void;
};

function thinkingLabel(level: ThinkingLevel): string {
  if (level === 'off') {
    return t('chatThinkingLevelOff');
  }
  if (level === 'minimal') {
    return t('chatThinkingLevelMinimal');
  }
  if (level === 'low') {
    return t('chatThinkingLevelLow');
  }
  if (level === 'medium') {
    return t('chatThinkingLevelMedium');
  }
  if (level === 'high') {
    return t('chatThinkingLevelHigh');
  }
  if (level === 'adaptive') {
    return t('chatThinkingLevelAdaptive');
  }
  return t('chatThinkingLevelXhigh');
}

function normalizeLevels(levels: ThinkingLevel[]): ThinkingLevel[] {
  const deduped: ThinkingLevel[] = [];
  for (const level of ['off', ...levels] as ThinkingLevel[]) {
    if (!deduped.includes(level)) {
      deduped.push(level);
    }
  }
  return deduped;
}

export function ChatInputThinkingSelector(props: ChatInputThinkingSelectorProps) {
  if (props.supportedLevels.length === 0) {
    return null;
  }

  const options = normalizeLevels(props.supportedLevels);
  const fallback = options.includes('off') ? 'off' : options[0];
  const resolvedValue =
    (props.selectedThinkingLevel && options.includes(props.selectedThinkingLevel) && props.selectedThinkingLevel) ||
    (props.defaultThinkingLevel && options.includes(props.defaultThinkingLevel) && props.defaultThinkingLevel) ||
    fallback;

  return (
    <Select value={resolvedValue} onValueChange={(value) => props.onSelectedThinkingLevelChange(value as ThinkingLevel)}>
      <SelectTrigger className="h-8 w-auto min-w-[150px] rounded-lg border-0 bg-transparent px-3 text-xs font-medium text-gray-600 shadow-none hover:bg-gray-100 focus:ring-0">
        <div className="flex min-w-0 items-center gap-2 text-left">
          <Brain className="h-3.5 w-3.5 shrink-0 text-gray-500" />
          <span className="truncate text-xs font-semibold text-gray-700">{thinkingLabel(resolvedValue)}</span>
        </div>
      </SelectTrigger>
      <SelectContent className="w-[180px]">
        {options.map((level) => (
          <SelectItem key={level} value={level}>
            {thinkingLabel(level)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
