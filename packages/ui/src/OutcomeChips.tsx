import { useCallback, useRef } from "preact/hooks";
import type { OutcomeChipDef } from "./types.js";
import "./outcome-chips.css";

const LONG_PRESS_MS = 500;

export interface OutcomeChipsProps {
  chips: OutcomeChipDef[];
  onTap: (id: string) => void;
  onLongPress: (id: string) => void;
}

export function OutcomeChips({ chips, onTap, onLongPress }: OutcomeChipsProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const pressingRef = useRef<string | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startPress = useCallback(
    (id: string) => {
      longPressFiredRef.current = false;
      pressingRef.current = id;
      clearTimer();
      timerRef.current = setTimeout(() => {
        longPressFiredRef.current = true;
        onLongPress(id);
        pressingRef.current = null;
      }, LONG_PRESS_MS);
    },
    [clearTimer, onLongPress],
  );

  const endPress = useCallback(
    (id: string) => {
      clearTimer();
      if (!longPressFiredRef.current) {
        onTap(id);
      }
      longPressFiredRef.current = false;
      pressingRef.current = null;
    },
    [clearTimer, onTap],
  );

  const cancelPress = useCallback(() => {
    clearTimer();
    longPressFiredRef.current = false;
    pressingRef.current = null;
  }, [clearTimer]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent, id: string) => {
      if (e.key === " " || e.key === "Enter") {
        if (e.shiftKey) {
          e.preventDefault();
          onLongPress(id);
        } else if (e.key === "Enter") {
          e.preventDefault();
          onTap(id);
        }
      }
    },
    [onTap, onLongPress],
  );

  return (
    <div class="outcome-chips" data-testid="outcome-chips">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          class={`outcome-chips__chip${pressingRef.current === chip.id ? " outcome-chips__chip--pressing" : ""}`}
          style={{ background: chip.color }}
          aria-label={chip.ariaLabel}
          data-testid={`outcome-chip-${chip.id}`}
          onMouseDown={() => startPress(chip.id)}
          onMouseUp={() => endPress(chip.id)}
          onMouseLeave={cancelPress}
          onTouchStart={() => startPress(chip.id)}
          onTouchEnd={() => endPress(chip.id)}
          onTouchCancel={cancelPress}
          onKeyDown={(e) => handleKeyDown(e as unknown as KeyboardEvent, chip.id)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
