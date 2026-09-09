import { useCallback, useRef } from "preact/hooks";

export const LONG_PRESS_MS = 500;

export interface UseLongPressOptions {
  onTap: () => void;
  onLongPress: () => void;
  disabled?: boolean;
}

export function useLongPress({ onTap, onLongPress, disabled = false }: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startPress = useCallback(() => {
    if (disabled) return;
    longPressFiredRef.current = false;
    clearTimer();
    timerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  }, [clearTimer, disabled, onLongPress]);

  const endPress = useCallback(() => {
    const wasLongPress = longPressFiredRef.current;
    clearTimer();
    if (!disabled && !wasLongPress) {
      onTap();
    }
    longPressFiredRef.current = false;
  }, [clearTimer, disabled, onTap]);

  const cancelPress = useCallback(() => {
    clearTimer();
    longPressFiredRef.current = false;
  }, [clearTimer]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return;
      if (e.key === "Enter") {
        e.preventDefault();
        onTap();
      } else if (e.shiftKey && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        onLongPress();
      }
    },
    [disabled, onLongPress, onTap],
  );

  return { startPress, endPress, cancelPress, handleKeyDown };
}
