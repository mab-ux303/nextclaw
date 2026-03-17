import { useEffect, type RefObject } from 'react';

type UseActiveItemScrollParams = {
  containerRef: RefObject<HTMLElement>;
  activeIndex: number;
  itemCount: number;
  isEnabled: boolean;
  getItemSelector?: (index: number) => string;
};

const defaultGetItemSelector = (index: number) => `[data-item-index="${index}"]`;

export function useActiveItemScroll(params: UseActiveItemScrollParams) {
  const getItemSelector = params.getItemSelector ?? defaultGetItemSelector;

  useEffect(() => {
    if (!params.isEnabled || params.itemCount === 0) {
      return;
    }

    const container = params.containerRef.current;
    if (!container) {
      return;
    }

    const activeItem = container.querySelector<HTMLElement>(getItemSelector(params.activeIndex));
    activeItem?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [getItemSelector, params.activeIndex, params.containerRef, params.isEnabled, params.itemCount]);
}
