import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { tapHaptic } from "./haptics.js";
import "./dice-picker.css";

export type DieFace = 1 | 2 | 3 | 4 | 5 | 6;

const FACES: DieFace[] = [1, 2, 3, 4, 5, 6];

const PIP_LAYOUT: Record<DieFace, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export interface DicePickerProps {
  dieA: DieFace | null;
  dieB: DieFace | null;
  expressMode: boolean;
  confirmRequired?: boolean;
  blocked?: string;
  haptics?: boolean;
  onDieA: (face: DieFace) => void;
  onDieB: (face: DieFace) => void;
  onCommit: () => void;
  onClear: () => void;
}

function faceAriaLabel(die: "A" | "B", face: DieFace): string {
  return `Die ${die} face ${face}`;
}

function DieGrid({
  die,
  selected,
  onSelect,
}: {
  die: "A" | "B";
  selected: DieFace | null;
  onSelect: (face: DieFace) => void;
}) {
  return (
    <div
      class="dice-picker__die"
      role="group"
      aria-label={`Die ${die}`}
      data-testid={`die-${die.toLowerCase()}-grid`}
    >
      <div class="dice-picker__die-label">DIE {die}</div>
      <div class="dice-picker__faces">
        {FACES.map((face) => (
          <button
            key={face}
            type="button"
            class={`dice-picker__face${selected === face ? " dice-picker__face--selected" : ""}`}
            data-testid={`die-${die.toLowerCase()}-${face}`}
            aria-label={faceAriaLabel(die, face)}
            aria-pressed={selected === face}
            onClick={() => onSelect(face)}
          >
            <span class="dice-picker__pip-grid" aria-hidden="true">
              {Array.from({ length: 9 }, (_, i) => (
                <span
                  key={i}
                  class={`dice-picker__pip${PIP_LAYOUT[face].includes(i) ? " dice-picker__pip--on" : ""}`}
                />
              ))}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function DicePicker({
  dieA,
  dieB,
  expressMode,
  confirmRequired = false,
  blocked,
  haptics = false,
  onDieA,
  onDieB,
  onCommit,
  onClear,
}: DicePickerProps) {
  const [pendingDie, setPendingDie] = useState<"A" | "B">("A");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dieA === null) setPendingDie("A");
    else if (dieB === null) setPendingDie("B");
  }, [dieA, dieB]);

  const handleFaceSelect = useCallback(
    (die: "A" | "B", face: DieFace) => {
      if (blocked) return;
      tapHaptic(haptics);
      if (die === "A") {
        onDieA(face);
        setPendingDie("B");
        if (expressMode && dieB !== null) {
          onCommit();
        }
        return;
      }
      onDieB(face);
      if (expressMode && dieA !== null) {
        onCommit();
      }
    },
    [blocked, dieA, dieB, expressMode, haptics, onCommit, onDieA, onDieB],
  );

  const canConfirm = dieA !== null && dieB !== null && !blocked;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const digit = Number(e.key);
      if (digit >= 1 && digit <= 6) {
        e.preventDefault();
        const face = digit as DieFace;
        if (pendingDie === "A") handleFaceSelect("A", face);
        else handleFaceSelect("B", face);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (canConfirm && (confirmRequired || !expressMode)) onCommit();
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        onClear();
      }
    };

    const el = containerRef.current;
    el?.addEventListener("keydown", handleKeyDown);
    return () => el?.removeEventListener("keydown", handleKeyDown);
  }, [canConfirm, confirmRequired, expressMode, handleFaceSelect, onClear, onCommit, pendingDie]);

  return (
    <div
      class="dice-picker"
      ref={containerRef}
      tabIndex={0}
      data-testid="dice-picker"
      aria-label="Dice picker"
    >
      {blocked && (
        <p class="dice-picker__blocked" role="alert">
          {blocked}
        </p>
      )}
      <div class="dice-picker__row">
        <DieGrid die="A" selected={dieA} onSelect={(f) => handleFaceSelect("A", f)} />
        <DieGrid die="B" selected={dieB} onSelect={(f) => handleFaceSelect("B", f)} />
      </div>
      {(!expressMode || confirmRequired) && (
        <div class="dice-picker__actions">
          <button
            type="button"
            class="dice-picker__clear"
            data-testid="dice-picker-clear"
            onClick={onClear}
          >
            Clear
          </button>
          <button
            type="button"
            class="dice-picker__commit"
            data-testid="dice-picker-commit"
            disabled={!canConfirm}
            onClick={onCommit}
          >
            Confirm
          </button>
        </div>
      )}
    </div>
  );
}
