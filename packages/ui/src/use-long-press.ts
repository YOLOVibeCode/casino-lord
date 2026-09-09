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

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startPress = useCallback(() => {
    longPressFiredRef.current = false;
    pressingRef.current = true;
    clearTimer();
    timerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      onLongPress();
      pressingRef.current = false;
    }, LONG_PRESS_MS);
  }, [clearTimer, onLongPress]);

  const endPress = useCallback(() => {
    clearTimer();
    if (!longPressFiredRef.current) {
      onTap();
    }
    longPressFiredRef.current = false;
    pressingRef.current = false;
  }, [clearTimer, onTap]);

  const cancelPress = useCallback(() => {
    clearTimer();
    longPressFiredRef.current = false;
    pressingRef.current = false;
  }, [clearTimer]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        if (e.shiftKey) {
          e.preventDefault();
          onLongPress();
        } else if (e.key === "Enter") {
          e.preventDefault();
          onTap();
        }
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
