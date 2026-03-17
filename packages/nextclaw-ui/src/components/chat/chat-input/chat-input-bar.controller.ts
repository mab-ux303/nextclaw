import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { ChatSlashItem } from '@/components/chat/view-models/chat-ui.types';

const SLASH_PANEL_MAX_WIDTH = 680;
const SLASH_PANEL_DESKTOP_SHRINK_RATIO = 0.82;
const SLASH_PANEL_DESKTOP_MIN_WIDTH = 560;

type UseChatInputBarControllerParams = {
  isSlashMode: boolean;
  slashItems: ChatSlashItem[];
  isSlashLoading: boolean;
  onSelectSlashItem: (item: ChatSlashItem) => void;
  onSend: () => Promise<void> | void;
  onStop: () => Promise<void> | void;
  isSending: boolean;
  canStopGeneration: boolean;
};

export function useChatInputBarController(params: UseChatInputBarControllerParams) {
  const [activeSlashIndex, setActiveSlashIndex] = useState(0);
  const [dismissedSlashPanel, setDismissedSlashPanel] = useState(false);
  const [slashPanelWidth, setSlashPanelWidth] = useState<number | null>(null);

  const slashAnchorRef = useRef<HTMLDivElement | null>(null);
  const slashListRef = useRef<HTMLDivElement | null>(null);

  const isSlashPanelOpen = params.isSlashMode && !dismissedSlashPanel;
  const activeSlashItem = params.slashItems[activeSlashIndex] ?? null;
  const resolvedSlashPanelWidth = useMemo(() => {
    if (!slashPanelWidth) {
      return undefined;
    }
    return Math.min(
      slashPanelWidth > SLASH_PANEL_DESKTOP_MIN_WIDTH
        ? slashPanelWidth * SLASH_PANEL_DESKTOP_SHRINK_RATIO
        : slashPanelWidth,
      SLASH_PANEL_MAX_WIDTH
    );
  }, [slashPanelWidth]);

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
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isSlashPanelOpen || params.slashItems.length === 0) {
      setActiveSlashIndex(0);
      return;
    }
    setActiveSlashIndex((current) => {
      if (current < 0) {
        return 0;
      }
      if (current >= params.slashItems.length) {
        return params.slashItems.length - 1;
      }
      return current;
    });
  }, [isSlashPanelOpen, params.slashItems.length]);

  useEffect(() => {
    if (!params.isSlashMode && dismissedSlashPanel) {
      setDismissedSlashPanel(false);
    }
  }, [dismissedSlashPanel, params.isSlashMode]);

  useEffect(() => {
    if (!isSlashPanelOpen || params.isSlashLoading || params.slashItems.length === 0) {
      return;
    }
    const container = slashListRef.current;
    if (!container) {
      return;
    }
    const active = container.querySelector<HTMLElement>(`[data-slash-index="${activeSlashIndex}"]`);
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeSlashIndex, isSlashPanelOpen, params.isSlashLoading, params.slashItems.length]);

  const handleSelectSlashItem = useCallback((item: ChatSlashItem) => {
    params.onSelectSlashItem(item);
    setDismissedSlashPanel(false);
  }, [params]);

  const onTextareaKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSlashPanelOpen && !event.nativeEvent.isComposing && (event.key === ' ' || event.code === 'Space')) {
      setDismissedSlashPanel(true);
    }
    if (isSlashPanelOpen && params.slashItems.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveSlashIndex((current) => (current + 1) % params.slashItems.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveSlashIndex((current) => (current - 1 + params.slashItems.length) % params.slashItems.length);
        return;
      }
      if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
        event.preventDefault();
        const selected = params.slashItems[activeSlashIndex];
        if (selected) {
          handleSelectSlashItem(selected);
        }
        return;
      }
    }
    if (event.key === 'Escape') {
      if (isSlashPanelOpen) {
        event.preventDefault();
        setDismissedSlashPanel(true);
        return;
      }
      if (params.isSending && params.canStopGeneration) {
        event.preventDefault();
        void params.onStop();
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void params.onSend();
    }
  }, [activeSlashIndex, handleSelectSlashItem, isSlashPanelOpen, params]);

  return {
    slashAnchorRef,
    slashListRef,
    isSlashPanelOpen,
    activeSlashIndex,
    activeSlashItem,
    resolvedSlashPanelWidth,
    onSelectSlashItem: handleSelectSlashItem,
    onSlashPanelOpenChange: (open: boolean) => {
      if (!open) {
        setDismissedSlashPanel(true);
      }
    },
    onSetActiveSlashIndex: setActiveSlashIndex,
    onTextareaKeyDown
  };
}
