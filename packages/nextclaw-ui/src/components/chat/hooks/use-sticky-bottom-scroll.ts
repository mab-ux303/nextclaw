import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

type UseStickyBottomScrollParams = {
  scrollRef: RefObject<HTMLElement>;
  resetKey: string | null;
  isLoading: boolean;
  hasContent: boolean;
  contentVersion: unknown;
  stickyThresholdPx?: number;
};

type UseStickyBottomScrollResult = {
  onScroll: () => void;
};

const DEFAULT_STICKY_THRESHOLD_PX = 10;

function scrollElementToBottom(element: HTMLElement) {
  element.scrollTop = element.scrollHeight;
}

export function useStickyBottomScroll(params: UseStickyBottomScrollParams): UseStickyBottomScrollResult {
  const isStickyRef = useRef(true);
  const isProgrammaticScrollRef = useRef(false);
  const previousResetKeyRef = useRef<string | null>(null);
  const pendingInitialScrollRef = useRef(false);

  const onScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) {
      isProgrammaticScrollRef.current = false;
      return;
    }

    const element = params.scrollRef.current;
    if (!element) {
      return;
    }

    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    isStickyRef.current = distanceFromBottom <= (params.stickyThresholdPx ?? DEFAULT_STICKY_THRESHOLD_PX);
  }, [params.scrollRef, params.stickyThresholdPx]);

  useEffect(() => {
    if (previousResetKeyRef.current === params.resetKey) {
      return;
    }

    previousResetKeyRef.current = params.resetKey;
    isStickyRef.current = true;
    pendingInitialScrollRef.current = true;
  }, [params.resetKey]);

  useLayoutEffect(() => {
    if (!pendingInitialScrollRef.current || params.isLoading || !params.hasContent) {
      return;
    }

    const element = params.scrollRef.current;
    if (!element) {
      return;
    }

    pendingInitialScrollRef.current = false;
    isProgrammaticScrollRef.current = true;
    scrollElementToBottom(element);
  }, [params.hasContent, params.isLoading, params.scrollRef]);

  useLayoutEffect(() => {
    if (!isStickyRef.current || !params.hasContent) {
      return;
    }

    const element = params.scrollRef.current;
    if (!element) {
      return;
    }

    isProgrammaticScrollRef.current = true;
    scrollElementToBottom(element);
  }, [params.contentVersion, params.hasContent, params.scrollRef]);

  return { onScroll };
}
