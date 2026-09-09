import { cardValue, findDuplicateCards, totalValue } from "./cards.js";
import type { BaccaratRules } from "./rules.js";
import type { Card, HandError, HandState, Outcome, SlotId } from "./types.js";
import { ShoeTracker } from "./shoe-tracker.js";

const DEAL_ORDER: SlotId[] = ["P1", "B1", "P2", "B2", "P3", "B3"];

export function bankerDraws(bankerTotal: number, playerThirdValue: number | null): boolean {
  if (playerThirdValue === null) {
    return bankerTotal <= 5;
  }

  switch (bankerTotal) {
    case 0:
    case 1:
    case 2:
      return true;
    case 3:
      return playerThirdValue !== 8;
    case 4:
      return playerThirdValue >= 2 && playerThirdValue <= 7;
    case 5:
      return playerThirdValue >= 4 && playerThirdValue <= 7;
    case 6:
      return playerThirdValue === 6 || playerThirdValue === 7;
    default:
      return false;
  }
}

export interface EvaluateHandOptions {
  shoeTracker?: ShoeTracker;
}

export function evaluateHand(
  slots: Partial<Record<SlotId, Card>>,
  rules: BaccaratRules,
  options: EvaluateHandOptions = {},
): HandState {
  const warnings = findDuplicateCards(slots);
  const errors: HandError[] = [];

  if (rules.suitRequired) {
    for (const [slot, card] of Object.entries(slots) as [SlotId, Card][]) {
      if (card && card.suit === null) {
        errors.push({ slot, message: "Suit required" });
      }
    }
  }

  const shoeErrors = options.shoeTracker?.addFromSlots(slots) ?? [];
  for (const message of shoeErrors) {
    errors.push({ slot: "P1", message });
  }

  const filled = (slot: SlotId): Card | undefined => slots[slot];
  const has = (slot: SlotId): boolean => filled(slot) !== undefined;

  const playerCards = (): Card[] =>
    [filled("P1"), filled("P2"), filled("P3")].filter(Boolean) as Card[];
  const bankerCards = (): Card[] =>
    [filled("B1"), filled("B2"), filled("B3")].filter(Boolean) as Card[];

  const nextEmptyInOrder = (): SlotId | null => {
    for (const slot of DEAL_ORDER) {
      if (!has(slot)) return slot;
    }
    return null;
  };

  if (!has("P1")) {
    return baseState({
      status: "awaiting_cards",
      nextSlot: "P1",
      enabledSlots: ["P1", "B1", "P2", "B2"],
      hint: "Deal Player card 1",
      errors,
      warnings,
    });
  }

  if (!has("B1")) {
    return baseState({
      status: "awaiting_cards",
      nextSlot: "B1",
      enabledSlots: enabledUpTo("B1", slots),
      hint: "Deal Banker card 1",
      playerTotal: totalValue([filled("P1")!]),
      errors,
      warnings,
    });
  }

  if (!has("P2")) {
    return baseState({
      status: "awaiting_cards",
      nextSlot: "P2",
      enabledSlots: enabledUpTo("P2", slots),
      hint: "Deal Player card 2",
      playerTotal: totalValue([filled("P1")!]),
      bankerTotal: totalValue([filled("B1")!]),
      errors,
      warnings,
    });
  }

  if (!has("B2")) {
    return baseState({
      status: "awaiting_cards",
      nextSlot: "B2",
      enabledSlots: enabledUpTo("B2", slots),
      hint: "Deal Banker card 2",
      playerTotal: totalValue([filled("P1")!, filled("P2")!]),
      bankerTotal: totalValue([filled("B1")!]),
      errors,
      warnings,
    });
  }

  const pTotal2 = totalValue([filled("P1")!, filled("P2")!]);
  const bTotal2 = totalValue([filled("B1")!, filled("B2")!]);
  const playerNatural = pTotal2 >= 8;
  const bankerNatural = bTotal2 >= 8;
  const playerPair = filled("P1")!.rank === filled("P2")!.rank;
  const bankerPair = filled("B1")!.rank === filled("B2")!.rank;

  if (playerNatural || bankerNatural) {
    validateNoThirdCards(slots, errors);
    const outcome = resolveOutcome(pTotal2, bTotal2);
    const hint = buildNaturalHint(playerNatural, bankerNatural, pTotal2, bTotal2, outcome);
    return baseState({
      status: errors.length > 0 ? "invalid" : "complete",
      nextSlot: null,
      enabledSlots: [],
      playerTotal: pTotal2,
      bankerTotal: bTotal2,
      outcome,
      playerPair,
      bankerPair,
      playerNatural,
      bankerNatural,
      hint,
      errors,
      warnings,
    });
  }

  const playerDraws = pTotal2 <= 5;

  if (playerDraws) {
    if (!has("P3")) {
      return baseState({
        status: "needs_player_third",
        nextSlot: "P3",
        enabledSlots: ["P3"],
        playerTotal: pTotal2,
        bankerTotal: bTotal2,
        playerPair,
        bankerPair,
        hint: `Player ${pTotal2} · Banker ${bTotal2} — Player draws`,
        errors,
        warnings,
      });
    }
  } else if (has("P3")) {
    errors.push({ slot: "P3", message: "Not allowed by rules — remove?" });
  }

  const pTotal = playerDraws ? totalValue(playerCards()) : pTotal2;
  const p3Value = has("P3") ? cardValue(filled("P3")!.rank) : null;
  const bankerShouldDraw = bankerDraws(bTotal2, playerDraws ? p3Value : null);

  if (bankerShouldDraw) {
    if (!has("B3")) {
      const hint = has("P3")
        ? `Player drew ${cardValue(filled("P3")!.rank)} (total ${pTotal}) · Banker ${bTotal2} — Banker draws`
        : `Player ${pTotal} · Banker ${bTotal2} — Banker draws`;
      return baseState({
        status: "needs_banker_third",
        nextSlot: "B3",
        enabledSlots: ["B3"],
        playerTotal: pTotal,
        bankerTotal: bTotal2,
        playerPair,
        bankerPair,
        hint,
        errors,
        warnings,
      });
    }
  } else if (has("B3")) {
    errors.push({ slot: "B3", message: "Not allowed by rules — remove?" });
  }

  const bTotal = bankerShouldDraw ? totalValue(bankerCards()) : bTotal2;
  const outcome = resolveOutcome(pTotal, bTotal);
  const hint = buildCompleteHint(outcome, pTotal, bTotal);

  return baseState({
    status: errors.length > 0 ? "invalid" : "complete",
    nextSlot: null,
    enabledSlots: [],
    playerTotal: pTotal,
    bankerTotal: bTotal,
    outcome,
    playerPair,
    bankerPair,
    playerNatural: false,
    bankerNatural: false,
    hint,
    errors,
    warnings,
  });
}

function enabledUpTo(until: SlotId, slots: Partial<Record<SlotId, Card>>): SlotId[] {
  const result: SlotId[] = [];
  for (const slot of DEAL_ORDER) {
    if (!slots[slot]) result.push(slot);
    if (slot === until) break;
  }
  return result;
}

function validateNoThirdCards(slots: Partial<Record<SlotId, Card>>, errors: HandError[]): void {
  if (slots.P3) errors.push({ slot: "P3", message: "Not allowed by rules — remove?" });
  if (slots.B3) errors.push({ slot: "B3", message: "Not allowed by rules — remove?" });
}

function resolveOutcome(pTotal: number, bTotal: number): Outcome {
  if (pTotal > bTotal) return "P";
  if (bTotal > pTotal) return "B";
  return "T";
}

function buildNaturalHint(
  playerNatural: boolean,
  bankerNatural: boolean,
  pTotal: number,
  bTotal: number,
  outcome: Outcome,
): string {
  if (playerNatural && !bankerNatural) return `Player NATURAL ${pTotal} — no more cards`;
  if (bankerNatural && !playerNatural) return `Banker NATURAL ${bTotal} — no more cards`;
  if (playerNatural && bankerNatural) {
    return `Hand complete — ${outcomeLabel(outcome)} ${Math.max(pTotal, bTotal)} to ${Math.min(pTotal, bTotal)}`;
  }
  return `Hand complete — ${outcomeLabel(outcome)} wins ${outcome === "P" ? pTotal : bTotal} to ${outcome === "P" ? bTotal : pTotal}`;
}

function buildCompleteHint(outcome: Outcome, pTotal: number, bTotal: number): string {
  return `Hand complete — ${outcomeLabel(outcome)} wins ${outcome === "P" ? pTotal : outcome === "B" ? bTotal : pTotal} to ${outcome === "P" ? bTotal : outcome === "B" ? pTotal : bTotal}`;
}

function outcomeLabel(outcome: Outcome): string {
  switch (outcome) {
    case "P":
      return "PLAYER";
    case "B":
      return "BANKER";
    case "T":
      return "TIE";
  }
}

interface BaseStateInput {
  status: HandState["status"];
  nextSlot: SlotId | null;
  enabledSlots: SlotId[];
  playerTotal?: number | null;
  bankerTotal?: number | null;
  outcome?: Outcome | null;
  playerPair?: boolean;
  bankerPair?: boolean;
  playerNatural?: boolean;
  bankerNatural?: boolean;
  hint: string;
  errors: HandError[];
  warnings: string[];
}

function baseState(input: BaseStateInput): HandState {
  return {
    status: input.status,
    nextSlot: input.nextSlot,
    enabledSlots: input.enabledSlots,
    playerTotal: input.playerTotal ?? null,
    bankerTotal: input.bankerTotal ?? null,
    outcome: input.outcome ?? null,
    playerPair: input.playerPair ?? false,
    bankerPair: input.bankerPair ?? false,
    playerNatural: input.playerNatural ?? false,
    bankerNatural: input.bankerNatural ?? false,
    hint: input.hint,
    errors: input.errors,
    warnings: input.warnings,
  };
}

export function slotsFromHands(
  playerCards: Card[],
  bankerCards: Card[],
): Partial<Record<SlotId, Card>> {
  const slots: Partial<Record<SlotId, Card>> = {};
  if (playerCards[0]) slots.P1 = playerCards[0];
  if (bankerCards[0]) slots.B1 = bankerCards[0];
  if (playerCards[1]) slots.P2 = playerCards[1];
  if (bankerCards[1]) slots.B2 = bankerCards[1];
  if (playerCards[2]) slots.P3 = playerCards[2];
  if (bankerCards[2]) slots.B3 = bankerCards[2];
  return slots;
}
