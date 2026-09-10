import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { tapHaptic } from "./haptics.js";
import type { PickedCard } from "./types.js";
import "./card-picker.css";

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
const SUITS = [
  { id: "S", glyph: "♠", red: false, name: "Spades" },
  { id: "H", glyph: "♥", red: true, name: "Hearts" },
  { id: "D", glyph: "♦", red: true, name: "Diamonds" },
  { id: "C", glyph: "♣", red: false, name: "Clubs" },
] as const;

const RANK_NAMES: Record<string, string> = {
  A: "Ace",
  J: "Jack",
  Q: "Queen",
  K: "King",
};

function rankAriaLabel(rank: string, valueOf: (rank: string) => number): string {
  const name = RANK_NAMES[rank] ?? rank;
  return `${name}, value ${valueOf(rank)}`;
}

const KEY_TO_RANK: Record<string, string> = {
  a: "A",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  "0": "10",
  j: "J",
  q: "Q",
  k: "K",
};

const KEY_TO_SUIT: Record<string, string> = {
  s: "S",
  h: "H",
  d: "D",
  c: "C",
};

export interface CardPickerProps {
  open: boolean;
  title: string;
  initialCard?: PickedCard | null;
  expressMode: boolean;
  suitRequired: boolean;
  valueOf: (rank: string) => number;
  duplicateWarning?: string;
  blocked?: string;
  stickySuit?: string | null;
  onStickySuitChange?: (suit: string | null) => void;
  onCommit: (card: PickedCard) => void;
  onRemove: () => void;
  onUndoLast?: () => void;
  onClose: () => void;
  haptics?: boolean;
}

function suitGlyph(suit: string | null): string {
  return SUITS.find((s) => s.id === suit)?.glyph ?? "";
}

function isRedSuit(suit: string | null): boolean {
  return suit === "H" || suit === "D";
}

export function CardPicker({
  open,
  title,
  initialCard,
  expressMode,
  suitRequired,
  valueOf,
  duplicateWarning,
  blocked,
  stickySuit: stickySuitProp,
  onStickySuitChange,
  onCommit,
  onRemove,
  onUndoLast,
  onClose,
  haptics = false,
}: CardPickerProps) {
  const [selectedRank, setSelectedRank] = useState<string | null>(initialCard?.rank ?? null);
  const [selectedSuit, setSelectedSuit] = useState<string | null>(initialCard?.suit ?? null);
  const [localStickySuit, setLocalStickySuit] = useState<string | null>(
    stickySuitProp ?? initialCard?.suit ?? null,
  );
  const stickySuit = stickySuitProp ?? localStickySuit;
  const setStickySuit = (suit: string | null) => {
    setLocalStickySuit(suit);
    onStickySuitChange?.(suit);
  };
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setSelectedRank(initialCard?.rank ?? null);
      setSelectedSuit(initialCard?.suit ?? null);
      setLocalStickySuit(stickySuitProp ?? initialCard?.suit ?? null);
    }
  }, [open, initialCard, stickySuitProp]);

  const canConfirm = useCallback((): boolean => {
    if (blocked) return false;
    if (!selectedRank) return false;
    if (suitRequired && !selectedSuit) return false;
    return true;
  }, [blocked, selectedRank, selectedSuit, suitRequired]);

  const buildCard = useCallback((): PickedCard | null => {
    if (!selectedRank) return null;
    const suit = suitRequired ? selectedSuit : (selectedSuit ?? null);
    if (suitRequired && !suit) return null;
    return { rank: selectedRank, suit };
  }, [selectedRank, selectedSuit, suitRequired]);

  const handleCommit = useCallback(() => {
    const card = buildCard();
    if (!card || blocked) return;
    onCommit(card);
    setSelectedRank(null);
    if (!expressMode) setSelectedSuit(null);
  }, [buildCard, blocked, onCommit, expressMode]);

  const handleRankSelect = useCallback(
    (rank: string) => {
      tapHaptic(haptics);
      setSelectedRank(rank);
      const suit = expressMode ? (stickySuit ?? selectedSuit) : selectedSuit;

      if (expressMode) {
        if (stickySuit) {
          setSelectedSuit(stickySuit);
          if (!suitRequired || stickySuit) {
            if (!blocked) {
              onCommit({ rank, suit: stickySuit });
              setSelectedRank(null);
            }
          }
          return;
        }
        if (!suitRequired) {
          if (!blocked) {
            onCommit({ rank, suit: null });
            setSelectedRank(null);
          }
          return;
        }
      }
    },
    [expressMode, stickySuit, selectedSuit, suitRequired, blocked, haptics, onCommit],
  );

  const handleSuitSelect = useCallback(
    (suit: string) => {
      tapHaptic(haptics);
      setSelectedSuit(suit);
      setStickySuit(suit);

      if (expressMode && selectedRank && !blocked) {
        onCommit({ rank: selectedRank, suit });
        setSelectedRank(null);
      }
    },
    [expressMode, selectedRank, blocked, haptics, onCommit],
  );

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      if (key === "escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (key === "backspace") {
        e.preventDefault();
        onRemove();
        return;
      }

      if (key === "enter") {
        e.preventDefault();
        handleCommit();
        return;
      }

      const rank = KEY_TO_RANK[key];
      if (rank) {
        e.preventDefault();
        handleRankSelect(rank);
        return;
      }

      const suit = KEY_TO_SUIT[key];
      if (suit) {
        e.preventDefault();
        handleSuitSelect(suit);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, onRemove, handleCommit, handleRankSelect, handleSuitSelect]);

  useEffect(() => {
    if (!open || !sheetRef.current) return;
    const focusable = sheetRef.current.querySelector<HTMLElement>("button");
    focusable?.focus();
  }, [open]);

  if (!open) return null;

  const previewRank = selectedRank;
  const previewSuit = selectedSuit ?? stickySuit;
  const previewRed = isRedSuit(previewSuit);

  return (
    <div class="card-picker__backdrop" onClick={onClose} data-testid="card-picker-backdrop">
      <div
        ref={sheetRef}
        class="card-picker__sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        data-testid="card-picker"
      >
        <div class="card-picker__header">
          <span class="card-picker__title">{title}</span>
          <button
            type="button"
            class="card-picker__close"
            onClick={onClose}
            aria-label="Close"
            data-testid="card-picker-close"
          >
            ✕
          </button>
        </div>

        {duplicateWarning && (
          <div
            class="card-picker__banner card-picker__banner--warning"
            data-testid="card-picker-warning"
          >
            {duplicateWarning}
          </div>
        )}

        {blocked && (
          <div
            class="card-picker__banner card-picker__banner--blocked"
            data-testid="card-picker-blocked"
          >
            {blocked}
          </div>
        )}

        <div class="card-picker__grid">
          {RANKS.map((rank) => (
            <button
              key={rank}
              type="button"
              class={`card-picker__rank${selectedRank === rank ? " card-picker__rank--selected" : ""}`}
              aria-label={rankAriaLabel(rank, valueOf)}
              onClick={() => handleRankSelect(rank)}
              data-testid={`rank-${rank}`}
            >
              {rank}
              <span class="card-picker__rank-sub">{valueOf(rank)}</span>
            </button>
          ))}
        </div>

        <div class="card-picker__suits">
          {SUITS.map(({ id, glyph, red, name }) => (
            <button
              key={id}
              type="button"
              class={`card-picker__suit card-picker__suit${red ? "--red" : ""}${selectedSuit === id || stickySuit === id ? " card-picker__suit--selected" : ""}`}
              aria-label={name}
              onClick={() => handleSuitSelect(id)}
              data-testid={`suit-${id}`}
            >
              {glyph}
            </button>
          ))}
        </div>

        <div class="card-picker__preview">
          <div
            class={`card-picker__preview-card${previewRed ? " card-picker__preview-card--red" : ""}`}
            data-testid="card-picker-preview"
          >
            {previewRank ? (
              <>
                {previewRank}
                {suitGlyph(previewSuit)}
                <span class="card-picker__preview-sub">{valueOf(previewRank)}</span>
              </>
            ) : (
              "—"
            )}
          </div>
        </div>

        <div class="card-picker__actions">
          {onUndoLast && (
            <button
              type="button"
              class="card-picker__btn card-picker__btn--undo"
              onClick={onUndoLast}
              data-testid="card-picker-undo-last"
            >
              Undo last
            </button>
          )}
          <button
            type="button"
            class="card-picker__btn card-picker__btn--remove"
            onClick={onRemove}
            data-testid="card-picker-remove"
          >
            Remove
          </button>
          <button
            type="button"
            class="card-picker__btn card-picker__btn--confirm"
            onClick={handleCommit}
            disabled={!canConfirm()}
            data-testid="card-picker-commit"
          >
            ✓
          </button>
        </div>
      </div>
    </div>
  );
}
