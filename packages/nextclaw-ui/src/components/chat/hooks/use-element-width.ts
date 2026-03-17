import { useEffect, useRef, useState, type RefObject } from 'react';

type UseElementWidthResult<T extends HTMLElement> = {
  elementRef: RefObject<T>;
  width: number | null;
};

export function useElementWidth<T extends HTMLElement>(): UseElementWidthResult<T> {
  const elementRef = useRef<T | null>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }

    const updateWidth = () => {
      setWidth(element.getBoundingClientRect().width);
    };

    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return {
    elementRef,
    width
  };
}
