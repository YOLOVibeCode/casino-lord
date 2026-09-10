import { useCallback, useEffect, useState } from "preact/hooks";
import { tapHaptic } from "./haptics.js";
import "./number-grid.css";

export type NumberGridPocket = 0 | "00" | number;

export type NumberGridWheel = "european" | "american" | "french";

const RED_NUMBERS = new Set<number>([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export function pocketColor(pocket: NumberGridPocket): "red" | "black" | "green" {
  if (pocket === 0 || pocket === "00") return "green";
  return RED_NUMBERS.has(pocket) ? "red" : "black";
}

function pocketLabel(pocket: NumberGridPocket): string {
  return String(pocket);
}

function pocketAriaLabel(pocket: NumberGridPocket): string {
  const color = pocketColor(pocket);
  return `${pocketLabel(pocket)}, ${color}`;
}

function isAmericanWheel(wheel: NumberGridWheel): boolean {
  return wheel === "american";
}

function buildRows(): number[][] {
  const rows: number[][] = [];
  for (let row = 0; row < 12; row++) {
    const base = row * 3 + 1;
    rows.push([base, base + 1, base + 2]);
  }
  return rows.reverse();
}

const FELT_ROWS = buildRows();

export interface NumberGridProps {
  wheel: NumberGridWheel;
  selected: NumberGridPocket | null;
  onSelect: (pocket: NumberGridPocket | null) => void;
  requireConfirm?: boolean;
  onConfirm?: () => void;
  disabled?: boolean;
  haptics?: boolean;
}

function shouldIgnoreKeyboard(e: KeyboardEvent): boolean {
  const target = e.target;
  if (target instanceof HTMLElement) {
    if (target.closest('input, textarea, select, [contenteditable="true"]')) {
      return true;
    }
  }
  return document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}

export function NumberGrid({
  wheel,
  selected,
  onSelect,
  requireConfirm = false,
  onConfirm,
  disabled = false,
  haptics = false,
}: NumberGridProps) {
  const [digitBuffer, setDigitBuffer] = useState("");

  const clearBuffer = useCallback(() => setDigitBuffer(""), []);

  const trySelectPocket = useCallback(
    (pocket: NumberGridPocket) => {
      if (disabled) return;
      tapHaptic(haptics);
      onSelect(pocket);
      clearBuffer();
    },
    [clearBuffer, disabled, haptics, onSelect],
  );

  const tryConfirm = useCallback(() => {
    if (disabled) return;
    if (selected !== null) {
      if (requireConfirm && onConfirm) {
        onConfirm();
      } else if (!requireConfirm) {
        onConfirm?.();
      }
      return;
    }
    if (digitBuffer === "0") {
      trySelectPocket(0);
      return;
    }
    if (digitBuffer === "00" && isAmericanWheel(wheel)) {
      trySelectPocket("00");
      return;
    }
    const n = Number(digitBuffer);
    if (Number.isInteger(n) && n >= 1 && n <= 36) {
      trySelectPocket(n);
    }
  }, [digitBuffer, disabled, onConfirm, requireConfirm, selected, trySelectPocket, wheel]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled || shouldIgnoreKeyboard(e)) return;
      const key = e.key;

      if (key === "Backspace") {
        e.preventDefault();
        if (selected !== null) {
          onSelect(null);
        } else {
          setDigitBuffer((prev) => prev.slice(0, -1));
        }
        return;
      }

      if (key === "Enter") {
        e.preventDefault();
        tryConfirm();
        return;
      }

      if (key === "0") {
        e.preventDefault();
        if (selected !== null) return;
        setDigitBuffer((prev) => {
          if (prev === "0" && isAmericanWheel(wheel)) return "00";
          return "0";
        });
        return;
      }

      if (/^[1-9]$/.test(key)) {
        e.preventDefault();
        if (selected !== null) return;
        setDigitBuffer((prev) => {
          const next = prev + key;
          const canExtend = (prefix: string): boolean => {
            for (let d = 0; d <= 9; d++) {
              const n = Number(`${prefix}${d}`);
              if (Number.isInteger(n) && n >= 1 && n <= 36) return true;
            }
            return false;
          };
          if (canExtend(next) && next.length < 2) return next;
          const n = Number(next);
          if (Number.isInteger(n) && n >= 1 && n <= 36) {
            trySelectPocket(n);
            return "";
          }
          return prev;
        });
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [disabled, onSelect, selected, tryConfirm, trySelectPocket, wheel]);

  const renderCell = (pocket: NumberGridPocket) => {
    const color = pocketColor(pocket);
    const isSelected = selected === pocket;
    return (
      <button
        key={pocketLabel(pocket)}
        type="button"
        class={`number-grid__cell number-grid__cell--${color}${isSelected ? " number-grid__cell--selected" : ""}`}
        aria-label={pocketAriaLabel(pocket)}
        aria-pressed={isSelected}
        data-testid={`number-cell-${pocketLabel(pocket)}`}
        disabled={disabled}
        onClick={() => trySelectPocket(pocket)}
      >
        {pocketLabel(pocket)}
      </button>
    );
  };

  return (
    <div class="number-grid" data-testid="number-grid">
      <div class="number-grid__zeros">
        {renderCell(0)}
        {isAmericanWheel(wheel) && renderCell("00")}
      </div>
      <div class="number-grid__felt">
        {FELT_ROWS.map((row) => (
          <div key={row.join("-")} class="number-grid__row">
            {row.map((n) => renderCell(n))}
          </div>
        ))}
      </div>
      {requireConfirm && onConfirm && (
        <button
          type="button"
          class="number-grid__confirm"
          data-testid="number-grid-confirm"
          aria-label="Confirm selected number"
          disabled={disabled || selected === null}
          onClick={() => onConfirm()}
        >
          Confirm
        </button>
      )}
    </div>
  );
}
