import { CardPicker, OutcomeChips } from "@casino-lord/ui";
import type { Emit, TableMeta } from "@casino-lord/core";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { cardValue } from "../cards.js";
import { evaluateHand } from "../engine.js";
import type { BaccaratRules } from "../rules.js";
import type { BaccaratState } from "../state.js";
import type { BaccaratResult, Card, Outcome, Rank, SlotId, Suit } from "../types.js";
import { MiniBigRoad } from "./MiniBigRoad.js";
import "./dealer-view.css";

const PLAYER_SLOTS: SlotId[] = ["P1", "P2", "P3"];
const BANKER_SLOTS: SlotId[] = ["B1", "B2", "B3"];

const QUICK_CHIPS = [
  { id: "P", label: "P", color: "#2563eb", ariaLabel: "Quick entry Player win" },
  { id: "B", label: "B", color: "#e5322d", ariaLabel: "Quick entry Banker win" },
  { id: "T", label: "T", color: "#16a34a", ariaLabel: "Quick entry Tie" },
];

const SUIT_GLYPH: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

const SUIT_NAMES: Record<Suit, string> = {
  S: "spades",
  H: "hearts",
  D: "diamonds",
  C: "clubs",
};

const RANK_NAMES: Partial<Record<Rank, string>> = {
  A: "Ace",
  J: "Jack",
  Q: "Queen",
  K: "King",
};

function isRedSuit(suit: Suit | null): boolean {
  return suit === "H" || suit === "D";
}

function formatSlotCard(card: Card): string {
  const glyph = card.suit ? (SUIT_GLYPH[card.suit] ?? "") : "";
  return `${card.rank}${glyph}`;
}

function slotTitle(slot: SlotId): string {
  const side = slot.startsWith("P") ? "Player" : "Banker";
  const num = slot[1];
  return `${side} · Card ${num}`;
}

function isThirdCardSlot(slot: SlotId): boolean {
  return slot === "P3" || slot === "B3";
}

function formatCardContents(card: Card): string {
  const rank = RANK_NAMES[card.rank] ?? card.rank;
  if (!card.suit) return rank;
  return `${rank} of ${SUIT_NAMES[card.suit]}`;
}

function slotAriaLabel(
  slot: SlotId,
  card: Card | undefined,
  opts: { enabled: boolean; isNext: boolean; isDraw: boolean },
): string {
  const side = slot.startsWith("P") ? "Player" : "Banker";
  const num = slot[1];
  const parts = [`${side} card ${num}`, card ? formatCardContents(card) : "empty"];
  if (opts.isDraw) parts.push("draw required");
  if (opts.isNext) parts.push("next");
  if (!opts.enabled && !card) parts.push("not allowed by rules");
  return parts.join(", ");
}

export interface DealerViewProps {
  state: BaccaratState;
  rules: BaccaratRules;
  table: TableMeta;
  emit: Emit;
  record: (result: BaccaratResult, opts: { quick: boolean }) => void;
  autoAdvance?: boolean;
  expressMode?: boolean;
}

export function DealerView({
  state,
  rules,
  emit,
  record,
  autoAdvance = true,
  expressMode = true,
}: DealerViewProps) {
  const { handState, liveSlots } = state;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSlot, setPickerSlot] = useState<SlotId | null>(null);
  const [pairMenuOutcome, setPairMenuOutcome] = useState<Outcome | null>(null);
  const [stickySuit, setStickySuit] = useState<Suit | null>(null);
  const prevResultsCountRef = useRef(state.results.length);

  const openPicker = useCallback((slot: SlotId) => {
    setPickerSlot(slot);
    setPickerOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setPickerSlot(null);
  }, []);

  const emitSlots = useCallback(
    (slots: Partial<Record<SlotId, Card>>) => {
      emit({
        type: "LIVE_INPUT",
        payload: { slots },
        source: "dealer",
      } as Parameters<Emit>[0]);
    },
    [emit],
  );

  const handleCommit = useCallback(
    (card: { rank: string; suit: string | null }) => {
      if (!pickerSlot) return;
      if (card.suit) setStickySuit(card.suit as Suit);
      const next = {
        ...liveSlots,
        [pickerSlot]: { rank: card.rank, suit: card.suit as Suit | null },
      };
      emitSlots(next);
      closePicker();

      if (autoAdvance) {
        const derived = evaluateHand(next, rules);
        if (derived.nextSlot) {
          setTimeout(() => openPicker(derived.nextSlot!), 0);
        }
      }
    },
    [pickerSlot, liveSlots, emitSlots, closePicker, autoAdvance, rules, openPicker],
  );

  const handleRemove = useCallback(() => {
    if (!pickerSlot) return;
    const next = { ...liveSlots };
    delete next[pickerSlot];
    emitSlots(next);
    closePicker();
  }, [pickerSlot, liveSlots, emitSlots, closePicker]);

  useEffect(() => {
    const prev = prevResultsCountRef.current;
    const curr = state.results.length;
    prevResultsCountRef.current = curr;

    if (autoAdvance && curr > prev) {
      setTimeout(() => openPicker("P1"), 0);
    }
  }, [state.results.length, autoAdvance, openPicker]);

  const handleQuickTap = useCallback(
    (id: string) => {
      record(
        {
          cards: null,
          outcome: id as Outcome,
          playerTotal: null,
          bankerTotal: null,
          playerPair: false,
          bankerPair: false,
          natural: false,
        },
        { quick: true },
      );
    },
    [record],
  );

  const activateQuickEntry = useCallback(
    (id: string) => {
      closePicker();
      handleQuickTap(id);
    },
    [closePicker, handleQuickTap],
  );

  const handleQuickLongPress = useCallback((id: string) => {
    setPairMenuOutcome(id as Outcome);
  }, []);

  const handlePairRecord = useCallback(
    (playerPair: boolean, bankerPair: boolean) => {
      if (!pairMenuOutcome) return;
      record(
        {
          cards: null,
          outcome: pairMenuOutcome,
          playerTotal: null,
          bankerTotal: null,
          playerPair,
          bankerPair,
          natural: false,
        },
        { quick: true },
      );
      setPairMenuOutcome(null);
    },
    [pairMenuOutcome, record],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      if (key === "P" || key === "B" || key === "T") {
        e.preventDefault();
        activateQuickEntry(key);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activateQuickEntry]);

  const slotError = (slot: SlotId): string | undefined =>
    handState.errors.find((err) => err.slot === slot)?.message;

  const renderSlot = (slot: SlotId) => {
    const card = liveSlots[slot];
    const enabled = handState.enabledSlots.includes(slot);
    const isNext = handState.nextSlot === slot;
    const isDraw = isThirdCardSlot(slot) && enabled && !card;
    const error = slotError(slot);
    const classes = [
      "dealer-view__slot",
      card ? "" : "dealer-view__slot--empty",
      isNext ? "dealer-view__slot--pulse" : "",
      !enabled ? "dealer-view__slot--disabled" : "",
      isDraw ? "dealer-view__slot--draw" : "",
      error ? "dealer-view__slot--error" : "",
      card && isRedSuit(card.suit) ? "dealer-view__slot--red" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        key={slot}
        type="button"
        class={classes}
        data-testid={`slot-${slot}`}
        aria-label={slotAriaLabel(slot, card, { enabled, isNext, isDraw })}
        disabled={!enabled}
        onClick={() => enabled && openPicker(slot)}
      >
        {isDraw && <span class="dealer-view__draw-badge">DRAW</span>}
        {card ? (
          <>
            {formatSlotCard(card)}
            <span class="dealer-view__slot-value">{cardValue(card.rank)}</span>
          </>
        ) : null}
        {error && <span class="dealer-view__error-msg">{error}</span>}
      </button>
    );
  };

  const duplicateWarning = handState.warnings[0];
  const shoeBlocked = handState.errors.find((err) => err.message.includes("Shoe limit"))?.message;

  return (
    <div class="dealer-view" data-testid="dealer-view">
      <div class="dealer-view__columns">
        <div class="dealer-view__column">
          <span class="dealer-view__side-label">PLAYER</span>
          <div class="dealer-view__slots">{PLAYER_SLOTS.map(renderSlot)}</div>
          {handState.playerTotal !== null && (
            <span class="dealer-view__total" data-testid="player-total">
              Total {handState.playerTotal}
            </span>
          )}
        </div>
        <div class="dealer-view__column">
          <span class="dealer-view__side-label">BANKER</span>
          <div class="dealer-view__slots">{BANKER_SLOTS.map(renderSlot)}</div>
          {handState.bankerTotal !== null && (
            <span class="dealer-view__total" data-testid="banker-total">
              Total {handState.bankerTotal}
            </span>
          )}
        </div>
      </div>

      <div class="dealer-view__hint" aria-live="polite" data-testid="hand-hint">
        {handState.hint}
      </div>

      <MiniBigRoad grid={state.roads.bigRoad} />

      <div class="dealer-view__quick-entry">
        <OutcomeChips
          chips={QUICK_CHIPS}
          onTap={activateQuickEntry}
          onLongPress={handleQuickLongPress}
        />
        {pairMenuOutcome && (
          <div class="dealer-view__pair-menu" data-testid="pair-menu">
            <button
              type="button"
              class="dealer-view__pair-btn"
              onClick={() => handlePairRecord(true, false)}
            >
              P pair
            </button>
            <button
              type="button"
              class="dealer-view__pair-btn"
              onClick={() => handlePairRecord(false, true)}
            >
              B pair
            </button>
            <button
              type="button"
              class="dealer-view__pair-btn"
              onClick={() => handlePairRecord(true, true)}
            >
              Both pairs
            </button>
            <button
              type="button"
              class="dealer-view__pair-btn"
              onClick={() => setPairMenuOutcome(null)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <CardPicker
        key={pickerSlot ?? "closed"}
        open={pickerOpen && pickerSlot !== null}
        title={pickerSlot ? slotTitle(pickerSlot) : ""}
        initialCard={pickerSlot ? (liveSlots[pickerSlot] ?? null) : null}
        expressMode={expressMode}
        suitRequired={rules.suitRequired}
        valueOf={(rank: string) => cardValue(rank as Rank)}
        {...(duplicateWarning ? { duplicateWarning } : {})}
        {...(shoeBlocked ? { blocked: shoeBlocked } : {})}
        stickySuit={stickySuit}
        onStickySuitChange={(suit) => setStickySuit(suit as Suit | null)}
        onCommit={handleCommit}
        onRemove={handleRemove}
        onClose={closePicker}
      />
    </div>
  );
}
