import { useCallback, useRef } from "preact/hooks";

export const LONG_PRESS_MS = 500;

export interface UseLongPressOptions {
  onTap: () => void;
  onLongPress: () => void;
}

export function useLongPress({ onTap, onLongPress }: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const pressingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startPress = useCallback(
    (e: PointerEvent) => {
      if (activePointerIdRef.current !== null && activePointerIdRef.current !== e.pointerId) {
        return;
      }
      activePointerIdRef.current = e.pointerId;
      longPressFiredRef.current = false;
      pressingRef.current = true;
      clearTimer();
      timerRef.current = setTimeout(() => {
        longPressFiredRef.current = true;
        onLongPress();
        pressingRef.current = false;
      }, LONG_PRESS_MS);
    },
    [clearTimer, onLongPress],
  );

  const endPress = useCallback(
    (e: PointerEvent) => {
      if (activePointerIdRef.current !== e.pointerId) return;
      clearTimer();
      if (!longPressFiredRef.current) {
        onTap();
      }
      longPressFiredRef.current = false;
      pressingRef.current = false;
      activePointerIdRef.current = null;
    },
    [clearTimer, onTap],
  );

  const cancelPress = useCallback(
    (e: PointerEvent) => {
      if (activePointerIdRef.current !== e.pointerId) return;
      clearTimer();
      longPressFiredRef.current = false;
      pressingRef.current = false;
      activePointerIdRef.current = null;
    },
    [clearTimer],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === " " && e.shiftKey) {
        e.preventDefault();
        onLongPress();
        return;
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        onTap();
      }
    },
    [onTap, onLongPress],
  );

  return {
    startPress,
    endPress,
    cancelPress,
    handleKeyDown,
    isPressing: () => pressingRef.current,
  };
}
