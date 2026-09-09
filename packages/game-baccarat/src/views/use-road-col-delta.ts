import { useRef } from "preact/hooks";

export function useRoadColDelta(cols: number): number {
  const prevRef = useRef(cols);
  const delta = Math.max(0, cols - prevRef.current);
  prevRef.current = cols;
  return delta;
}
