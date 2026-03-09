import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SkillsPicker } from '@/components/chat/SkillsPicker';
import type { MarketplaceInstalledRecord } from '@/api/types';
import type { QueuedChatMessageView } from '@/components/chat/useChatStreamController';
import { t } from '@/lib/i18n';
import { ArrowUp, ChevronDown, ChevronRight, Paperclip, Pencil, Send, Sparkles, Square, Trash2, X } from 'lucide-react';

const SLASH_PANEL_MAX_WIDTH = 920;

export type ChatModelOption = {
  value: string;
  modelLabel: string;
  providerLabel: string;
};

type ChatInputBarProps = {
  isProviderStateResolved: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => Promise<void> | void;
  onStop: () => Promise<void> | void;
  onGoToProviders: () => void;
  canStopGeneration: boolean;
  stopDisabledReason?: string | null;
  sendError?: string | null;
  isSending: boolean;
  queuedCount: number;
  queuedMessages: QueuedChatMessageView[];
  onEditQueuedMessage: (messageId: number, message: string) => void;
  onPromoteQueuedMessage: (messageId: number) => void;
  onRemoveQueuedMessage: (messageId: number) => void;
  modelOptions: ChatModelOption[];
  selectedModel: string;
  onSelectedModelChange: (value: string) => void;
  skillRecords: MarketplaceInstalledRecord[];
  isSkillsLoading?: boolean;
  selectedSkills: string[];
  onSelectedSkillsChange: (next: string[]) => void;
};

type SlashPanelItem = {
  kind: 'skill';
  key: string;
  title: string;
  subtitle: string;
  description: string;
  detailLines: string[];
  skillSpec?: string;
};

type RankedSkill = {
  record: MarketplaceInstalledRecord;
  score: number;
  order: number;
};

function resolveSlashQuery(draft: string): string | null {
  const match = /^\/([^\s]*)$/.exec(draft);
  if (!match) {
    return null;
  }
  return (match[1] ?? '').trim().toLowerCase();
}

function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function previewQueuedMessage(message: string): string {
  const compact = message.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return '-';
  }
  return compact.length > 180 ? `${compact.slice(0, 180)}…` : compact;
}

function isSubsequenceMatch(query: string, target: string): boolean {
  if (!query || !target) {
    return false;
  }
  let pointer = 0;
  for (const char of target) {
    if (char === query[pointer]) {
      pointer += 1;
      if (pointer >= query.length) {
        return true;
      }
    }
  }
  return false;
}

function scoreSkillRecord(record: MarketplaceInstalledRecord, query: string): number {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return 1;
  }

  const spec = normalizeSearchText(record.spec);
  const label = normalizeSearchText(record.label || record.spec);
  const description = normalizeSearchText(`${record.descriptionZh ?? ''} ${record.description ?? ''}`);
  const labelTokens = label.split(/[\s/_-]+/).filter(Boolean);

  if (spec === normalizedQuery) {
    return 1200;
  }
  if (label === normalizedQuery) {
    return 1150;
  }
  if (spec.startsWith(normalizedQuery)) {
    return 1000;
  }
  if (label.startsWith(normalizedQuery)) {
    return 950;
  }
  if (labelTokens.some((token) => token.startsWith(normalizedQuery))) {
    return 900;
  }
  if (spec.includes(normalizedQuery)) {
    return 800;
  }
  if (label.includes(normalizedQuery)) {
    return 760;
  }
  if (description.includes(normalizedQuery)) {
    return 500;
  }
  if (isSubsequenceMatch(normalizedQuery, label) || isSubsequenceMatch(normalizedQuery, spec)) {
    return 300;
  }
  return 0;
}

export function ChatInputBar({
  isProviderStateResolved,
  draft,
  onDraftChange,
  onSend,
  onStop,
  onGoToProviders,
  canStopGeneration,
  stopDisabledReason = null,
  sendError = null,
  isSending,
  queuedCount,
  queuedMessages,
  onEditQueuedMessage,
  onPromoteQueuedMessage,
  onRemoveQueuedMessage,
  modelOptions,
  selectedModel,
  onSelectedModelChange,
  skillRecords,
  isSkillsLoading = false,
  selectedSkills,
  onSelectedSkillsChange
}: ChatInputBarProps) {
  const [activeSlashIndex, setActiveSlashIndex] = useState(0);
  const [dismissedSlashPanel, setDismissedSlashPanel] = useState(false);
  const [slashPanelWidth, setSlashPanelWidth] = useState<number | null>(null);
  const [isQueueExpanded, setIsQueueExpanded] = useState(true);
  const slashAnchorRef = useRef<HTMLDivElement | null>(null);
  const slashListRef = useRef<HTMLDivElement | null>(null);
  const hasModelOptions = modelOptions.length > 0;
  const isModelOptionsLoading = !isProviderStateResolved && !hasModelOptions;
  const isModelOptionsEmpty = isProviderStateResolved && !hasModelOptions;
  const inputDisabled = (isModelOptionsLoading || isModelOptionsEmpty) && !isSending;
  const selectedModelOption = modelOptions.find((option) => option.value === selectedModel);
  const resolvedStopHint =
    stopDisabledReason === '__preparing__'
      ? t('chatStopPreparing')
      : stopDisabledReason?.trim() || t('chatStopUnavailable');
  const selectedSkillRecords = selectedSkills.map((spec) => {
    const matched = skillRecords.find((record) => record.spec === spec);
    return {
      spec,
      label: matched?.label || spec
    };
  });
  const slashQuery = useMemo(() => resolveSlashQuery(draft), [draft]);
  const startsWithSlash = draft.startsWith('/');
  const normalizedSlashQuery = slashQuery ?? '';
  const skillSortCollator = useMemo(
    () => new Intl.Collator(undefined, { sensitivity: 'base', numeric: true }),
    []
  );
  const skillSlashItems = useMemo<SlashPanelItem[]>(() => {
    const rankedRecords: RankedSkill[] = skillRecords
      .map((record, order) => ({
        record,
        score: scoreSkillRecord(record, normalizedSlashQuery),
        order
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        const leftLabel = (left.record.label || left.record.spec).trim();
        const rightLabel = (right.record.label || right.record.spec).trim();
        const labelCompare = skillSortCollator.compare(leftLabel, rightLabel);
        if (labelCompare !== 0) {
          return labelCompare;
        }
        return left.order - right.order;
      });

    return rankedRecords
      .map((entry) => entry.record)
      .map((record) => ({
        kind: 'skill',
        key: `skill:${record.spec}`,
        title: record.label || record.spec,
        subtitle: t('chatSlashTypeSkill'),
        description: (record.descriptionZh ?? record.description ?? '').trim() || t('chatSkillsPickerNoDescription'),
        detailLines: [`${t('chatSlashSkillSpec')}: ${record.spec}`],
        skillSpec: record.spec
      }));
  }, [normalizedSlashQuery, skillRecords, skillSortCollator]);
  const slashItems = useMemo(() => [...skillSlashItems], [skillSlashItems]);
  const isSlashPanelOpen = slashQuery !== null && !dismissedSlashPanel;
  const activeSlashItem = slashItems[activeSlashIndex] ?? null;
  const isSlashPanelLoading = isSkillsLoading;
  const resolvedSlashPanelWidth = slashPanelWidth ? Math.min(slashPanelWidth, SLASH_PANEL_MAX_WIDTH) : undefined;

  useEffect(() => {
    const anchor = slashAnchorRef.current;
    if (!anchor || typeof ResizeObserver === 'undefined') {
      return;
    }
    const update = () => {
      setSlashPanelWidth(anchor.getBoundingClientRect().width);
    };
    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(anchor);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isSlashPanelOpen) {
      setActiveSlashIndex(0);
      return;
    }
    if (slashItems.length === 0) {
      setActiveSlashIndex(0);
      return;
    }
    setActiveSlashIndex((current) => {
      if (current < 0) {
        return 0;
      }
      if (current >= slashItems.length) {
        return slashItems.length - 1;
      }
      return current;
    });
  }, [isSlashPanelOpen, slashItems.length]);

  useEffect(() => {
    if (!startsWithSlash && dismissedSlashPanel) {
      setDismissedSlashPanel(false);
    }
  }, [dismissedSlashPanel, startsWithSlash]);

  useEffect(() => {
    if (queuedMessages.length === 0) {
      setIsQueueExpanded(true);
    }
  }, [queuedMessages.length]);

  useEffect(() => {
    if (!isSlashPanelOpen || isSlashPanelLoading || slashItems.length === 0) {
      return;
    }
    const container = slashListRef.current;
    if (!container) {
      return;
    }
    const active = container.querySelector<HTMLElement>(`[data-slash-index="${activeSlashIndex}"]`);
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeSlashIndex, isSlashPanelLoading, isSlashPanelOpen, slashItems.length]);

  const handleSelectSlashItem = useCallback((item: SlashPanelItem) => {
    if (item.kind === 'skill' && item.skillSpec) {
      if (!selectedSkills.includes(item.skillSpec)) {
        onSelectedSkillsChange([...selectedSkills, item.skillSpec]);
      }
      onDraftChange('');
      setDismissedSlashPanel(false);
    }
  }, [onDraftChange, onSelectedSkillsChange, selectedSkills]);

  const handleSlashPanelOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setDismissedSlashPanel(true);
    }
  }, []);

  return (
    <div className="border-t border-gray-200/80 bg-white p-4">
      <div className="mx-auto w-full max-w-[min(1120px,100%)]">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-card overflow-hidden">
          {queuedMessages.length > 0 && (
            <div className="border-b border-gray-200/80 bg-gray-50/70 px-3 py-2">
              <button
                type="button"
                onClick={() => setIsQueueExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-800"
              >
                {isQueueExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <span>
                  {t('chatQueuedHintPrefix')} {queuedCount} {t('chatQueuedHintSuffix')}
                </span>
              </button>
              {isQueueExpanded && (
                <div className="mt-2 space-y-1.5">
                  {queuedMessages.map((item, index) => (
                    <div
                      key={item.id}
                      className="group flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-2"
                    >
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-300 text-gray-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                        {previewQueuedMessage(item.message)}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => onEditQueuedMessage(item.id, item.message)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title={t('edit')}
                          aria-label={t('edit')}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => onPromoteQueuedMessage(item.id)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:text-gray-200"
                          title={t('chatQueueMoveFirst')}
                          aria-label={t('chatQueueMoveFirst')}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveQueuedMessage(item.id)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-destructive"
                          title={t('delete')}
                          aria-label={t('delete')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="relative">
            {/* Textarea */}
            <textarea
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              disabled={inputDisabled}
              onKeyDown={(e) => {
                if (isSlashPanelOpen && !e.nativeEvent.isComposing && (e.key === ' ' || e.code === 'Space')) {
                  setDismissedSlashPanel(true);
                }
                if (isSlashPanelOpen && slashItems.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActiveSlashIndex((current) => (current + 1) % slashItems.length);
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActiveSlashIndex((current) => (current - 1 + slashItems.length) % slashItems.length);
                    return;
                  }
                  if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
                    e.preventDefault();
                    const selected = slashItems[activeSlashIndex];
                    if (selected) {
                      handleSelectSlashItem(selected);
                    }
                    return;
                  }
                }
                if (e.key === 'Escape') {
                  if (isSlashPanelOpen) {
                    e.preventDefault();
                    setDismissedSlashPanel(true);
                    return;
                  }
                  if (isSending && canStopGeneration) {
                    e.preventDefault();
                    void onStop();
                    return;
                  }
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void onSend();
                }
              }}
              placeholder={
                isModelOptionsLoading
                  ? ''
                  : hasModelOptions
                    ? t('chatInputPlaceholder')
                    : t('chatModelNoOptions')
              }
              className="w-full min-h-[68px] max-h-[220px] resize-y bg-transparent outline-none text-sm px-4 py-3 text-gray-800 placeholder:text-gray-400"
            />
            <Popover open={isSlashPanelOpen} onOpenChange={handleSlashPanelOpenChange}>
              <PopoverAnchor asChild>
                <div ref={slashAnchorRef} className="pointer-events-none absolute left-3 right-3 bottom-full h-0" />
              </PopoverAnchor>
              <PopoverContent
                side="top"
                align="start"
                sideOffset={10}
                className="z-[70] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white/95 p-0 shadow-2xl backdrop-blur-md"
                onOpenAutoFocus={(event) => event.preventDefault()}
                style={resolvedSlashPanelWidth ? { width: `${resolvedSlashPanelWidth}px` } : undefined}
              >
                  <div className="grid min-h-[240px] grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
                    <div ref={slashListRef} className="max-h-[320px] overflow-y-auto border-r border-gray-200 p-3 custom-scrollbar">
                      {isSlashPanelLoading ? (
                        <div className="p-2 text-xs text-gray-500">{t('chatSlashLoading')}</div>
                      ) : (
                        <>
                          <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            {t('chatSlashSectionSkills')}
                          </div>
                          {skillSlashItems.length === 0 ? (
                            <div className="px-2 text-xs text-gray-400">{t('chatSlashNoResult')}</div>
                          ) : (
                            <div className="space-y-1">
                              {skillSlashItems.map((item, index) => {
                                const isActive = index === activeSlashIndex;
                                return (
                                  <button
                                    key={item.key}
                                    type="button"
                                    data-slash-index={index}
                                    onMouseEnter={() => setActiveSlashIndex(index)}
                                    onClick={() => handleSelectSlashItem(item)}
                                    className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                                      isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                                  >
                                    <span className="truncate text-xs font-semibold">{item.title}</span>
                                    <span className="truncate text-xs text-gray-500">{item.subtitle}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div className="p-4">
                      {activeSlashItem ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                              {activeSlashItem.subtitle}
                            </span>
                            <span className="text-sm font-semibold text-gray-900">{activeSlashItem.title}</span>
                          </div>
                          <p className="text-xs leading-5 text-gray-600">{activeSlashItem.description}</p>
                          <div className="space-y-1">
                            {activeSlashItem.detailLines.map((line) => (
                              <div key={line} className="rounded-md bg-gray-50 px-2 py-1 text-[11px] text-gray-600">
                                {line}
                              </div>
                            ))}
                          </div>
                          <div className="pt-1 text-[11px] text-gray-500">
                            {t('chatSlashSkillHint')}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">{t('chatSlashHint')}</div>
                      )}
                    </div>
                  </div>
              </PopoverContent>
            </Popover>
          </div>
          {isModelOptionsLoading && (
            <div className="px-4 pb-2">
              <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="h-3 w-28 animate-pulse rounded bg-gray-200" />
                <span className="h-3 w-16 animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          )}
          {isModelOptionsEmpty && (
            <div className="px-4 pb-2">
              <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                <span>{t('chatModelNoOptions')}</span>
                <button
                  type="button"
                  onClick={onGoToProviders}
                  className="font-semibold text-amber-900 underline-offset-2 hover:underline"
                >
                  {t('chatGoConfigureProvider')}
                </button>
              </div>
            </div>
          )}
          {selectedSkillRecords.length > 0 && (
            <div className="px-4 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                {selectedSkillRecords.map((record) => (
                  <button
                    key={record.spec}
                    type="button"
                    onClick={() => onSelectedSkillsChange(selectedSkills.filter((skill) => skill !== record.spec))}
                    className="inline-flex max-w-[200px] items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                  >
                    <span className="truncate">{record.label}</span>
                    <X className="h-3 w-3 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 pb-3">
            {/* Left group */}
            <div className="flex items-center gap-1">
              {/* Skills picker */}
              <SkillsPicker
                records={skillRecords}
                isLoading={isSkillsLoading}
                selectedSkills={selectedSkills}
                onSelectedSkillsChange={onSelectedSkillsChange}
              />

              {/* Model selector */}
              <Select
                value={hasModelOptions ? selectedModel : undefined}
                onValueChange={onSelectedModelChange}
                disabled={!hasModelOptions}
              >
                <SelectTrigger className="h-8 w-auto min-w-[220px] rounded-lg border-0 bg-transparent shadow-none text-xs font-medium text-gray-600 hover:bg-gray-100 focus:ring-0 px-3">
                  {selectedModelOption ? (
                    <div className="flex min-w-0 items-center gap-2 text-left">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate text-xs font-semibold text-gray-700">
                        {selectedModelOption.providerLabel}/{selectedModelOption.modelLabel}
                      </span>
                    </div>
                  ) : isModelOptionsLoading ? (
                    <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
                  ) : (
                    <SelectValue placeholder={t('chatSelectModel')} />
                  )}
                </SelectTrigger>
                <SelectContent className="w-[320px]">
                  {modelOptions.length === 0 && (
                    isModelOptionsLoading ? (
                      <div className="space-y-2 px-3 py-2">
                        <div className="h-3 w-36 animate-pulse rounded bg-gray-200" />
                        <div className="h-3 w-28 animate-pulse rounded bg-gray-200" />
                        <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
                      </div>
                    ) : (
                      <div className="px-3 py-2 text-xs text-gray-500">{t('chatModelNoOptions')}</div>
                    )
                  )}
                  {modelOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="py-2">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-xs font-semibold text-gray-800">{option.modelLabel}</span>
                        <span className="truncate text-[11px] text-gray-500">{option.providerLabel}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Attachment button (placeholder) */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 cursor-not-allowed"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">{t('chatInputAttachComingSoon')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Right group */}
            <div className="flex flex-col items-end gap-1">
              {sendError?.trim() && (
                <div className="max-w-[420px] text-right text-[11px] text-red-600">{sendError}</div>
              )}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="rounded-lg"
                  onClick={() => void onSend()}
                  disabled={draft.trim().length === 0 || !hasModelOptions}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {t('chatSend')}
                </Button>
              {isSending && (
                canStopGeneration ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-lg"
                    onClick={() => void onStop()}
                  >
                    <Square className="h-3.5 w-3.5 mr-1.5" />
                    {t('chatStop')}
                  </Button>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button size="sm" className="rounded-lg" disabled>
                            <Square className="h-3.5 w-3.5 mr-1.5" />
                            {t('chatStop')}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">{resolvedStopHint}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
