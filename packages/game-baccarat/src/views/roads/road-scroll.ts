import { useEffect, useRef } from "preact/hooks";

export function useRoadScroll(
  cols: number,
  cellSizeRem = 1.375,
): { ref: (el: HTMLDivElement | null) => void } {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prevColsRef = useRef(cols);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const cellPx = cellSizeRem * rootFont;
    const margin = cellPx * 2;
    el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth - margin);
    prevColsRef.current = cols;
  }, [cols, cellSizeRem]);

  return {
    ref: (el: HTMLDivElement | null) => {
      containerRef.current = el;
    },
  };
}
