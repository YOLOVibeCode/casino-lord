import { useEffect, useRef } from "preact/hooks";
import { tapHaptic } from "./haptics.js";
import "./action-buttons.css";

export interface ActionButtonDef<Action> {
  id: string;
  label: string;
  enabled: boolean;
  action: Action;
}

export interface ActionButtonsProps<Action> {
  actions: ActionButtonDef<Action>[];
  countdownSec: number | null;
  countdownTotalSec?: number;
  onAction: (action: Action) => void;
  haptics?: boolean;
}

export function ActionButtons<Action>({
  actions,
  countdownSec,
  countdownTotalSec = 20,
  onAction,
  haptics = false,
}: ActionButtonsProps<Action>) {
  const lastSec = useRef<number | null>(null);

  useEffect(() => {
    if (countdownSec === null) return;
    if (lastSec.current !== countdownSec && (countdownSec === 10 || countdownSec === 5)) {
      tapHaptic(haptics);
    }
    lastSec.current = countdownSec;
  }, [countdownSec, haptics]);

  const progress = countdownSec !== null ? Math.max(0, countdownSec / countdownTotalSec) : null;
  const circumference = 2 * Math.PI * 36;
  const dashOffset = progress !== null ? circumference * (1 - progress) : circumference;

  return (
    <div class="action-buttons" data-testid="action-buttons">
      {actions.map((def) => {
        const enabled = def.enabled;
        return (
          <div key={def.id} class="action-buttons__btn-wrap">
            {countdownSec !== null && (
              <div class="action-buttons__countdown" data-testid="action-countdown-ring">
                <span class="action-buttons__sr-only">{countdownSec} s left</span>
                <svg viewBox="0 0 80 80" aria-hidden="true">
                  <circle class="action-buttons__countdown-track" cx="40" cy="40" r="36" />
                  <circle
                    class="action-buttons__countdown-progress"
                    cx="40"
                    cy="40"
                    r="36"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                  />
                </svg>
              </div>
            )}
            <button
              type="button"
              class="action-buttons__btn"
              data-testid={`action-btn-${def.id}`}
              disabled={!enabled}
              onClick={() => onAction(def.action)}
            >
              {def.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}
