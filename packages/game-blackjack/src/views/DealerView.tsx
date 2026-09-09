import { CardPicker, OutcomeChips } from "@casino-lord/ui";
import type { PickedCard } from "@casino-lord/ui";
import type { Emit, TableMeta } from "@casino-lord/core";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { rankPoints } from "../cards.js";
import { canSplit, handValue } from "../engine.js";
import { parseQuickDealerToken } from "../quick-entry.js";
import type { BlackjackRules } from "../rules.js";
import type { BlackjackState } from "../state.js";
import type {
  BlackjackLiveInput,
  BlackjackResult,
  Card,
  HandInput,
  Rank,
  Seat,
  SeatOutcome,
  Suit,
} from "../types.js";
import { formatCardGlyph, handTotalLabel, isRedSuit } from "./card-display.js";
import "./blackjack-tokens.css";
import "./dealer-view.css";

const SEAT_OUTCOME_CHIPS = [
  { id: "win", label: "W", color: "#2BB673", ariaLabel: "Win" },
  { id: "lose", label: "L", color: "#D7263D", ariaLabel: "Lose" },
  { id: "push", label: "P", color: "#9AA0A6", ariaLabel: "Push" },
  { id: "blackjack", label: "BJ", color: "#D4AF37", ariaLabel: "Blackjack" },
  { id: "bust", label: "B", color: "#D7263D", ariaLabel: "Bust" },
  { id: "surrender", label: "R", color: "#9AA0A6", ariaLabel: "Surrender" },
];

const QUICK_DEALER_CHIPS = [
  { id: "BUST", label: "BUST", color: "#E08A1E", ariaLabel: "Quick dealer bust" },
  { id: "BJ", label: "BJ", color: "#D7263D", ariaLabel: "Quick dealer blackjack" },
  { id: "17", label: "17", color: "#EDE6D6", ariaLabel: "Quick dealer 17" },
  { id: "18", label: "18", color: "#EDE6D6", ariaLabel: "Quick dealer 18" },
  { id: "19", label: "19", color: "#EDE6D6", ariaLabel: "Quick dealer 19" },
  { id: "20", label: "20", color: "#EDE6D6", ariaLabel: "Quick dealer 20" },
  { id: "21", label: "21", color: "#EDE6D6", ariaLabel: "Quick dealer 21" },
];

const OUTCOME_MAP: Record<string, SeatOutcome> = {
  win: "win",
  lose: "lose",
  push: "push",
  blackjack: "blackjack",
  bust: "bust",
  surrender: "surrender",
};

type PickerTarget =
  | { kind: "dealer"; index: number }
  | { kind: "seat"; seat: Seat; handIndex: number; cardIndex: number };

function emptyHand(fromSplit = false): HandInput {
  return { cards: [], doubled: false, fromSplit, surrendered: false, outcome: null };
}

function toCard(picked: PickedCard): Card {
  return { rank: picked.rank as Rank, suit: (picked.suit as Suit) ?? null };
}

export interface DealerViewProps {
  state: BlackjackState;
  rules: BlackjackRules;
  table: TableMeta;
  emit: Emit;
  record: (result: BlackjackResult, opts: { quick: boolean }) => void;
  autoAdvance?: boolean;
  expressMode?: boolean;
  haptics?: boolean;
}

function tapHaptic(enabled: boolean): void {
  if (enabled && typeof navigator.vibrate === "function") {
    navigator.vibrate(10);
  }
}

export function DealerView({
  state,
  rules,
  emit,
  record,
  autoAdvance = true,
  expressMode = true,
  haptics = false,
}: DealerViewProps) {
  const { liveInput, roundEvaluation } = state;
  const [activeSeat, setActiveSeat] = useState<Seat>(1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [stickySuit, setStickySuit] = useState<Suit | null>(null);
  const prevResultsCountRef = useRef(state.rounds.length);

  const emitLive = useCallback(
    (next: BlackjackLiveInput) => {
      emit({
        type: "LIVE_INPUT",
        payload: next,
        source: "dealer",
      } as Parameters<Emit>[0]);
    },
    [emit],
  );

  const patchLive = useCallback(
    (patch: Partial<BlackjackLiveInput>) => {
      emitLive({
        dealer: patch.dealer ?? liveInput.dealer,
        seats: patch.seats ?? liveInput.seats,
        ...(patch.recordDespiteDealerError !== undefined
          ? { recordDespiteDealerError: patch.recordDespiteDealerError }
          : liveInput.recordDespiteDealerError !== undefined
            ? { recordDespiteDealerError: liveInput.recordDespiteDealerError }
            : {}),
      });
    },
    [emitLive, liveInput],
  );

  const seatHands = (seat: Seat): HandInput[] => liveInput.seats[seat] ?? [];

  const ensureSeat = useCallback(
    (seat: Seat): HandInput[] => {
      const existing = seatHands(seat);
      if (existing.length > 0) return existing;
      const seats = { ...liveInput.seats, [seat]: [emptyHand()] };
      patchLive({ seats });
      return [emptyHand()];
    },
    [liveInput.seats, patchLive],
  );

  const updateSeatHands = useCallback(
    (seat: Seat, hands: HandInput[]) => {
      patchLive({ seats: { ...liveInput.seats, [seat]: hands } });
    },
    [liveInput.seats, patchLive],
  );

  const openPicker = (target: PickerTarget) => {
    setPickerTarget(target);
    setPickerOpen(true);
  };

  const closePicker = () => {
    setPickerOpen(false);
    setPickerTarget(null);
  };

  useEffect(() => {
    const prev = prevResultsCountRef.current;
    const curr = state.rounds.length;
    prevResultsCountRef.current = curr;
    if (autoAdvance && curr > prev) {
      setTimeout(() => openPicker({ kind: "dealer", index: 0 }), 0);
    }
  }, [state.rounds.length, autoAdvance]);

  const handleUndoLast = () => {
    tapHaptic(haptics);
    if (liveInput.dealer.length > 0) {
      const index = liveInput.dealer.length - 1;
      const dealer = liveInput.dealer.slice(0, -1);
      patchLive({ dealer });
      openPicker({ kind: "dealer", index: Math.max(0, index - 1) });
      return;
    }
    for (let seat = 7; seat >= 1; seat--) {
      const s = seat as Seat;
      const hands = liveInput.seats[s];
      if (!hands?.length) continue;
      for (let hi = hands.length - 1; hi >= 0; hi--) {
        const hand = hands[hi]!;
        if (hand.cards.length > 0) {
          const cardIndex = hand.cards.length - 1;
          const nextHands = [...hands];
          const nextHand = { ...hand, cards: hand.cards.slice(0, -1) };
          nextHands[hi] = nextHand;
          patchLive({ seats: { ...liveInput.seats, [s]: nextHands } });
          openPicker({
            kind: "seat",
            seat: s,
            handIndex: hi,
            cardIndex: Math.max(0, cardIndex - 1),
          });
          return;
        }
      }
    }
  };

  const hasAnyCards =
    liveInput.dealer.length > 0 ||
    Object.values(liveInput.seats).some((hands) => hands?.some((h) => h.cards.length > 0));

  const handleCommit = (picked: PickedCard) => {
    if (!pickerTarget) return;
    tapHaptic(haptics);
    const card = toCard(picked);

    if (pickerTarget.kind === "dealer") {
      const dealer = [...liveInput.dealer];
      dealer[pickerTarget.index] = card;
      patchLive({ dealer });
    } else {
      const { seat, handIndex, cardIndex } = pickerTarget;
      const hands = [...(liveInput.seats[seat] ?? [emptyHand()])];
      const hand = { ...hands[handIndex]! };
      const cards = [...hand.cards];
      cards[cardIndex] = card;
      hand.cards = cards;
      hands[handIndex] = hand;
      updateSeatHands(seat, hands);
    }
    closePicker();
  };

  const handleRemove = () => {
    if (!pickerTarget) return;
    if (pickerTarget.kind === "dealer") {
      const dealer = liveInput.dealer.filter((_, i) => i !== pickerTarget.index);
      patchLive({ dealer });
    } else {
      const { seat, handIndex, cardIndex } = pickerTarget;
      const hands = [...(liveInput.seats[seat] ?? [])];
      const hand = { ...hands[handIndex]! };
      hand.cards = hand.cards.filter((_, i) => i !== cardIndex);
      hands[handIndex] = hand;
      updateSeatHands(seat, hands);
    }
    closePicker();
  };

  const handleOutcome = (outcomeId: string) => {
    const outcome = OUTCOME_MAP[outcomeId];
    if (!outcome) return;
    const hands = [...ensureSeat(activeSeat)];
    hands[0] = { ...hands[0]!, outcome };
    updateSeatHands(activeSeat, hands);
  };

  const handleSplit = () => {
    const hands = [...ensureSeat(activeSeat)];
    if (!canSplit(hands, rules)) return;
    const hand = hands[hands.length - 1]!;
    const [c1, c2] = hand.cards;
    if (!c1 || !c2) return;
    const splitIndex = hands.length - 1;
    hands[splitIndex] = { ...hand, cards: [c1] };
    hands.splice(splitIndex + 1, 0, {
      cards: [c2],
      doubled: false,
      fromSplit: true,
      surrendered: false,
      outcome: null,
    });
    updateSeatHands(activeSeat, hands);
  };

  const handleDouble = () => {
    const hands = [...ensureSeat(activeSeat)];
    const idx = hands.length - 1;
    hands[idx] = { ...hands[idx]!, doubled: true };
    updateSeatHands(activeSeat, hands);
  };

  const handleSurrender = () => {
    const hands = [...ensureSeat(activeSeat)];
    const idx = hands.length - 1;
    hands[idx] = { ...hands[idx]!, surrendered: true, outcome: "surrender" };
    updateSeatHands(activeSeat, hands);
  };

  const handleSitOut = () => {
    const seats = { ...liveInput.seats };
    delete seats[activeSeat];
    patchLive({ seats });
  };

  const handleQuickDealer = (id: string) => {
    const result = parseQuickDealerToken(id);
    if (result) record(result, { quick: true });
  };

  const handleOverride = () => {
    patchLive({ recordDespiteDealerError: true });
  };

  const illegalActions = roundEvaluation.dealerValidation.illegalActions;
  const showErrorBanner = illegalActions.length > 0 && liveInput.recordDespiteDealerError !== true;

  const pickerInitial = (): PickedCard | null => {
    if (!pickerTarget) return null;
    if (pickerTarget.kind === "dealer") {
      const c = liveInput.dealer[pickerTarget.index];
      return c ? { rank: c.rank, suit: c.suit } : null;
    }
    const hand = liveInput.seats[pickerTarget.seat]?.[pickerTarget.handIndex];
    const c = hand?.cards[pickerTarget.cardIndex];
    return c ? { rank: c.rank, suit: c.suit } : null;
  };

  const pickerTitle = (): string => {
    if (!pickerTarget) return "";
    if (pickerTarget.kind === "dealer") {
      return pickerTarget.index === 0
        ? "Dealer · Up card"
        : `Dealer · Card ${pickerTarget.index + 1}`;
    }
    return `Seat ${pickerTarget.seat} · Hand ${pickerTarget.handIndex + 1} · Card ${pickerTarget.cardIndex + 1}`;
  };

  const dealerSlotCount = Math.max(2, liveInput.dealer.length + 1);

  const activeHands = seatHands(activeSeat);
  const displayHands = activeHands.length > 0 ? activeHands : [];

  return (
    <div class="dealer-view" data-testid="dealer-view">
      <div>
        <div class="dealer-view__section-label">DEALER</div>
        <div class="dealer-view__dealer-slots">
          {Array.from({ length: dealerSlotCount }, (_, i) => {
            const card = liveInput.dealer[i];
            const isHolePlaceholder = i === 1 && !card && liveInput.dealer.length === 1;
            return (
              <button
                key={i}
                type="button"
                class={`dealer-view__slot${isHolePlaceholder ? " dealer-view__slot--hole" : ""}${card?.suit && isRedSuit(card.suit) ? " dealer-view__slot--red" : ""}`}
                data-testid={`dealer-slot-${i}`}
                aria-label={
                  isHolePlaceholder
                    ? "Dealer hole card, face down"
                    : card
                      ? `Dealer card ${i + 1}, ${formatCardGlyph(card)}`
                      : `Dealer card ${i + 1}, empty`
                }
                onClick={() => openPicker({ kind: "dealer", index: i })}
              >
                {!isHolePlaceholder && card ? formatCardGlyph(card) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div class="dealer-view__section-label">SEATS</div>
        <div class="dealer-view__seat-tabs">
          {Array.from({ length: rules.seats }, (_, i) => {
            const seat = (i + 1) as Seat;
            const active = seat === activeSeat;
            const hasSeat = (liveInput.seats[seat]?.length ?? 0) > 0;
            return (
              <button
                key={seat}
                type="button"
                class={`dealer-view__seat-tab${active ? " dealer-view__seat-tab--active" : ""}${!hasSeat ? " dealer-view__seat-tab--inactive" : ""}`}
                data-testid={`seat-tab-${seat}`}
                aria-label={`Seat ${seat}${hasSeat ? ", in play" : ", sit out"}`}
                aria-pressed={active}
                onClick={() => setActiveSeat(seat)}
              >
                {seat}
              </button>
            );
          })}
        </div>
      </div>

      <div class="dealer-view__seat-panel" data-testid={`seat-panel-${activeSeat}`}>
        <div class="dealer-view__section-label">Seat {activeSeat}</div>

        {rules.entryDepth === "outcomes" && (
          <OutcomeChips chips={SEAT_OUTCOME_CHIPS} onTap={handleOutcome} onLongPress={() => {}} />
        )}

        {rules.entryDepth === "full" &&
          displayHands.map((hand, hi) => {
            const hv = handValue(hand.cards, hand.fromSplit, rules.blackjackAfterSplit);
            const slotCount = Math.max(
              2,
              hand.cards.length + (hv.bust || hand.surrendered ? 0 : 1),
            );
            const { label } = handTotalLabel(hand, rules);
            return (
              <div
                class="dealer-view__hand-row"
                key={hi}
                data-testid={`seat-${activeSeat}-hand-${hi}`}
              >
                <div class="dealer-view__hand-label">
                  Hand {hi + 1} {label}
                  {hand.doubled && " ×2"}
                </div>
                <div class="dealer-view__dealer-slots">
                  {Array.from({ length: slotCount }, (_, ci) => {
                    const card = hand.cards[ci];
                    return (
                      <button
                        key={ci}
                        type="button"
                        class={`dealer-view__slot${card?.suit && isRedSuit(card.suit) ? " dealer-view__slot--red" : ""}`}
                        data-testid={`seat-${activeSeat}-hand-${hi}-slot-${ci}`}
                        aria-label={
                          card
                            ? `Seat ${activeSeat} hand ${hi + 1} card ${ci + 1}, ${formatCardGlyph(card)}`
                            : `Seat ${activeSeat} hand ${hi + 1} card ${ci + 1}, empty`
                        }
                        onClick={() =>
                          openPicker({
                            kind: "seat",
                            seat: activeSeat,
                            handIndex: hi,
                            cardIndex: ci,
                          })
                        }
                      >
                        {card ? formatCardGlyph(card) : "+"}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

        {rules.entryDepth === "full" && displayHands.length === 0 && (
          <button
            type="button"
            class="dealer-view__action"
            onClick={() => updateSeatHands(activeSeat, [emptyHand()])}
          >
            Add hand
          </button>
        )}

        {rules.entryDepth === "full" && displayHands.length > 0 && (
          <div class="dealer-view__actions">
            <button
              type="button"
              class="dealer-view__action"
              data-testid="action-split"
              disabled={!canSplit(displayHands, rules)}
              onClick={handleSplit}
            >
              Split
            </button>
            <button
              type="button"
              class="dealer-view__action"
              data-testid="action-double"
              onClick={handleDouble}
            >
              Double
            </button>
            <button
              type="button"
              class="dealer-view__action"
              data-testid="action-surrender"
              onClick={handleSurrender}
            >
              Surrender
            </button>
            <button type="button" class="dealer-view__action" onClick={handleSitOut}>
              Sit out
            </button>
          </div>
        )}

        {rules.entryDepth === "outcomes" && (
          <button type="button" class="dealer-view__action" onClick={handleSitOut}>
            Sit out
          </button>
        )}
      </div>

      <div class="dealer-view__hint" aria-live="polite" data-testid="round-hint">
        {roundEvaluation.hint}
      </div>

      {showErrorBanner && (
        <div class="dealer-view__error-banner" data-testid="dealer-error-banner" role="alert">
          <ul class="dealer-view__error-list">
            {illegalActions.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
          <button
            type="button"
            class="dealer-view__override-btn"
            data-testid="dealer-error-override"
            onClick={handleOverride}
          >
            Dealer error — record anyway
          </button>
        </div>
      )}

      <div class="dealer-view__quick-entry">
        <OutcomeChips chips={QUICK_DEALER_CHIPS} onTap={handleQuickDealer} onLongPress={() => {}} />
      </div>

      <CardPicker
        key={pickerTarget ? JSON.stringify(pickerTarget) : "closed"}
        open={pickerOpen && pickerTarget !== null}
        title={pickerTitle()}
        initialCard={pickerInitial()}
        expressMode={expressMode}
        suitRequired={true}
        valueOf={(rank: string) => rankPoints(rank as Rank)}
        stickySuit={stickySuit}
        onStickySuitChange={(suit) => setStickySuit(suit as Suit | null)}
        onCommit={handleCommit}
        onRemove={handleRemove}
        {...(hasAnyCards ? { onUndoLast: handleUndoLast } : {})}
        onClose={closePicker}
      />
    </div>
  );
}
